"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/components/ui";
import { UserDetailDrawer, statusDot, type BillingRequest } from "./UserDetailDrawer";
import {
  ACCESS_REASON_LABELS,
  accessLine,
  calendarDaysUntil,
  daysUntil,
  describeAction,
  displayName,
  formatDate,
  formatMoney,
  getAuthHeaders,
  initials,
  localISODate,
  type AdminAction,
  type AdminUser,
  type GrantDuration,
} from "./admin-utils";

interface AdminStats {
  totalUsers: number;
  withAccess: number;
  freeAccess: number;
  activeSubscribers: number;
  trialUsers: number;
  pastDue: number;
  newSignups7d: number;
  grossReceiptsMTD: number;
  failedPaymentsMTD: number;
  mrr: number;
}

interface PaymentRecord {
  id: string;
  email: string;
  type: string;
  amount: number;
  status: string;
  billing_interval: string | null;
  description: string;
  created_at: string;
}

interface CompedEmail {
  email: string;
  note: string | null;
  access_months: number | null;
  created_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
}

type Tab = "people" | "payments" | "comped" | "activity";
type PeopleFilter = "all" | "can_use" | "locked" | "trial" | "problems";
type SortKey = "newest" | "name" | "ending";

const GRANT_TEXT: Record<Exclude<GrantDuration, "custom">, string> = {
  "1m": "1 month",
  "3m": "3 months",
  "6m": "6 months",
  "12m": "12 months",
  lifetime: "life",
};

const COMPED_LENGTHS: { months: number | null; label: string }[] = [
  { months: null, label: "For life" },
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
];

const PROBLEM_REASONS = new Set(["past_due", "grace", "lapsed"]);

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

interface PromptState {
  title: string;
  message: string;
  inputType: "number" | "date";
  inputLabel: string;
  min?: string;
  max?: string;
  confirmLabel: string;
  onSubmit: (value: string) => void;
}

interface Attention {
  user: AdminUser;
  tone: "error" | "warning" | "neutral";
  text: string;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** CSV field, quoted when it contains a comma, quote, or newline. */
function csvField(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function Avatar({ user }: { user: AdminUser }) {
  return (
    <span className="w-9 h-9 rounded-full bg-orange-subtle text-orange flex items-center justify-center text-[13px] font-semibold flex-shrink-0">
      {initials(user)}
    </span>
  );
}

function Modal({
  children,
  onCancel,
  onSubmit,
}: {
  children: React.ReactNode;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    // Capture phase + stopImmediatePropagation: Escape closes only this
    // dialog, not the person panel underneath it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1C1917]/40 backdrop-blur-[2px] px-4"
      onClick={onCancel}
    >
      <form
        role="dialog"
        aria-modal="true"
        className="bg-surface rounded-2xl shadow-overlay max-w-md w-full p-7"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {children}
      </form>
    </div>
  );
}

function ModalButtons({
  confirmLabel,
  onCancel,
  disabled,
}: {
  confirmLabel: string;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 mt-7">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded-lg text-[14px] font-medium text-text-secondary hover:bg-background"
      >
        Cancel
      </button>
      <button
        type="submit"
        autoFocus
        disabled={disabled}
        className="px-4 py-2 rounded-lg bg-orange text-[14px] font-medium text-white hover:bg-[#D44A00] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 focus-visible:ring-offset-2"
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function ConfirmDialog({ confirm, onCancel }: { confirm: ConfirmState; onCancel: () => void }) {
  return (
    <Modal onCancel={onCancel} onSubmit={confirm.onConfirm}>
      <h3 className="font-display text-[28px] leading-tight text-text-primary">{confirm.title}</h3>
      <p className="text-[15px] text-text-secondary mt-3 leading-relaxed">{confirm.message}</p>
      <ModalButtons confirmLabel={confirm.confirmLabel} onCancel={onCancel} />
    </Modal>
  );
}

function PromptDialog({ prompt, onCancel }: { prompt: PromptState; onCancel: () => void }) {
  const [value, setValue] = useState("");
  const valid =
    prompt.inputType === "number"
      ? value !== "" &&
        Number.isInteger(Number(value)) &&
        Number(value) >= Number(prompt.min ?? 1) &&
        Number(value) <= Number(prompt.max ?? Infinity)
      : value !== "" && (!prompt.min || value >= prompt.min);

  return (
    <Modal onCancel={onCancel} onSubmit={() => valid && prompt.onSubmit(value)}>
      <h3 className="font-display text-[28px] leading-tight text-text-primary">{prompt.title}</h3>
      <p className="text-[15px] text-text-secondary mt-3 leading-relaxed">{prompt.message}</p>
      <label className="block text-[13px] font-medium text-text-secondary mt-5 mb-1.5">
        {prompt.inputLabel}
      </label>
      <input
        type={prompt.inputType}
        value={value}
        min={prompt.min}
        max={prompt.max}
        onChange={(e) => setValue(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-[15px] text-text-primary focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
      />
      <ModalButtons confirmLabel={prompt.confirmLabel} onCancel={onCancel} disabled={!valid} />
    </Modal>
  );
}

export default function AdminPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { showToast } = useToast();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [compedEmails, setCompedEmails] = useState<CompedEmail[]>([]);
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [detailVersion, setDetailVersion] = useState(0);

  const [newCompEmail, setNewCompEmail] = useState("");
  const [newCompNote, setNewCompNote] = useState("");
  const [newCompMonths, setNewCompMonths] = useState<number | null>(null);
  const [addingComp, setAddingComp] = useState(false);

  const [tab, setTab] = useState<Tab>("people");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PeopleFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [showAllAttention, setShowAllAttention] = useState(false);

  // Admin check (identity comes from the session token server-side)
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) {
          setIsAdmin(false);
          return;
        }
        const res = await fetch("/api/admin/check", { headers });
        const data = await res.json();
        setIsAdmin(data.isAdmin === true);
      } catch {
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    })();
  }, [user]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        showToast("error", "Your session expired. Sign in again to continue.");
        return;
      }

