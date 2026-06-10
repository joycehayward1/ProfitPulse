"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Papa, { ParseResult } from "papaparse";
import { Icon } from "@iconify/react";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, CurrencyInput } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getInsForgeClient } from "@/lib/insforge";
import type { FinancialSnapshot } from "@/lib/database.types";

type Tab = "manual" | "upload" | "quickbooks";

interface FormData {
  cash: string;
  revenue: string;
  expenses: string;
  receivables: string;
  payables: string;
  ytdRevenue: string;
  ytdExpenses: string;
  inventoryValue: string;
  period: string;
}

interface ExpenseBreakdown {
  rent: string;
  payroll: string;
  supplies: string;
  marketing: string;
  other: string;
}

interface HistoryEntry {
  id: string;
  period: string;
  cash: number;
  revenue: number;
  expenses: number;
  receivables: number;
  payables: number;
  ytdRevenue: number;
  ytdExpenses: number;
  inventoryValue: number;
  createdAt: string;
  dataSource: string;
  expenseBreakdown?: {
    rent?: number;
    payroll?: number;
    supplies?: number;
    marketing?: number;
    other?: number;
  } | null;
}

interface CSVRow {
  [key: string]: string;
}

interface ColumnMapping {
  revenue: string;
  expenses: string;
  cashBalance: string;
  date: string;
}

type ColumnMappingKey = keyof ColumnMapping;

interface HealthAssessmentRow {
  id: string;
  created_at: string;
  cash_on_hand: number | null;
  monthly_revenue: number | null;
  monthly_expenses: number | null;
  accounts_receivable: number | null;
  accounts_payable: number | null;
  ytd_revenue: number | null;
  ytd_expenses: number | null;
  inventory_value: number | null;
  expense_breakdown: {
    rent?: number;
    payroll?: number;
    supplies?: number;
    marketing?: number;
    other?: number;
  } | null;
}

interface QuickBooksSyncMetrics {
  cash: number;
  revenue: number;
  expenses: number;
  receivables: number;
  payables: number;
  ytdRevenue: number;
  ytdExpenses: number;
  inventoryValue: number;
}

interface RichSnapshot {
  period_date: string;
  data_source: string;
  total_income: number | null;
  gross_profit: number | null;
  total_expenses: number | null;
  net_operating_income: number | null;
  net_profit: number | null;
  gross_profit_margin: number | null;
  net_profit_margin: number | null;
  current_assets: number | null;
  fixed_assets: number | null;
  total_assets: number | null;
  current_liabilities: number | null;
  long_term_liabilities: number | null;
  equity: number | null;
  operating_activities: number | null;
  investing_activities: number | null;
  financing_activities: number | null;
  net_cash_flow: number | null;
  current_ratio: number | null;
  working_capital: number | null;
  roa: number | null;
  roe: number | null;
  pl_detail: Record<string, number> | null;
  bs_detail: Record<string, number> | null;
  cf_detail: Record<string, number> | null;
}

interface QuickBooksSyncResponse {
  success: boolean;
  realmId?: string;
  pulledAt?: string;
  periods?: {
    monthlyStart: string;
    monthlyEnd: string;
    ytdStart: string;
    ytdEnd: string;
  };
  metrics?: QuickBooksSyncMetrics;
  richSnapshot?: RichSnapshot;
  error?: string;
}

interface DatabaseErrorLike {
  code?: string;
  message?: string;
}

interface AISnapshotData {
  period_date: string | null;
  total_income: number | null;
  gross_profit: number | null;
  total_expenses: number | null;
  net_operating_income: number | null;
  net_profit: number | null;
  gross_profit_margin: number | null;
  net_profit_margin: number | null;
  current_assets: number | null;
  fixed_assets: number | null;
  total_assets: number | null;
  current_liabilities: number | null;
  long_term_liabilities: number | null;
  equity: number | null;
  operating_activities: number | null;
  investing_activities: number | null;
  financing_activities: number | null;
  net_cash_flow: number | null;
  working_capital: number | null;
  current_ratio: number | null;
  roa: number | null;
  roe: number | null;
}

type UploadStep = "idle" | "reading" | "processing" | "confirm" | "saving";

/**
 * In-progress work is mirrored to localStorage so navigating away (e.g. to
 * the Glossary) and coming back doesn't wipe what the user was entering.
 * Drafts are per-user and expire after 24 hours.
 */
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getDraftKey(userId: string) {
  return `pp-data-draft-v1:${userId}`;
}

interface DataEntryDraft {
  savedAt: number;
  formData: FormData;
  expenseBreakdown: ExpenseBreakdown;
  showExpenseBreakdown: boolean;
  /** Present when the user was mid-way through a spreadsheet upload. */
  parsedSnapshots?: AISnapshotData[];
  activeSnapshotIndex?: number;
}

