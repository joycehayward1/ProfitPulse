"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useToast } from "@/components/ui";
import type { AccessSummary } from "@/lib/feature-gate";
import type { Subscription } from "@/lib/database.types";
import {
  COMP_CHOICES,
  GRANT_CHOICES,
  TRIAL_CHOICES,
  accessLine,
  describeAction,
  displayName,
  formatDate,
  formatMoney,
  formatMonth,
  getAuthHeaders,
  initials,
  type AdminAction,
  type AdminUser,
  type GrantDuration,
} from "./admin-utils";

interface UserDetail {
  user: {
    id: string;
    email: string;
    email_verified: boolean;
    joined: string;
    name: string | null;
    business_name: string | null;
    industry: string | null;
  };
  subscription: Subscription | null;
  access: AccessSummary;
  arb: { id: string; status: string; lastChargeAt: string | null; error?: string } | null;
  card: {
    cardType: string | null;
    last4: string | null;
    expiration: string | null;
    billingName: string | null;
    billingZip: string | null;
    error?: string;
  } | null;
  payments: {
    id: string;
    anet_transaction_id: string | null;
    type: string;
    amount: number;
    status: string;
    description: string;
    created_at: string;
  }[];
  actions: AdminAction[];
  onboarding: {
    self_assessment_at: string | null;
    health_score: number | null;
    data_months: number;
    first_month: string | null;
    latest_month: string | null;
  };
}

type SupportAction = "password_reset" | "resend_verification";

export type BillingActionName =
  | "retry_payment"
  | "cancel_subscription"
  | "switch_plan"
  | "refund_payment"
  | "send_update_card_link";

/** A billing action for the page to confirm and run against /api/admin/billing. */
export interface BillingRequest {
  title: string;
  message: string;
  confirmLabel: string;
  successMessage: string;
  body: { action: BillingActionName; target?: string; paymentId?: string };
}

/** "Visa ending 4304" from Authorize.net's masked card. */
function cardLabel(card: UserDetail["card"]): string {
  if (!card?.last4) return "their card on file";
  return `${card.cardType ?? "Card"} ending ${card.last4}`;
}

/** Months until a YYYY-MM card expiry (negative once it has expired). */
function monthsUntilExpiry(expiration: string | null): number | null {
  if (!expiration) return null;
  const [y, m] = expiration.split("-").map(Number);
  const now = new Date();
  return (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1));
}

/** Green = can use the app, amber = trial, red = payment problem, grey = otherwise locked. */
export function statusDot(access: AccessSummary): string {
  if (["past_due", "grace", "lapsed"].includes(access.reason)) return "bg-error";
  if (access.level === "full") return "bg-success";
  if (access.level === "trial") return "bg-warning";
  return "bg-border-strong";
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-1.5">
      <dt className="text-[13px] text-text-muted">{label}</dt>
      <dd className="text-[14px] text-text-primary text-right">{children}</dd>
    </div>
  );
}

