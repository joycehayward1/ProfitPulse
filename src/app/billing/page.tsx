"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { UpdateCardForm } from "@/components/payments/UpdateCardForm";
import { getInsForgeClient } from "@/lib/insforge";
import type { PaymentRecord } from "@/lib/database.types";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

export default function BillingPage() {
  const router = useRouter();
  const { user } = useRequireAuth();
  const { subscription, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);

  const [cancelling, setCancelling] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    async function loadPayments() {
      if (!user?.id) return;
      try {
        const client = getInsForgeClient();
        const { data } = await client.database
          .from("payment_records")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        setPayments((data ?? []) as PaymentRecord[]);
      } catch (err) {
        console.error("Failed to load payment history:", err);
      } finally {
        setPaymentsLoading(false);
      }
    }
    loadPayments();
  }, [user?.id]);

  const status = subscription?.subscription_status ?? null;
  const interval = subscription?.billing_interval;
  const hasActiveOrCanceled =
    status === "active" || status === "past_due" || status === "canceled";

  const priceLabel = interval === "annual" ? "$49.99" : "$59.99";
  const priceSub = interval === "annual" ? "/month (billed annually)" : "/month";
  const planName =
    interval === "annual" ? "ProfitPulse Pro Annual" : "ProfitPulse Pro Monthly";

  const switchTarget = interval === "annual" ? "monthly" : "annual";
  const switchLabel =
    interval === "annual" ? "Switch to Monthly" : "Switch to Annual";

  async function handleCancel() {
    if (!user?.id) return;
    setCancelling(true);
    try {
      const res = await fetch("/api/payments/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        showToast("error", json.error ?? "Failed to cancel subscription");
        return;
      }
      showToast("success", "Subscription canceled");
      await refreshUser();
      setShowCancelModal(false);
    } catch {
      showToast("error", "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  }

  async function handleSwitch() {
    if (!user?.id) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/payments/switch-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, target: switchTarget }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        showToast("error", json.error ?? "Failed to switch plan");
        return;
      }
      showToast("success", `Switched to ${switchTarget}`);
      await refreshUser();
      setShowSwitchModal(false);
    } catch {
      showToast("error", "Failed to switch plan");
    } finally {
      setSwitching(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-md">
        {/* Header */}
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-small text-text-secondary hover:text-text-primary transition-colors mb-sm"
          >
            <Icon icon="lucide:arrow-left" width={16} height={16} />
            Back to dashboard
          </Link>
          <h1 className="font-display text-h1 text-text-primary">Billing</h1>
        </div>

        {/* Current Plan Card */}
        <div className="bg-gradient-to-br from-orange/5 via-surface to-surface rounded-xl p-xl border border-orange/20 shadow-sm">
          {status === null || status === "trial" ? (
            <div className="text-center py-md">
              <div className="w-16 h-16 rounded-full bg-orange/10 flex items-center justify-center mx-auto mb-md">
                <Icon icon="ph:crown-simple-bold" className="text-orange" width={28} height={28} />
              </div>
              <h3 className="font-display text-h3 text-text-primary mb-xs">
                {status === "trial" ? "Free Trial" : "No Active Plan"}
              </h3>
              <p className="text-small text-text-secondary mb-lg">
                {status === "trial"
                  ? "Upgrade to Pro to unlock the full experience."
                  : "Start your subscription to access Pro features."}
              </p>
              <Button variant="primary" onClick={() => router.push("/pricing")}>
                <Icon icon="ph:arrow-up-right-bold" className="w-4 h-4 mr-2" />
                {status === "trial" ? "Upgrade to Pro" : "Subscribe"}
              </Button>
            </div>
          ) : status === "terminated" || status === "expired" ? (
            <div className="text-center py-md">
              <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-md">
                <Icon icon="lucide:x-circle" className="text-error" width={28} height={28} />
              </div>
              <h3 className="font-display text-h3 text-text-primary mb-xs">
                Subscription Ended
              </h3>
              <p className="text-small text-text-secondary mb-lg">
                Resubscribe to regain Pro access.
              </p>
              <Button variant="primary" onClick={() => router.push("/pricing")}>
                Resubscribe
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-md">
                <div>
                  <div className="flex items-center gap-2 mb-xs">
                    <h3 className="font-display text-h3 text-text-primary">
                      {planName}
                    </h3>
                    {status === "active" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-[11px] font-semibold uppercase tracking-wider">
                        <Icon icon="ph:check-circle-fill" width={12} height={12} />
                        Active
                      </span>
                    )}
                    {status === "past_due" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error/10 text-error text-[11px] font-semibold uppercase tracking-wider">
                        <Icon icon="lucide:alert-triangle" width={12} height={12} />
                        Past due
                      </span>
                    )}
                    {status === "canceled" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber/10 text-amber text-[11px] font-semibold uppercase tracking-wider">
                        Canceled
                      </span>
                    )}
                  </div>
                  <p className="text-small text-text-secondary">
                    {status === "canceled"
                      ? `Access until ${formatDate(subscription?.current_period_end)}`
                      : status === "past_due"
                        ? "Update your card to keep Pro access"
                        : `Next billing: ${formatDate(subscription?.next_billing_date)}`}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-display text-[32px] text-text-primary">
                    {priceLabel}
                  </div>
                  <div className="text-small text-text-secondary">{priceSub}</div>
                </div>
              </div>

              {subscription?.pending_switch_to && (
                <div className="p-sm rounded-md bg-orange/5 border border-orange/20 mb-md">
                  <p className="text-small text-text-primary">
                    <Icon
                      icon="ph:clock-bold"
                      className="inline-block w-4 h-4 mr-1 text-orange"
                    />
                    Switching to <strong>{subscription.pending_switch_to}</strong> on{" "}
                    {formatDate(subscription.current_period_end)}.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-sm pt-md border-t border-[#E5E0DA]">
                {status === "active" && !subscription?.pending_switch_to && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowSwitchModal(true)}
                  >
                    <Icon icon="ph:swap-bold" className="w-4 h-4 mr-2" />
                    {switchLabel}
                  </Button>
                )}
                {hasActiveOrCanceled && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowCardModal(true)}
                  >
                    <Icon icon="ph:credit-card-bold" className="w-4 h-4 mr-2" />
                    Update Payment Method
                  </Button>
                )}
                {(status === "active" || status === "past_due") && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowCancelModal(true)}
                  >
                    <Icon icon="ph:x-circle-bold" className="w-4 h-4 mr-2" />
                    Cancel Subscription
                  </Button>
                )}
                {status === "canceled" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push("/pricing")}
                  >
                    Resubscribe
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Payment History */}
        <div className="bg-surface rounded-xl p-xl border border-[#E5E0DA] shadow-sm">
          <h3 className="font-display text-h3 text-text-primary mb-md">
            Payment History
          </h3>

          {paymentsLoading ? (
            <div className="text-center py-xl">
              <p className="text-small text-text-muted">Loading...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-xl">
              <Icon
                icon="ph:receipt-duotone"
                className="w-16 h-16 text-text-muted mx-auto mb-md"
              />
              <p className="text-small text-text-secondary">
                No billing history yet. Your first invoice will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="border-b border-[#E5E0DA]">
                    <th className="text-left py-sm px-sm text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Date
                    </th>
                    <th className="text-left py-sm px-sm text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Description
                    </th>
                    <th className="text-left py-sm px-sm text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Type
                    </th>
                    <th className="text-right py-sm px-sm text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Amount
                    </th>
                    <th className="text-right py-sm px-sm text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-[#E5E0DA]/50 last:border-0"
                    >
                      <td className="py-sm px-sm text-text-primary tabular-nums">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="py-sm px-sm text-text-secondary">
                        {p.description}
                      </td>
                      <td className="py-sm px-sm">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-[#E5E0DA] text-text-secondary text-[11px] capitalize">
                          {p.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-sm px-sm text-right text-text-primary font-medium tabular-nums">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-sm px-sm text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                            p.status === "success"
                              ? "bg-success/10 text-success"
                              : p.status === "failed"
                                ? "bg-error/10 text-error"
                                : "bg-[#E5E0DA] text-text-secondary"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── Cancel Modal ─────────────────────────────────────────────────── */}
      {showCancelModal && (
        <Modal onClose={() => !cancelling && setShowCancelModal(false)}>
          <div className="flex items-center gap-sm mb-md">
            <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
              <Icon
                icon="lucide:alert-triangle"
                className="text-error"
                width={20}
                height={20}
              />
            </div>
            <h3 className="font-display text-h3 text-text-primary">
              Cancel subscription?
            </h3>
          </div>
          <p className="text-body text-text-secondary mb-lg">
            You&apos;ll keep Pro access until{" "}
            <strong className="text-text-primary">
              {formatDate(subscription?.current_period_end)}
            </strong>
            , then your plan will end. You can resubscribe at any time.
          </p>
          <div className="flex gap-sm justify-end">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowCancelModal(false)}
              disabled={cancelling}
            >
              Keep subscription
            </Button>
            <button
              type="button"
              disabled={cancelling}
              onClick={handleCancel}
              className="px-6 py-3 rounded-md bg-error text-white text-body font-medium hover:bg-[#B91C1C] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cancelling ? "Canceling..." : "Yes, cancel"}
            </button>
          </div>
        </Modal>
      )}

      {/* ─── Switch Plan Modal ────────────────────────────────────────────── */}
      {showSwitchModal && (
        <Modal onClose={() => !switching && setShowSwitchModal(false)}>
          <div className="flex items-center gap-sm mb-md">
            <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center">
              <Icon icon="ph:swap-bold" className="text-orange" width={20} height={20} />
            </div>
            <h3 className="font-display text-h3 text-text-primary">
              Switch to {switchTarget}?
            </h3>
          </div>
          {switchTarget === "annual" ? (
            <p className="text-body text-text-secondary mb-lg">
              You&apos;ll be charged <strong className="text-text-primary">$599.88</strong>{" "}
              right now for the next year of Pro access. Your monthly plan will be
              canceled immediately.
            </p>
          ) : (
            <p className="text-body text-text-secondary mb-lg">
              You&apos;ll stay on the annual plan until{" "}
              <strong className="text-text-primary">
                {formatDate(subscription?.current_period_end)}
              </strong>
              , then switch to monthly billing at $59.99/month. No charge today.
            </p>
          )}
          <div className="flex gap-sm justify-end">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowSwitchModal(false)}
              disabled={switching}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSwitch}
              disabled={switching}
            >
              {switching ? "Switching..." : `Confirm switch`}
            </Button>
          </div>
        </Modal>
      )}

      {/* ─── Update Card Modal ────────────────────────────────────────────── */}
      {showCardModal && user && (
        <Modal onClose={() => setShowCardModal(false)} wide>
          <div className="flex items-center gap-sm mb-md">
            <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center">
              <Icon
                icon="ph:credit-card-bold"
                className="text-orange"
                width={20}
                height={20}
              />
            </div>
            <h3 className="font-display text-h3 text-text-primary">
              Update payment method
            </h3>
          </div>
          <p className="text-small text-text-secondary mb-lg">
            Enter new card details. Your subscription will be updated to charge this
            card going forward.
          </p>
          <UpdateCardForm
            userId={user.id}
            userEmail={user.email}
            onSuccess={async () => {
              showToast("success", "Payment method updated");
              await refreshUser();
              setShowCardModal(false);
            }}
            onCancel={() => setShowCardModal(false)}
          />
        </Modal>
      )}
    </AppLayout>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function Modal({
  children,
  onClose,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-md"
      onClick={onClose}
    >
      <div
        className={`${
          wide ? "max-w-xl" : "max-w-md"
        } w-full bg-surface rounded-xl shadow-elevated border border-[#E5E0DA] p-xl max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