function readDraft(userId: string): DataEntryDraft | null {
  try {
    const raw = window.localStorage.getItem(getDraftKey(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as DataEntryDraft;
    if (!draft.savedAt || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(getDraftKey(userId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

interface SnapshotField {
  key: keyof AISnapshotData;
  label: string;
  format: "currency" | "percent" | "ratio";
}

const SNAPSHOT_SECTIONS: Array<{
  title: string;
  fields: SnapshotField[];
}> = [
  {
    title: "Profit & Loss",
    fields: [
      { key: "total_income", label: "Total Income", format: "currency" },
      { key: "gross_profit", label: "Gross Profit", format: "currency" },
      { key: "total_expenses", label: "Total Expenses", format: "currency" },
      { key: "net_operating_income", label: "Net Operating Income", format: "currency" },
      { key: "net_profit", label: "Net Profit", format: "currency" },
      { key: "gross_profit_margin", label: "Gross Profit Margin", format: "percent" },
      { key: "net_profit_margin", label: "Net Profit Margin", format: "percent" },
    ],
  },
  {
    title: "Balance Sheet",
    fields: [
      { key: "current_assets", label: "Current Assets", format: "currency" },
      { key: "fixed_assets", label: "Fixed Assets", format: "currency" },
      { key: "total_assets", label: "Total Assets", format: "currency" },
      { key: "current_liabilities", label: "Current Liabilities", format: "currency" },
      { key: "long_term_liabilities", label: "Long-term Liabilities", format: "currency" },
      { key: "equity", label: "Equity", format: "currency" },
      { key: "working_capital", label: "Working Capital", format: "currency" },
      { key: "current_ratio", label: "Current Ratio", format: "ratio" },
      { key: "roa", label: "Return on Assets (ROA)", format: "percent" },
      { key: "roe", label: "Return on Equity (ROE)", format: "percent" },
    ],
  },
  {
    title: "Cash Flow",
    fields: [
      { key: "operating_activities", label: "Operating Activities", format: "currency" },
      { key: "investing_activities", label: "Investing Activities", format: "currency" },
      { key: "financing_activities", label: "Financing Activities", format: "currency" },
      { key: "net_cash_flow", label: "Net Cash Flow", format: "currency" },
    ],
  },
];

function DataContent() {
  const { user } = useRequireAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("manual");
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Upload States
  const [_isDragging, setIsDragging] = useState(false);
  const [_csvFiles, setCsvFiles] = useState<File[]>([]);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [_csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    revenue: "",
    expenses: "",
    cashBalance: "",
    date: "",
  });
  const [_isImporting, setIsImporting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    cash: "",
    revenue: "",
    expenses: "",
    receivables: "",
    payables: "",
    ytdRevenue: "",
    ytdExpenses: "",
    inventoryValue: "",
    period: getCurrentPeriod(),
  });

  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdown>({
    rent: "",
    payroll: "",
    supplies: "",
    marketing: "",
    other: "",
  });

  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbConnected, setQbConnected] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbRealmId, setQbRealmId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbLastSyncAt, setQbLastSyncAt] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbSyncing, setQbSyncing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbConnecting, setQbConnecting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbDisconnecting, setQbDisconnecting] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const quickBooksModeLocked = false; // QB disabled — coming soon

  // AI Upload States
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsedSnapshots, setParsedSnapshots] = useState<AISnapshotData[]>([]);
  const [activeSnapshotIndex, setActiveSnapshotIndex] = useState(0);
  // Legacy single-snapshot aliases for backward compat in UI
  const parsedSnapshot = parsedSnapshots[activeSnapshotIndex] ?? null;
  const confirmPeriod = parsedSnapshot?.period_date ? (() => {
    const d = new Date(parsedSnapshot.period_date!);
    if (isNaN(d.getTime())) return getCurrentPeriod();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })() : getCurrentPeriod();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [_sheetNames, setSheetNames] = useState<string[]>([]);
  const [_selectedSheet, setSelectedSheet] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workbookRef = useRef<any>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  function toInputCurrency(value: number) {
    if (!Number.isFinite(value) || value <= 0) return "";
    return Math.round(value).toLocaleString("en-US");
  }

  function toMonthInputValue(period: string) {
    if (!period) return getCurrentPeriod();
    const parsed = new Date(period);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      return `${year}-${month}`;
    }

    const [year, month] = period.split("-");
    if (!year || !month) return getCurrentPeriod();
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function formatDataSourceLabel(dataSource: string) {
    if (dataSource === "quickbooks") return "QuickBooks";
    if (dataSource === "spreadsheet") return "Spreadsheet Upload";
    if (dataSource === "assessment") return "Assessment";
    return "Manual Entry";
  }

  function normalizePeriodDate(input: string): string | null {
    if (!input) return null;
    if (/^\d{4}-\d{2}$/.test(input)) {
      return `${input}-01`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }

    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function mapAssessmentToHistoryEntry(row: HealthAssessmentRow): HistoryEntry {
    return {
      id: `assessment-${row.id}`,
      period: row.created_at || `${getCurrentPeriod()}-01`,
      cash: row.cash_on_hand || 0,
      revenue: row.monthly_revenue || 0,
      expenses: row.monthly_expenses || 0,
      receivables: row.accounts_receivable || 0,
      payables: row.accounts_payable || 0,
      ytdRevenue: row.ytd_revenue || 0,
      ytdExpenses: row.ytd_expenses || 0,
      inventoryValue: row.inventory_value || 0,
      createdAt: row.created_at || new Date().toISOString(),
      dataSource: "assessment",
      expenseBreakdown: row.expense_breakdown || null,
    };
  }

  function applyEntryToForm(entry: HistoryEntry) {
    setFormData({
      cash: toInputCurrency(entry.cash),
      revenue: toInputCurrency(entry.revenue),
      expenses: toInputCurrency(entry.expenses),
      receivables: toInputCurrency(entry.receivables),
      payables: toInputCurrency(entry.payables),
      ytdRevenue: toInputCurrency(entry.ytdRevenue),
      ytdExpenses: toInputCurrency(entry.ytdExpenses),
      inventoryValue: toInputCurrency(entry.inventoryValue),
      period: toMonthInputValue(entry.period),
    });

    const breakdown = entry.expenseBreakdown || {};
    const hasBreakdown =
      Boolean(breakdown.rent) ||
      Boolean(breakdown.payroll) ||
      Boolean(breakdown.supplies) ||
      Boolean(breakdown.marketing) ||
      Boolean(breakdown.other);

    setExpenseBreakdown({
      rent: toInputCurrency(breakdown.rent || 0),
      payroll: toInputCurrency(breakdown.payroll || 0),
      supplies: toInputCurrency(breakdown.supplies || 0),
      marketing: toInputCurrency(breakdown.marketing || 0),
      other: toInputCurrency(breakdown.other || 0),
    });
    setShowExpenseBreakdown(hasBreakdown);
  }

  function mapSnapshotToHistoryEntry(row: FinancialSnapshot): HistoryEntry {
    return {
      id: row.id,
      period: row.period_date || getCurrentPeriod(),
      cash: row.current_assets ?? 0,
      revenue: row.total_income ?? 0,
      expenses: row.total_expenses ?? 0,
      receivables: row.accounts_receivable ?? 0,
      payables: row.current_liabilities ?? 0,
      ytdRevenue: row.ytd_revenue ?? 0,
      ytdExpenses: row.ytd_expenses ?? 0,
      inventoryValue: row.inventory_value ?? 0,
      createdAt: row.created_at,
      dataSource: row.data_source || "manual",
      expenseBreakdown: row.expense_breakdown ?? null,
    };
  }

  async function refreshHistory(prefillLatest: boolean) {
    if (!user) return;

    const client = getInsForgeClient();

    const { data: snapData, error: snapError } = await client.database
      .from("financial_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (snapError) {
      console.error("Error loading financial_snapshots history:", snapError);
    }

    const allEntries: HistoryEntry[] = (snapData || []).map((row) =>
      mapSnapshotToHistoryEntry(row as FinancialSnapshot)
    );

    setHistoryEntries(allEntries);

    if (allEntries.length > 0) {
      if (prefillLatest) {
        applyEntryToForm(allEntries[0]);
      }
      return;
    }

    // Fallback: prefill form from latest health_assessment if no snapshots exist
    const { data: assessment, error: assessmentError } = await client.database
      .from("health_assessments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!assessmentError && assessment) {
      const assessmentRow = assessment as HealthAssessmentRow;
      const fallbackEntry = mapAssessmentToHistoryEntry(assessmentRow);
      if (prefillLatest) {
        applyEntryToForm(fallbackEntry);
      }
    }
  }

  async function getAuthHeaders(): Promise<Record<string, string> | null> {
    const client = getInsForgeClient();
    const { data, error } = await client.auth.getCurrentSession();
    if (error || !data?.session?.accessToken) {
      return null;
    }

    return {
      Authorization: `Bearer ${data.session.accessToken}`,
    };
  }

  async function checkQuickBooksStatus() {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) return;

    const res = await fetch("/api/quickbooks/status", {
      headers: authHeaders,
    });
    if (!res.ok) return;

    const data = await res.json();
    setQbConnected(Boolean(data.connected));
    setQbRealmId(data.realmId || null);
    setQbLastSyncAt(data.lastSyncAt || null);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function syncQuickBooksToFinancialData() {
    if (!user) return;

    const authHeaders = await getAuthHeaders();
    if (!authHeaders) {
      showToast("error", "Your session expired. Please log in again.");
      return;
    }

    setQbSyncing(true);
    try {
      const response = await fetch("/api/quickbooks/assessment-data", {
        method: "GET",
        headers: authHeaders,
      });

      const payload = (await response.json()) as QuickBooksSyncResponse;
      if (!response.ok || !payload.success || !payload.metrics) {
        showToast("error", payload.error || "Failed to sync QuickBooks data.");
        return;
      }

      const periodFromQuickBooks = payload.periods?.monthlyEnd
        ? normalizePeriodDate(payload.periods.monthlyEnd)
        : normalizePeriodDate(getCurrentPeriod());

      if (!periodFromQuickBooks) {
        showToast("error", "QuickBooks sync returned an invalid period.");
        return;
      }

      const metrics = payload.metrics;
      const { getInsForgeClient: getClient } = await import("@/lib/insforge");
      const client = getClient();

      // Upsert into financial_snapshots (single source of truth)
      const snapshotRow = payload.richSnapshot
        ? {
            user_id: user.id,
            ...payload.richSnapshot,
            period_date: periodFromQuickBooks,
          }
        : {
            user_id: user.id,
            period_date: periodFromQuickBooks,
            data_source: "quickbooks",
            total_income: metrics.revenue || 0,
            total_expenses: metrics.expenses || 0,
            net_profit: (metrics.revenue || 0) - (metrics.expenses || 0),
            current_assets: metrics.cash || 0,
            current_liabilities: metrics.payables || 0,
          };

      const { error } = await client.database
        .from("financial_snapshots")
        .upsert([snapshotRow], { onConflict: "user_id,period_date" });

      if (error) {
        console.error("Failed to save QuickBooks sync snapshot:", error);
        const dbError = error as DatabaseErrorLike;
        showToast(
          "error",
          dbError.message
            ? `QuickBooks synced but save failed: ${dbError.message}`
            : "QuickBooks synced but save failed."
        );
        return;
      }

      setQbConnected(true);
      setQbRealmId(payload.realmId || qbRealmId);
      setQbLastSyncAt(payload.pulledAt || new Date().toISOString());

      setFormData((prev) => ({
        ...prev,
        cash: toInputCurrency(metrics.cash || 0),
        revenue: toInputCurrency(metrics.revenue || 0),
        expenses: toInputCurrency(metrics.expenses || 0),
        receivables: toInputCurrency(metrics.receivables || 0),
        payables: toInputCurrency(metrics.payables || 0),
        ytdRevenue: toInputCurrency(metrics.ytdRevenue || 0),
        ytdExpenses: toInputCurrency(metrics.ytdExpenses || 0),
        inventoryValue: toInputCurrency(metrics.inventoryValue || 0),
        period: toMonthInputValue(periodFromQuickBooks),
      }));

      await refreshHistory(true);
      showToast("success", "QuickBooks synced and your data was updated.");
    } catch (error) {
      console.error("QuickBooks sync error:", error);
      showToast("error", "Failed to sync QuickBooks data.");
    } finally {
      setQbSyncing(false);
    }
  }

  // ── Draft persistence ──────────────────────────────────────────────
  // Restore any in-progress draft first so navigating to the Glossary (or
  // anywhere else) and coming back doesn't lose what the user was typing.
  // Keyed on the stable user id (not the user object) so the effects don't
  // re-fire on every render.
  const userId = user?.id ?? null;
  const formDirtyRef = useRef(false);
  const draftRestoredRef = useRef(false);

  useEffect(() => {
    if (!userId || draftRestoredRef.current) return;
    const draft = readDraft(userId);
    if (!draft) return;
    setFormData(draft.formData);
    setExpenseBreakdown(draft.expenseBreakdown);
    setShowExpenseBreakdown(draft.showExpenseBreakdown);
    if (draft.parsedSnapshots && draft.parsedSnapshots.length > 0) {
      setParsedSnapshots(draft.parsedSnapshots);
      setActiveSnapshotIndex(draft.activeSnapshotIndex ?? 0);
      setUploadStep("confirm");
    }
    formDirtyRef.current = true;
    draftRestoredRef.current = true;
  }, [userId]);

  // Mirror in-progress work to localStorage once the user has touched the page.
  useEffect(() => {
    if (!userId || !formDirtyRef.current) return;
    const draft: DataEntryDraft = {
      savedAt: Date.now(),
      formData,
      expenseBreakdown,
      showExpenseBreakdown,
      ...(uploadStep === "confirm" && parsedSnapshots.length > 0
        ? { parsedSnapshots, activeSnapshotIndex }
        : {}),
    };
    try {
      window.localStorage.setItem(getDraftKey(userId), JSON.stringify(draft));
    } catch {
      // Storage unavailable — the draft backup is best-effort.
    }
  }, [
    userId,
    formData,
    expenseBreakdown,
    showExpenseBreakdown,
    uploadStep,
    parsedSnapshots,
    activeSnapshotIndex,
  ]);

  // Load financial data history
  useEffect(() => {
    if (!user) {
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    // Don't prefill over a restored draft — the user's in-progress
    // numbers take priority over the latest saved entry.
    void refreshHistory(!draftRestoredRef.current)
      .catch((error) => {
        console.error("Error loading history:", error);
      })
      .finally(() => {
        setLoadingHistory(false);
      });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    void checkQuickBooksStatus();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "quickbooks" || (tab && quickBooksModeLocked)) {
      setActiveTab("quickbooks");
    }

    const qbStatus = searchParams.get("qb");
    if (!qbStatus) return;

    if (qbStatus === "success") {
      showToast("success", "QuickBooks connected.");
      setActiveTab("quickbooks");
      void checkQuickBooksStatus();
    } else if (qbStatus === "error") {
      showToast("error", "QuickBooks connection failed. Please try again.");
    } else if (qbStatus === "auth_required") {
      showToast("error", "Please log in before connecting QuickBooks.");
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("qb");
    const query = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${query ? `?${query}` : ""}`);
  }, [quickBooksModeLocked, searchParams, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (quickBooksModeLocked && activeTab !== "quickbooks") {
      setActiveTab("quickbooks");
    }
  }, [activeTab, quickBooksModeLocked]);

  function getCurrentPeriod() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  function formatPeriodDisplay(period: string) {
    const [year, month] = period.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  function formatDate(dateString: string) {
    // Ensure UTC timestamps without a Z suffix are parsed correctly
    const normalized = dateString.endsWith("Z") || dateString.includes("+")
      ? dateString
      : dateString + "Z";
    return new Date(normalized).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (quickBooksModeLocked) {
      showToast(
        "error",
        "QuickBooks is connected. Use QuickBooks Sync to refresh your numbers."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (!user) {
        showToast("error", "You must be logged in to save data");
        return;
      }

      const client = getInsForgeClient();

      // Parse currency values
      const cashValue = parseFloat(formData.cash.replace(/,/g, ""));
      const revenueValue = parseFloat(formData.revenue.replace(/,/g, ""));
      const expensesValue = parseFloat(formData.expenses.replace(/,/g, ""));
      const receivablesValue = parseFloat(formData.receivables.replace(/,/g, "")) || 0;
      const payablesValue = parseFloat(formData.payables.replace(/,/g, "")) || 0;
      const ytdRevenueValue = parseFloat(formData.ytdRevenue.replace(/,/g, "")) || 0;
      const ytdExpensesValue = parseFloat(formData.ytdExpenses.replace(/,/g, "")) || 0;
      const inventoryValue = parseFloat(formData.inventoryValue.replace(/,/g, "")) || 0;
      const rentValue = parseFloat(expenseBreakdown.rent.replace(/,/g, "")) || 0;
      const payrollValue = parseFloat(expenseBreakdown.payroll.replace(/,/g, "")) || 0;
      const suppliesValue = parseFloat(expenseBreakdown.supplies.replace(/,/g, "")) || 0;
      const marketingValue = parseFloat(expenseBreakdown.marketing.replace(/,/g, "")) || 0;
      const otherValue = parseFloat(expenseBreakdown.other.replace(/,/g, "")) || 0;
      const periodDateValue = normalizePeriodDate(formData.period);

      if (!periodDateValue) {
        showToast("error", "Please choose a valid month.");
        return;
      }

      const hasBreakdown =
        rentValue > 0 || payrollValue > 0 || suppliesValue > 0 ||
        marketingValue > 0 || otherValue > 0;

      const snapshotRow = {
        user_id: user.id,
        period_date: periodDateValue,
        data_source: "manual",
        total_income: revenueValue,
        total_expenses: expensesValue,
        net_profit: revenueValue - expensesValue,
        current_assets: cashValue,
        current_liabilities: payablesValue,
        accounts_receivable: receivablesValue,
        inventory_value: inventoryValue,
        ytd_revenue: ytdRevenueValue,
        ytd_expenses: ytdExpensesValue,
        expense_breakdown: hasBreakdown
          ? {
              rent: rentValue,
              payroll: payrollValue,
              supplies: suppliesValue,
              marketing: marketingValue,
              other: otherValue,
            }
          : null,
      };

      let { error } = await client.database
        .from("financial_snapshots")
        .upsert([snapshotRow], { onConflict: "user_id,period_date" });

      if (error) {
        // The auth token may have gone stale during a long editing session.
        // Re-check the session (which refreshes it) and retry once.
        const { data: sessionData } = await client.auth.getCurrentSession();
        if (!sessionData?.session?.accessToken) {
          showToast(
            "error",
            "Your session expired. Please log in again — your entries are kept on this device and will still be here."
          );
          return;
        }
        ({ error } = await client.database
          .from("financial_snapshots")
          .upsert([snapshotRow], { onConflict: "user_id,period_date" }));
      }

      if (error) {
        console.error("Error saving financial data:", error);
        const dbError = error as DatabaseErrorLike;
        showToast(
          "error",
          dbError.message
            ? `Failed to save data: ${dbError.message}`
            : "Failed to save data. Please try again."
        );
        return;
      }

      showToast("success", "Financial data saved successfully");
      setLoadingHistory(true);
      // Refresh the history list but keep the form showing what was just
      // entered — re-prefilling from the latest row can swap in a different
      // month and look like the save was lost.
      await refreshHistory(false);
      setLoadingHistory(false);
    } catch (error) {
      showToast("error", "Failed to save data. Please try again.");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const isFormValid =
    formData.cash && formData.revenue && formData.expenses && formData.receivables;

  // CSV Upload Handlers
  function _handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function _handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function _handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  }

  function _handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  }

  async function processFiles(files: File[]) {
    // Validate file types
    const invalidFiles = files.filter(f => !f.name.endsWith(".csv"));
    if (invalidFiles.length > 0) {
      showToast("error", `Please upload CSV files only. Invalid: ${invalidFiles.map(f => f.name).join(", ")}`);
      return;
    }

    // Validate file sizes (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    const oversizedFiles = files.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      showToast("error", `File size exceeds 10MB limit: ${oversizedFiles.map(f => f.name).join(", ")}`);
      return;
    }

    setCsvFiles(prev => [...prev, ...files]);

    // Aggregate data from all files
    let allData: CSVRow[] = [];
    const allHeaders: Set<string> = new Set();

    // Process each file sequentially
    for (const file of files) {
      await new Promise<void>((resolve) => {
        Papa.parse<CSVRow>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results: ParseResult<CSVRow>) => {
            if (results.errors.length > 0) {
              console.warn(`Parsing errors in ${file.name}:`, results.errors);
            }

            // Aggregate data
            allData = [...allData, ...results.data];

            // Aggregate headers
            const fileHeaders = results.meta.fields || [];
            fileHeaders.forEach(h => allHeaders.add(h));

            resolve();
          },
          error: (error: Error) => {
            console.error(`Failed to parse ${file.name}:`, error);
            resolve();
          },
        });
      });
    }

    const headersArray = Array.from(allHeaders);
    setCsvData(allData);
    setCsvHeaders(headersArray);

    // Auto-detect column mapping
    const autoMapping = autoDetectColumns(headersArray);
    setColumnMapping(autoMapping);

    showToast("success", `${files.length} file(s) loaded successfully - ${allData.length} total rows`);
  }

  function autoDetectColumns(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {
      revenue: "",
      expenses: "",
      cashBalance: "",
      date: "",
    };

    const lowerHeaders = headers.map((h) => h.toLowerCase());

    // Auto-detect Revenue
    const revenueIndex = lowerHeaders.findIndex(
      (h) =>
        h.includes("revenue") ||
        h.includes("sales") ||
        h.includes("income") ||
        h === "rev"
    );
    if (revenueIndex !== -1) mapping.revenue = headers[revenueIndex];

    // Auto-detect Expenses
    const expensesIndex = lowerHeaders.findIndex(
      (h) =>
        h.includes("expense") ||
        h.includes("cost") ||
        h.includes("spending") ||
        h === "exp"
    );
    if (expensesIndex !== -1) mapping.expenses = headers[expensesIndex];

    // Auto-detect Cash Balance
    const cashIndex = lowerHeaders.findIndex(
      (h) =>
        h.includes("cash") ||
        h.includes("balance") ||
        h.includes("bank") ||
        h === "bal"
    );
    if (cashIndex !== -1) mapping.cashBalance = headers[cashIndex];

    // Auto-detect Date
    const dateIndex = lowerHeaders.findIndex(
      (h) =>
        h.includes("date") ||
        h.includes("period") ||
        h.includes("month") ||
        h.includes("year")
    );
    if (dateIndex !== -1) mapping.date = headers[dateIndex];

    return mapping;
  }

  function _handleColumnMappingChange(field: ColumnMappingKey, value: string) {
    setColumnMapping({ ...columnMapping, [field]: value });
  }

  function resetUpload() {
    setCsvFiles([]);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({
      revenue: "",
      expenses: "",
      cashBalance: "",
      date: "",
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleAIUpload(file: File) {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError(
        "File is over 10 MB. Please use a smaller file or enter data manually."
      );
      return;
    }

    setUploadFile(file);
    setUploadError(null);
    setUploadStep("reading");

    try {
      let fileContent = "";

      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });

        if (workbook.SheetNames.length > 1) {
          // Combine all sheets so AI can extract from P&L, Balance Sheet, Cash Flow, etc.
          const parts: string[] = [];
          for (const name of workbook.SheetNames) {
            const sheet = workbook.Sheets[name];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            if (csv.trim()) {
              parts.push(`=== SHEET: ${name} ===\n${csv}`);
            }
          }
          fileContent = parts.join("\n\n");
        } else {
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          fileContent = XLSX.utils.sheet_to_csv(sheet);
        }
      } else {
        fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsText(file);
        });
      }

      await sendContentToAI(fileContent);
    } catch (error) {
      console.error("AI upload error:", error);
      setUploadError(
        "We couldn\u2019t read this file format. Try a different file or connect QuickBooks instead."
      );
      setUploadStep("idle");
    }
  }

  async function sendContentToAI(fileContent: string) {
    if (!fileContent.trim()) {
      setUploadError("The file appears to be empty. Please try a different file.");
      setUploadStep("idle");
      return;
    }

    setUploadStep("processing");

    try {
      const res = await fetch("/api/extract-financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileContent }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "AI extraction failed");
      }

      const { snapshots } = await res.json();
      const parsedArray = snapshots as AISnapshotData[];

      // Fix percentages if AI returned them as whole numbers (68.3) instead of decimals (0.683)
      const pctFields: (keyof AISnapshotData)[] = [
        "gross_profit_margin", "net_profit_margin", "roa", "roe",
      ];
      for (const snap of parsedArray) {
        for (const f of pctFields) {
          const v = snap[f];
          if (typeof v === "number" && (v > 1 || v < -1)) {
            (snap as unknown as Record<string, number | null>)[f] = v / 100;
          }
        }
      }

      setParsedSnapshots(parsedArray);
      setActiveSnapshotIndex(0);
      setUploadStep("confirm");
      // Extracted data counts as in-progress work — back it up so a side
      // trip to the Glossary doesn't force a re-upload.
      formDirtyRef.current = true;
    } catch (error) {
      console.error("AI extraction failed:", error);
      setUploadError(
        "We couldn\u2019t read this file. Try a different file or connect QuickBooks instead."
      );
      setUploadStep("idle");
    }
  }

  // handleParseSheet removed — all sheets are now combined automatically

  async function handleSaveAISnapshot() {
    if (!user || parsedSnapshots.length === 0) return;

    setUploadStep("saving");
    try {
      const { getInsForgeClient: getClient } = await import("@/lib/insforge");
      const client = getClient();

      const snapshotRows = parsedSnapshots.map((snap) => {
        let periodDate = snap.period_date;
        if (periodDate) {
          const d = new Date(periodDate);
          if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const lastDay = new Date(year, month, 0).getDate();
            periodDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
          }
        }

        return {
          user_id: user.id,
          period_date: periodDate,
          data_source: "spreadsheet",
          total_income: snap.total_income,
          gross_profit: snap.gross_profit,
          total_expenses: snap.total_expenses,
          net_operating_income: snap.net_operating_income,
          net_profit: snap.net_profit,
          gross_profit_margin: snap.gross_profit_margin,
          net_profit_margin: snap.net_profit_margin,
          current_assets: snap.current_assets,
          fixed_assets: snap.fixed_assets,
          total_assets: snap.total_assets,
          current_liabilities: snap.current_liabilities,
          long_term_liabilities: snap.long_term_liabilities,
          equity: snap.equity,
          operating_activities: snap.operating_activities,
          investing_activities: snap.investing_activities,
          financing_activities: snap.financing_activities,
          net_cash_flow: snap.net_cash_flow,
          working_capital: snap.working_capital,
          current_ratio: snap.current_ratio,
          roa: snap.roa,
          roe: snap.roe,
        };
      });

      let { error } = await client.database
        .from("financial_snapshots")
        .upsert(snapshotRows, { onConflict: "user_id,period_date" });

      if (error) {
        // Stale auth token after a long review session — refresh and retry once.
        const { data: sessionData } = await client.auth.getCurrentSession();
        if (sessionData?.session?.accessToken) {
          ({ error } = await client.database
            .from("financial_snapshots")
            .upsert(snapshotRows, { onConflict: "user_id,period_date" }));
        }
      }

      if (error) {
        const dbError = error as DatabaseErrorLike;
        showToast(
          "error",
          dbError.message ? `Save failed: ${dbError.message}` : "Failed to save data."
        );
        setUploadStep("confirm");
        return;
      }

      // Auto-update health assessment from the most recent month
      const mostRecent = parsedSnapshots[parsedSnapshots.length - 1];
      const cash = mostRecent.current_assets ?? 0;
      const revenue = mostRecent.total_income ?? 0;
      const expenses = mostRecent.total_expenses ?? 0;

      try {
        await client.database
          .from("health_assessments")
          .upsert([{
            user_id: user.id,
            cash_on_hand: cash,
            monthly_revenue: revenue,
            monthly_expenses: expenses,
            accounts_receivable: 0,
          }], { onConflict: "user_id" });
      } catch (e) {
        // Non-critical — health score will just use previous data
        console.warn("Could not update health assessment:", e);
      }

      const monthCount = parsedSnapshots.length;
      showToast("success", monthCount > 1 ? `${monthCount} months of data saved` : "Your data has been saved");
      resetAIUpload();

      setLoadingHistory(true);
      await refreshHistory(false);
      setLoadingHistory(false);
    } catch (error) {
      console.error("Save snapshot error:", error);
      showToast("error", "Failed to save data. Please try again.");
      setUploadStep("confirm");
    }
  }

  function resetAIUpload() {
    setUploadStep("idle");
    setUploadFile(null);
    setUploadError(null);
    setParsedSnapshots([]);
    setActiveSnapshotIndex(0);
    setSheetNames([]);
    setSelectedSheet("");
    workbookRef.current = null;
    if (aiFileInputRef.current) {
      aiFileInputRef.current.value = "";
    }
  }

  async function _handleImport() {
    if (quickBooksModeLocked) {
      showToast(
        "error",
        "QuickBooks is connected. Disconnect it first to use spreadsheet uploads."
      );
      return;
    }

    // Validate mapping
    if (!columnMapping.revenue || !columnMapping.expenses || !columnMapping.cashBalance) {
      showToast("error", "Please map Revenue, Expenses, and Cash Balance columns");
      return;
    }

    if (!user) {
      showToast("error", "You must be logged in to import data");
      return;
    }

    setIsImporting(true);

    try {
      const client = getInsForgeClient();
      let importedCount = 0;
      let skippedCount = 0;

      // Import each row
      for (const row of csvData) {
        try {
          const revenue = parseFloat(row[columnMapping.revenue]?.replace(/[^0-9.-]/g, "") || "0");
          const expenses = parseFloat(row[columnMapping.expenses]?.replace(/[^0-9.-]/g, "") || "0");
          const cashBalance = parseFloat(row[columnMapping.cashBalance]?.replace(/[^0-9.-]/g, "") || "0");
          const rawPeriod = columnMapping.date ? row[columnMapping.date] : getCurrentPeriod();
          const periodDate = normalizePeriodDate(rawPeriod);

          // Skip rows with invalid data
          if ((isNaN(revenue) && isNaN(expenses) && isNaN(cashBalance)) || !periodDate) {
            skippedCount++;
            continue;
          }

          const rev = isNaN(revenue) ? 0 : revenue;
          const exp = isNaN(expenses) ? 0 : expenses;
          const cash = isNaN(cashBalance) ? 0 : cashBalance;

          const { error } = await client.database
            .from("financial_snapshots")
            .upsert([{
              user_id: user.id,
              period_date: periodDate,
              data_source: "spreadsheet",
              total_income: rev,
              total_expenses: exp,
              net_profit: rev - exp,
              current_assets: cash,
            }], { onConflict: "user_id,period_date" });

          if (error) {
            console.error("Error importing row:", error);
            skippedCount++;
          } else {
            importedCount++;
          }
        } catch (rowError) {
          console.error("Error processing row:", rowError);
          skippedCount++;
        }
      }

      if (importedCount > 0) {
        showToast("success", `Successfully imported ${importedCount} rows${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}`);

        setLoadingHistory(true);
        await refreshHistory(true);
        setLoadingHistory(false);

        resetUpload();
      } else {
        showToast("error", "No valid data found to import");
      }
    } catch (error) {
      showToast("error", "Failed to import data. Please try again.");
      console.error(error);
    } finally {
      setIsImporting(false);
    }
  }

  async function handleConnectQuickBooks() {
    if (!user) {
      showToast("error", "Please log in before connecting QuickBooks.");
      return;
    }

    setQbConnecting(true);
    try {
      const client = getInsForgeClient();
      const { data, error } = await client.auth.getCurrentSession();
      const accessToken = data?.session?.accessToken;

      if (error || !accessToken) {
        showToast("error", "Your session expired. Please log in again.");
        return;
      }

      const res = await fetch("/api/connect/quickbooks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnTo: "/data?tab=quickbooks",
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload?.authUrl) {
        showToast("error", payload?.error || "Failed to start QuickBooks connection.");
        return;
      }

      window.location.href = payload.authUrl;
    } catch (err) {
      console.error("Error initiating QuickBooks OAuth:", err);
      showToast("error", "Failed to start QuickBooks connection.");
    } finally {
      setQbConnecting(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleDisconnectQuickBooks() {
    if (!user) return;

    const confirmed = window.confirm(
      "Disconnect QuickBooks for this account? Manual and spreadsheet entry will be enabled again."
    );
    if (!confirmed) return;

    const authHeaders = await getAuthHeaders();
    if (!authHeaders) {
      showToast("error", "Your session expired. Please log in again.");
      return;
    }

    setQbDisconnecting(true);
    try {
      const response = await fetch("/api/quickbooks/disconnect", {
        method: "DELETE",
        headers: authHeaders,
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        showToast("error", payload?.error || "Failed to disconnect QuickBooks.");
        return;
      }

      setQbConnected(false);
      setQbRealmId(null);
      setQbLastSyncAt(null);
      setActiveTab("manual");
      showToast("success", "QuickBooks disconnected. Manual entry is enabled.");
    } catch (error) {
      console.error("QuickBooks disconnect error:", error);
      showToast("error", "Failed to disconnect QuickBooks.");
    } finally {
      setQbDisconnecting(false);
    }
  }

  const _isMappingValid =
    columnMapping.revenue && columnMapping.expenses && columnMapping.cashBalance;

  function selectTab(tab: Tab) {
    if (quickBooksModeLocked && tab !== "quickbooks") {
      showToast(
        "error",
        "QuickBooks is connected for this account. Use QuickBooks Sync to manage data."
      );
      return;
    }

    setActiveTab(tab);
  }

  async function handleDeleteLedgerEntry(entryId: string, period: string) {
    if (!user) return;

    const confirmed = window.confirm(
      `Delete ${formatPeriodDisplay(period)} from your Data Ledger? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingEntryId(entryId);
    try {
      const client = getInsForgeClient();

      const { error } = await client.database
        .from("financial_snapshots")
        .delete()
        .eq("id", entryId)
        .eq("user_id", user.id);

      if (error) {
        const dbError = error as DatabaseErrorLike;
        showToast(
          "error",
          dbError.message
            ? `Failed to delete row: ${dbError.message}`
            : "Failed to delete row."
        );
        return;
      }

      await refreshHistory(false);
      showToast("success", "Ledger row deleted.");
    } catch (error) {
      console.error("Delete ledger row error:", error);
      showToast("error", "Failed to delete row.");
    } finally {
      setDeletingEntryId(null);
    }
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F8F8F8]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-[28px] font-bold text-[#111111] tracking-tight">
              Your Numbers
            </h1>
            <p className="text-[14px] text-[#8B8B8B] mt-1">
              Keep your financial picture up to date. The more you track, the clearer
              things become.
            </p>
          </div>

          {/* Tabs */}
          <div>
            <div className="border-b border-[#E4E4E7] flex gap-0">
              <button
                onClick={() => selectTab("manual")}
                disabled={quickBooksModeLocked}
                className={`px-4 py-2.5 text-[14px] font-medium border-b-2 transition-colors ${
                  activeTab === "manual"
                    ? "border-[#E65100] text-[#111111]"
                    : quickBooksModeLocked
                    ? "border-transparent text-[#8B8B8B] cursor-not-allowed"
                    : "border-transparent text-[#8B8B8B] hover:text-[#4B4B4B] hover:border-[#E4E4E7]"
                }`}
              >
                Enter Manually
              </button>
              <button
                onClick={() => selectTab("upload")}
                disabled={quickBooksModeLocked}
                className={`px-4 py-2.5 text-[14px] font-medium border-b-2 transition-colors ${
                  activeTab === "upload"
                    ? "border-[#E65100] text-[#111111]"
                    : quickBooksModeLocked
                    ? "border-transparent text-[#8B8B8B] cursor-not-allowed"
                    : "border-transparent text-[#8B8B8B] hover:text-[#4B4B4B] hover:border-[#E4E4E7]"
                }`}
              >
                Upload Spreadsheet
              </button>
              <button
                onClick={() => selectTab("quickbooks")}
                className={`px-4 py-2.5 text-[14px] font-medium border-b-2 transition-colors ${
                  activeTab === "quickbooks"
                    ? "border-[#E65100] text-[#111111]"
                    : "border-transparent text-[#8B8B8B] hover:text-[#4B4B4B] hover:border-[#E4E4E7]"
                }`}
              >
                <span className="flex items-center gap-2">
                  QuickBooks Sync
                  <span className="text-[10px] font-semibold text-[#E65100] bg-[#FFF7F2] px-1.5 py-0.5 rounded-full leading-none">Soon</span>
                </span>
              </button>
            </div>
            {quickBooksModeLocked && (
              <p className="mt-3 text-[13px] text-[#8B8B8B]">
                QuickBooks is connected, so manual entry and spreadsheet upload are disabled.
              </p>
            )}
          </div>

          {/* Manual Entry Form */}
          {activeTab === "manual" && (
            <div>
              {quickBooksModeLocked ? (
                <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6 border-l-4 border-l-green-500">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-[16px] font-semibold text-[#111111]">
                        Manual entry is locked while QuickBooks is connected
                      </h3>
                      <p className="text-[14px] text-[#4B4B4B] mt-2">
                        Use QuickBooks Sync to refresh data that powers your dashboard and
                        scenarios.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => selectTab("quickbooks")}
                    >
                      Open QuickBooks Sync
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
                <form
                  onSubmit={handleSubmit}
                  onChangeCapture={() => {
                    formDirtyRef.current = true;
                  }}
                  className="space-y-6"
                >
                  {/* Period Selector */}
                  <div>
                    <label
                      htmlFor="period"
                      className="text-[13px] font-medium text-[#111111] mb-1.5 block"
                    >
                      Which month are these numbers for?
                    </label>
                    <input
                      type="month"
                      id="period"
                      value={formData.period}
                      onChange={(e) =>
                        setFormData({ ...formData, period: e.target.value })
                      }
                      className="w-full sm:w-auto h-10 px-3 rounded-lg border border-[#E4E4E7] bg-white text-[14px] text-[#111111] placeholder:text-[#8B8B8B] focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Financial Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CurrencyInput
                      label="Cash in the bank right now"
                      value={formData.cash}
                      onChange={(value) => setFormData({ ...formData, cash: value })}
                      placeholder="0"
                      required
                    />

                    <CurrencyInput
                      label="Total sales this month"
                      value={formData.revenue}
                      onChange={(value) => setFormData({ ...formData, revenue: value })}
                      placeholder="0"
                      required
                    />

                    <CurrencyInput
                      label="Total expenses this month"
                      value={formData.expenses}
                      onChange={(value) =>
                        setFormData({ ...formData, expenses: value })
                      }
                      placeholder="0"
                      required
                    />

                    <CurrencyInput
                      label="Money customers owe you (accounts receivable)"
                      value={formData.receivables}
                      onChange={(value) =>
                        setFormData({ ...formData, receivables: value })
                      }
                      placeholder="0"
                      required
                    />

                    <CurrencyInput
                      label="Money you owe (accounts payable)"
                      value={formData.payables}
                      onChange={(value) =>
                        setFormData({ ...formData, payables: value })
                      }
                      placeholder="0"
                    />

                    <CurrencyInput
                      label="Year-to-date revenue"
                      value={formData.ytdRevenue}
                      onChange={(value) =>
                        setFormData({ ...formData, ytdRevenue: value })
                      }
                      placeholder="0"
                    />

                    <CurrencyInput
                      label="Year-to-date expenses"
                      value={formData.ytdExpenses}
                      onChange={(value) =>
                        setFormData({ ...formData, ytdExpenses: value })
                      }
                      placeholder="0"
                    />

                    <CurrencyInput
                      label="Inventory value (if applicable)"
                      value={formData.inventoryValue}
                      onChange={(value) =>
                        setFormData({ ...formData, inventoryValue: value })
                      }
                      placeholder="0"
                    />
                  </div>

                  {/* Expense Breakdown Toggle */}
                  <div className="pt-4 border-t border-[#F0F0F2]">
                    <button
                      type="button"
                      onClick={() => setShowExpenseBreakdown(!showExpenseBreakdown)}
                      className="flex items-center justify-between w-full text-left group"
                    >
                      <span className="text-[13px] font-medium text-[#4B4B4B] group-hover:text-[#E65100] transition-colors">
                        Add expense breakdown by category (optional)
                      </span>
                      <svg
                        className={`w-5 h-5 text-[#8B8B8B] transition-transform ${
                          showExpenseBreakdown ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* Expandable Expense Breakdown */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ease-in-out ${
                        showExpenseBreakdown
                          ? "max-h-[600px] opacity-100 mt-6"
                          : "max-h-0 opacity-0"
                      }`}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F4F4F5] p-4 sm:p-6 rounded-lg border border-[#F0F0F2]">
                        <CurrencyInput
                          label="Rent"
                          value={expenseBreakdown.rent}
                          onChange={(value) =>
                            setExpenseBreakdown({ ...expenseBreakdown, rent: value })
                          }
                          placeholder="0"
                        />

                        <CurrencyInput
                          label="Payroll"
                          value={expenseBreakdown.payroll}
                          onChange={(value) =>
                            setExpenseBreakdown({ ...expenseBreakdown, payroll: value })
                          }
                          placeholder="0"
                        />

                        <CurrencyInput
                          label="Supplies"
                          value={expenseBreakdown.supplies}
                          onChange={(value) =>
                            setExpenseBreakdown({ ...expenseBreakdown, supplies: value })
                          }
                          placeholder="0"
                        />

                        <CurrencyInput
                          label="Marketing"
                          value={expenseBreakdown.marketing}
                          onChange={(value) =>
                            setExpenseBreakdown({
                              ...expenseBreakdown,
                              marketing: value,
                            })
                          }
                          placeholder="0"
                        />

                        <CurrencyInput
                          label="Other"
                          value={expenseBreakdown.other}
                          onChange={(value) =>
                            setExpenseBreakdown({ ...expenseBreakdown, other: value })
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4">
                    <button
                      type="submit"
                      disabled={!isFormValid || isSubmitting}
                      className="bg-[#E65100] text-white rounded-lg px-6 py-2.5 text-[14px] font-medium hover:bg-[#D84A00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isSubmitting ? "Saving..." : "Save This Month's Data"}
                    </button>

                    <button
                      type="button"
                      onClick={handleConnectQuickBooks}
                      className="text-[13px] text-[#8B8B8B] hover:text-[#E65100] transition-colors text-center sm:text-right"
                    >
                      Or connect QuickBooks to use sync-only mode →
                    </button>
                  </div>
                </form>
              </div>
              )}
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === "upload" && (
            <div>
              {quickBooksModeLocked ? (
                <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6 border-l-4 border-l-green-500">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-[16px] font-semibold text-[#111111]">
                        Spreadsheet upload is disabled while QuickBooks is connected
                      </h3>
                      <p className="text-[14px] text-[#4B4B4B] mt-2">
                        QuickBooks is your source of truth for this account. Use Sync Now
                        in the QuickBooks tab.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => selectTab("quickbooks")}
                    >
                      Open QuickBooks Sync
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* File Upload Zone */}
                  {uploadStep === "idle" && (
                    <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
                      {uploadError && (
                        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
                          <p className="text-[14px] text-red-700">{uploadError}</p>
                        </div>
                      )}
                      <div
                        className="border-2 border-dashed border-[#E4E4E7] rounded-xl p-8 text-center hover:border-[#E65100] hover:bg-[#FFF7F2] transition-colors cursor-pointer"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.classList.add("border-[#E65100]", "bg-[#FFF7F2]");
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.classList.remove("border-[#E65100]", "bg-[#FFF7F2]");
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          e.currentTarget.classList.remove("border-[#E65100]", "bg-[#FFF7F2]");
                          const file = e.dataTransfer.files?.[0];
                          if (file) void handleAIUpload(file);
                        }}
                        onClick={() => aiFileInputRef.current?.click()}
                      >
                        <svg
                          className="w-10 h-10 mx-auto mb-4 text-[#8B8B8B]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <h3 className="text-[16px] font-semibold text-[#111111] mb-2">
                          Upload your financial spreadsheet
                        </h3>
                        <p className="text-[14px] text-[#4B4B4B] mb-6">
                          Drag and drop your file here, or click to browse
                        </p>
                        <input
                          ref={aiFileInputRef}
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleAIUpload(file);
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            aiFileInputRef.current?.click();
                          }}
                          className="bg-[#E65100] text-white rounded-lg px-6 py-2.5 text-[14px] font-medium hover:bg-[#D84A00] transition-colors"
                        >
                          Choose File
                        </button>
                        <p className="text-[12px] text-[#8B8B8B] mt-6">
                          Accepts .csv and .xlsx files up to 10 MB
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Loading State */}
                  {(uploadStep === "reading" || uploadStep === "processing") && (
                    <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
                      <div className="py-12 text-center">
                        <div className="w-10 h-10 mx-auto mb-4 border-3 border-[#E65100]/20 border-t-[#E65100] rounded-full animate-spin" />
                        <p className="text-[16px] font-semibold text-[#111111] mb-1">
                          Reading your spreadsheet&hellip;
                        </p>
                        <p className="text-[14px] text-[#4B4B4B]">
                          {uploadFile?.name && (
                            <span className="block mb-1 text-[#111111] font-medium">{uploadFile.name}</span>
                          )}
                          Our AI is extracting your financial data
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Confirmation Screen */}
                  {(uploadStep === "confirm" || uploadStep === "saving") && parsedSnapshot && (
                    <div className="space-y-6">
                      <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
                        <div className="mb-6">
                          <h3 className="text-[16px] font-semibold text-[#111111] mb-1">
                            Here&apos;s what we found in your spreadsheet
                          </h3>
                          <p className="text-[14px] text-[#4B4B4B]">
                            {parsedSnapshots.length > 1
                              ? `We found ${parsedSnapshots.length} months of data. Review each month before saving.`
                              : "Review before saving. Click any value to edit or fill in missing fields."}
                          </p>
                        </div>

                        {/* Month tabs for multi-month uploads */}
                        {parsedSnapshots.length > 1 && (
                          <div className="flex flex-wrap gap-2 mb-6">
                            {parsedSnapshots.map((snap, idx) => {
                              const label = snap.period_date
                                ? new Date(snap.period_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                                : `Month ${idx + 1}`;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => setActiveSnapshotIndex(idx)}
                                  className={[
                                    "px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors",
                                    activeSnapshotIndex === idx
                                      ? "bg-orange/10 border-orange text-orange"
                                      : "bg-transparent border-[#E4E4E7] text-[#4B4B4B] hover:border-[#111111]",
                                  ].join(" ")}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Period display */}
                        <div className="mb-6">
                          <label className="text-[13px] font-medium text-[#111111] mb-1.5 block">
                            {parsedSnapshots.length > 1 ? "Viewing data for:" : "Which month does this data cover?"}
                          </label>
                          {parsedSnapshots.length <= 1 ? (
                            <input
                              type="month"
                              value={confirmPeriod}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                setParsedSnapshots(prev => {
                                  const updated = [...prev];
                                  if (updated[0]) {
                                    const [y, m] = newDate.split("-").map(Number);
                                    const lastDay = new Date(y, m, 0).getDate();
                                    updated[0] = { ...updated[0], period_date: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}` };
                                  }
                                  return updated;
                                });
                              }}
                              className="w-full sm:w-auto h-10 px-3 rounded-lg border border-[#E4E4E7] bg-white text-[14px] text-[#111111] placeholder:text-[#8B8B8B] focus:border-[#E65100] focus:ring-2 focus:ring-[#E65100]/15 focus:outline-none transition-colors"
                            />
                          ) : (
                            <p className="text-[14px] text-[#111111] font-medium">
                              {parsedSnapshot?.period_date
                                ? new Date(parsedSnapshot.period_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                                : "Unknown period"}
                            </p>
                          )}
                        </div>

                        {/* Data Table — grouped by section */}
                        <div className="overflow-x-auto space-y-6">
                          {SNAPSHOT_SECTIONS.map((section) => (
                            <div key={section.title}>
                              <h4 className="text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] mb-2 px-6">
                                {section.title}
                              </h4>
                              <table className="w-full text-[14px]">
                                <thead>
                                  <tr className="border-b border-[#E4E4E7]">
                                    <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] px-6 py-2.5">
                                      Field
                                    </th>
                                    <th className="text-right text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] px-6 py-2.5">
                                      Value
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {section.fields.map(({ key, label, format }) => {
                                    const val = parsedSnapshot[key];
                                    const isEditing = editingField === key;
                                    const displayValue =
                                      val != null && typeof val === "number"
                                        ? format === "currency"
                                          ? formatCurrency(val)
                                          : format === "percent"
                                          ? `${(val * 100).toFixed(1)}%`
                                          : val.toFixed(2)
                                        : null;

                                    return (
                                      <tr key={key} className="border-b border-[#F0F0F2] last:border-b-0 hover:bg-[#F4F4F5]/50">
                                        <td className="px-6 py-3 text-[14px] text-[#111111]">
                                          {label}
                                        </td>
                                        <td className="px-6 py-3 text-right text-[14px]">
                                          {isEditing ? (
                                            <input
                                              type="text"
                                              autoFocus
                                              defaultValue={
                                                val != null && typeof val === "number"
                                                  ? format === "percent"
                                                    ? (val * 100).toFixed(1)
                                                    : format === "currency"
                                                    ? Math.round(val).toLocaleString("en-US")
                                                    : val.toFixed(2)
                                                  : ""
                                              }
                                              placeholder={
                                                format === "currency"
                                                  ? "$0"
                                                  : format === "percent"
                                                  ? "0.0%"
                                                  : "0.00"
                                              }
                                              className="w-32 ml-auto text-right px-2 py-1 rounded-lg border border-[#E65100] bg-white text-[14px] text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#E65100]/15"
                                              onBlur={(e) => {
                                                const raw = e.target.value.replace(/[$,%\s]/g, "").replace(/,/g, "");
                                                const num = parseFloat(raw);
                                                setParsedSnapshots((prev) => {
                                                  const updated = [...prev];
                                                  const current = updated[activeSnapshotIndex];
                                                  if (!current) return prev;
                                                  updated[activeSnapshotIndex] = {
                                                    ...current,
                                                    [key]: raw === "" || isNaN(num)
                                                      ? null
                                                      : format === "percent"
                                                      ? num / 100
                                                      : num,
                                                  };
                                                  return updated;
                                                });
                                                setEditingField(null);
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                                if (e.key === "Escape") setEditingField(null);
                                              }}
                                            />
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => setEditingField(key)}
                                              className={`inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors hover:bg-[#FFF7F2] ${
                                                displayValue
                                                  ? "text-[#111111]"
                                                  : "text-[#8B8B8B] italic"
                                              }`}
                                              title="Click to edit"
                                            >
                                              {displayValue || "Not found"}
                                              <Icon
                                                icon="ph:pencil-simple"
                                                className="w-3 h-3 text-[#8B8B8B] opacity-40"
                                              />
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            void handleSaveAISnapshot();
                          }}
                          disabled={uploadStep === "saving"}
                          className="bg-[#E65100] text-white rounded-lg px-6 py-2.5 text-[14px] font-medium hover:bg-[#D84A00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {uploadStep === "saving" ? "Saving..." : parsedSnapshots.length > 1 ? `Save All ${parsedSnapshots.length} Months` : "Save to Dashboard"}
                        </button>
                        <button
                          type="button"
                          onClick={resetAIUpload}
                          className="rounded-lg px-6 py-2.5 text-[14px] font-medium text-[#4B4B4B] border border-[#E4E4E7] hover:bg-[#F4F4F5] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* QuickBooks Tab */}
          {activeTab === "quickbooks" && (
            <div>
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6">
                <div className="flex flex-col items-center text-center py-8 px-4 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#F4F4F5] flex items-center justify-center">
                    <img
                      src="/quickbooks.png"
                      alt="QuickBooks"
                      className="w-10 h-10 object-contain grayscale"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <h3 className="text-[20px] font-semibold text-[#111111]">QuickBooks Integration</h3>
                      <span className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-[#FFF7F2] rounded-full text-[12px] font-semibold text-[#E65100]">
                        Coming Soon
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Unified Data Ledger */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-[20px] font-semibold text-[#111111]">Data Ledger</h2>
                <p className="text-[14px] text-[#8B8B8B] mt-1">
                  Every saved snapshot used by Dashboard and Scenarios.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLoadingHistory(true);
                  void refreshHistory(false).finally(() => {
                    setLoadingHistory(false);
                  });
                }}
                className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#4B4B4B] border border-[#E4E4E7] hover:bg-[#F4F4F5] transition-colors"
              >
                Refresh Ledger
              </button>
            </div>

            {loadingHistory ? (
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6 text-center py-12">
                <div className="w-10 h-10 mx-auto mb-4 border-3 border-[#E65100]/20 border-t-[#E65100] rounded-full animate-spin" />
                <p className="text-[14px] text-[#8B8B8B]">Loading ledger...</p>
              </div>
            ) : historyEntries.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] p-6 text-center py-16">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-[#FFF7F2] rounded-full mb-4">
                  <Icon
                    icon="ph:table-duotone"
                    className="w-7 h-7 text-[#E65100]"
                  />
                </div>
                <h3 className="text-[16px] font-semibold text-[#111111] mb-1">
                  No saved rows yet
                </h3>
                <p className="text-[14px] text-[#4B4B4B] max-w-md mx-auto">
                  Complete the assessment or save data manually to create your first ledger
                  row.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#F0F0F2] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.06)] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E4E4E7]">
                        <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] px-6 py-2.5">Period</th>
                        <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] px-6 py-2.5">Source</th>
                        <th className="text-right text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] px-6 py-2.5">Cash</th>
                        <th className="text-right text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] px-6 py-2.5">Revenue</th>
                        <th className="text-right text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] px-6 py-2.5">Expenses</th>
                        <th className="text-right text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] px-6 py-2.5">Profit</th>
                        <th className="text-left text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] px-6 py-2.5">Updated</th>
                        <th className="text-right text-[12px] uppercase tracking-wider font-semibold text-[#8B8B8B] px-6 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyEntries.map((entry) => {
                        const profit = entry.revenue - entry.expenses;
                        return (
                          <tr
                            key={entry.id}
                            className="border-b border-[#F0F0F2] last:border-b-0 hover:bg-[#F4F4F5]/50"
                          >
                            <td className="px-6 py-3 text-[14px] text-[#111111]">
                              {formatPeriodDisplay(entry.period)}
                            </td>
                            <td className="px-6 py-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-4 ${
                                  entry.dataSource === "quickbooks"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-[#F4F4F5] text-[#8B8B8B]"
                                }`}
                              >
                                {entry.dataSource === "quickbooks" && (
                                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                )}
                                {formatDataSourceLabel(entry.dataSource)}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-right text-[14px] text-[#4B4B4B]">
                              {formatCurrency(entry.cash)}
                            </td>
                            <td className="px-6 py-3 text-right text-[14px] text-[#4B4B4B]">
                              {formatCurrency(entry.revenue)}
                            </td>
                            <td className="px-6 py-3 text-right text-[14px] text-[#4B4B4B]">
                              {formatCurrency(entry.expenses)}
                            </td>
                            <td
                              className={`px-6 py-3 text-right text-[14px] font-medium ${
                                profit >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {formatCurrency(profit)}
                            </td>
                            <td className="px-6 py-3 text-[13px] text-[#8B8B8B]">
                              {formatDate(entry.createdAt)}
                            </td>
                            <td className="px-6 py-3 text-right">
                              <button
                                type="button"
                                disabled={deletingEntryId === entry.id}
                                onClick={() => {
                                  void handleDeleteLedgerEntry(entry.id, entry.period);
                                }}
                                className="text-[13px] font-medium text-[#8B8B8B] hover:text-red-600 disabled:opacity-50 transition-colors"
                              >
                                {deletingEntryId === entry.id ? "Deleting..." : "Delete"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function DataPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DataContent />
    </Suspense>
  );
}
