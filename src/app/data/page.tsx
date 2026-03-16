"use client";

import { useState, useRef, useEffect } from "react";
import Papa, { ParseResult } from "papaparse";
import { Icon } from "@iconify/react";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, CurrencyInput } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getInsForgeClient } from "@/lib/insforge";

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

interface FinancialDataRow {
  id: string;
  period_date: string | null;
  cash_balance: number | null;
  revenue: number | null;
  expenses: number | null;
  receivables: number | null;
  payables: number | null;
  ytd_revenue: number | null;
  ytd_expenses: number | null;
  inventory_value: number | null;
  created_at: string;
  data_source: string | null;
  expense_breakdown: {
    rent?: number;
    payroll?: number;
    supplies?: number;
    marketing?: number;
    other?: number;
  } | null;
}

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
  error?: string;
}

interface DatabaseErrorLike {
  code?: string;
  message?: string;
}

function isMissingFinancialDataColumnError(error: unknown): boolean {
  const dbError = error as DatabaseErrorLike | null;
  const message = (dbError?.message || "").toLowerCase();
  if (dbError?.code === "PGRST204") return true;

  return (
    message.includes("payables") ||
    message.includes("ytd_revenue") ||
    message.includes("ytd_expenses") ||
    message.includes("inventory_value") ||
    message.includes("expense_breakdown")
  );
}