      const [statsRes, usersRes, paymentsRes, compedRes, actionsRes] = await Promise.all([
        fetch("/api/admin/stats", { headers }),
        fetch("/api/admin/users", { headers }),
        fetch("/api/admin/payments", { headers }),
        fetch("/api/admin/comped-emails", { headers }),
        fetch("/api/admin/actions", { headers }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setUsers((await usersRes.json()).users || []);
      if (paymentsRes.ok) setPayments((await paymentsRes.json()).payments || []);
      if (compedRes.ok) setCompedEmails((await compedRes.json()).compedEmails || []);
      if (actionsRes.ok) setActions((await actionsRes.json()).actions || []);

      const failed = [
        !statsRes.ok && "numbers",
        !usersRes.ok && "people",
        !paymentsRes.ok && "payments",
        !compedRes.ok && "free access list",
        !actionsRes.ok && "activity",
      ].filter(Boolean);
      if (failed.length) {
        showToast("error", `Couldn't load the ${failed.join(", ")}. Refresh to try again.`);
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
      showToast("error", "Couldn't load the admin data. Refresh to try again.");
    } finally {
      setLoadingData(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function runAction(
    endpoint: string,
    body: Record<string, string | number | null>,
    successMessage: string
  ) {
    setConfirm(null);
    setPrompt(null);
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        showToast("error", "Your session expired. Sign in again to continue.");
        return;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast("success", successMessage);
        await loadData();
        setDetailVersion((v) => v + 1);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", data.error || "That didn't go through. Try again.");
      }
    } catch {
      showToast("error", "Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function grantPro(u: AdminUser, duration: GrantDuration) {
    const who = displayName(u);
    if (duration === "custom") {
      setPrompt({
        title: "Free Pro until a date",
        message: `${who} can use everything through the end of the day you pick. Their card isn't charged.`,
        inputType: "date",
        inputLabel: "Last day of access",
        min: localISODate(1),
        confirmLabel: "Give free Pro",
        onSubmit: (endDate) =>
          runAction(
            "/api/admin/grant-pro",
            { userId: u.id, duration, endDate },
            `${who} has free Pro until ${formatDate(`${endDate}T12:00:00`)}`
          ),
      });
      return;
    }
    const length = GRANT_TEXT[duration];
    setConfirm({
      title: duration === "lifetime" ? "Free Pro for life?" : `${length} of free Pro?`,
      message:
        duration === "lifetime"
          ? `${who} gets permanent access to everything, replacing any trial. Their card is never charged.`
          : `${who} gets full access for ${length}, replacing any trial. Their card isn't charged, and access ends after that unless you extend it.`,
      confirmLabel: "Give free Pro",
      onConfirm: () =>
        runAction(
          "/api/admin/grant-pro",
          { userId: u.id, duration },
          duration === "lifetime" ? `${who} has free Pro for life` : `${who} has ${length} of free Pro`
        ),
    });
  }

  function addFreeDays(u: AdminUser, days: number, label: string) {
    const who = displayName(u);
    setConfirm({
      title: `Add ${label} free?`,
      message: `${who} gets ${days} extra days after their paid time ends. Billing isn't touched. The free days kick in whenever their subscription stops.${
        u.comp_days > 0 ? ` This adds to the ${u.comp_days} free days they already have.` : ""
      }`,
      confirmLabel: "Add free days",
      onConfirm: () =>
        runAction("/api/admin/comp-days", { userId: u.id, days }, `Added ${label} free for ${who}`),
    });
  }

  function extendTrial(u: AdminUser, days: number | "custom") {
    const who = displayName(u);
    const left = u.access.level === "trial" ? daysUntil(u.access.until) : null;
    const describe = (amount: string) =>
      left !== null && left > 0
        ? `${who} has ${plural(left, "day")} left. This adds ${amount}.`
        : `${who} gets a new free trial of ${amount}, starting today.`;
    const run = (n: number) =>
      runAction("/api/admin/extend-trial", { userId: u.id, days: n }, `${who}'s trial extended by ${n} days`);

    if (days === "custom") {
      setPrompt({
        title: "Extend their trial",
        message: describe("the days you choose"),
        inputType: "number",
        inputLabel: "Days to add (1 to 365)",
        min: "1",
        max: "365",
        confirmLabel: "Extend trial",
        onSubmit: (value) => run(Number(value)),
      });
      return;
    }
    setConfirm({
      title: `Extend their trial by ${days} days?`,
      message: describe(`${days} days`),
      confirmLabel: "Extend trial",
      onConfirm: () => run(days),
    });
  }

  function billingAction(u: AdminUser, request: BillingRequest) {
    setConfirm({
      title: request.title,
      message: request.message,
      confirmLabel: request.confirmLabel,
      onConfirm: () =>
        runAction(
          "/api/admin/billing",
          { userId: u.id, action: request.body.action, target: request.body.target ?? null, paymentId: request.body.paymentId ?? null },
          request.successMessage
        ),
    });
  }

  async function addCompedEmail() {
    const email = newCompEmail.trim().toLowerCase();
    if (!email) return;
    setAddingComp(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        showToast("error", "Your session expired. Sign in again to continue.");
        return;
      }
      const res = await fetch("/api/admin/comped-emails", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          note: newCompNote.trim() || undefined,
          accessMonths: newCompMonths,
        }),
      });
      if (res.ok) {
        showToast(
          "success",
          `Added ${email}. They'll get ${newCompMonths ? `${newCompMonths} months of` : "lifetime"} free Pro when they sign up.`
        );
        setNewCompEmail("");
        setNewCompNote("");
        setNewCompMonths(null);
        await loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", data.error || "Couldn't add that email. Try again.");
      }
    } catch {
      showToast("error", "Couldn't reach the server. Check your connection and try again.");
    } finally {
      setAddingComp(false);
    }
  }

  function removeCompedEmail(c: CompedEmail) {
    setConfirm({
      title: `Remove ${c.email}?`,
      message: c.claimed_at
        ? "They've already signed up and keep their free access. This only removes them from the list."
        : "They haven't signed up yet. If they do after this, they'll get the normal 7-day trial instead of free Pro.",
      confirmLabel: "Remove from list",
      onConfirm: async () => {
        setConfirm(null);
        setBusy(true);
        try {
          const headers = await getAuthHeaders();
          if (!headers) {
            showToast("error", "Your session expired. Sign in again to continue.");
            return;
          }
          const res = await fetch("/api/admin/comped-emails", {
            method: "DELETE",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ email: c.email }),
          });
          if (res.ok) {
            showToast("success", `Removed ${c.email} from the list`);
            await loadData();
          } else {
            const data = await res.json().catch(() => ({}));
            showToast("error", data.error || "Couldn't remove that email. Try again.");
          }
        } catch {
          showToast("error", "Couldn't reach the server. Check your connection and try again.");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  // ─── Derived data ──────────────────────────────────────────────────────────

  const attention = useMemo((): Attention[] => {
    const items: Attention[] = [];
    for (const u of users) {
      const r = u.access.reason;
      if (PROBLEM_REASONS.has(r)) {
        items.push({
          user: u,
          tone: "error",
          text:
            r === "lapsed"
              ? "Paid time ran out and no renewal came through"
              : r === "grace"
              ? `Payment failed. They can still use the app until ${formatDate(u.access.until)}`
              : "Payment failed. They're locked out until the card is updated",
        });
      } else if (r === "trial") {
        const d = calendarDaysUntil(u.access.until) ?? 99;
        if (d <= 3) {
          items.push({
            user: u,
            tone: "warning",
            text: d <= 0 ? "Trial ends today" : d === 1 ? "Trial ends tomorrow" : `Trial ends in ${d} days`,
          });
        }
      } else if (r === "trial_expired") {
        const ago = -(calendarDaysUntil(u.trial_end_date) ?? -999);
        if (ago <= 14) {
          items.push({
            user: u,
            tone: "neutral",
            text: `Trial ended ${ago <= 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`} and they haven't subscribed`,
          });
        }
      } else if (!u.email_verified && (daysUntil(u.joined) ?? 0) < -1) {
        items.push({ user: u, tone: "neutral", text: "Signed up but never verified their email" });
      }
    }
    const order = { error: 0, warning: 1, neutral: 2 };
    return items.sort((a, b) => order[a.tone] - order[b.tone]);
  }, [users]);

  const counts = useMemo(
    () => ({
      all: users.length,
      can_use: users.filter((u) => u.access.level !== "locked").length,
      locked: users.filter((u) => u.access.level === "locked").length,
      trial: users.filter((u) => u.access.level === "trial").length,
      problems: users.filter((u) => PROBLEM_REASONS.has(u.access.reason)).length,
    }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    let list = users;
    if (filter === "can_use") list = list.filter((u) => u.access.level !== "locked");
    else if (filter === "locked") list = list.filter((u) => u.access.level === "locked");
    else if (filter === "trial") list = list.filter((u) => u.access.level === "trial");
    else if (filter === "problems") list = list.filter((u) => PROBLEM_REASONS.has(u.access.reason));

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.business_name || "").toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      if (sortKey === "name") return displayName(a).localeCompare(displayName(b));
      if (sortKey === "ending") {
        const end = (u: AdminUser) =>
          u.access.level === "locked" || u.access.reason === "lifetime"
            ? Infinity
            : new Date(u.access.until ?? 0).getTime();
        return end(a) - end(b);
      }
      return new Date(b.joined || 0).getTime() - new Date(a.joined || 0).getTime();
    });
  }, [users, search, filter, sortKey]);

