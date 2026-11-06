import { adminSql } from "@/lib/admin-log";
import { getInsForgeAdmin } from "@/lib/insforge";
import { TRIAL_DAYS } from "@/lib/trial";
import {
  buildGhlCancelPayload,
  buildGhlPurchasePayload,
  buildGhlTrialUpdatedPayload,
  isGhlWebhookConfigured,
  postGhlEvent,
  type GhlCancelReason,
  type GhlContact,
  type GhlPurchaseInput,
} from "@/lib/ghl";

/**
 * Account lifecycle events pushed to Go High Level (purchase, trial update,
 * cancellation). Each sender is safe to call from a payment or admin request:
 * it returns without any lookup when its webhook env var is unset, never
 * throws, and is bounded by the short timeout in postGhlEvent.
 */

/** Email and display name for an account, or null for deleted/unknown ones. */
export async function getGhlContact(
  userId: string,
  fallbackName = ""
): Promise<GhlContact | null> {
  const rows = await adminSql<{ email: string | null; name: string | null }>(
    "SELECT email, profile->>'name' AS name FROM auth.users WHERE id = $1",
    [userId]
  );
  const email = rows?.[0]?.email;
  if (!email || email.endsWith("@deleted.invalid")) return null;
  return { email, fullName: rows?.[0]?.name?.trim() || fallbackName };
}

async function sendEvent(
  envVar: Parameters<typeof postGhlEvent>[0],
  label: string,
  userId: string,
  fallbackName: string,
  buildPayload: (contact: GhlContact) => object
): Promise<void> {
  if (!isGhlWebhookConfigured(envVar)) return;
  try {
    const contact = await getGhlContact(userId, fallbackName);
    if (!contact) {
      console.warn(`[ghl] ${label} skipped: no email found for account`);
      return;
    }
    await postGhlEvent(envVar, label, buildPayload(contact));
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown error";
    console.error(`[ghl] ${label} failed (${reason})`);
  }
}

/** A subscription payment just succeeded and a new subscription started. */
export function sendGhlPurchaseEvent(
  userId: string,
  purchase: Omit<GhlPurchaseInput, keyof GhlContact>,
  fallbackName = ""
): Promise<void> {
  return sendEvent("GHL_PURCHASE_WEBHOOK_URL", "purchase", userId, fallbackName, (contact) =>
    buildGhlPurchasePayload({ ...contact, ...purchase })
  );
}

/** An admin changed the user's trial_end_date. */
export function sendGhlTrialUpdatedEvent(
  userId: string,
  trialEndDate: Date | string
): Promise<void> {
  return sendEvent("GHL_TRIAL_UPDATE_WEBHOOK_URL", "trial update", userId, "", (contact) =>
    buildGhlTrialUpdatedPayload({ ...contact, trialEndDate })
  );
}

/**
 * Cancellation dedupe. Authorize.net's cancel/terminate webhook does not say
 * who cancelled, and it also fires when our own code cancels a subscription
 * (user cancel, admin cancel, plan switch). So every cancel is claimed once per
 * Authorize.net subscription id in email_log (unique on user, kind, ref):
 * whoever claims first decides what happens, and the webhook only reports a
 * cancel nobody claimed. Our own flows claim BEFORE they call Authorize.net,
 * so the webhook can never win the race against them.
 */
const CANCEL_CLAIM_KIND = "ghl_subscription_cancelled";

/** True if this call claimed the subscription id; false if already claimed or the log is unavailable. */
export async function claimGhlCancel(userId: string, subscriptionId: string): Promise<boolean> {
  try {
    const { error } = await getInsForgeAdmin()
      .database.from("email_log")
      .insert([{ user_id: userId, kind: CANCEL_CLAIM_KIND, ref: subscriptionId }]);
    return !error;
  } catch {
    return false;
  }
}

/** Undo a claim so a later event for the same subscription can still be reported. */
export async function releaseGhlCancelClaim(userId: string, subscriptionId: string): Promise<void> {
  try {
    await getInsForgeAdmin()
      .database.from("email_log")
      .delete()
      .eq("user_id", userId)
      .eq("kind", CANCEL_CLAIM_KIND)
      .eq("ref", subscriptionId);
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown error";
    console.error(`[ghl] could not release cancellation claim (${reason})`);
  }
}

/**
 * Claim `subscriptionId` without reporting it: used when our own code cancels a
 * subscription that is being replaced (plan switch), so the webhook stays quiet.
 * Skipped when GHL_CANCEL_WEBHOOK_URL is unset. Returns true if a claim was made
 * (the caller should release it if the cancel then fails).
 */
export async function suppressGhlCancel(userId: string, subscriptionId: string): Promise<boolean> {
  if (!isGhlWebhookConfigured("GHL_CANCEL_WEBHOOK_URL")) return false;
  return claimGhlCancel(userId, subscriptionId);
}

/** Send subscription_cancelled for a claim this caller already holds. */
export function sendGhlCancelEvent(
  userId: string,
  subscriptionId: string,
  cancelledAt: Date | string,
  reason: GhlCancelReason
): Promise<void> {
  return sendEvent("GHL_CANCEL_WEBHOOK_URL", "cancellation", userId, "", (contact) =>
    buildGhlCancelPayload({ ...contact, subscriptionId, cancelledAt, reason })
  );
}

/**
 * Report a cancel seen by the Authorize.net webhook, unless our own flow
 * already claimed it (user/admin cancel, plan switch) or it was reported before
 * (webhook redelivery, cancelled-then-terminated).
 */
export async function reportAuthnetCancel(
  userId: string,
  subscriptionId: string,
  reason: Extract<GhlCancelReason, "authnet_cancel" | "authnet_terminated">,
  cancelledAt: Date | string
): Promise<void> {
  if (!isGhlWebhookConfigured("GHL_CANCEL_WEBHOOK_URL")) return;
  if (!(await claimGhlCancel(userId, subscriptionId))) return;
  await sendGhlCancelEvent(userId, subscriptionId, cancelledAt, reason);
}

/**
 * Trial end date to put on the sign-up payload, as ISO 8601, or null when the
 * account gets no trial (emails on the comped allowlist skip it).
 *
 * The trial row is only created by /api/auth/start-trial, which runs on first
 * signed-in load — after email verification, so usually after this is called.
 * If a row already exists its real date is used; otherwise this is the date the
 * trial will end if it starts now (now + TRIAL_DAYS).
 */
export async function getSignupTrialEndDate(email: string): Promise<string | null> {
  const comped = await adminSql(
    "SELECT 1 FROM comped_emails WHERE email = lower($1) AND claimed_at IS NULL",
    [email]
  );
  if (comped && comped.length > 0) return null;

  const rows = await adminSql<{ trial_end_date: string | null }>(
    `SELECT s.trial_end_date FROM subscriptions s
     JOIN auth.users u ON u.id = s.user_id
     WHERE lower(u.email) = lower($1)`,
    [email]
  );
  const existing = rows?.[0]?.trial_end_date;
  if (existing) return new Date(existing).toISOString();

  const estimate = new Date();
  estimate.setDate(estimate.getDate() + TRIAL_DAYS);
  return estimate.toISOString();
}
