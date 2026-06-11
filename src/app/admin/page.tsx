"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/components/ui";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  business_name: string | null;
  plan: string;
  billing_interval: string | null;
  trial_end_date: string | null;
  next_billing_date: string | null;
  current_period_end: string | null;
  pricing_promo: string | null;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  last_payment_status: string | null;
  health_score: number | null;
  data_periods: number;
  joined: string | null;
}

interface AdminStats {
  totalUsers: number;
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

type PlanFilter = "all" | "active" | "trial" | "past_due" | "canceled" | "none";
type GrantDuration = "1m" | "12m" | "lifetime";

const GRANT_OPTIONS: { value: GrantDuration; label: string; icon: string }[] = [
  { value: "1m", label: "1 month", icon: "ph:calendar-bold" },
  { value: "12m", label: "12 months", icon: "ph:calendar-plus-bold" },
  { value: "lifetime", label: "Lifetime", icon: "ph:infinity-bold" },
];

const GRANT_LABELS: Record<GrantDuration, string> = {
  "1m": "1 month",
  "12m": "12 months",
  lifetime: "lifetime",
};

/** Period ends more than 50 years out are admin-granted lifetime comps. */
function isLifetime(periodEnd: string | null): boolean {
  if (!periodEnd) return false;
  return new Date(periodEnd).getFullYear() - new Date().getFullYear() > 50;
}
type SortKey = "joined" | "name" | "health" | "plan";
type Tab = "users" | "payments";

async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const { getInsForgeClient } = await import("@/lib/insforge");
  const client = getInsForgeClient();
  const { data, error } = await client.auth.getCurrentSession();
  if (error || !data?.session?.accessToken) return null;
  return { Authorization: `Bearer ${data.session.accessToken}` };
}