  const detailUser = users.find((u) => u.id === detailUserId) ?? null;

  function exportUsersCsv() {
    const header = [
      "Name",
      "Email",
      "Business",
      "Can use the app",
      "Status",
      "Access until",
      "Billing status",
      "Billing interval",
      "Free days",
      "Last payment",
      "Last payment date",
      "Health score",
      "Months of numbers",
      "Email verified",
      "Joined",
    ];
    const rows = filteredUsers.map((u) => [
      u.name === "—" ? "" : u.name,
      u.email,
      u.business_name ?? "",
      u.access.level === "locked" ? "No" : "Yes",
      ACCESS_REASON_LABELS[u.access.reason],
      u.access.reason === "lifetime" ? "For life" : u.access.until?.slice(0, 10) ?? "",
      u.plan,
      u.billing_interval ?? "",
      u.comp_days,
      u.last_payment_amount ?? "",
      u.last_payment_date?.slice(0, 10) ?? "",
      u.health_score ?? "",
      u.data_periods,
      u.email_verified ? "Yes" : "No",
      u.joined?.slice(0, 10) ?? "",
    ]);
    // BOM so Excel reads accented names as UTF-8
    const csv = "\uFEFF" + [header, ...rows].map((r) => r.map(csvField).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `myprofitpulse-people-${localISODate()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking immediately can cancel the download in Safari.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  // ─── Gates ─────────────────────────────────────────────────────────────────

  if (authLoading || checkingAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-8 h-8 border-2 border-orange border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-md mx-auto text-center py-24 px-4">
          <Icon icon="ph:lock-simple" className="w-10 h-10 text-text-muted mx-auto" />
          <h1 className="font-display text-display-sm text-text-primary mt-4">This page is for admins</h1>
          <p className="text-body text-text-secondary mt-2">
            Sign in with an admin account to manage people and billing.
          </p>
        </div>
      </AppLayout>
    );
  }

  const firstName = user?.name?.split(" ")[0];
  const visibleAttention = showAllAttention ? attention : attention.slice(0, 5);

  // ─── Page ──────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-content-wide mx-auto px-1 sm:px-2 py-2">
        {/* Desk headline */}
        <header className="flex items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-[15px] text-text-muted">
              {greeting()}
              {firstName ? `, ${firstName}` : ""}.
            </p>
            {stats ? (
              <h1 className="font-display text-[28px] sm:text-[34px] leading-[1.15] text-text-primary mt-1">
                {plural(stats.totalUsers, "person", "people")}{" "}
                {stats.totalUsers === 1 ? "has an account" : "have accounts"}.{" "}
                <span className="text-text-muted">
                  {stats.withAccess} can use the app right now: {stats.activeSubscribers} paying,{" "}
                  {stats.freeAccess} free, and {stats.trialUsers} on trial.
                </span>
              </h1>
            ) : (
              <div className="h-16 mt-1 rounded-lg bg-surface-inset animate-pulse max-w-2xl" />
            )}
          </div>
          <button
            onClick={loadData}
            disabled={loadingData}
            aria-label="Refresh"
            title="Refresh"
            className="p-2.5 rounded-full text-text-muted hover:text-orange hover:bg-orange-subtle disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 flex-shrink-0"
          >
            <Icon icon="ph:arrows-clockwise" className={`w-5 h-5 ${loadingData ? "animate-spin" : ""}`} />
          </button>
        </header>

        {/* Needs you + money */}
        <div className="grid lg:grid-cols-[1fr_300px] items-start gap-4 mt-6">
          <section className="bg-surface rounded-2xl shadow-card px-5 py-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[16px] font-semibold text-text-primary">Needs you</h2>
              {attention.length > 0 && (
                <span className="text-[13px] text-text-muted">
                  {plural(attention.length, "person", "people")}
                </span>
              )}
            </div>
            {loadingData && users.length === 0 ? (
              <div className="space-y-3 mt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-11 rounded-lg bg-surface-inset animate-pulse" />
                ))}
              </div>
            ) : attention.length === 0 ? (
              <p className="text-[15px] text-text-secondary mt-4 flex items-center gap-2">
                <Icon icon="ph:check-circle" className="w-5 h-5 text-success" />
                Nobody needs attention. Every payment and trial is on track.
              </p>
            ) : (
              <>
                <ul className="mt-2 -mx-3">
                  {visibleAttention.map((item) => (
                    <li key={item.user.id}>
                      <button
                        onClick={() => setDetailUserId(item.user.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
                      >
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            item.tone === "error"
                              ? "bg-error"
                              : item.tone === "warning"
                              ? "bg-warning"
                              : "bg-border-strong"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-[15px] font-medium text-text-primary">
                            {displayName(item.user)}
                          </span>
                          <span className="block text-[13px] text-text-secondary truncate">{item.text}</span>
                        </span>
                        <Icon icon="ph:caret-right" className="w-4 h-4 text-text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
                {attention.length > 5 && (
                  <button
                    onClick={() => setShowAllAttention((v) => !v)}
                    className="mt-2 text-[13px] font-medium text-orange hover:underline"
                  >
                    {showAllAttention ? "Show fewer" : `Show all ${attention.length}`}
                  </button>
                )}
              </>
            )}
          </section>

          <section className="bg-surface-dark text-white rounded-2xl px-5 py-4 flex flex-col">
            <h2 className="text-[16px] font-semibold">This month</h2>
            {stats ? (
              <>
                <p className="font-display text-metric-sm sm:text-[36px] mt-3 leading-none">{formatMoney(stats.mrr)}</p>
                <p className="text-[13px] text-white/60 mt-1">Monthly recurring revenue</p>
                <dl className="mt-4 space-y-2 text-[14px]">
                  <div className="flex justify-between">
                    <dt className="text-white/60">Collected so far</dt>
                    <dd>{formatMoney(stats.grossReceiptsMTD)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/60">Declined payments</dt>
                    <dd className={stats.failedPaymentsMTD > 0 ? "text-[#FCA5A5]" : ""}>
                      {stats.failedPaymentsMTD}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-white/60">New sign-ups, last 7 days</dt>
                    <dd>{stats.newSignups7d}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <div className="h-20 mt-3 rounded-lg bg-white/10 animate-pulse" />
            )}
          </section>
        </div>

        {/* Tabs */}
        <nav className="flex gap-6 mt-8 border-b border-border overflow-x-auto" aria-label="Admin sections">
          {(
            [
              { key: "people", label: "People", count: users.length },
              { key: "payments", label: "Payments", count: payments.length },
              { key: "comped", label: "Free access list", count: compedEmails.length },
              { key: "activity", label: "Activity", count: actions.length },
            ] as { key: Tab; label: string; count: number }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`pb-3 -mb-px border-b-2 text-[15px] font-medium whitespace-nowrap transition-colors ${
                tab === t.key
                  ? "border-orange text-text-primary"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-[13px] text-text-muted">{t.count}</span>
            </button>
          ))}
        </nav>

