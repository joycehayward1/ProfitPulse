"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import * as XLSX from "xlsx";
import { Icon } from "@iconify/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/components/ui/Toast";

type DataSource = "upload" | "quickbooks" | "manual" | null;
type Step = "choose-source" | "upload" | "review" | "context" | "processing";

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

interface DatabaseErrorLike {
  code?: string;
  message?: string;
}

function isMissingAssessmentColumnError(error: unknown): boolean {
  const dbError = error as DatabaseErrorLike | null;
  const message = (dbError?.message || "").toLowerCase();
  if (dbError?.code === "PGRST204") return true;

  return (
    message.includes("accounts_payable") ||
    message.includes("ytd_revenue") ||
    message.includes("ytd_expenses") ||
    message.includes("inventory_value") ||
    message.includes("expense_breakdown")
  );
}

function AssessmentContent() {
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handledQbResultRef = useRef<string | null>(null);
  const autoQuickBooksSyncTriggeredRef = useRef(false);

  // State
  const [currentStep, setCurrentStep] = useState<Step>("choose-source");
  const [dataSource, setDataSource] = useState<DataSource>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qbConnected, setQbConnected] = useState(false);
  const [qbRealmId, setQbRealmId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [qbConnecting, setQbConnecting] = useState(false);
  const [qbSyncing, setQbSyncing] = useState(false);
  const [qbSyncedAt, setQbSyncedAt] = useState<string | null>(null);
  const [qbSyncPeriodText, setQbSyncPeriodText] = useState<string | null>(null);
  const [checkingExistingAssessment, setCheckingExistingAssessment] = useState(true);

  // User-confirmed data
  const [formData, setFormData] = useState({
    cash: "",
    revenue: "",
    expenses: "",
    receivables: "",
    payables: "",
    ytdRevenue: "",
    ytdExpenses: "",
    inventoryValue: "",
    employeeCount: "",
    biggestWorry: "",
  });

  // Expense breakdown (optional)
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);
  const [expenseBreakdown, setExpenseBreakdown] = useState({
    rent: "",
    payroll: "",
    supplies: "",
    marketing: "",
    other: "",
  });

  // AI snapshot data (upload flow)
  const [parsedSnapshots, setParsedSnapshots] = useState<AISnapshotData[]>([]);
  const [activeSnapshotIndex, setActiveSnapshotIndex] = useState(0);
  const parsedSnapshot = parsedSnapshots[activeSnapshotIndex] ?? null;
  const [confirmPeriod, setConfirmPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [editingField, setEditingField] = useState<string | null>(null);

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string> | null> => {
    const { getInsForgeClient } = await import("@/lib/insforge");
    const client = getInsForgeClient();
    const { data, error } = await client.auth.getCurrentSession();

    if (error || !data?.session?.accessToken) {
      return null;
    }

    return {
      Authorization: `Bearer ${data.session.accessToken}`,
    };
  }, []);

  const checkQbStatus = useCallback(async () => {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) return;

    const res = await fetch("/api/quickbooks/status", {
      headers: authHeaders,
    });
    if (!res.ok) return;

    const data = await res.json();
    setQbConnected(Boolean(data.connected));
    setQbRealmId(data.realmId || null);
  }, [getAuthHeaders]);

  const formatMetricForInput = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return "";
    return Math.round(value).toLocaleString("en-US");
  };

  const syncFromQuickBooks = useCallback(async (): Promise<boolean> => {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders) {
      showToast("error", "Your session expired. Please log in again.");
      return false;
    }

    setQbSyncing(true);
    try {
      const res = await fetch("/api/quickbooks/assessment-data", {
        method: "GET",
        headers: authHeaders,
      });

      const payload = (await res.json()) as QuickBooksSyncResponse;
      if (!res.ok || !payload.success || !payload.metrics) {
        showToast("error", payload.error || "Failed to sync QuickBooks data.");
        return false;
      }

      const metrics = payload.metrics;

      setFormData((prev) => ({
        ...prev,
        cash: formatMetricForInput(metrics.cash),
        revenue: formatMetricForInput(metrics.revenue),
        expenses: formatMetricForInput(metrics.expenses),
        receivables: formatMetricForInput(metrics.receivables),
        payables: formatMetricForInput(metrics.payables),
        ytdRevenue: formatMetricForInput(metrics.ytdRevenue),
        ytdExpenses: formatMetricForInput(metrics.ytdExpenses),
        inventoryValue: formatMetricForInput(metrics.inventoryValue),
      }));

      setQbSyncedAt(payload.pulledAt || new Date().toISOString());
      if (payload.periods) {
        setQbSyncPeriodText(
          `${payload.periods.monthlyStart} to ${payload.periods.monthlyEnd} (monthly), ${payload.periods.ytdStart} to ${payload.periods.ytdEnd} (YTD)`
        );
      }

      showToast("success", "QuickBooks data synced. Review and continue.");
      return true;
    } catch (err) {
      console.error("Failed to sync QuickBooks assessment data:", err);
      showToast("error", "Failed to sync QuickBooks data.");
      return false;
    } finally {
      setQbSyncing(false);
    }
  }, [getAuthHeaders, showToast]);

  useEffect(() => {
    if (!user) return;
    checkQbStatus();
  }, [user, checkQbStatus]);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    let cancelled = false;

    async function checkExistingAssessment() {
      try {
        const { getInsForgeClient } = await import("@/lib/insforge");
        const client = getInsForgeClient();
        const { data, error } = await client.database
          .from("health_assessments")
          .select("id")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!cancelled) {
          if (!error && data?.id) {
            router.replace("/dashboard");
            return;
          }
          setCheckingExistingAssessment(false);
        }
      } catch (err) {
        console.error("Failed to check existing assessment:", err);
        if (!cancelled) {
          setCheckingExistingAssessment(false);
        }
      }
    }

    checkExistingAssessment();

    return () => {
      cancelled = true;
    };
  }, [user, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      setCheckingExistingAssessment(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    const source = searchParams.get("source");
    if (source === "quickbooks") {
      setDataSource("quickbooks");
      if (qbConnected) {
        setCurrentStep("review");
      }
    }
  }, [searchParams, qbConnected]);

  useEffect(() => {
    if (dataSource !== "quickbooks" || currentStep !== "review" || !qbConnected) {
      return;
    }
    if (autoQuickBooksSyncTriggeredRef.current) {
      return;
    }

    autoQuickBooksSyncTriggeredRef.current = true;
    void syncFromQuickBooks();
  }, [dataSource, currentStep, qbConnected, syncFromQuickBooks]);

  useEffect(() => {
    const qbResult = searchParams.get("qb");
    if (!qbResult || handledQbResultRef.current === qbResult) {
      return;
    }

    handledQbResultRef.current = qbResult;

    if (qbResult === "success") {
      setQbConnected(true);
      setDataSource("quickbooks");
      setCurrentStep("review");
      autoQuickBooksSyncTriggeredRef.current = false;
      showToast("success", "QuickBooks connected successfully!");
      checkQbStatus();
    } else if (qbResult === "error") {
      showToast("error", "Failed to connect QuickBooks. Please try again.");
    } else if (qbResult === "auth_required") {
      showToast("error", "Please log in before connecting QuickBooks.");
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("qb");
    const query = url.searchParams.toString();
    window.history.replaceState({}, "", `${url.pathname}${query ? `?${query}` : ""}`);
  }, [searchParams, showToast, checkQbStatus]);

  // Choose Data Source
  function handleChooseSource(source: DataSource) {
    setDataSource(source);
    if (source === "upload") {
      setCurrentStep("upload");
    } else if (source === "manual") {
      setCurrentStep("review");
    }
    // QuickBooks will be handled when credentials available
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function handleQuickBooksConnect() {
    if (qbConnected) {
      if (!qbSyncedAt) {
        autoQuickBooksSyncTriggeredRef.current = false;
      }
      setDataSource("quickbooks");
      setCurrentStep("review");
      return;
    }

    if (!user?.id) {
      showToast("error", "Please log in before connecting QuickBooks.");
      return;
    }

    setQbConnecting(true);
    try {
      const authHeaders = await getAuthHeaders();
      if (!authHeaders) {
        showToast("error", "Your session expired. Please log in again.");
        return;
      }

      const res = await fetch("/api/connect/quickbooks", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnTo: "/assessment?source=quickbooks",
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

  // File Upload Handlers
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
    const validFiles = files.filter(
      (f) =>
        f.name.endsWith(".csv") ||
        f.name.endsWith(".xlsx") ||
        f.name.endsWith(".xls")
    );

    if (validFiles.length === 0) {
      showToast("error", "Please upload CSV files");
      return;
    }

    setUploadedFiles((prev) => [...prev, ...validFiles]);
    setIsProcessing(true);

    // Read all files and concatenate content for a single AI call
    let allContent = "";

    for (const file of validFiles) {
      const content = await new Promise<string>((resolve) => {
        const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
        const reader = new FileReader();

        reader.onload = (e) => {
          try {
            let csvText = "";
            if (isExcel) {
              const data = new Uint8Array(e.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: "array" });
              // Combine ALL sheets so AI can extract from P&L, Balance Sheet, Cash Flow, etc.
              const parts: string[] = [];
              for (const name of workbook.SheetNames) {
                const sheet = workbook.Sheets[name];
                const csv = XLSX.utils.sheet_to_csv(sheet);
                if (csv.trim()) {
                  parts.push(`=== SHEET: ${name} ===\n${csv}`);
                }
              }
              csvText = parts.join("\n\n");
            } else {
              csvText = e.target?.result as string;
            }
            resolve(csvText);
          } catch (error) {
            console.error(`Error reading ${file.name}:`, error);
            resolve("");
          }
        };

        if (isExcel) {
          reader.readAsArrayBuffer(file);
        } else {
          reader.readAsText(file);
        }
      });

      if (content) {
        allContent += `\n--- ${file.name} ---\n${content}`;
      }
    }

    if (!allContent.trim()) {
      showToast("error", "Could not read any data from the uploaded files.");
      setIsProcessing(false);
      return;
    }

    console.log("🤖 Using AI to analyze uploaded files...");

    try {
      const res = await fetch("/api/extract-financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileContent: allContent }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "AI extraction failed");
      }

      const responseData = await res.json();
      console.log("API response snapshots count:", responseData.snapshots?.length, "raw:", JSON.stringify(responseData.snapshots?.map((s: AISnapshotData) => s.period_date)));
      const parsedArray = responseData.snapshots as AISnapshotData[];

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

      // Set confirm period from the most recent month
      const mostRecent = parsedArray[parsedArray.length - 1];
      if (mostRecent.period_date) {
        const d = new Date(mostRecent.period_date);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          setConfirmPeriod(`${year}-${month}`);
        }
      }

      const totalFields = parsedArray.reduce((sum, snap) => {
        return sum + Object.entries(snap).filter(([k, v]) => k !== "period_date" && v != null).length;
      }, 0);

      const monthLabel = parsedArray.length > 1 ? `${parsedArray.length} months, ` : "";
      console.log(`Found ${totalFields} financial fields across ${parsedArray.length} month(s)`);
      showToast("success", `Found ${monthLabel}${totalFields} financial fields in your files!`);

      setIsProcessing(false);
      setCurrentStep("review");
      return;
    } catch (aiError) {
      console.error("AI extraction failed:", aiError);
      showToast("error", "AI analysis failed. Please try again.");
    }

    setIsProcessing(false);
  }

  // Submit Assessment
  async function handleSubmit() {
    if (!user) return;

    setIsProcessing(true);

    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      // Upload flow with full snapshot(s)
      if (dataSource === "upload" && parsedSnapshots.length > 0) {
        // Use the most recent month for the health assessment
        const mostRecent = parsedSnapshots[parsedSnapshots.length - 1];
        const cash = mostRecent.current_assets ?? 0;
        const revenue = mostRecent.total_income ?? 0;
        const expenses = mostRecent.total_expenses ?? 0;
        const receivables = 0;

        const healthScore = calculateHealthScore(cash, revenue, expenses, receivables);

        const basePayload = {
          user_id: user.id,
          cash_on_hand: cash,
          monthly_revenue: revenue,
          monthly_expenses: expenses,
          accounts_receivable: receivables,
          employee_count: parseInt(formData.employeeCount) || 0,
          biggest_worry: formData.biggestWorry || null,
          health_score: healthScore,
        };

        // Save health assessment
        const { error } = await client.database
          .from("health_assessments")
          .insert(basePayload);

        if (error) {
          console.error("Error saving assessment:", error);
          const dbError = error as DatabaseErrorLike;
          showToast(
            "error",
            dbError.message
              ? `Failed to save assessment: ${dbError.message}`
              : "Failed to save assessment"
          );
          return;
        }

        // Upsert ALL months to financial_snapshots
        const snapshotRows = parsedSnapshots.map((snap) => {
          let periodDate = snap.period_date;

          // For single-month uploads, use the user-confirmed period
          if (parsedSnapshots.length === 1 && confirmPeriod) {
            periodDate = confirmPeriod + "-01";
          }

          if (periodDate) {
            const d = new Date(periodDate);
            if (!isNaN(d.getTime())) {
              const y = d.getFullYear();
              const m = d.getMonth() + 1;
              const lastDay = new Date(y, m, 0).getDate();
              periodDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
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

        const { error: snapshotError } = await client.database
          .from("financial_snapshots")
          .upsert(snapshotRows, { onConflict: "user_id,period_date" });

        if (snapshotError) {
          console.error("Error saving financial snapshot:", snapshotError);
          const dbError = snapshotError as DatabaseErrorLike;
          showToast(
            "error",
            dbError.message
              ? `Assessment saved, but snapshot failed: ${dbError.message}`
              : "Assessment saved, but snapshot failed."
          );
          return;
        }

        // Store in sessionStorage as backup
        sessionStorage.setItem(
          "assessment_data",
          JSON.stringify({
            cash_on_hand: cash,
            monthly_revenue: revenue,
            monthly_expenses: expenses,
            accounts_receivable: receivables,
            employee_count: parseInt(formData.employeeCount) || 0,
            biggest_worry: formData.biggestWorry,
            health_score: healthScore,
          })
        );
      } else {
        // Manual / QuickBooks flow (original logic)
        const cash = parseFloat(formData.cash.replace(/,/g, "")) || 0;
        const revenue = parseFloat(formData.revenue.replace(/,/g, "")) || 0;
        const expenses = parseFloat(formData.expenses.replace(/,/g, "")) || 0;
        const receivables =
          parseFloat(formData.receivables.replace(/,/g, "")) || 0;
        const payables = parseFloat(formData.payables.replace(/,/g, "")) || 0;
        const ytdRevenue = parseFloat(formData.ytdRevenue.replace(/,/g, "")) || 0;
        const ytdExpenses = parseFloat(formData.ytdExpenses.replace(/,/g, "")) || 0;
        const inventoryValue = parseFloat(formData.inventoryValue.replace(/,/g, "")) || 0;

        const payrollAmount = parseFloat(expenseBreakdown.payroll.replace(/,/g, "")) || 0;
        const rentAmount = parseFloat(expenseBreakdown.rent.replace(/,/g, "")) || 0;
        const suppliesAmount = parseFloat(expenseBreakdown.supplies.replace(/,/g, "")) || 0;
        const marketingAmount = parseFloat(expenseBreakdown.marketing.replace(/,/g, "")) || 0;
        const otherAmount = parseFloat(expenseBreakdown.other.replace(/,/g, "")) || 0;

        const healthScore = calculateHealthScore(cash, revenue, expenses, receivables);

        const basePayload = {
          user_id: user.id,
          cash_on_hand: cash,
          monthly_revenue: revenue,
          monthly_expenses: expenses,
          accounts_receivable: receivables,
          employee_count: parseInt(formData.employeeCount) || 0,
          biggest_worry: formData.biggestWorry || null,
          health_score: healthScore,
        };

        const extendedPayload = {
          ...basePayload,
          accounts_payable: payables,
          ytd_revenue: ytdRevenue,
          ytd_expenses: ytdExpenses,
          inventory_value: inventoryValue,
          expense_breakdown:
            payrollAmount || rentAmount || suppliesAmount || marketingAmount || otherAmount
              ? {
                  rent: rentAmount,
                  payroll: payrollAmount,
                  supplies: suppliesAmount,
                  marketing: marketingAmount,
                  other: otherAmount,
                }
              : null,
        };

        const sourceForFinancialData =
          dataSource === "quickbooks"
            ? "quickbooks"
            : "manual";

        const now = new Date();
        const periodDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

        let { error } = await client.database
          .from("health_assessments")
          .insert(extendedPayload);

        if (error && isMissingAssessmentColumnError(error)) {
          console.warn("health_assessments missing newer columns; falling back to legacy insert", error);
          const retry = await client.database
            .from("health_assessments")
            .insert(basePayload);
          error = retry.error;
        }

        if (error) {
          console.error("Error saving assessment:", error);
          const dbError = error as DatabaseErrorLike;
          showToast(
            "error",
            dbError.message
              ? `Failed to save assessment: ${dbError.message}`
              : "Failed to save assessment"
          );
          return;
        }

        const { error: snapshotError } = await client.database
          .from("financial_snapshots")
          .upsert([{
            user_id: user.id,
            period_date: periodDate,
            data_source: sourceForFinancialData,
            total_income: revenue,
            total_expenses: expenses,
            net_profit: revenue - expenses,
            current_assets: cash,
            current_liabilities: payables,
          }], { onConflict: "user_id,period_date" });

        if (snapshotError) {
          console.error("Error saving financial snapshot:", snapshotError);
          const dbError = snapshotError as DatabaseErrorLike;
          showToast(
            "error",
            dbError.message
              ? `Assessment saved, but data snapshot failed: ${dbError.message}`
              : "Assessment saved, but data snapshot failed."
          );
          return;
        }

        sessionStorage.setItem(
          "assessment_data",
          JSON.stringify({
            cash_on_hand: cash,
            monthly_revenue: revenue,
            monthly_expenses: expenses,
            accounts_receivable: receivables,
            accounts_payable: payables,
            ytd_revenue: ytdRevenue,
            ytd_expenses: ytdExpenses,
            inventory_value: inventoryValue,
            expense_breakdown: payrollAmount || rentAmount || suppliesAmount || marketingAmount || otherAmount ? {
              rent: rentAmount,
              payroll: payrollAmount,
              supplies: suppliesAmount,
              marketing: marketingAmount,
              other: otherAmount,
            } : null,
            employee_count: parseInt(formData.employeeCount) || 0,
            biggest_worry: formData.biggestWorry,
            health_score: healthScore,
          })
        );
      }

      showToast("success", "Assessment completed. Your dashboard is ready.");
      router.push("/dashboard");
    } catch (error) {
      console.error("Assessment error:", error);
      showToast("error", "Failed to complete assessment");
    } finally {
      setIsProcessing(false);
    }
  }

  function calculateHealthScore(
    cash: number,
    revenue: number,
    expenses: number,
    receivables: number
  ): number {
    let score = 0;

    // Cash runway (40 points)
    const runway = expenses > 0 ? cash / expenses : 0;
    if (runway >= 6) score += 40;
    else if (runway >= 3) score += 25;
    else if (runway >= 1) score += 10;

    // Profitability (30 points)
    const profit = revenue - expenses;
    if (profit > 0) {
      const margin = (profit / revenue) * 100;
      if (margin >= 20) score += 30;
      else if (margin >= 10) score += 20;
      else score += 10;
    }

    // Cash health (20 points)
    if (cash >= revenue * 2) score += 20;
    else if (cash >= revenue) score += 15;
    else if (cash >= revenue * 0.5) score += 10;

    // Receivables (10 points)
    const receivablesRatio = revenue > 0 ? receivables / revenue : 0;
    if (receivablesRatio <= 0.3) score += 10;
    else if (receivablesRatio <= 0.5) score += 5;

    return Math.min(score, 100);
  }

  const canProceedToContext =
    (dataSource === "upload" && parsedSnapshot) ||
    (formData.cash && formData.revenue && formData.expenses);

  if (authLoading || checkingExistingAssessment) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-solid border-orange border-r-transparent align-[-0.125em]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background py-8">
        <div className="max-w-3xl mx-auto px-4">
          {/* Choose Source */}
          {currentStep === "choose-source" && (
            <div className="animate-fade-in">
              <div className="text-center mb-12">
                <h1 className="text-4xl sm:text-5xl font-display text-text-primary mb-4">
                  Let&apos;s get you some clarity on your business.
                </h1>
                <p className="text-lg text-text-secondary font-body">
                  How would you like to connect your financial data?
                </p>
              </div>

              <div className="grid gap-6">
                {/* Upload Spreadsheets */}
                <button
                  onClick={() => handleChooseSource("upload")}
                  className="group relative p-8 bg-surface rounded-xl border-2 border-text-muted/20 hover:border-orange hover:shadow-lg transition-all text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange to-orange/80 flex items-center justify-center flex-shrink-0 group-hover:shadow-lg transition-all">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-display text-text-primary mb-2 group-hover:text-orange transition-colors">
                        Upload Spreadsheets (Recommended)
                      </h3>
                      <p className="text-body text-text-secondary font-body mb-3">
                        Upload your CSV files and let AI extract your
                        financial data automatically.
                      </p>
                      <div className="inline-flex items-center gap-2 text-sm text-orange font-semibold">
                        <span>Get started</span>
                        <svg
                          className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </button>

                {/* QuickBooks - Coming Soon */}
                <div
                  className="group relative p-8 rounded-xl border-2 transition-all text-left bg-surface border-text-muted/20 opacity-70 cursor-default"
                >
                  <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1 bg-orange/10 rounded-full">
                    <span className="text-xs font-semibold text-orange">Coming Soon</span>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                      <Image
                        src="/quickbooks.png"
                        alt="QuickBooks"
                        width={48}
                        height={48}
                        className="w-12 h-12 object-contain grayscale"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-display text-text-primary mb-2">
                        Connect QuickBooks
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Enter Manually */}
                <button
                  onClick={() => handleChooseSource("manual")}
                  className="group relative p-8 bg-surface rounded-xl border-2 border-text-muted/20 hover:border-text-secondary hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-text-secondary to-text-muted flex items-center justify-center flex-shrink-0 group-hover:shadow-md transition-all">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-display text-text-primary mb-2">
                        Enter Manually
                      </h3>
                      <p className="text-body text-text-secondary font-body">
                        Type in your financial numbers yourself.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Upload Step */}
          {currentStep === "upload" && (
            <div className="animate-fade-in">
              <button
                onClick={() => setCurrentStep("choose-source")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-text-secondary hover:text-orange hover:bg-orange/5 transition-all mb-8"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span className="font-body font-medium">Back</span>
              </button>

              <div className="text-center mb-8">
                <h1 className="text-3xl sm:text-4xl font-display text-text-primary mb-3">
                  Upload Your Financial Data
                </h1>
                <p className="text-base text-text-secondary font-body">
                  Drop your CSV files below. AI will extract the data
                  automatically.
                </p>
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                  isDragging
                    ? "border-orange bg-orange/5"
                    : "border-text-muted/30 hover:border-orange/50 hover:bg-orange/5"
                }`}
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-orange/10 flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-orange"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-display text-text-primary mb-2">
                  Drop your files here
                </h3>
                <p className="text-sm text-text-secondary mb-6">
                  or click to browse
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
                  disabled={isProcessing}
                >
                  {isProcessing ? "Processing..." : "Choose Files"}
                </Button>
                <p className="text-xs text-text-muted mt-4">
                  Supports CSV files
                </p>
              </div>

              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="mt-6 p-6 bg-surface rounded-xl border border-text-muted/20">
                  <h4 className="text-sm font-medium text-text-secondary mb-3">
                    {uploadedFiles.length} file(s) uploaded:
                  </h4>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 text-sm"
                      >
                        <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-4 h-4 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        <span className="text-text-primary font-body truncate">
                          {file.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4"
                  >
                    Add More Files
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Review & Fill Gaps */}
          {currentStep === "review" && (
            <div className="animate-fade-in">
              <button
                onClick={() =>
                  setCurrentStep(
                    dataSource === "upload" ? "upload" : "choose-source"
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-text-secondary hover:text-orange hover:bg-orange/5 transition-all mb-8"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span className="font-body font-medium">Back</span>
              </button>

              <div className="mb-8">
                <h1 className="text-3xl sm:text-4xl font-display text-text-primary mb-3">
                  {dataSource === "upload"
                    ? "Review Your Financial Data"
                    : dataSource === "quickbooks"
                    ? "Review Your QuickBooks Data"
                    : "Enter Your Financial Data"}
                </h1>
                <p className="text-base text-text-secondary font-body">
                  {dataSource === "upload"
                    ? "Check what we found and fill in any missing details."
                    : dataSource === "quickbooks"
                    ? "You are connected to QuickBooks. Confirm your key numbers to complete your assessment."
                    : "Enter your current financial numbers."}
                </p>
              </div>

              {dataSource === "quickbooks" && (
                <div className="mb-8 p-5 bg-[#2CA01C]/[0.05] border border-[#2CA01C]/30 rounded-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#1E7A14]">
                        {qbSyncing ? "Syncing data from QuickBooks..." : "QuickBooks sync ready"}
                      </p>
                      {qbRealmId && (
                        <p className="text-xs text-text-secondary font-body mt-1">
                          Company ID: {qbRealmId}
                        </p>
                      )}
                      {qbSyncPeriodText && (
                        <p className="text-xs text-text-secondary font-body mt-1">
                          Synced periods: {qbSyncPeriodText}
                        </p>
                      )}
                      {qbSyncedAt && (
                        <p className="text-xs text-text-secondary font-body mt-1">
                          Last synced: {new Date(qbSyncedAt).toLocaleString("en-US")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        autoQuickBooksSyncTriggeredRef.current = true;
                        await syncFromQuickBooks();
                      }}
                      disabled={qbSyncing}
                    >
                      {qbSyncing ? "Syncing..." : "Refresh from QuickBooks"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Financial Data Section */}
              <div className="space-y-6">
              {dataSource === "upload" && parsedSnapshots.length > 0 ? (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h3 className="text-xl font-display text-text-primary mb-2">
                      Here&apos;s what we found in your spreadsheet
                    </h3>
                    <p className="text-sm font-body text-text-secondary">
                      {parsedSnapshots.length > 1
                        ? `We found ${parsedSnapshots.length} months of data. Review all months below before saving.`
                        : "Review before saving. Click any value to edit or fill in missing fields."}
                    </p>
                  </div>

                  {/* Single-month: show period selector */}
                  {parsedSnapshots.length === 1 && (
                    <div className="mb-6">
                      <label className="block text-sm font-body font-medium text-text-secondary mb-2">
                        Which month does this data cover?
                      </label>
                      <input
                        type="month"
                        value={confirmPeriod}
                        onChange={(e) => setConfirmPeriod(e.target.value)}
                        className="w-full sm:w-auto px-4 py-3 rounded-md border border-text-muted/30 bg-surface text-text-primary font-body focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent transition-all"
                      />
                    </div>
                  )}

                  {/* Show ALL months, each in its own section */}
                  {parsedSnapshots.map((snap, snapIdx) => {
                    let monthLabel = `Month ${snapIdx + 1}`;
                    if (snap.period_date) {
                      const d = new Date(snap.period_date);
                      if (!isNaN(d.getTime())) {
                        monthLabel = d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
                      }
                    }

                    return (
                      <div key={snapIdx} className={`space-y-4 ${parsedSnapshots.length > 1 ? "pb-6 mb-6 border-b-2 border-orange/20 last:border-b-0 last:mb-0 last:pb-0" : ""}`}>
                        {parsedSnapshots.length > 1 && (
                          <h3 className="text-lg font-display text-orange font-semibold">
                            {monthLabel}
                          </h3>
                        )}

                        <div className="overflow-x-auto space-y-4">
                          {SNAPSHOT_SECTIONS.map((section) => (
                            <div key={section.title}>
                              <h4 className="text-sm font-body font-semibold text-text-secondary uppercase tracking-wider mb-2 px-4">
                                {section.title}
                              </h4>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-text-muted/20">
                                    <th className="text-left font-body font-medium text-text-secondary py-2 px-4">
                                      Field
                                    </th>
                                    <th className="text-right font-body font-medium text-text-secondary py-2 px-4">
                                      Value
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {section.fields.map(({ key, label, format }) => {
                                    const val = snap[key];
                                    const editKey = `${snapIdx}-${key}`;
                                    const isEditing = editingField === editKey;
                                    const displayValue =
                                      val != null && typeof val === "number"
                                        ? format === "currency"
                                          ? formatCurrency(val)
                                          : format === "percent"
                                          ? `${(val * 100).toFixed(1)}%`
                                          : val.toFixed(2)
                                        : null;

                                    return (
                                      <tr key={key} className="border-b border-text-muted/10">
                                        <td className="py-3 px-4 font-body text-text-primary">
                                          {label}
                                        </td>
                                        <td className="py-3 px-4 text-right font-body">
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
                                              className="w-32 ml-auto text-right px-2 py-1 rounded border border-orange/50 bg-white text-text-primary font-body text-sm focus:outline-none focus:ring-2 focus:ring-orange"
                                              onBlur={(e) => {
                                                const raw = e.target.value.replace(/[$,%\s]/g, "").replace(/,/g, "");
                                                const num = parseFloat(raw);
                                                setParsedSnapshots((prev) => {
                                                  const updated = [...prev];
                                                  const current = updated[snapIdx];
                                                  if (!current) return prev;
                                                  updated[snapIdx] = {
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
                                              onClick={() => setEditingField(editKey)}
                                              className={`inline-flex items-center gap-1.5 rounded px-2 py-1 transition-colors hover:bg-orange/10 ${
                                                displayValue
                                                  ? "text-text-primary"
                                                  : "text-text-muted italic"
                                              }`}
                                              title="Click to edit"
                                            >
                                              {displayValue || "Not found"}
                                              <Icon
                                                icon="ph:pencil-simple"
                                                className="w-3 h-3 text-text-muted"
                                                style={{ opacity: 0.4 }}
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
                    );
                  })}
                </div>
              ) : (
                /* Manual / QuickBooks flow: CurrencyInput form */
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <CurrencyInput
                        label="Cash in the bank right now"
                        value={formData.cash}
                        onChange={(value) =>
                          setFormData({ ...formData, cash: value })
                        }
                        placeholder="0"
                        required
                      />
                    </div>

                    <div>
                      <CurrencyInput
                        label="Monthly revenue (average)"
                        value={formData.revenue}
                        onChange={(value) =>
                          setFormData({ ...formData, revenue: value })
                        }
                        placeholder="0"
                        required
                      />
                    </div>

                    <div>
                      <CurrencyInput
                        label="Monthly expenses (average)"
                        value={formData.expenses}
                        onChange={(value) =>
                          setFormData({ ...formData, expenses: value })
                        }
                        placeholder="0"
                        required
                      />
                    </div>

                    <div>
                      <CurrencyInput
                        label="Accounts receivable (money owed to you)"
                        value={formData.receivables}
                        onChange={(value) =>
                          setFormData({ ...formData, receivables: value })
                        }
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <CurrencyInput
                        label="Accounts payable (money you owe)"
                        value={formData.payables}
                        onChange={(value) =>
                          setFormData({ ...formData, payables: value })
                        }
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <CurrencyInput
                        label="Year-to-date revenue"
                        value={formData.ytdRevenue}
                        onChange={(value) =>
                          setFormData({ ...formData, ytdRevenue: value })
                        }
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <CurrencyInput
                        label="Year-to-date expenses"
                        value={formData.ytdExpenses}
                        onChange={(value) =>
                          setFormData({ ...formData, ytdExpenses: value })
                        }
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <CurrencyInput
                        label="Inventory value (if applicable)"
                        value={formData.inventoryValue}
                        onChange={(value) =>
                          setFormData({ ...formData, inventoryValue: value })
                        }
                        placeholder="0"
                      />
                    </div>
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
                            setExpenseBreakdown({ ...expenseBreakdown, marketing: value })
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
                </div>
              )}

                {/* Context Questions */}
                <div className="pt-6 border-t border-text-muted/20">
                  <h3 className="text-lg font-display text-text-primary mb-4">
                    Quick Context (Optional)
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-body font-medium text-text-secondary mb-2">
                        How many employees do you have?
                      </label>
                      <input
                        type="number"
                        value={formData.employeeCount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            employeeCount: e.target.value,
                          })
                        }
                        placeholder="0"
                        className="w-full px-4 py-3 rounded-md border border-text-muted/30 bg-surface text-text-primary font-body focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-body font-medium text-text-secondary mb-2">
                        What&apos;s your biggest financial worry right now?
                      </label>
                      <textarea
                        value={formData.biggestWorry}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            biggestWorry: e.target.value,
                          })
                        }
                        placeholder="E.g., Not enough cash flow, late-paying clients..."
                        rows={3}
                        className="w-full px-4 py-3 rounded-md border border-text-muted/30 bg-surface text-text-primary font-body focus:outline-none focus:ring-2 focus:ring-orange focus:border-transparent resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex justify-end pt-4">
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={!canProceedToContext || isProcessing}
                  >
                    {isProcessing
                      ? "Analyzing..."
                      : "See My Health Assessment"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function AssessmentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AssessmentContent />
    </Suspense>
  );
}