function Block({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-4 border-t border-border-light first:border-t-0">
      <h3 className="text-[15px] font-semibold text-text-primary">{title}</h3>
      {hint && <p className="text-[13px] text-text-muted mt-0.5">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Choice({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-full border border-border text-[13px] font-medium text-text-secondary bg-surface hover:border-orange hover:text-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-secondary disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

interface DrawerProps {
  user: AdminUser;
  /** Bumped by the page after an action so the drawer re-fetches. */
  version: number;
  busy: boolean;
  onClose: () => void;
  onGrant: (u: AdminUser, duration: GrantDuration) => void;
  onComp: (u: AdminUser, days: number, label: string) => void;
  onTrial: (u: AdminUser, days: number | "custom") => void;
  onBilling: (u: AdminUser, request: BillingRequest) => void;
}

export function UserDetailDrawer({
  user,
  version,
  busy,
  onClose,
  onGrant,
  onComp,
  onTrial,
  onBilling,
}: DrawerProps) {
  const { showToast } = useToast();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingSupport, setPendingSupport] = useState<SupportAction | null>(null);
  const [sending, setSending] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        showToast("error", "Your session expired. Sign in again to continue.");
        return;
      }
      const res = await fetch(`/api/admin/users/${user.id}`, { headers });
      if (res.ok) {
        setDetail(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", data.error || "Couldn't load this person's details.");
      }
    } catch {
      showToast("error", "Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [user.id, showToast]);

  useEffect(() => {
    load();
  }, [load, version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function sendSupport(action: SupportAction) {
    setSending(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        showToast("error", "Your session expired. Sign in again to continue.");
        return;
      }
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(
          "success",
          action === "password_reset"
            ? `Reset code sent to ${data.email}. Share the "enter code" link below with them.`
            : `Verification code sent to ${data.email}. They enter it after logging in.`
        );
        if (action === "password_reset") setResetSentTo(data.email);
        setPendingSupport(null);
        await load();
      } else {
        showToast("error", data.error || "The email didn't send. Try again.");
      }
    } catch {
      showToast("error", "Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  const access = detail?.access ?? user.access;
  const sub = detail?.subscription;
  const paying = access.reason === "paid" || access.reason === "grace";
  // A live Authorize.net subscription must be canceled before granting free Pro.
  const liveBilling = detail?.arb?.status === "active" || detail?.arb?.status === "suspended";
  const blockGrant = paying || liveBilling;
  const fullAccess = access.level === "full";
  // Free days extend paid time, so they need a subscription that has had some.
  const canComp = Boolean(sub && sub.subscription_status !== "trial" && sub.current_period_end);

  const arbMismatch =
    detail?.arb &&
    sub &&
    detail.arb.status !== "unknown" &&
    !(
      (detail.arb.status === "active" &&
        ["active", "past_due", "canceled"].includes(sub.subscription_status)) ||
      (detail.arb.status === "suspended" && sub.subscription_status === "past_due") ||
      (["canceled", "terminated", "expired"].includes(detail.arb.status) &&
        ["canceled", "terminated", "expired"].includes(sub.subscription_status))
    );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#1C1917]/30 backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${displayName(user)}`}
    >
      <aside
        className="h-full w-full max-w-[520px] bg-surface shadow-overlay overflow-y-auto animate-[drawerIn_220ms_ease-out] motion-reduce:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes drawerIn{from{transform:translateX(24px);opacity:.6}to{transform:none;opacity:1}}`}</style>

        {/* Header */}
        <header className="px-6 pt-6 pb-5 bg-background border-b border-border-light">
          <div className="flex items-start justify-between gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-subtle text-orange flex items-center justify-center text-[15px] font-semibold">
              {initials(user)}
            </div>
            <button
              onClick={onClose}
              className="p-2 -m-2 rounded-lg text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
              aria-label="Close"
            >
              <Icon icon="ph:x" className="w-5 h-5" />
            </button>
          </div>
          <h2 className="font-display text-[28px] leading-tight text-text-primary mt-3">
            {displayName(user)}
          </h2>
          <p className="text-[14px] text-text-muted mt-1">
            {user.email}
            {user.business_name ? `, ${user.business_name}` : ""}
          </p>
          <p className="mt-3 inline-flex items-center gap-2 text-[15px] font-medium text-text-primary">
            <span className={`w-2 h-2 rounded-full ${statusDot(access)}`} />
            {accessLine(access)}
          </p>
        </header>

        <div className="px-6 pb-8">
          {/* Access actions */}
          <Block
            title="Give free Pro"
            hint={
              paying
                ? "They're a paying subscriber. Add free days below instead, so their billing isn't touched."
                : liveBilling
                ? "Their Authorize.net subscription is still set to charge their card. Add free days instead, or cancel it in Authorize.net first."
                : "Replaces any trial or earlier grant. Their card is never charged."
            }
          >
            <div className="flex flex-wrap gap-2">
              {GRANT_CHOICES.map((c) => (
                <Choice key={c.value} disabled={busy || blockGrant} onClick={() => onGrant(user, c.value)}>
                  {c.label}
                </Choice>
              ))}
              <Choice disabled={busy || blockGrant} onClick={() => onGrant(user, "custom")}>
                Until a date…
              </Choice>
            </div>
          </Block>

          <Block
            title="Add free days"
            hint={
              canComp
                ? "Added after their paid time ends, or from today if it already has. Billing keeps running as normal."
                : "Only for people who've had paid or granted time. For a trial, extend it below."
            }
          >
            <div className="flex flex-wrap gap-2">
              {COMP_CHOICES.map((c) => (
                <Choice key={c.days} disabled={busy || !canComp} onClick={() => onComp(user, c.days, c.label)}>
                  {c.label}
                </Choice>
              ))}
            </div>
            {sub?.comp_days ? (
              <p className="text-[13px] text-text-muted mt-2">
                They have {sub.comp_days} free days so far.
              </p>
            ) : null}
          </Block>

          <Block
            title="Extend their trial"
            hint={
              fullAccess
                ? "They already have full access, so a trial doesn't apply."
                : access.level === "trial"
                ? "Adds days to the trial they're on."
                : "Starts a new trial from today."
            }
          >
            <div className="flex flex-wrap gap-2">
              {TRIAL_CHOICES.map((d) => (
                <Choice key={d} disabled={busy || fullAccess} onClick={() => onTrial(user, d)}>
                  {d} days
                </Choice>
              ))}
              <Choice disabled={busy || fullAccess} onClick={() => onTrial(user, "custom")}>
                Other…
              </Choice>
            </div>
          </Block>

          <Block
            title="Help them sign in"
            hint={
              resetSentTo
                ? undefined
                : "Emails come from MyProfitPulse with a sign-in code."
            }
          >
            {pendingSupport ? (
              <div className="rounded-lg bg-background p-4">
                <p className="text-[14px] text-text-secondary">
                  {pendingSupport === "password_reset"
                    ? `Email a password reset code to ${user.email}?`
                    : `Email a new verification code to ${user.email}?`}
                </p>
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => setPendingSupport(null)}
                    disabled={sending}
                    className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-text-secondary hover:bg-surface"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => sendSupport(pendingSupport)}
                    disabled={sending}
                    className="px-3.5 py-1.5 rounded-lg bg-orange text-[13px] font-medium text-white hover:bg-[#D44A00] disabled:opacity-50"
                  >
                    {sending ? "Sending…" : "Send email"}
                  </button>
                </div>
              </div>
            ) : (
              <>
              {resetSentTo && (
                <div className="rounded-lg bg-success-subtle p-3 mb-3 text-[13px] text-text-secondary">
                  Reset code sent. Send them this link so they can enter it:
                  <input
                    readOnly
                    value={`https://myprofitpulse.app/forgot-password?email=${encodeURIComponent(resetSentTo)}&step=code`}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="Link to enter the reset code"
                    className="mt-2 w-full px-2.5 py-1.5 rounded-md border border-border bg-surface text-[12px] text-text-primary"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Choice onClick={() => setPendingSupport("password_reset")}>
                  Send password reset
                </Choice>
                <Choice
                  disabled={detail?.user.email_verified ?? user.email_verified}
                  onClick={() => setPendingSupport("resend_verification")}
                >
                  {(detail?.user.email_verified ?? user.email_verified)
                    ? "Email already verified"
                    : "Resend verification code"}
                </Choice>
              </div>
              </>
            )}
          </Block>

          {loading && !detail ? (
            <div className="space-y-3 pt-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-9 rounded-lg bg-surface-inset animate-pulse" />
              ))}
            </div>
          ) : detail ? (
            <>
              <Block title="Card on file" hint="Shown masked by Authorize.net. The full number is never stored or shown.">
                {!detail.card ? (
                  <p className="text-[14px] text-text-muted">No card on file.</p>
                ) : detail.card.error ? (
                  <p className="text-[14px] text-text-muted">Couldn&apos;t load card details right now.</p>
                ) : (
                  <div className="flex items-center gap-4 rounded-xl border border-border p-4">
                    <Icon icon="ph:credit-card" className="w-7 h-7 text-text-muted flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-text-primary">
                        {detail.card.cardType ?? "Card"} •••• {detail.card.last4 ?? "????"}
                      </p>
                      <p className="text-[13px] text-text-muted">
                        {detail.card.billingName ?? "No name on card"}
                        {detail.card.billingZip ? `, ${detail.card.billingZip}` : ""}
                      </p>
                    </div>
                    {detail.card.expiration && (() => {
                      const left = monthsUntilExpiry(detail.card.expiration);
                      const [y, m] = detail.card.expiration.split("-");
                      const tone =
                        left !== null && left < 0
                          ? "text-error"
                          : left !== null && left <= 2
                          ? "text-warning"
                          : "text-text-secondary";
                      return (
                        <p className={`text-[13px] text-right ${tone}`}>
                          {left !== null && left < 0 ? "Expired" : "Expires"} {m}/{y}
                        </p>
                      );
                    })()}
                  </div>
                )}
              </Block>

              {sub?.anet_customer_profile_id && (
                <Block
                  title="Billing actions"
                  hint="Charges only ever go to the card on file. For a new card, email them the update link."
                >
                  <div className="flex flex-wrap gap-2">
                    {sub.last_payment_status === "failed" && sub.anet_subscription_id && (
                      <Choice
                        disabled={busy}
                        onClick={() =>
                          onBilling(user, {
                            title: "Charge the missed payment?",
                            message: `This charges ${formatMoney(Number(sub.last_payment_amount) || 0)} to ${cardLabel(
                              detail.card
                            )} for their declined renewal. If it goes through, they can use the app again right away.`,
                            confirmLabel: "Charge card",
                            successMessage: `Missed payment collected from ${displayName(user)}`,
                            body: { action: "retry_payment" },
                          })
                        }
                      >
                        Charge missed payment
                      </Choice>
                    )}
                    {sub.anet_subscription_id && sub.subscription_status === "active" && sub.billing_interval && !sub.pending_switch_to && (
                      <Choice
                        disabled={busy}
                        onClick={() =>
                          onBilling(
                            user,
                            sub.billing_interval === "monthly"
                              ? {
                                  title: "Switch them to annual?",
                                  message: `This charges ${cardLabel(detail.card)} the annual price today, minus credit for the unused days of this month, and stops their monthly billing.`,
                                  confirmLabel: "Switch and charge",
                                  successMessage: `${displayName(user)} is now on the annual plan`,
                                  body: { action: "switch_plan", target: "annual" },
                                }
                              : {
                                  title: "Switch them to monthly?",
                                  message: `Nothing is charged today. Their annual plan runs until ${formatDate(
                                    sub.current_period_end
                                  )}, then monthly billing starts on ${cardLabel(detail.card)}.`,
                                  confirmLabel: "Switch to monthly",
                                  successMessage: `${displayName(user)} switches to monthly on ${formatDate(sub.current_period_end)}`,
                                  body: { action: "switch_plan", target: "monthly" },
                                }
                          )
                        }
                      >
                        {sub.billing_interval === "monthly" ? "Switch to annual" : "Switch to monthly"}
                      </Choice>
                    )}
                    <Choice
                      disabled={busy}
                      onClick={() =>
                        onBilling(user, {
                          title: "Email them the update-card link?",
                          message: `${user.email} gets an email with a button to update their card. They enter it themselves, and it goes straight to Authorize.net.`,
                          confirmLabel: "Send email",
                          successMessage: `Update-card link sent to ${user.email}`,
                          body: { action: "send_update_card_link" },
                        })
                      }
                    >
                      Email update-card link
                    </Choice>
                    {sub.anet_subscription_id && (
                      <Choice
                        disabled={busy}
                        onClick={() =>
                          onBilling(user, {
                            title: "Cancel their subscription?",
                            message: `Their card won't be charged again.${
                              sub.current_period_end
                                ? ` They keep access until ${formatDate(sub.current_period_end)}.`
                                : ""
                            } To come back later, they subscribe again from the app.`,
                            confirmLabel: "Cancel subscription",
                            successMessage: `${displayName(user)}'s subscription is canceled`,
                            body: { action: "cancel_subscription" },
                          })
                        }
                      >
                        Cancel subscription
                      </Choice>
                    )}
                  </div>
                </Block>
              )}

              <Block title="Billing">
                <dl className="divide-y divide-border-light">
                  <Fact label="Plan">
                    {sub?.plan === "pro"
                      ? `Pro${sub.billing_interval ? `, ${sub.billing_interval}` : ""}${
                          sub.pricing_promo === "launch" ? " (launch price)" : ""
                        }`
                      : sub?.subscription_status === "trial"
                      ? "Free trial"
                      : "None"}
                  </Fact>
                  {sub?.current_period_end && (
                    <Fact label={detail.arb ? "Paid through" : "Access through"}>
                      {access.reason === "lifetime" ? "For life" : formatDate(sub.current_period_end)}
                    </Fact>
                  )}
                  {detail.arb && <Fact label="Next charge">{formatDate(sub?.next_billing_date)}</Fact>}
                  {sub?.trial_start_date && (
                    <Fact label="Trial">
                      {formatDate(sub.trial_start_date)} to {formatDate(sub.trial_end_date)}
                    </Fact>
                  )}
                  <Fact label="Authorize.net">
                    {detail.arb
                      ? detail.arb.error
                        ? "Couldn't check right now"
                        : `${detail.arb.status}, subscription ${detail.arb.id}`
                      : "No recurring billing"}
                  </Fact>
                </dl>
                {arbMismatch && (
                  <p className="mt-3 flex gap-2 rounded-lg bg-warning-subtle p-3 text-[13px] text-text-secondary">
                    <Icon icon="ph:warning-circle" className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    Authorize.net shows this subscription as {detail.arb?.status}, but our records say{" "}
                    {sub?.subscription_status}. The nightly billing check corrects this; if it
                    doesn&apos;t by tomorrow, check the Authorize.net portal.
                  </p>
                )}
              </Block>

              <Block title="Getting started">
                <dl className="divide-y divide-border-light">
                  <Fact label="Joined">{formatDate(detail.user.joined)}</Fact>
                  <Fact label="Email">
                    {detail.user.email_verified ? "Verified" : "Not verified yet"}
                  </Fact>
                  <Fact label="Check-in">
                    {detail.onboarding.self_assessment_at
                      ? `Done ${formatDate(detail.onboarding.self_assessment_at)}`
                      : "Not done yet"}
                  </Fact>
                  <Fact label="Months of numbers">
                    {detail.onboarding.data_months
                      ? `${detail.onboarding.data_months}, through ${formatMonth(detail.onboarding.latest_month)}`
                      : "None uploaded"}
                  </Fact>
                  <Fact label="Health score">{detail.onboarding.health_score ?? "Not yet"}</Fact>
                  {detail.user.industry && <Fact label="Industry">{detail.user.industry}</Fact>}
                </dl>
              </Block>

              <Block title="Payments">
                {detail.payments.length === 0 ? (
                  <p className="text-[14px] text-text-muted">No payments yet.</p>
                ) : (
                  <ul className="divide-y divide-border-light">
                    {detail.payments.map((p) => (
                      <li key={p.id} className="py-2.5 flex items-baseline justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[14px] text-text-primary">
                            {p.status === "success"
                              ? "Paid"
                              : p.status === "failed"
                              ? "Declined"
                              : p.status === "refunded"
                              ? "Refunded"
                              : p.status === "voided"
                              ? "Voided"
                              : p.status}
                            {p.type === "renewal" ? " renewal" : p.type === "subscription" ? ", first payment" : ""}
                          </p>
                          <p className="text-[12px] text-text-muted">{formatDate(p.created_at)}</p>
                        </div>
                        <span className="flex items-center gap-3">
                          {p.status === "success" && p.anet_transaction_id && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                onBilling(user, {
                                  title: `Refund ${formatMoney(Number(p.amount))}?`,
                                  message: `The money goes back to the card it was charged on (${formatDate(
                                    p.created_at
                                  )}). If the payment hasn't settled yet, it's voided instead and never shows on their statement. Their access doesn't change; cancel their subscription separately if you need to.`,
                                  confirmLabel: "Refund payment",
                                  successMessage: `Refunded ${formatMoney(Number(p.amount))} to ${displayName(user)}`,
                                  body: { action: "refund_payment", paymentId: p.id },
                                })
                              }
                              className="text-[12px] font-medium text-text-muted hover:text-error disabled:opacity-40"
                            >
                              Refund
                            </button>
                          )}
                          <span
                            className={`font-display text-[20px] ${
                              p.status === "success" ? "text-text-primary" : "text-error"
                            }`}
                          >
                            {formatMoney(Number(p.amount))}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Block>

              <Block title="What we've done for them">
                {detail.actions.length === 0 ? (
                  <p className="text-[14px] text-text-muted">Nothing yet.</p>
                ) : (
                  <ol className="relative border-l border-border ml-1.5 space-y-4">
                    {detail.actions.map((a) => (
                      <li key={a.id} className="pl-5 relative">
                        <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-surface border-2 border-orange" />
                        <p className="text-[14px] text-text-primary">{describeAction(a)}</p>
                        <p className="text-[12px] text-text-muted">
                          {formatDate(a.created_at)} by {a.admin_email}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </Block>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
