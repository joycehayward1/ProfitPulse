"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/contexts/AuthContext";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  business_name: string | null;
  plan: string;
  billing_interval: string | null;
  trial_end_date: string | null;
  health_score: number | null;
  data_periods: number;
  joined: string | null;
}

interface AdminStats {
  totalUsers: number;
  activeSubscribers: number;
  trialUsers: number;
  monthlyRevenue: number;
}

function PlanBadge({ plan }: { plan: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", label: "Active" },
    trial: { bg: "bg-[#FFF7ED]", text: "text-[#EA580C]", label: "Trial" },
    canceled: { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", label: "Canceled" },
    past_due: { bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", label: "Past Due" },
    terminated: { bg: "bg-[#F4F4F5]", text: "text-[#8B8B8B]", label: "Terminated" },
    expired: { bg: "bg-[#F4F4F5]", text: "text-[#8B8B8B]", label: "Expired" },
    none: { bg: "bg-[#F4F4F5]", text: "text-[#8B8B8B]", label: "None" },
  };

  const c = config[plan] || config.none;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

export default function AdminPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { user: authUser } = useAuth();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const email = authUser?.email || user?.email || "";

  // Check admin status
  useEffect(() => {
    if (!email) return;

    async function checkAdmin() {
      try {
        const res = await fetch(`/api/admin/check?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        setIsAdmin(data.isAdmin === true);
      } catch {
        setIsAdmin(false);
      } finally {
        setCheckingAdmin(false);
      }
    }
    checkAdmin();
  }, [email]);

  // Load admin data
  const loadData = useCallback(async () => {
    if (!email || !isAdmin) return;
    setLoadingData(true);

    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch(`/api/admin/stats?email=${encodeURIComponent(email)}`),
        fetch(`/api/admin/users?email=${encodeURIComponent(email)}`),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoadingData(false);
    }
  }, [email, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, loadData]);

  // Actions
  async function handleGrantPro(userId: string) {
    setActionLoading(`grant-${userId}`);
    try {
      const res = await fetch("/api/admin/grant-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error("Grant pro failed:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExtendTrial(userId: string) {
    setActionLoading(`trial-${userId}`);
    try {
      const res = await fetch("/api/admin/extend-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error("Extend trial failed:", err);
    } finally {
      setActionLoading(null);
    }
  }

  // Loading state
  if (authLoading || checkingAdmin) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto px-4 py-8">
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
        <div className="max-w-6xl mx-auto px-4 py-8">
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
      <div className="max-w-6xl mx-auto space-y-8 px-4 py-8">
        {/* Header */}
        <div>
          <h1 className="text-[28px] font-bold text-[#111111] tracking-tight">
            Admin Panel
          </h1>
          <p className="text-[14px] text-[#8B8B8B] mt-1">
            Manage users, subscriptions, and view platform metrics
          </p>
        </div>

        {/* KPI Cards */}
        {loadingData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6"
              >
                <div className="h-4 bg-[#F4F4F5] rounded animate-pulse mb-3 w-24" />
                <div className="h-8 bg-[#F4F4F5] rounded animate-pulse w-16" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="ph:users-bold" className="w-4 h-4 text-[#8B8B8B]" />
                <p className="text-[13px] font-medium text-[#8B8B8B]">Total Users</p>
              </div>
              <p className="text-[28px] font-bold text-[#111111]">{stats.totalUsers}</p>
            </div>

            <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="ph:check-circle-bold" className="w-4 h-4 text-[#16A34A]" />
                <p className="text-[13px] font-medium text-[#8B8B8B]">Active Subscribers</p>
              </div>
              <p className="text-[28px] font-bold text-[#111111]">{stats.activeSubscribers}</p>
            </div>

            <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="ph:hourglass-bold" className="w-4 h-4 text-[#EA580C]" />
                <p className="text-[13px] font-medium text-[#8B8B8B]">Trial Users</p>
              </div>
              <p className="text-[28px] font-bold text-[#111111]">{stats.trialUsers}</p>
            </div>

            <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="ph:currency-dollar-bold" className="w-4 h-4 text-[#16A34A]" />
                <p className="text-[13px] font-medium text-[#8B8B8B]">Monthly Revenue</p>
              </div>
              <p className="text-[28px] font-bold text-[#111111]">
                ${stats.monthlyRevenue.toFixed(2)}
              </p>
            </div>
          </div>
        ) : null}

        {/* Users Table */}
        <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)]">
          <div className="p-6 border-b border-[#F0F0F2]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-semibold text-[#111111]">Users</h2>
                <p className="text-[13px] text-[#8B8B8B] mt-0.5">
                  {users.length} user{users.length !== 1 ? "s" : ""} registered
                </p>
              </div>
              <button
                onClick={loadData}
                disabled={loadingData}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E4E4E7] text-[13px] font-medium text-[#4B4B4B] hover:border-[#E65100] hover:text-[#E65100] disabled:opacity-50 transition-colors"
              >
                <Icon
                  icon="ph:arrows-clockwise-bold"
                  className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>

          {loadingData ? (
            <div className="p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-[#F4F4F5] rounded animate-pulse mb-3" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16">
              <Icon icon="ph:users-duotone" className="w-12 h-12 text-[#E4E4E7] mx-auto mb-3" />
              <p className="text-[13px] text-[#8B8B8B]">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-[#F0F0F2]">
                    <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-6">
                      Name
                    </th>
                    <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-4">
                      Email
                    </th>
                    <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-4">
                      Plan
                    </th>
                    <th className="text-center text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-4">
                      Health
                    </th>
                    <th className="text-center text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-4">
                      Periods
                    </th>
                    <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-4">
                      Joined
                    </th>
                    <th className="text-right text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] py-3 px-6">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
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
                        <div className="flex items-center gap-2">
                          <PlanBadge plan={u.plan} />
                          {u.billing_interval && u.plan === "active" && (
                            <span className="text-[11px] text-[#8B8B8B]">
                              {u.billing_interval}
                            </span>
                          )}
                        </div>
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
                      <td className="py-3 px-4 text-[#4B4B4B]">
                        {u.joined
                          ? new Date(u.joined).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleGrantPro(u.id)}
                            disabled={actionLoading === `grant-${u.id}` || u.plan === "active"}
                            title="Grant Pro subscription"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E4E4E7] text-[12px] font-medium text-[#4B4B4B] hover:border-[#16A34A] hover:text-[#16A34A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <Icon icon="ph:crown-bold" className="w-3.5 h-3.5" />
                            {actionLoading === `grant-${u.id}` ? "..." : "Grant Pro"}
                          </button>
                          <button
                            onClick={() => handleExtendTrial(u.id)}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