        {/* People */}
        {tab === "people" && (
          <section className="mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Icon
                  icon="ph:magnifying-glass"
                  className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find someone by name, email, or business"
                  className="w-full pl-10 pr-3 py-2 rounded-full border border-border bg-surface text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                />
              </div>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                aria-label="Sort people"
                className="px-3.5 py-2 rounded-full border border-border bg-surface text-[14px] text-text-secondary focus:outline-none focus:border-orange"
              >
                <option value="newest">Newest first</option>
                <option value="name">By name</option>
                <option value="ending">Access ending soonest</option>
              </select>
              <button
                onClick={exportUsersCsv}
                disabled={filteredUsers.length === 0}
                className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[14px] font-medium text-text-secondary hover:text-orange hover:bg-orange-subtle disabled:opacity-40"
              >
                <Icon icon="ph:download-simple" className="w-4 h-4" />
                Download spreadsheet
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Filter people">
              {(
                [
                  { key: "all", label: "Everyone" },
                  { key: "can_use", label: "Can use the app" },
                  { key: "trial", label: "On trial" },
                  { key: "locked", label: "Locked out" },
                  { key: "problems", label: "Payment problems" },
                ] as { key: PeopleFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                    filter === f.key
                      ? "bg-text-primary text-white"
                      : "bg-surface text-text-secondary border border-border hover:border-border-strong"
                  }`}
                >
                  {f.label}
                  <span className={`ml-1.5 ${filter === f.key ? "text-white/60" : "text-text-muted"}`}>
                    {counts[f.key]}
                  </span>
                </button>
              ))}
            </div>

            <div className="bg-surface rounded-2xl shadow-card mt-3 overflow-hidden">
              {loadingData && users.length === 0 ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-surface-inset animate-pulse" />
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-center text-[15px] text-text-muted py-16">
                  {users.length === 0
                    ? "No one has signed up yet."
                    : "No one matches that. Try a different search or filter."}
                </p>
              ) : (
                <>
                <div className="hidden sm:grid grid-cols-[36px_minmax(0,1fr)_16px] sm:grid-cols-[36px_minmax(0,1.1fr)_minmax(0,1fr)_120px_16px] items-center gap-x-4 px-5 py-2.5 border-b border-border-light text-[12px] font-medium text-text-muted">
                  <span />
                  <span>Name</span>
                  <span>Status</span>
                  <span>Joined</span>
                  <span />
                </div>
                <ul className="divide-y divide-border-light">
                  {filteredUsers.map((u) => (
                    <li key={u.id}>
                      <button
                        onClick={() => setDetailUserId(u.id)}
                        className="w-full grid grid-cols-[36px_minmax(0,1fr)_16px] sm:grid-cols-[36px_minmax(0,1.1fr)_minmax(0,1fr)_120px_16px] items-center gap-x-4 gap-y-0.5 px-5 py-2.5 text-left hover:bg-background focus-visible:outline-none focus-visible:bg-background"
                      >
                        <span className="row-span-2 sm:row-span-1"><Avatar user={u} /></span>
                        <span className="min-w-0">
                          <span className="block text-[15px] font-medium text-text-primary truncate">
                            {displayName(u)}
                          </span>
                          <span className="block text-[13px] text-text-muted truncate">
                            {u.business_name || u.email}
                          </span>
                        </span>
                        <span className="row-start-2 col-start-2 sm:row-start-auto sm:col-start-auto flex items-center gap-2 text-[14px] text-text-secondary min-w-0">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(u.access)}`} />
                          <span className="truncate">{accessLine(u.access)}</span>
                          {(u.access.reason === "lifetime" || u.access.reason === "comped" || u.access.reason === "granted") && (
                            <span className="px-1.5 py-0.5 rounded-md bg-insight-subtle text-insight text-[11px] font-semibold flex-shrink-0">
                              Free
                            </span>
                          )}
                        </span>
                        <span className="hidden sm:block text-[13px] text-text-muted whitespace-nowrap">
                          {formatDate(u.joined)}
                        </span>
                        <Icon
                          icon="ph:caret-right"
                          className="row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto w-4 h-4 text-text-muted"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
                </>
              )}
            </div>
          </section>
        )}

        {/* Payments */}
        {tab === "payments" && (
          <section className="bg-surface rounded-2xl shadow-card mt-4 overflow-hidden">
            {payments.length === 0 ? (
              <p className="text-center text-[15px] text-text-muted py-16">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-border-light">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 px-5 py-3">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        p.status === "success"
                          ? "bg-success"
                          : p.status === "failed"
                          ? "bg-error"
                          : "bg-border-strong"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-text-primary truncate">{p.email}</span>
                      <span className="block text-[13px] text-text-muted truncate">
                        {p.status === "failed"
                          ? "Declined. "
                          : p.status === "refunded"
                          ? "Refunded. "
                          : p.status === "voided"
                          ? "Voided. "
                          : ""}
                        {p.description}
                      </span>
                    </span>
                    <span className="hidden sm:block text-[13px] text-text-muted whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </span>
                    <span
                      className={`font-display text-[22px] whitespace-nowrap ${
                        p.status === "success" ? "text-text-primary" : "text-error"
                      }`}
                    >
                      {p.status === "refunded" ? "−" : ""}
                      {formatMoney(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Free access list */}
        {tab === "comped" && (
          <section className="mt-4 space-y-4">
            <form
              className="bg-surface rounded-2xl shadow-card px-5 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                addCompedEmail();
              }}
            >
              <h2 className="text-[17px] font-semibold text-text-primary">
                Give someone free access before they sign up
              </h2>
              <p className="text-[14px] text-text-secondary mt-1 max-w-2xl">
                When they sign up with this exact email, they skip the trial and get free Pro for the time
                you choose, counted from the day they join. No card needed.
              </p>
              <div className="flex flex-wrap gap-3 mt-5">
                <input
                  type="email"
                  required
                  value={newCompEmail}
                  onChange={(e) => setNewCompEmail(e.target.value)}
                  placeholder="Their email"
                  aria-label="Email"
                  className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-lg border border-border bg-surface text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                />
                <input
                  type="text"
                  value={newCompNote}
                  onChange={(e) => setNewCompNote(e.target.value)}
                  placeholder="Note, like their name or business"
                  aria-label="Note"
                  className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-lg border border-border bg-surface text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                />
                <select
                  value={newCompMonths ?? ""}
                  onChange={(e) => setNewCompMonths(e.target.value ? Number(e.target.value) : null)}
                  aria-label="How long their free access lasts"
                  className="px-3.5 py-2.5 rounded-lg border border-border bg-surface text-[14px] text-text-primary focus:outline-none focus:border-orange"
                >
                  {COMPED_LENGTHS.map((l) => (
                    <option key={l.label} value={l.months ?? ""}>
                      Free {l.months ? `for ${l.label}` : "for life"}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={addingComp || !newCompEmail.trim()}
                  className="px-5 py-2.5 rounded-lg bg-orange text-[14px] font-medium text-white hover:bg-[#D44A00] disabled:opacity-40"
                >
                  {addingComp ? "Adding…" : "Add to list"}
                </button>
              </div>
            </form>

            <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
              {compedEmails.length === 0 ? (
                <p className="text-center text-[15px] text-text-muted py-16">
                  No one on the list yet. Add an email above.
                </p>
              ) : (
                <ul className="divide-y divide-border-light">
                  {compedEmails.map((c) => (
                    <li key={c.email} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] text-text-primary truncate">{c.email}</span>
                        <span className="block text-[13px] text-text-muted truncate">
                          {c.note ? `${c.note}. ` : ""}Free{" "}
                          {c.access_months ? `for ${c.access_months} months` : "for life"}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-[13px] text-text-secondary">
                        <span
                          className={`w-2 h-2 rounded-full ${c.claimed_at ? "bg-success" : "bg-border-strong"}`}
                        />
                        {c.claimed_at ? `Joined ${formatDate(c.claimed_at)}` : "Hasn't signed up yet"}
                      </span>
                      <button
                        onClick={() => removeCompedEmail(c)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-full text-[13px] font-medium text-text-muted hover:text-error hover:bg-error-subtle disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {/* Activity */}
        {tab === "activity" && (
          <section className="bg-surface rounded-2xl shadow-card mt-4 p-5 sm:p-6">
            {actions.length === 0 ? (
              <p className="text-center text-[15px] text-text-muted py-10">
                Nothing yet. Every trial extension, free access grant, and support email you send shows
                up here.
              </p>
            ) : (
              <ol className="relative border-l border-border ml-1.5 space-y-4">
                {actions.map((a) => {
                  const target = users.find((u) => u.id === a.target_user_id) ?? null;
                  return (
                    <li key={a.id} className="pl-6 relative">
                      <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-surface border-2 border-orange" />
                      <p className="text-[15px] text-text-primary">
                        {target ? (
                          <button
                            onClick={() => setDetailUserId(target.id)}
                            className="font-medium hover:text-orange hover:underline"
                          >
                            {displayName(target)}
                          </button>
                        ) : (
                          <span className="font-medium">{a.target_email ?? "Someone"}</span>
                        )}
                        <span className="text-text-secondary">: {describeAction(a)}</span>
                      </p>
                      <p className="text-[13px] text-text-muted mt-0.5">
                        {formatDate(a.created_at)} by {a.admin_email}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}
      </div>

      {detailUser && (
        <UserDetailDrawer
          user={detailUser}
          version={detailVersion}
          busy={busy}
          onClose={() => setDetailUserId(null)}
          onGrant={grantPro}
          onComp={addFreeDays}
          onTrial={extendTrial}
          onBilling={billingAction}
        />
      )}
      {confirm && <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(null)} />}
      {prompt && <PromptDialog prompt={prompt} onCancel={() => setPrompt(null)} />}
    </AppLayout>
  );
}