function PlanBadge({ plan }: { plan: string }) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    active: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", dot: "bg-[#16A34A]", label: "Active" },
    trial: { bg: "bg-[#FFF7ED]", text: "text-[#EA580C]", dot: "bg-[#EA580C]", label: "Trial" },
    canceled: { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", dot: "bg-[#DC2626]", label: "Canceled" },
    past_due: { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", dot: "bg-[#DC2626]", label: "Past Due" },
    terminated: { bg: "bg-[#F4F4F5]", text: "text-[#8B8B8B]", dot: "bg-[#8B8B8B]", label: "Terminated" },
    expired: { bg: "bg-[#F4F4F5]", text: "text-[#8B8B8B]", dot: "bg-[#8B8B8B]", label: "Expired" },
    none: { bg: "bg-[#F4F4F5]", text: "text-[#8B8B8B]", dot: "bg-[#8B8B8B]", label: "None" },
  };

  const c = config[plan] || config.none;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${c.bg} ${c.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    success: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", label: "Success" },
    failed: { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", label: "Failed" },
    voided: { bg: "bg-[#F4F4F5]", text: "text-[#8B8B8B]", label: "Voided" },
    refunded: { bg: "bg-[#FFF7ED]", text: "text-[#EA580C]", label: "Refunded" },
  };
  const c = config[status] || config.voided;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function trialDaysLeft(trialEnd: string | null): number | null {
  if (!trialEnd) return null;
  const diff = new Date(trialEnd).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

interface StatCardProps {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ icon, iconColor, label, value, sub }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon icon={icon} className={`w-4 h-4 ${iconColor}`} />
        <p className="text-[13px] font-medium text-[#8B8B8B]">{label}</p>
      </div>
      <p className="text-[26px] font-bold text-[#111111] leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-[#8B8B8B] mt-1">{sub}</p>}
    </div>
  );
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}

function ConfirmDialog({
  confirm,
  onCancel,
}: {
  confirm: ConfirmState;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-[#FFF7ED] flex items-center justify-center mb-4">
          <Icon icon="ph:warning-circle-bold" className="w-6 h-6 text-[#E65100]" />
        </div>
        <h3 className="text-[18px] font-bold text-[#111111] mb-2">{confirm.title}</h3>
        <p className="text-[14px] text-[#4B4B4B] mb-6">{confirm.message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-[#E4E4E7] text-[14px] font-medium text-[#4B4B4B] hover:bg-[#FAFAFA] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={confirm.onConfirm}
            className="px-4 py-2 rounded-lg bg-[#E65100] text-[14px] font-medium text-white hover:bg-[#D44A00] transition-colors"
          >
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
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
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [grantMenuFor, setGrantMenuFor] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("users");
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("joined");
  const [sortAsc, setSortAsc] = useState(false);

  // Check admin status (identity comes from the session token server-side)
  useEffect(() => {
    if (!user) return;

    async function checkAdmin() {
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
    }
    checkAdmin();
  }, [user]);

  // Load admin data
  const loadData = useCallback(async () => {
    setLoadingData(true);

    try {
      const headers = await getAuthHeaders();
      if (!headers) return;

      const [statsRes, usersRes, paymentsRes] = await Promise.all([
        fetch("/api/admin/stats", { headers }),
        fetch("/api/admin/users", { headers }),
        fetch("/api/admin/payments", { headers }),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.payments || []);
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
      showToast("error", "Failed to load admin data");
    } finally {
      setLoadingData(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, loadData]);

  // Actions
  async function runAction(
    endpoint: string,
    body: Record<string, string>,
    loadingKey: string,
    successMessage: string
  ) {
    setConfirm(null);
    setActionLoading(loadingKey);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        showToast("error", "Session expired — please sign in again");
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
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", data.error || "Action failed");
      }
    } catch {
      showToast("error", "Action failed — check your connection");
    } finally {
      setActionLoading(null);
    }
  }

  function confirmGrantPro(u: AdminUser, duration: GrantDuration) {
    setGrantMenuFor(null);
    const who = u.name !== "—" ? u.name : u.email;
    setConfirm({
      title: `Grant ${GRANT_LABELS[duration]} of Pro?`,
      message:
        duration === "lifetime"
          ? `${who} will get permanent Pro access, replacing any trial. This does not charge their card.`
          : `${who} will get Pro access for ${GRANT_LABELS[duration]}, replacing any trial. This does not charge their card, and access ends after the period unless re-granted.`,
      confirmLabel: "Grant Pro",
      onConfirm: () =>
        runAction(
          "/api/admin/grant-pro",
          { userId: u.id, duration },
          `grant-${u.id}`,
          `Pro (${GRANT_LABELS[duration]}) granted to ${u.email}`
        ),
    });
  }

  function confirmExtendTrial(u: AdminUser) {
    const daysLeft = trialDaysLeft(u.trial_end_date);
    setConfirm({
      title: "Extend trial by 7 days?",
      message: `${u.name !== "—" ? u.name : u.email}'s trial will be extended by 7 days${
        daysLeft !== null && daysLeft > 0 ? ` (currently ${daysLeft} day${daysLeft === 1 ? "" : "s"} left)` : ""
      }.`,
      confirmLabel: "Extend Trial",
      onConfirm: () =>
        runAction(
          "/api/admin/extend-trial",
          { userId: u.id },
          `trial-${u.id}`,
          `Trial extended for ${u.email}`
        ),
    });
  }

  // Derived user list: search + filter + sort
  const filteredUsers = useMemo(() => {
    let list = users;

    if (planFilter !== "all") {
      list = list.filter((u) => u.plan === planFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.business_name || "").toLowerCase().includes(q)
      );
    }

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "health":
          cmp = (a.health_score ?? -1) - (b.health_score ?? -1);
          break;
        case "plan":
          cmp = a.plan.localeCompare(b.plan);
          break;
        case "joined":
        default:
          cmp =
            new Date(a.joined || 0).getTime() - new Date(b.joined || 0).getTime();
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return sorted;
  }, [users, search, planFilter, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  }

  function SortHeader({
    label,
    sort,
    align = "left",
  }: {
    label: string;
    sort: SortKey;
    align?: "left" | "center";
  }) {
    const active = sortKey === sort;
    return (
      <button
        onClick={() => toggleSort(sort)}
        className={`inline-flex items-center gap-1 text-[12px] uppercase tracking-wider font-semibold transition-colors ${
          active ? "text-[#E65100]" : "text-[#8B8B8B] hover:text-[#4B4B4B]"
        } ${align === "center" ? "justify-center" : ""}`}
      >
        {label}
        <Icon
          icon={active && sortAsc ? "ph:caret-up-bold" : "ph:caret-down-bold"}
          className={`w-3 h-3 ${active ? "" : "opacity-0"}`}
        />
      </button>
    );
  }

  const planFilters: { value: PlanFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "trial", label: "Trial" },
    { value: "past_due", label: "Past Due" },
    { value: "canceled", label: "Canceled" },
    { value: "none", label: "None" },
  ];

  // Loading state
  if (authLoading || checkingAdmin) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[#E65100] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[14px] text-[#8B8B8B]">Loading...</p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Access denied
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#FEF2F2] flex items-center justify-center mx-auto mb-4">
                <Icon icon="ph:shield-warning-bold" className="w-8 h-8 text-[#DC2626]" />
              </div>
              <h2 className="text-[20px] font-bold text-[#111111] mb-2">Access Denied</h2>
              <p className="text-[14px] text-[#8B8B8B]">
                You don&apos;t have permission to access the admin panel.
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#FFF7ED] flex items-center justify-center">
                <Icon icon="ph:shield-check-bold" className="w-5 h-5 text-[#E65100]" />
              </div>
              <h1 className="text-[28px] font-bold text-[#111111] tracking-tight">
                Admin Panel
              </h1>
            </div>
            <p className="text-[14px] text-[#8B8B8B] mt-1.5">
              Manage users, subscriptions, and view platform metrics
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loadingData}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E4E4E7] bg-white text-[13px] font-medium text-[#4B4B4B] hover:border-[#E65100] hover:text-[#E65100] disabled:opacity-50 transition-colors"
          >
            <Icon
              icon="ph:arrows-clockwise-bold"
              className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* KPI Cards */}
        {loadingData && !stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-5"
              >
                <div className="h-4 bg-[#F4F4F5] rounded animate-pulse mb-3 w-20" />
                <div className="h-8 bg-[#F4F4F5] rounded animate-pulse w-14" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard
              icon="ph:users-bold"
              iconColor="text-[#8B8B8B]"
              label="Total Users"
              value={String(stats.totalUsers)}
              sub={`+${stats.newSignups7d} in last 7 days`}
            />
            <StatCard
              icon="ph:check-circle-bold"
              iconColor="text-[#16A34A]"
              label="Active Subs"
              value={String(stats.activeSubscribers)}
            />
            <StatCard
              icon="ph:hourglass-bold"
              iconColor="text-[#EA580C]"
              label="Trials"
              value={String(stats.trialUsers)}
            />
            <StatCard
              icon="ph:warning-bold"
              iconColor={stats.pastDue > 0 ? "text-[#DC2626]" : "text-[#8B8B8B]"}
              label="Past Due"
              value={String(stats.pastDue)}
              sub={
                stats.failedPaymentsMTD > 0
                  ? `${stats.failedPaymentsMTD} failed payment${stats.failedPaymentsMTD === 1 ? "" : "s"} MTD`
                  : undefined
              }
            />
            <StatCard
              icon="ph:chart-line-up-bold"
              iconColor="text-[#16A34A]"
              label="MRR"
              value={formatMoney(stats.mrr)}
              sub="Active subs × monthly equivalent"
            />
            <StatCard
              icon="ph:currency-dollar-bold"
              iconColor="text-[#16A34A]"
              label="Receipts (MTD)"
              value={formatMoney(stats.grossReceiptsMTD)}
              sub="Successful payments this month"
            />
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-[#F0F0F2]">
          {(
            [
              { key: "users", label: "Users", icon: "ph:users-bold", count: users.length },
              { key: "payments", label: "Payments", icon: "ph:receipt-bold", count: payments.length },
            ] as { key: Tab; label: string; icon: string; count: number }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? "border-[#E65100] text-[#E65100]"
                  : "border-transparent text-[#8B8B8B] hover:text-[#4B4B4B]"
              }`}
            >
              <Icon icon={t.icon} className="w-4 h-4" />
              {t.label}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  tab === t.key ? "bg-[#FFF7ED] text-[#E65100]" : "bg-[#F4F4F5] text-[#8B8B8B]"
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Users tab */}
        {tab === "users" && (
          <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]">
            <div className="p-5 border-b border-[#F0F0F2] flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Icon
                  icon="ph:magnifying-glass-bold"
                  className="w-4 h-4 text-[#8B8B8B] absolute left-3 top-1/2 -translate-y-1/2"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, or business..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E4E4E7] text-[14px] text-[#111111] placeholder:text-[#9A948E] focus:outline-none focus:border-[#E65100] focus:ring-1 focus:ring-[#E65100] transition-colors"
                />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {planFilters.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setPlanFilter(f.value)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                      planFilter === f.value
                        ? "bg-[#E65100] text-white"
                        : "bg-[#F4F4F5] text-[#4B4B4B] hover:bg-[#E4E4E7]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingData ? (
              <div className="p-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-[#F4F4F5] rounded animate-pulse mb-3" />
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16">
                <Icon icon="ph:users-duotone" className="w-12 h-12 text-[#E4E4E7] mx-auto mb-3" />
                <p className="text-[13px] text-[#8B8B8B]">
                  {users.length === 0 ? "No users found" : "No users match your search"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="border-b border-[#F0F0F2]">
                      <th className="text-left py-3 px-6">
                        <SortHeader label="Name" sort="name" />
                      </th>
                      <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-4">
                        Email
                      </th>
                      <th className="text-left py-3 px-4">
                        <SortHeader label="Plan" sort="plan" />
                      </th>
                      <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-4">
                        Last Payment
                      </th>
                      <th className="text-center py-3 px-4">
                        <SortHeader label="Health" sort="health" align="center" />
                      </th>
                      <th className="text-center text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-4">
                        Periods
                      </th>
                      <th className="text-left py-3 px-4">
                        <SortHeader label="Joined" sort="joined" />
                      </th>
                      <th className="text-right text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-6">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const daysLeft = u.plan === "trial" ? trialDaysLeft(u.trial_end_date) : null;
                      return (
                        <tr
                          key={u.id}
                          className="border-b border-[#F0F0F2] last:border-b-0 hover:bg-[#FAFAFA] transition-colors"
                        >
                          <td className="py-3 px-6">
                            <div>
                              <p className="font-medium text-[#111111]">{u.name}</p>
                              {u.business_name && (
                                <p className="text-[12px] text-[#8B8B8B]">{u.business_name}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-[#4B4B4B]">{u.email}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                              <div className="flex items-center gap-2">
                                <PlanBadge plan={u.plan} />
                                {u.billing_interval && u.plan === "active" && (
                                  <span className="text-[11px] text-[#8B8B8B]">
                                    {u.billing_interval}
                                  </span>
                                )}
                                {u.pricing_promo === "launch" && (
                                  <span
                                    title="Locked launch pricing"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F3E8FD] text-[#7B1FA2]"
                                  >
                                    <Icon icon="ph:lock-simple-bold" className="w-2.5 h-2.5" />
                                    Launch
                                  </span>
                                )}
                              </div>
                              {daysLeft !== null && (
                                <span
                                  className={`text-[11px] font-medium ${
                                    daysLeft <= 0
                                      ? "text-[#DC2626]"
                                      : daysLeft <= 2
                                      ? "text-[#EA580C]"
                                      : "text-[#8B8B8B]"
                                  }`}
                                >
                                  {daysLeft <= 0
                                    ? "Trial expired"
                                    : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                                </span>
                              )}
                              {u.plan === "active" && u.current_period_end && (
                                <span className="text-[11px] text-[#8B8B8B]">
                                  {isLifetime(u.current_period_end)
                                    ? "Lifetime"
                                    : `until ${formatDate(u.current_period_end)}`}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {u.last_payment_date ? (
                              <div>
                                <p
                                  className={`font-medium ${
                                    u.last_payment_status === "failed"
                                      ? "text-[#DC2626]"
                                      : "text-[#111111]"
                                  }`}
                                >
                                  {u.last_payment_amount !== null
                                    ? formatMoney(Number(u.last_payment_amount))
                                    : "—"}
                                </p>
                                <p className="text-[12px] text-[#8B8B8B]">
                                  {formatDate(u.last_payment_date)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[#8B8B8B]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {u.health_score !== null ? (
                              <span
                                className={`font-semibold ${
                                  u.health_score >= 70
                                    ? "text-[#16A34A]"
                                    : u.health_score >= 40
                                    ? "text-[#EA580C]"
                                    : "text-[#DC2626]"
                                }`}
                              >
                                {u.health_score}
                              </span>
                            ) : (
                              <span className="text-[#8B8B8B]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center text-[#4B4B4B]">
                            {u.data_periods}
                          </td>
                          <td className="py-3 px-4 text-[#4B4B4B]">{formatDate(u.joined)}</td>
                          <td className="py-3 px-6">
                            <div className="flex items-center justify-end gap-2">
                              <div className="relative">
                                <button
                                  onClick={() =>
                                    setGrantMenuFor(grantMenuFor === u.id ? null : u.id)
                                  }
                                  disabled={actionLoading === `grant-${u.id}` || u.plan === "active"}
                                  title="Grant Pro subscription"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E4E4E7] text-[12px] font-medium text-[#4B4B4B] hover:border-[#16A34A] hover:text-[#16A34A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Icon icon="ph:crown-bold" className="w-3.5 h-3.5" />
                                  {actionLoading === `grant-${u.id}` ? "..." : "Grant Pro"}
                                  <Icon icon="ph:caret-down-bold" className="w-3 h-3" />
                                </button>
                                {grantMenuFor === u.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-30"
                                      onClick={() => setGrantMenuFor(null)}
                                    />
                                    <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-lg border border-[#E4E4E7] shadow-lg overflow-hidden min-w-[150px]">
                                      {GRANT_OPTIONS.map((opt) => (
                                        <button
                                          key={opt.value}
                                          onClick={() => confirmGrantPro(u, opt.value)}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#4B4B4B] hover:bg-[#FAFAFA] hover:text-[#16A34A] transition-colors text-left"
                                        >
                                          <Icon icon={opt.icon} className="w-3.5 h-3.5" />
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                              <button
                                onClick={() => confirmExtendTrial(u)}
                                disabled={actionLoading === `trial-${u.id}`}
                                title="Extend trial by 7 days"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E4E4E7] text-[12px] font-medium text-[#4B4B4B] hover:border-[#EA580C] hover:text-[#EA580C] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                <Icon icon="ph:plus-bold" className="w-3.5 h-3.5" />
                                {actionLoading === `trial-${u.id}` ? "..." : "+7 Days"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Payments tab */}
        {tab === "payments" && (
          <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]">
            <div className="p-5 border-b border-[#F0F0F2]">
              <h2 className="text-[16px] font-semibold text-[#111111]">Recent Payments</h2>
              <p className="text-[13px] text-[#8B8B8B] mt-0.5">
                Last {payments.length} transactions across all users
              </p>
            </div>

            {loadingData ? (
              <div className="p-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-[#F4F4F5] rounded animate-pulse mb-3" />
                ))}
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-16">
                <Icon icon="ph:receipt-duotone" className="w-12 h-12 text-[#E4E4E7] mx-auto mb-3" />
                <p className="text-[13px] text-[#8B8B8B]">No payments recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="border-b border-[#F0F0F2]">
                      <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-6">
                        Date
                      </th>
                      <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-4">
                        User
                      </th>
                      <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-4">
                        Description
                      </th>
                      <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-4">
                        Status
                      </th>
                      <th className="text-right text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-6">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-[#F0F0F2] last:border-b-0 hover:bg-[#FAFAFA] transition-colors"
                      >
                        <td className="py-3 px-6 text-[#4B4B4B] whitespace-nowrap">
                          {formatDate(p.created_at)}
                        </td>
                        <td className="py-3 px-4 text-[#4B4B4B]">{p.email}</td>
                        <td className="py-3 px-4">
                          <p className="text-[#111111]">{p.description}</p>
                          <p className="text-[12px] text-[#8B8B8B] capitalize">
                            {p.type.replace("_", " ")}
                            {p.billing_interval ? ` · ${p.billing_interval}` : ""}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <PaymentStatusBadge status={p.status} />
                        </td>
                        <td
                          className={`py-3 px-6 text-right font-semibold ${
                            p.status === "failed" || p.status === "refunded"
                              ? "text-[#DC2626]"
                              : "text-[#111111]"
                          }`}
                        >
                          {p.status === "refunded" ? "−" : ""}
                          {formatMoney(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {confirm && <ConfirmDialog confirm={confirm} onCancel={() => setConfirm(null)} />}
    </AppLayout>
  );
}
