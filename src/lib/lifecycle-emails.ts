import { getInsForgeAdmin } from "@/lib/insforge";
import { adminSql } from "@/lib/admin-log";
import { getResend, FROM_EMAIL, REPLY_TO_EMAIL } from "@/lib/resend";

/**
 * Account lifecycle emails: payment declined, trial ending soon, trial ended.
 * Each is sent at most once per event, keyed in `email_log` by
 * (user, kind, ref) — so a retried webhook or a re-run of the daily job never
 * sends the same email twice.
 */

export type LifecycleKind = "payment_declined" | "trial_ending" | "trial_ended";

const HOUR = 3_600_000;

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://myprofitpulse.app";
}

/** Dates in the customer-facing emails are shown in Bermuda time. */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "Atlantic/Bermuda",
  });
}

function money(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Shared layout, matching the weekly summary's look. */
export function emailShell(args: {
  heading: string;
  paragraphs: string[];
  buttonLabel: string;
  buttonHref: string;
  footnote?: string;
}): string {
  const body = args.paragraphs
    .map((p) => `<p style="color:#2D2A26;font-size:15px;line-height:1.6;margin:0 0 14px;">${p}</p>`)
    .join("");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F5F3F0;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:28px;border:1px solid #E8E4E0;">
      <h1 style="font-family:Georgia,serif;color:#2D2A26;font-size:22px;font-weight:normal;margin:0 0 16px;">${args.heading}</h1>
      ${body}
      <p style="margin:24px 0 8px;">
        <a href="${args.buttonHref}" style="display:inline-block;background:#E65100;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-size:15px;">${args.buttonLabel}</a>
      </p>
      ${args.footnote ? `<p style="color:#6B6560;font-size:13px;line-height:1.5;margin:18px 0 0;">${args.footnote}</p>` : ""}
    </div>
    <p style="color:#9A948E;font-size:12px;text-align:center;margin:16px 0 0;">MyProfitPulse &middot; Questions? Just reply to this email.</p>
  </div>
</body></html>`;
}

export function paymentDeclinedEmail(amount: number | null) {
  const what = amount ? `${money(amount)} payment` : "payment";
  return {
    subject: "Your MyProfitPulse payment didn't go through",
    html: emailShell({
      heading: `Your ${what} didn't go through`,
      paragraphs: [
        `We tried to charge your card for your MyProfitPulse subscription, but it was declined.`,
        `You can keep using MyProfitPulse for the next 3 days. To keep your access, try your card again or use a different one. It only takes a minute.`,
      ],
      buttonLabel: "Fix my payment",
      buttonHref: `${appUrl()}/billing`,
      footnote: "You'll be asked to log in first. Your card details go straight to our secure payment processor.",
    }),
  };
}

export function trialEndingEmail(trialEnd: string) {
  const hoursLeft = (new Date(trialEnd).getTime() - Date.now()) / HOUR;
  const when = hoursLeft <= 30 ? "tomorrow" : "in 2 days";
  return {
    subject: `Your MyProfitPulse trial ends ${when}`,
    html: emailShell({
      heading: `Your free trial ends ${when}`,
      paragraphs: [
        `Your MyProfitPulse trial ends on ${formatDay(trialEnd)}.`,
        `Subscribe to keep your dashboard, your health score, and the numbers you've uploaded, and to keep getting your weekly summary.`,
      ],
      buttonLabel: "Choose a plan",
      buttonHref: `${appUrl()}/pricing`,
    }),
  };
}

export function trialEndedEmail() {
  return {
    subject: "Your MyProfitPulse trial has ended",
    html: emailShell({
      heading: "Your free trial has ended",
      paragraphs: [
        "Thanks for trying MyProfitPulse. Your trial has ended, but everything you set up is saved.",
        "Subscribe anytime to pick up right where you left off.",
      ],
      buttonLabel: "Choose a plan",
      buttonHref: `${appUrl()}/pricing`,
    }),
  };
}

/** The account's email, or null for deleted/unknown accounts. */
export async function getUserEmail(userId: string): Promise<string | null> {
  const rows = await adminSql<{ email: string }>("SELECT email FROM auth.users WHERE id = $1", [userId]);
  const email = rows?.[0]?.email ?? null;
  return email && !email.endsWith("@deleted.invalid") ? email : null;
}

/**
 * Send an email once per (user, kind, ref). Claims the log row first so two
 * concurrent runs can't both send; releases it if the send fails so the next
 * run retries. Never throws. Returns true when this call sent the email.
 */
export async function sendLifecycleEmailOnce(args: {
  userId: string;
  kind: LifecycleKind;
  ref: string;
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const db = getInsForgeAdmin().database;
  try {
    const { error: claimError } = await db
      .from("email_log")
      .insert([{ user_id: args.userId, kind: args.kind, ref: args.ref }]);
    if (claimError) return false; // already sent (unique key) or log unavailable

    try {
      await getResend().emails.send({
        from: FROM_EMAIL,
        replyTo: REPLY_TO_EMAIL,
        to: args.to,
        subject: args.subject,
        html: args.html,
      });
      return true;
    } catch (err) {
      console.error(`[lifecycle-email] ${args.kind} send failed for ${args.userId}:`, err);
      await db
        .from("email_log")
        .delete()
        .eq("user_id", args.userId)
        .eq("kind", args.kind)
        .eq("ref", args.ref);
      return false;
    }
  } catch (err) {
    console.error(`[lifecycle-email] ${args.kind} failed for ${args.userId}:`, err);
    return false;
  }
}

/** Email a customer that a renewal was declined (once per declined charge). */
export async function notifyPaymentDeclined(
  userId: string,
  transId: string,
  amount: number | null
): Promise<void> {
  const to = await getUserEmail(userId);
  if (!to) return;
  const { subject, html } = paymentDeclinedEmail(amount);
  await sendLifecycleEmailOnce({ userId, kind: "payment_declined", ref: transId, to, subject, html });
}

/**
 * Daily: "trial ends in 2 days" (0–60 hours left) and "trial ended" (ended in
 * the last 3 days and still not subscribed). Keyed on the trial end date, so
 * an extended trial gets a fresh reminder for its new end.
 */
export async function sendTrialEmails(): Promise<{ ending: number; ended: number }> {
  const sent = { ending: 0, ended: 0 };
  const { data: trials, error } = await getInsForgeAdmin()
    .database.from("subscriptions")
    .select("user_id, trial_end_date")
    .eq("subscription_status", "trial")
    .not("trial_end_date", "is", null);
  if (error || !trials) {
    console.error("[lifecycle-email] couldn't load trials:", error);
    return sent;
  }

  const now = Date.now();
  for (const t of trials as { user_id: string; trial_end_date: string }[]) {
    const hoursLeft = (new Date(t.trial_end_date).getTime() - now) / HOUR;
    let kind: LifecycleKind | null = null;
    if (hoursLeft > 0 && hoursLeft <= 60) kind = "trial_ending";
    else if (hoursLeft <= 0 && hoursLeft > -72) kind = "trial_ended";
    if (!kind) continue;

    const to = await getUserEmail(t.user_id);
    if (!to) continue;
    const { subject, html } = kind === "trial_ending" ? trialEndingEmail(t.trial_end_date) : trialEndedEmail();
    const didSend = await sendLifecycleEmailOnce({
      userId: t.user_id,
      kind,
      ref: t.trial_end_date,
      to,
      subject,
      html,
    });
    if (didSend) sent[kind === "trial_ending" ? "ending" : "ended"]++;
  }
  return sent;
}