export default function DataPage() {
  const { user } = useRequireAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("manual");
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Upload States
  const [isDragging, setIsDragging] = useState(false);
  const [csvFiles, setCsvFiles] = useState<File[]>([]);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    revenue: "",
    expenses: "",
    cashBalance: "",
    date: "",
  });
  const [isImporting, setIsImporting] = useState(false);

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
  const [latestSnapshot, setLatestSnapshot] = useState<HistoryEntry | null>(null);
  const [qbConnected, setQbConnected] = useState(false);
  const [qbRealmId, setQbRealmId] = useState<string | null>(null);
  const [qbLastSyncAt, setQbLastSyncAt] = useState<string | null>(null);
  const [qbSyncing, setQbSyncing] = useState(false);
  const [qbConnecting, setQbConnecting] = useState(false);
  const [qbDisconnecting, setQbDisconnecting] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const quickBooksModeLocked = qbConnected;

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

  function mapRowToHistoryEntry(row: FinancialDataRow): HistoryEntry {
    return {
      id: row.id,
      period: row.period_date || getCurrentPeriod(),
      cash: row.cash_balance || 0,
      revenue: row.revenue || 0,
      expenses: row.expenses || 0,
      receivables: row.receivables || 0,
      payables: row.payables || 0,
      ytdRevenue: row.ytd_revenue || 0,
      ytdExpenses: row.ytd_expenses || 0,
      inventoryValue: row.inventory_value || 0,
      createdAt: row.created_at,
      dataSource: row.data_source || "manual",
      expenseBreakdown: row.expense_breakdown || null,
    };
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

  async function refreshHistory(prefillLatest: boolean) {
    if (!user) return;

    const client = getInsForgeClient();
    const { data, error } = await client.database
      .from("financial_data")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error loading financial history:", error);
      return;
    }

    const entries: HistoryEntry[] = (data || []).map((row) =>
      mapRowToHistoryEntry(row as FinancialDataRow)
    );
    setHistoryEntries(entries);

    if (entries.length > 0) {
      setLatestSnapshot(entries[0]);
      if (prefillLatest) {
        applyEntryToForm(entries[0]);
      }
      return;
    }

    // Backward compatibility for users who completed assessment before financial_data sync existed.
    const { data: assessment, error: assessmentError } = await client.database
      .from("health_assessments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!assessmentError && assessment) {
      const assessmentRow = assessment as HealthAssessmentRow;
      const hydrated = await hydrateFinancialDataFromAssessment(assessmentRow);
      if (hydrated) {
        const { data: refreshed } = await client.database
          .from("financial_data")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        const hydratedEntries: HistoryEntry[] = (refreshed || []).map((row) =>
          mapRowToHistoryEntry(row as FinancialDataRow)
        );

        if (hydratedEntries.length > 0) {
          setHistoryEntries(hydratedEntries);
          setLatestSnapshot(hydratedEntries[0]);
          if (prefillLatest) {
            applyEntryToForm(hydratedEntries[0]);
          }
          return;
        }
      }

      const fallbackEntry = mapAssessmentToHistoryEntry(
        assessmentRow
      );
      setLatestSnapshot(fallbackEntry);
      if (prefillLatest) {
        applyEntryToForm(fallbackEntry);
      }
      return;
    }

    setLatestSnapshot(null);
  }

  async function hydrateFinancialDataFromAssessment(
    assessment: HealthAssessmentRow
  ): Promise<boolean> {
    if (!user) return false;

    const client = getInsForgeClient();
    const periodDate = normalizePeriodDate(assessment.created_at);
    if (!periodDate) return false;

    const { data: qbConnection } = await client.database
      .from("quickbooks_connections")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    const inferredSource = qbConnection ? "quickbooks" : "manual";

    const basePayload = {
      user_id: user.id,
      period_date: periodDate,
      cash_balance: assessment.cash_on_hand || 0,
      revenue: assessment.monthly_revenue || 0,
      expenses: assessment.monthly_expenses || 0,
      receivables: assessment.accounts_receivable || 0,
      data_source: inferredSource,
    };

    const extendedPayload = {
      ...basePayload,
      payables: assessment.accounts_payable || 0,
      ytd_revenue: assessment.ytd_revenue || 0,
      ytd_expenses: assessment.ytd_expenses || 0,
      inventory_value: assessment.inventory_value || 0,
      expense_breakdown: assessment.expense_breakdown || null,
    };

    let { error } = await client.database
      .from("financial_data")
      .insert(extendedPayload);

    if (error && isMissingFinancialDataColumnError(error)) {
      const retry = await client.database
        .from("financial_data")
        .insert(basePayload);
      error = retry.error;
    }

    if (error) {
      console.error("Failed to hydrate financial_data from assessment:", error);
      return false;
    }

    return true;
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
      const client = getInsForgeClient();

      const basePayload = {
        user_id: user.id,
        period_date: periodFromQuickBooks,
        cash_balance: metrics.cash || 0,
        revenue: metrics.revenue || 0,
        expenses: metrics.expenses || 0,
        receivables: metrics.receivables || 0,
        data_source: "quickbooks",
      };

      const extendedPayload = {
        ...basePayload,
        payables: metrics.payables || 0,
        ytd_revenue: metrics.ytdRevenue || 0,
        ytd_expenses: metrics.ytdExpenses || 0,
        inventory_value: metrics.inventoryValue || 0,
      };

      let { error } = await client.database
        .from("financial_data")
        .insert(extendedPayload);

      if (error && isMissingFinancialDataColumnError(error)) {
        const retry = await client.database
          .from("financial_data")
          .insert(basePayload);
        error = retry.error;
      }

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

  // Load financial data history
  useEffect(() => {
    if (!user) {
      setLoadingHistory(false);
      return;
    }

    setLoadingHistory(true);
    void refreshHistory(true)
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
    return new Date(dateString).toLocaleDateString("en-US", {
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
      const receivablesValue = parseFloat(formData.receivables.replace(/,/g, ""));
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

      const basePayload = {
        user_id: user.id,
        period_date: periodDateValue,
        cash_balance: cashValue,
        revenue: revenueValue,
        expenses: expensesValue,
        receivables: receivablesValue,
        data_source: "manual",
      };

      const extendedPayload = {
        ...basePayload,
        payables: payablesValue,
        ytd_revenue: ytdRevenueValue,
        ytd_expenses: ytdExpensesValue,
        inventory_value: inventoryValue,
        expense_breakdown:
          rentValue || payrollValue || suppliesValue || marketingValue || otherValue
            ? {
                rent: rentValue,
                payroll: payrollValue,
                supplies: suppliesValue,
                marketing: marketingValue,
                other: otherValue,
              }
            : null,
      };

      // Save to InsForge financial_data table
      let { error } = await client.database.from("financial_data").insert(extendedPayload);

      if (error && isMissingFinancialDataColumnError(error)) {
        const retry = await client.database.from("financial_data").insert(basePayload);
        error = retry.error;
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
      await refreshHistory(true);
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
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
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

  function handleColumnMappingChange(field: ColumnMappingKey, value: string) {
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

  async function handleImport() {
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

          const { error } = await client.database.from("financial_data").insert({
            user_id: user.id,
            period_date: periodDate,
            revenue: isNaN(revenue) ? 0 : revenue,
            expenses: isNaN(expenses) ? 0 : expenses,
            cash_balance: isNaN(cashBalance) ? 0 : cashBalance,
            receivables: 0, // Not mapped in CSV import
            data_source: "spreadsheet",
          });

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

  const isMappingValid =
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
        .from("financial_data")
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
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Header */}
          <div
            className="mb-8 sm:mb-12 animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <h1 className="text-4xl sm:text-5xl font-display text-text-primary mb-3">
              Your Numbers
            </h1>
            <p className="text-base sm:text-lg text-text-secondary font-body">
              Keep your financial picture up to date. The more you track, the clearer
              things become.
            </p>
          </div>

          {/* Current Snapshot */}
          {latestSnapshot && (
            <Card className="mb-8 border border-text-muted/20 bg-surface animate-fade-in">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-display text-text-primary">Current Data Snapshot</h2>
                    <p className="text-sm font-body text-text-secondary mt-1">
                      Source: {formatDataSourceLabel(latestSnapshot.dataSource)} | Period: {formatPeriodDisplay(latestSnapshot.period)} | Updated: {formatDate(latestSnapshot.createdAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (quickBooksModeLocked) {
                        setActiveTab("quickbooks");
                        return;
                      }
                      applyEntryToForm(latestSnapshot);
                      selectTab("manual");
                    }}
                  >
                    {quickBooksModeLocked ? "Go to QuickBooks Sync" : "Update These Numbers"}
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div>
                    <p className="text-xs text-text-muted font-body">Cash</p>
                    <p className="text-sm font-display text-text-primary">{formatCurrency(latestSnapshot.cash)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-body">Revenue</p>
                    <p className="text-sm font-display text-text-primary">{formatCurrency(latestSnapshot.revenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-body">Expenses</p>
                    <p className="text-sm font-display text-text-primary">{formatCurrency(latestSnapshot.expenses)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-body">Receivables</p>
                    <p className="text-sm font-display text-text-primary">{formatCurrency(latestSnapshot.receivables)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-body">Payables</p>
                    <p className="text-sm font-display text-text-primary">{formatCurrency(latestSnapshot.payables)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-body">YTD Rev</p>
                    <p className="text-sm font-display text-text-primary">{formatCurrency(latestSnapshot.ytdRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted font-body">YTD Exp</p>
                    <p className="text-sm font-display text-text-primary">{formatCurrency(latestSnapshot.ytdExpenses)}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Tabs */}
          <div
            className="mb-8 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="border-b border-text-muted/20 relative">
              <div className="flex space-x-8">
                <button
                  onClick={() => selectTab("manual")}
                  disabled={quickBooksModeLocked}
                  className={`pb-4 px-1 font-body text-sm sm:text-base font-medium transition-colors relative ${
                    activeTab === "manual"
                      ? "text-orange"
                      : quickBooksModeLocked
                      ? "text-text-muted cursor-not-allowed"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Enter Manually
                  {activeTab === "manual" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange animate-slide-in" />
                  )}
                </button>
                <button
                  onClick={() => selectTab("upload")}
                  disabled={quickBooksModeLocked}
                  className={`pb-4 px-1 font-body text-sm sm:text-base font-medium transition-colors relative ${
                    activeTab === "upload"
                      ? "text-orange"
                      : quickBooksModeLocked
                      ? "text-text-muted cursor-not-allowed"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Upload Spreadsheet
                  {activeTab === "upload" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange animate-slide-in" />
                  )}
                </button>
                <button
                  onClick={() => selectTab("quickbooks")}
                  className={`pb-4 px-1 font-body text-sm sm:text-base font-medium transition-colors relative ${
                    activeTab === "quickbooks"
                      ? "text-orange"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  QuickBooks Sync
                  {activeTab === "quickbooks" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange animate-slide-in" />
                  )}
                </button>
              </div>
            </div>
            {quickBooksModeLocked && (
              <p className="mt-3 text-sm font-body text-text-secondary">
                QuickBooks is connected, so manual entry and spreadsheet upload are disabled.
              </p>
            )}
          </div>

          {/* Manual Entry Form */}
          {activeTab === "manual" && (
            <div
              className="animate-fade-in"
              style={{ animationDelay: "0.3s" }}
            >
              {quickBooksModeLocked ? (
                <Card className="mb-8 border border-[#2CA01C]/30 bg-[#2CA01C]/[0.04]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-display text-text-primary">
                        Manual entry is locked while QuickBooks is connected
                      </h3>
                      <p className="text-sm font-body text-text-secondary mt-2">
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
                </Card>
              ) : (
                <Card className="mb-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Period Selector */}
                  <div>
                    <label
                      htmlFor="period"
                      className="block text-sm font-body font-medium text-text-secondary mb-2"
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
                      className="w-full sm:w-auto px-4 py-3 rounded-md border border-text-muted/30 bg-surface text-text-primary font-body focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Financial Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                      label="Money customers owe you"
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
                  <div className="pt-4 border-t border-text-muted/20">
                    <button
                      type="button"
                      onClick={() => setShowExpenseBreakdown(!showExpenseBreakdown)}
                      className="flex items-center justify-between w-full text-left group"
                    >
                      <span className="text-sm font-body font-medium text-text-secondary group-hover:text-orange transition-colors">
                        Add expense breakdown by category (optional)
                      </span>
                      <svg
                        className={`w-5 h-5 text-text-muted transition-transform ${
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-background/50 p-4 sm:p-6 rounded-lg border border-text-muted/10">
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
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!isFormValid || isSubmitting}
                      className="order-2 sm:order-1"
                    >
                      {isSubmitting ? "Saving..." : "Save This Month's Data"}
                    </Button>

                    <button
                      type="button"
                      onClick={handleConnectQuickBooks}
                      className="text-sm font-body text-text-secondary hover:text-orange transition-colors text-center sm:text-right order-1 sm:order-2"
                    >
                      Or connect QuickBooks to use sync-only mode →
                    </button>
                  </div>
                </form>
              </Card>
              )}
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === "upload" && (
            <div
              className="animate-fade-in"
              style={{ animationDelay: "0.3s" }}
            >
              {quickBooksModeLocked ? (
                <Card className="mb-8 border border-[#2CA01C]/30 bg-[#2CA01C]/[0.04]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-display text-text-primary">
                        Spreadsheet upload is disabled while QuickBooks is connected
                      </h3>
                      <p className="text-sm font-body text-text-secondary mt-2">
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
                </Card>
              ) : csvFiles.length === 0 ? (
                /* Drag and Drop Zone */
                <Card className="mb-8">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg py-16 px-6 text-center transition-all ${
                      isDragging
                        ? "border-orange bg-orange/5"
                        : "border-text-muted/30 hover:border-orange/50 hover:bg-orange/5"
                    }`}
                  >
                    <svg
                      className="w-16 h-16 mx-auto mb-6 text-text-muted opacity-40"
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
                    <h3 className="text-xl font-display text-text-primary mb-3">
                      Drop your financial spreadsheets here
                    </h3>
                    <p className="text-sm font-body text-text-secondary mb-6">
                      Upload multiple files at once - we&apos;ll combine them automatically
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      variant="primary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Choose CSV Files
                    </Button>
                    <p className="text-xs font-body text-text-muted mt-6">
                      Accepts .csv files up to 10MB
                    </p>
                  </div>
                </Card>
              ) : (
                /* CSV Preview and Mapping */
                <div className="space-y-6">
                  {/* Files Info */}
                  <Card>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-display text-text-primary">
                          Uploaded Files ({csvFiles.length})
                        </h3>
                        <Button variant="secondary" size="sm" onClick={resetUpload}>
                          Remove All
                        </Button>
                      </div>

                      {/* List of uploaded files */}
                      <div className="space-y-2">
                        {csvFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                            <svg
                              className="w-6 h-6 text-success flex-shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="font-body font-medium text-text-primary truncate">
                                {file.name}
                              </p>
                              <p className="text-xs font-body text-text-muted">
                                {(file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-text-muted/20">
                        <p className="text-sm font-body text-text-primary mb-2">
                          Total: {csvData.length} rows • {csvHeaders.length} unique columns
                        </p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Add More Files
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* Column Mapping */}
                  <Card>
                    <h3 className="text-lg font-display text-text-primary mb-4">
                      Map Your Columns
                    </h3>
                    <p className="text-sm font-body text-text-secondary mb-6">
                      Match the columns in your spreadsheet to the fields below. We&apos;ve
                      made our best guess, but double-check to make sure.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-body font-medium text-text-secondary mb-2">
                          Revenue <span className="text-error">*</span>
                        </label>
                        <select
                          value={columnMapping.revenue}
                          onChange={(e) =>
                            handleColumnMappingChange("revenue", e.target.value)
                          }
                          className="w-full px-4 py-3 rounded-md border border-text-muted/30 bg-surface text-text-primary font-body focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent appearance-none"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B6560'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 0.75rem center",
                            backgroundSize: "1.25rem",
                            paddingRight: "2.5rem",
                          }}
                        >
                          <option value="">Select column...</option>
                          {csvHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-body font-medium text-text-secondary mb-2">
                          Expenses <span className="text-error">*</span>
                        </label>
                        <select
                          value={columnMapping.expenses}
                          onChange={(e) =>
                            handleColumnMappingChange("expenses", e.target.value)
                          }
                          className="w-full px-4 py-3 rounded-md border border-text-muted/30 bg-surface text-text-primary font-body focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent appearance-none"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B6560'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 0.75rem center",
                            backgroundSize: "1.25rem",
                            paddingRight: "2.5rem",
                          }}
                        >
                          <option value="">Select column...</option>
                          {csvHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-body font-medium text-text-secondary mb-2">
                          Cash Balance <span className="text-error">*</span>
                        </label>
                        <select
                          value={columnMapping.cashBalance}
                          onChange={(e) =>
                            handleColumnMappingChange("cashBalance", e.target.value)
                          }
                          className="w-full px-4 py-3 rounded-md border border-text-muted/30 bg-surface text-text-primary font-body focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent appearance-none"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B6560'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 0.75rem center",
                            backgroundSize: "1.25rem",
                            paddingRight: "2.5rem",
                          }}
                        >
                          <option value="">Select column...</option>
                          {csvHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-body font-medium text-text-secondary mb-2">
                          Date (Optional)
                        </label>
                        <select
                          value={columnMapping.date}
                          onChange={(e) =>
                            handleColumnMappingChange("date", e.target.value)
                          }
                          className="w-full px-4 py-3 rounded-md border border-text-muted/30 bg-surface text-text-primary font-body focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent appearance-none"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B6560'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 0.75rem center",
                            backgroundSize: "1.25rem",
                            paddingRight: "2.5rem",
                          }}
                        >
                          <option value="">Select column...</option>
                          {csvHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </Card>

                  {/* Preview Table */}
                  <Card>
                    <h3 className="text-lg font-display text-text-primary mb-4">
                      Preview
                    </h3>
                    <p className="text-sm font-body text-text-secondary mb-4">
                      First 10 rows from your file
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-text-muted/20">
                            {csvHeaders.map((header) => (
                              <th
                                key={header}
                                className="text-left font-body font-medium text-text-secondary py-3 px-4"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvData.slice(0, 10).map((row, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-text-muted/10 hover:bg-background/50 transition-colors"
                            >
                              {csvHeaders.map((header) => (
                                <td
                                  key={header}
                                  className="font-body text-text-primary py-3 px-4"
                                >
                                  {row[header]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csvData.length > 10 && (
                      <p className="text-xs font-body text-text-muted mt-4">
                        Showing 10 of {csvData.length} rows
                      </p>
                    )}
                  </Card>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                    <Button
                      variant="primary"
                      onClick={handleImport}
                      disabled={!isMappingValid || isImporting}
                    >
                      {isImporting
                        ? "Importing..."
                        : `Import ${csvData.length} Rows`}
                    </Button>
                    <Button variant="cancel" onClick={resetUpload}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QuickBooks Tab */}
          {activeTab === "quickbooks" && (
            <div
              className="animate-fade-in"
              style={{ animationDelay: "0.3s" }}
            >
              <Card className="mb-6 border border-[#2CA01C]/30 bg-[#2CA01C]/[0.04]">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-display text-text-primary">QuickBooks Sync</h3>
                      <p className="text-sm font-body text-text-secondary mt-1">
                        Sync on demand. Each sync writes a new row to your Data ledger.
                      </p>
                    </div>
                    {!qbConnected ? (
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleConnectQuickBooks}
                        disabled={qbConnecting}
                      >
                        {qbConnecting ? "Connecting..." : "Connect QuickBooks"}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            void syncQuickBooksToFinancialData();
                          }}
                          disabled={qbSyncing || qbDisconnecting}
                        >
                          {qbSyncing ? "Syncing..." : "Sync Now"}
                        </Button>
                        <Button
                          type="button"
                          variant="cancel"
                          onClick={() => {
                            void handleDisconnectQuickBooks();
                          }}
                          disabled={qbDisconnecting || qbSyncing}
                        >
                          {qbDisconnecting ? "Disconnecting..." : "Disconnect"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm font-body">
                    <div className="rounded-md bg-white/70 border border-text-muted/20 px-3 py-2">
                      <p className="text-text-muted">Status</p>
                      <p className="text-text-primary font-medium">
                        {qbConnected ? "Connected" : "Not Connected"}
                      </p>
                    </div>
                    <div className="rounded-md bg-white/70 border border-text-muted/20 px-3 py-2">
                      <p className="text-text-muted">Company ID</p>
                      <p className="text-text-primary font-medium">{qbRealmId || "—"}</p>
                    </div>
                    <div className="rounded-md bg-white/70 border border-text-muted/20 px-3 py-2">
                      <p className="text-text-muted">Last Sync</p>
                      <p className="text-text-primary font-medium">
                        {qbLastSyncAt ? formatDate(qbLastSyncAt) : "Never"}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs font-body text-text-secondary">
                    Manual mode: data updates only when you click <span className="font-semibold">Sync Now</span>.
                  </p>
                  {qbConnected && (
                    <p className="text-xs font-body text-text-secondary">
                      QuickBooks is the active source for this account. Manual and spreadsheet
                      updates are locked while connected.
                    </p>
                  )}
                </div>
              </Card>

              {!qbConnected && (
                <Card className="text-center py-12">
                  <p className="font-body text-text-secondary mb-4">
                    Connect QuickBooks to sync your accounting data into ProfitPulse.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleConnectQuickBooks}
                    disabled={qbConnecting}
                  >
                    {qbConnecting ? "Connecting..." : "Connect QuickBooks"}
                  </Button>
                </Card>
              )}
            </div>
          )}

          {/* Unified Data Ledger */}
          <div
            className="mt-10 animate-fade-in"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-display text-text-primary">Data Ledger</h2>
                <p className="text-sm font-body text-text-secondary mt-1">
                  Every saved snapshot used by Dashboard and Scenarios.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setLoadingHistory(true);
                  void refreshHistory(false).finally(() => {
                    setLoadingHistory(false);
                  });
                }}
              >
                Refresh Ledger
              </Button>
            </div>

            {loadingHistory ? (
              <Card className="text-center py-12">
                <div className="text-text-muted mb-2">
                  <div className="w-12 h-12 mx-auto mb-4 border-4 border-orange/20 border-t-orange rounded-full animate-spin" />
                  <p className="font-body text-sm">Loading ledger...</p>
                </div>
              </Card>
            ) : historyEntries.length === 0 ? (
              <Card className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-orange/10 rounded-full mb-5">
                  <Icon
                    icon="ph:table-duotone"
                    className="w-9 h-9 text-orange/70"
                  />
                </div>
                <h3 className="text-xl font-display text-text-primary mb-2">
                  No saved rows yet
                </h3>
                <p className="font-body text-text-secondary max-w-xl mx-auto">
                  Complete the assessment or save data manually to create your first ledger
                  row.
                </p>
              </Card>
            ) : (
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-background/60 border-b border-text-muted/20">
                      <tr>
                        <th className="text-left font-body font-medium text-text-secondary py-3 px-4">Period</th>
                        <th className="text-left font-body font-medium text-text-secondary py-3 px-4">Source</th>
                        <th className="text-right font-body font-medium text-text-secondary py-3 px-4">Cash</th>
                        <th className="text-right font-body font-medium text-text-secondary py-3 px-4">Revenue</th>
                        <th className="text-right font-body font-medium text-text-secondary py-3 px-4">Expenses</th>
                        <th className="text-right font-body font-medium text-text-secondary py-3 px-4">Profit</th>
                        <th className="text-left font-body font-medium text-text-secondary py-3 px-4">Updated</th>
                        <th className="text-left font-body font-medium text-text-secondary py-3 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyEntries.map((entry) => {
                        const profit = entry.revenue - entry.expenses;
                        return (
                          <tr
                            key={entry.id}
                            className="border-b border-text-muted/10 hover:bg-background/40"
                          >
                            <td className="py-3 px-4 font-body text-text-primary">
                              {formatPeriodDisplay(entry.period)}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center rounded-full bg-background px-2 py-1 text-xs font-body text-text-secondary">
                                {formatDataSourceLabel(entry.dataSource)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-body text-text-primary">
                              {formatCurrency(entry.cash)}
                            </td>
                            <td className="py-3 px-4 text-right font-body text-text-primary">
                              {formatCurrency(entry.revenue)}
                            </td>
                            <td className="py-3 px-4 text-right font-body text-text-primary">
                              {formatCurrency(entry.expenses)}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-body ${
                                profit >= 0 ? "text-success" : "text-error"
                              }`}
                            >
                              {formatCurrency(profit)}
                            </td>
                            <td className="py-3 px-4 font-body text-text-secondary">
                              {formatDate(entry.createdAt)}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  disabled={quickBooksModeLocked}
                                  onClick={() => {
                                    applyEntryToForm(entry);
                                    selectTab("manual");
                                    showToast(
                                      "success",
                                      `Loaded ${formatPeriodDisplay(entry.period)} into the form.`
                                    );
                                  }}
                                >
                                  Load
                                </Button>
                                <Button
                                  type="button"
                                  variant="cancel"
                                  size="sm"
                                  disabled={deletingEntryId === entry.id}
                                  onClick={() => {
                                    void handleDeleteLedgerEntry(entry.id, entry.period);
                                  }}
                                >
                                  {deletingEntryId === entry.id ? "Deleting..." : "Delete"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
