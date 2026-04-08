"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getInsForgeClient } from "@/lib/insforge";

interface WaitlistRow {
  id: string;
  email: string;
  name: string | null;
  business_name: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_url: string | null;
  created_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toCSV(rows: WaitlistRow[]): string {
  const headers = [
    "id",
    "email",
    "name",
    "business_name",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "referrer",
    "landing_url",
    "created_at",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const body = rows
    .map((r) =>
      headers
        .map((h) => escape((r as unknown as Record<string, unknown>)[h]))
        .join(",")
    )
    .join("\n");
  return `${headers.join(",")}\n${body}`;
}

export default function AdminWaitlistPage() {
  const router = useRouter();
  const { user } = useRequireAuth();
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const client = getInsForgeClient();
        const { data: sessionData } = await client.auth.getCurrentSession();
        const token = sessionData?.session?.accessToken;
        if (!token) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/admin/waitlist", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 403) {
          setError("You don't have access to this page.");
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError("Failed to load waitlist");
          setLoading(false);
          return;
        }
        const json = await res.json();
        setRows(json.rows ?? []);
      } catch (err) {
        console.error(err);
        setError("Failed to load waitlist");
      } finally {
        setLoading(false);
      }
    }
    if (user?.id) load();
  }, [user?.id]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const needle = search.toLowerCase();
    return (
      r.email.toLowerCase().includes(needle) ||
      (r.name ?? "").toLowerCase().includes(needle) ||
      (r.business_name ?? "").toLowerCase().includes(needle) ||
      (r.utm_source ?? "").toLowerCase().includes(needle) ||
      (r.utm_campaign ?? "").toLowerCase().includes(needle)
    );
  });

  function downloadCSV() {
    const csv = toCSV(filtered.length ? filtered : rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-md">
        <div className="flex items-center justify-between flex-wrap gap-md">
          <div>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-2 text-small text-text-secondary hover:text-text-primary transition-colors mb-sm"
            >
              <Icon icon="lucide:arrow-left" width={16} height={16} />
              Back to dashboard
            </button>
            <h1 className="font-display text-h1 text-text-primary">
              Waitlist{" "}
              <span className="text-text-muted font-body text-h3">
                ({rows.length})
              </span>
            </h1>
          </div>
          <Button variant="primary" size="md" onClick={downloadCSV} disabled={!rows.length}>
            <Icon icon="ph:download-simple-bold" className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
        </div>

        {loading ? (
          <div className="bg-surface rounded-xl p-xl border border-[#E5E0DA] text-center text-text-muted">
            Loading waitlist…
          </div>
        ) : error ? (
          <div className="bg-error/5 border border-error/20 rounded-xl p-xl text-center text-error">
            {error}
          </div>
        ) : (
          <>
            <div className="relative">
              <Icon
                icon="lucide:search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                width={16}
                height={16}
              />
              <input
                type="search"
                placeholder="Search email, name, business, UTM..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-body font-body text-text-primary bg-surface border border-[#D1D5DB] rounded-md focus:border-orange focus:ring-2 focus:ring-orange/20 focus:outline-none"
              />
            </div>

            <div className="bg-surface rounded-xl border border-[#E5E0DA] overflow-hidden">
              {filtered.length === 0 ? (
                <div className="text-center py-xl text-text-muted">
                  {rows.length === 0
                    ? "No signups yet."
                    : "No results matching your search."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-small">
                    <thead>
                      <tr className="border-b border-[#E5E0DA] bg-[#FAF8F5]">
                        <th className="text-left py-sm px-md text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          Email
                        </th>
                        <th className="text-left py-sm px-md text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          Name
                        </th>
                        <th className="text-left py-sm px-md text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          Business
                        </th>
                        <th className="text-left py-sm px-md text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          Source
                        </th>
                        <th className="text-left py-sm px-md text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          Campaign
                        </th>
                        <th className="text-left py-sm px-md text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          Signed up
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-[#E5E0DA]/50 last:border-0 hover:bg-[#FAF8F5]/50"
                        >
                          <td className="py-sm px-md text-text-primary font-medium">
                            {r.email}
                          </td>
                          <td className="py-sm px-md text-text-secondary">
                            {r.name ?? "—"}
                          </td>
                          <td className="py-sm px-md text-text-secondary">
                            {r.business_name ?? "—"}
                          </td>
                          <td className="py-sm px-md text-text-secondary">
                            {r.utm_source ?? "—"}
                          </td>
                          <td className="py-sm px-md text-text-secondary">
                            {r.utm_campaign ?? "—"}
                          </td>
                          <td className="py-sm px-md text-text-muted whitespace-nowrap">
                            {formatDate(r.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
