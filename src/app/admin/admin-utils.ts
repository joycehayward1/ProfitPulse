import type { AccessSummary, AccessReason } from "@/lib/feature-gate";

export async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const { getAccessToken } = await import("@/lib/insforge");
  const token = await getAccessToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  // Date-only values (YYYY-MM-DD) parse as UTC midnight, which is the previous
  // day in Bermuda — anchor them at local noon instead.
  const value = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export const ACCESS_REASON_LABELS: Record<AccessReason, string> = {
  paid: "Paying subscriber",
  lifetime: "Lifetime (granted)",
  granted: "Free Pro (granted)",
  canceled_in_period: "Canceled, paid time left",
  comped: "Comped days",
  grace: "Payment failed, grace period",
  trial: "Free trial",
  trial_expired: "Trial ended",
  canceled: "Canceled",
  past_due: "Payment failed",
  lapsed: "Paid period ended, no renewal",
  grant_ended: "Free access ended",
  none: "No subscription",
};

/** Short "until" text for an access summary. */
export function accessUntilText(access: AccessSummary): string {
  if (access.level === "locked" || !access.until) return "";
  if (access.reason === "lifetime") return "Lifetime";
  return `until ${formatDate(access.until)}`;
}

export interface AdminAction {
  id: string;
  admin_email: string;
  action: string;
  target_user_id?: string | null;
  target_email?: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const GRANT_TEXT: Record<string, string> = {
  "1m": "1 month",
  "3m": "3 months",
  "6m": "6 months",
  "12m": "12 months",
  lifetime: "lifetime",
};

/** Plain-English description of an admin action (without the target). */
export function describeAction(a: AdminAction): string {
  const d = a.details ?? {};
  switch (a.action) {
    case "grant_pro":
      return d.duration === "custom"
        ? `Granted free Pro until ${formatDate(d.access_until as string)}`
        : `Granted ${GRANT_TEXT[d.duration as string] ?? ""} of free Pro`;
    case "extend_trial":
      return `Extended trial by ${d.days} days (now ends ${formatDate(d.new_trial_end as string)})`;
    case "comp_days":
      return `Gave ${d.days} free days (${d.total_comp_days} total)`;
    case "comped_email_add":
      return `Added to comp list (${d.access_months ? `${d.access_months} months free` : "lifetime"})`;
    case "comped_email_remove":
      return "Removed from comp list";
    case "send_password_reset":
      return "Sent password reset email";
    case "resend_verification":
      return "Resent verification email";
    default:
      return a.action;
  }
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  business_name: string | null;
  plan: string;
  billing_interval: string | null;
  trial_end_date: string | null;
  next_billing_date: string | null;
  current_period_end: string | null;
  pricing_promo: string | null;
  comp_days: number;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  last_payment_status: string | null;
  access: AccessSummary;
  health_score: number | null;
  data_periods: number;
  joined: string | null;
}

/** The name to show for a user, falling back to their email. */
export function displayName(u: Pick<AdminUser, "name" | "email">): string {
  return u.name && u.name !== "—" ? u.name : u.email;
}

export function initials(u: Pick<AdminUser, "name" | "email">): string {
  const source = displayName(u).replace(/@.*/, "");
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Whole days from now until `date` (negative if past). */
export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

/** One-line access status, e.g. "Paying until Oct 25, 2026". */
export function accessLine(access: AccessSummary): string {
  switch (access.reason) {
    case "paid":
      return `Paying until ${formatDate(access.until)}`;
    case "lifetime":
      return "Free for life";
    case "granted":
      return `Free Pro until ${formatDate(access.until)}`;
    case "grant_ended":
      return "Free access ended";
    case "canceled_in_period":
      return `Canceled, can use it until ${formatDate(access.until)}`;
    case "comped":
      return `Free time until ${formatDate(access.until)}`;
    case "grace":
      return `Payment failed, grace until ${formatDate(access.until)}`;
    case "trial": {
      const d = daysUntil(access.until);
      return d !== null && d <= 1 ? "Trial ends today" : `Trial, ${d} days left`;
    }
    case "trial_expired":
      return "Trial ended";
    case "canceled":
      return "Canceled";
    case "past_due":
      return "Payment failed";
    case "lapsed":
      return "Paid period ended";
    default:
      return "Never subscribed";
  }
}


export type GrantDuration = "1m" | "3m" | "6m" | "12m" | "lifetime" | "custom";

export const GRANT_CHOICES: { value: Exclude<GrantDuration, "custom">; label: string }[] = [
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "12m", label: "12 months" },
  { value: "lifetime", label: "For life" },
];

/** Goodwill credit presets: extra free days added after the paid period ends. */
export const COMP_CHOICES: { days: number; label: string }[] = [
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
];

/** Trial extension presets, in days. */
export const TRIAL_CHOICES = [7, 14, 30];

/** "Aug 2026" for a month of financial data (YYYY-MM-DD). */
export function formatMonth(date: string | null | undefined): string {
  if (!date) return "—";
  const [y, m] = date.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, 15).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Local calendar date (YYYY-MM-DD) `offsetDays` from today. */
export function localISODate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Whole calendar days from today to `date` (0 = today, 1 = tomorrow, -1 = yesterday). */
export function calendarDaysUntil(date: string | null): number | null {
  if (!date) return null;
  const target = new Date(date);
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}
