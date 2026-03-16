"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import * as XLSX from "xlsx";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/components/ui/Toast";

type DataSource = "upload" | "quickbooks" | "manual" | null;
type Step = "choose-source" | "upload" | "review" | "context" | "processing";

interface ExtractedData {
  cash: string;
  revenue: string;
  expenses: string;
  receivables: string;
  payables: string;
  ytdRevenue: string;
  ytdExpenses: string;
  inventoryValue: string;
  sources: {
    cash?: string;
    revenue?: string;
    expenses?: string;
    receivables?: string;
    payables?: string;
    ytdRevenue?: string;
    ytdExpenses?: string;
    inventoryValue?: string;
  };
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

export default function AssessmentPage() {
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
  const [qbConnecting, setQbConnecting] = useState(false);
  const [qbSyncing, setQbSyncing] = useState(false);
  const [qbSyncedAt, setQbSyncedAt] = useState<string | null>(null);
  const [qbSyncPeriodText, setQbSyncPeriodText] = useState<string | null>(null);
  const [checkingExistingAssessment, setCheckingExistingAssessment] = useState(true);

  // Extracted data from AI
  const [extractedData, setExtractedData] = useState<ExtractedData>({
    cash: "",
    revenue: "",
    expenses: "",
    receivables: "",
    payables: "",
    ytdRevenue: "",
    ytdExpenses: "",
    inventoryValue: "",
    sources: {},
  });

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

      setExtractedData((prev) => ({
        ...prev,
        cash: metrics.cash > 0 ? metrics.cash.toString() : "",
        revenue: metrics.revenue > 0 ? metrics.revenue.toString() : "",
        expenses: metrics.expenses > 0 ? metrics.expenses.toString() : "",
        receivables: metrics.receivables > 0 ? metrics.receivables.toString() : "",
        payables: metrics.payables > 0 ? metrics.payables.toString() : "",
        ytdRevenue: metrics.ytdRevenue > 0 ? metrics.ytdRevenue.toString() : "",
        ytdExpenses: metrics.ytdExpenses > 0 ? metrics.ytdExpenses.toString() : "",
        inventoryValue: metrics.inventoryValue > 0 ? metrics.inventoryValue.toString() : "",
        sources: {
          ...(metrics.cash > 0 ? { cash: "QuickBooks" } : {}),
          ...(metrics.revenue > 0 ? { revenue: "QuickBooks" } : {}),
          ...(metrics.expenses > 0 ? { expenses: "QuickBooks" } : {}),
          ...(metrics.receivables > 0 ? { receivables: "QuickBooks" } : {}),
          ...(metrics.payables > 0 ? { payables: "QuickBooks" } : {}),
          ...(metrics.ytdRevenue > 0 ? { ytdRevenue: "QuickBooks" } : {}),
          ...(metrics.ytdExpenses > 0 ? { ytdExpenses: "QuickBooks" } : {}),
          ...(metrics.inventoryValue > 0 ? { inventoryValue: "QuickBooks" } : {}),
        },
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
      showToast("error", "Please upload CSV or Excel files");
      return;
    }

    setUploadedFiles((prev) => [...prev, ...validFiles]);
    setIsProcessing(true);

    // Use AI to extract financial data
    const { getInsForgeClient } = await import("@/lib/insforge");
    const client = getInsForgeClient();

    const extracted: ExtractedData = {
      cash: "",
      revenue: "",
      expenses: "",
      receivables: "",
      payables: "",
      ytdRevenue: "",
      ytdExpenses: "",
      inventoryValue: "",
      sources: {},
    };

    for (const file of validFiles) {
      await new Promise<void>((resolve) => {
        const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
        const reader = new FileReader();

        reader.onload = async (e) => {
          try {
            let csvText = "";

            if (isExcel) {
              // Convert Excel to CSV first
              const data = new Uint8Array(e.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: "array" });
              const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
              csvText = XLSX.utils.sheet_to_csv(firstSheet);
            } else {
              // Already CSV
              csvText = e.target?.result as string;
            }

            console.log(`🤖 Using AI to analyze ${file.name}...`);

            // Use AI to extract financial data
            try {
              const aiResponse = await client.ai.chat.completions.create({
                model: "anthropic/claude-sonnet-4.5",
                messages: [
                  {
                    role: "user",
                    content: `Analyze this financial spreadsheet and extract these 8 metrics (if present):

1. **Current Cash Balance** - The amount of cash the business has right now
2. **Monthly Revenue** - Average monthly sales/income
3. **Monthly Expenses** - Average monthly costs/spending
4. **Accounts Receivable** - Money owed to the business by customers
5. **Accounts Payable** - Money the business owes to vendors/suppliers
6. **Year-to-Date Revenue** - Total revenue earned so far this fiscal year
7. **Year-to-Date Expenses** - Total expenses incurred so far this fiscal year
8. **Inventory Value** - Current value of inventory on hand (if applicable)

Spreadsheet data:
${csvText}

Return ONLY a JSON object with these exact keys (use empty string "" if not found):
{
  "cash": "number only, no $ or commas",
  "revenue": "number only, no $ or commas",
  "expenses": "number only, no $ or commas",
  "receivables": "number only, no $ or commas",
  "payables": "number only, no $ or commas",
  "ytdRevenue": "number only, no $ or commas",
  "ytdExpenses": "number only, no $ or commas",
  "inventoryValue": "number only, no $ or commas"
}`,
                  },
                ],
                temperature: 0.3,
                maxTokens: 500,
              });

              const aiContent = aiResponse.choices[0]?.message?.content || "{}";
              console.log(`🤖 AI response for ${file.name}:`, aiContent);

              // Parse AI response
              const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const aiData = JSON.parse(jsonMatch[0]);

                // Update extracted data (only if not already set)
                if (aiData.cash && !extracted.cash) {
                  extracted.cash = aiData.cash;
                  extracted.sources.cash = file.name;
                }
                if (aiData.revenue && !extracted.revenue) {
                  extracted.revenue = aiData.revenue;
                  extracted.sources.revenue = file.name;
                }
                if (aiData.expenses && !extracted.expenses) {
                  extracted.expenses = aiData.expenses;
                  extracted.sources.expenses = file.name;
                }
                if (aiData.receivables && !extracted.receivables) {
                  extracted.receivables = aiData.receivables;
                  extracted.sources.receivables = file.name;
                }
                if (aiData.payables && !extracted.payables) {
                  extracted.payables = aiData.payables;
                  extracted.sources.payables = file.name;
                }
                if (aiData.ytdRevenue && !extracted.ytdRevenue) {
                  extracted.ytdRevenue = aiData.ytdRevenue;
                  extracted.sources.ytdRevenue = file.name;
                }
                if (aiData.ytdExpenses && !extracted.ytdExpenses) {
                  extracted.ytdExpenses = aiData.ytdExpenses;
                  extracted.sources.ytdExpenses = file.name;
                }
                if (aiData.inventoryValue && !extracted.inventoryValue) {
                  extracted.inventoryValue = aiData.inventoryValue;
                  extracted.sources.inventoryValue = file.name;
                }

                console.log(`✅ Extracted from ${file.name}:`, aiData);
              }
            } catch (aiError) {
              console.error(`❌ AI extraction failed for ${file.name}:`, aiError);
            }

            resolve();
          } catch (error) {
            console.error(`❌ Error processing ${file.name}:`, error);
            resolve();
          }
        };

        if (isExcel) {
          reader.readAsArrayBuffer(file);
        } else {
          reader.readAsText(file);
        }
      });
    }

    // Debug: Show final aggregated data
    console.log("🎯 FINAL AGGREGATED DATA:", extracted);

    setExtractedData(extracted);

    // Pre-fill form with extracted data
    setFormData((prev) => ({
      ...prev,
      cash: extracted.cash || prev.cash,
      revenue: extracted.revenue || prev.revenue,
      expenses: extracted.expenses || prev.expenses,
      receivables: extracted.receivables || prev.receivables,
      payables: extracted.payables || prev.payables,
      ytdRevenue: extracted.ytdRevenue || prev.ytdRevenue,
      ytdExpenses: extracted.ytdExpenses || prev.ytdExpenses,
      inventoryValue: extracted.inventoryValue || prev.inventoryValue,
    }));

    setIsProcessing(false);
    setCurrentStep("review");

    const foundCount = [
      extracted.cash,
      extracted.revenue,
      extracted.expenses,
      extracted.receivables,
      extracted.payables,
      extracted.ytdRevenue,
      extracted.ytdExpenses,
      extracted.inventoryValue,
    ].filter(Boolean).length;

    const totalMetrics = 8;
    console.log(`✅ Found ${foundCount} of ${totalMetrics} metrics`);

    showToast(
      "success",
      `Found ${foundCount} financial metrics in your files!`
    );
  }

  // Submit Assessment
  async function handleSubmit() {
    if (!user) return;

    setIsProcessing(true);

    try {
      const { getInsForgeClient } = await import("@/lib/insforge");
      const client = getInsForgeClient();

      // Parse values
      const cash = parseFloat(formData.cash.replace(/,/g, "")) || 0;
      const revenue = parseFloat(formData.revenue.replace(/,/g, "")) || 0;
      const expenses = parseFloat(formData.expenses.replace(/,/g, "")) || 0;
      const receivables =
        parseFloat(formData.receivables.replace(/,/g, "")) || 0;
      const payables = parseFloat(formData.payables.replace(/,/g, "")) || 0;
      const ytdRevenue = parseFloat(formData.ytdRevenue.replace(/,/g, "")) || 0;
      const ytdExpenses = parseFloat(formData.ytdExpenses.replace(/,/g, "")) || 0;
      const inventoryValue = parseFloat(formData.inventoryValue.replace(/,/g, "")) || 0;

      // Parse expense breakdown
      const payrollAmount = parseFloat(expenseBreakdown.payroll.replace(/,/g, "")) || 0;
      const rentAmount = parseFloat(expenseBreakdown.rent.replace(/,/g, "")) || 0;
      const suppliesAmount = parseFloat(expenseBreakdown.supplies.replace(/,/g, "")) || 0;
      const marketingAmount = parseFloat(expenseBreakdown.marketing.replace(/,/g, "")) || 0;
      const otherAmount = parseFloat(expenseBreakdown.other.replace(/,/g, "")) || 0;

      // Calculate health score
      const healthScore = calculateHealthScore(
        cash,
        revenue,
        expenses,
        receivables
      );

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
          : dataSource === "upload"
          ? "spreadsheet"
          : "manual";

      const now = new Date();
      const periodDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      const financialBasePayload = {
        user_id: user.id,
        period_date: periodDate,
        cash_balance: cash,
        revenue,
        expenses,
        receivables,
        data_source: sourceForFinancialData,
      };

      const financialExtendedPayload = {
        ...financialBasePayload,
        payables,
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

      // Save assessment (with backward compatibility for older schemas)
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

      // Save matching snapshot so Data and Scenarios stay in sync with assessment answers.
      let financialInsert = await client.database
        .from("financial_data")
        .insert(financialExtendedPayload);

      if (financialInsert.error && isMissingFinancialDataColumnError(financialInsert.error)) {
        console.warn(
          "financial_data missing newer columns; falling back to legacy insert",
          financialInsert.error
        );
        financialInsert = await client.database
          .from("financial_data")
          .insert(financialBasePayload);
      }

      if (financialInsert.error) {
        console.error("Error saving financial snapshot:", financialInsert.error);
        const dbError = financialInsert.error as DatabaseErrorLike;
        showToast(
          "error",
          dbError.message
            ? `Assessment saved, but data snapshot failed: ${dbError.message}`
            : "Assessment saved, but data snapshot failed."
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
    formData.cash && formData.revenue && formData.expenses;

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
                        Upload your CSV or Excel files and let AI extract your
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

                {/* QuickBooks */}
                <button
                  onClick={handleQuickBooksConnect}
                  disabled={qbConnecting}
                  className={`group relative p-8 rounded-xl border-2 transition-all text-left ${
                    qbConnected
                      ? "bg-[#2CA01C]/[0.03] border-[#2CA01C] shadow-sm"
                      : "bg-surface border-text-muted/20 hover:border-[#2CA01C] hover:shadow-md"
                  } ${qbConnecting ? "opacity-70 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                      <Image
                        src="/quickbooks.png"
                        alt="QuickBooks"
                        width={48}
                        height={48}
                        className="w-12 h-12 object-contain"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-display text-text-primary mb-2 group-hover:text-[#2CA01C] transition-colors">
                        Connect QuickBooks
                      </h3>
                      <p className="text-body text-text-secondary font-body">
                        Automatically sync your QuickBooks data for instant
                        insights.
                      </p>
                      {qbConnected && (
                        <div className="mt-3 space-y-2">
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#2CA01C]/10 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-[#2CA01C]" />
                            <span className="text-xs font-semibold text-[#1E7A14]">Connected to QuickBooks</span>
                          </div>
                          {qbRealmId && (
                            <p className="text-xs text-text-secondary font-body">
                              Company ID: {qbRealmId}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="mt-3 inline-flex items-center gap-2 text-sm text-[#2CA01C] font-semibold">
                        <span>{qbConnecting ? "Connecting..." : qbConnected ? "Continue to assessment" : "Connect now"}</span>
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
                  Drop your CSV or Excel files below. AI will extract the data
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
                  accept=".csv,.xlsx,.xls"
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
                  Supports CSV, Excel (.xlsx, .xls)
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

              {/* AI Extraction Results */}
              {dataSource === "upload" &&
                uploadedFiles.length > 0 &&
                (extractedData.cash ||
                  extractedData.revenue ||
                  extractedData.expenses ||
                  extractedData.receivables ||
                  extractedData.payables ||
                  extractedData.ytdRevenue ||
                  extractedData.ytdExpenses) && (
                <div className="mb-8 p-6 bg-success/5 border border-success/20 rounded-xl">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center flex-shrink-0">
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
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-display text-text-primary mb-1">
                        AI Found Data in Your Files
                      </h3>
                      <div className="text-sm text-text-secondary font-body space-y-1">
                        {extractedData.cash && (
                          <p>
                            ✓ Cash: ${parseFloat(extractedData.cash).toLocaleString()}{" "}
                            <span className="text-text-muted">
                              (from {extractedData.sources.cash})
                            </span>
                          </p>
                        )}
                        {extractedData.revenue && (
                          <p>
                            ✓ Revenue: ${parseFloat(extractedData.revenue).toLocaleString()}{" "}
                            <span className="text-text-muted">
                              (from {extractedData.sources.revenue})
                            </span>
                          </p>
                        )}
                        {extractedData.expenses && (
                          <p>
                            ✓ Expenses: ${parseFloat(extractedData.expenses).toLocaleString()}{" "}
                            <span className="text-text-muted">
                              (from {extractedData.sources.expenses})
                            </span>
                          </p>
                        )}
                        {extractedData.receivables && (
                          <p>
                            ✓ Receivables: $
                            {parseFloat(extractedData.receivables).toLocaleString()}{" "}
                            <span className="text-text-muted">
                              (from {extractedData.sources.receivables})
                            </span>
                          </p>
                        )}
                        {extractedData.payables && (
                          <p>
                            ✓ Payables: $
                            {parseFloat(extractedData.payables).toLocaleString()}{" "}
                            <span className="text-text-muted">
                              (from {extractedData.sources.payables})
                            </span>
                          </p>
                        )}
                        {extractedData.ytdRevenue && (
                          <p>
                            ✓ YTD Revenue: $
                            {parseFloat(extractedData.ytdRevenue).toLocaleString()}{" "}
                            <span className="text-text-muted">
                              (from {extractedData.sources.ytdRevenue})
                            </span>
                          </p>
                        )}
                        {extractedData.ytdExpenses && (
                          <p>
                            ✓ YTD Expenses: $
                            {parseFloat(extractedData.ytdExpenses).toLocaleString()}{" "}
                            <span className="text-text-muted">
                              (from {extractedData.sources.ytdExpenses})
                            </span>
                          </p>
                        )}
                        {extractedData.inventoryValue && (
                          <p>
                            ✓ Inventory: $
                            {parseFloat(extractedData.inventoryValue).toLocaleString()}{" "}
                            <span className="text-text-muted">
                              (from {extractedData.sources.inventoryValue})
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Inputs */}
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
                    {extractedData.cash && (
                      <p className="text-xs text-success mt-1 font-body">
                        ✓ Auto-filled from {extractedData.sources.cash}
                      </p>
                    )}
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
                    {extractedData.revenue && (
                      <p className="text-xs text-success mt-1 font-body">
                        ✓ Auto-filled from {extractedData.sources.revenue}
                      </p>
                    )}
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
                    {extractedData.expenses && (
                      <p className="text-xs text-success mt-1 font-body">
                        ✓ Auto-filled from {extractedData.sources.expenses}
                      </p>
                    )}
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
                    {extractedData.receivables ? (
                      <p className="text-xs text-success mt-1 font-body">
                        ✓ Auto-filled from {extractedData.sources.receivables}
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted mt-1 font-body">
                        Couldn&apos;t find this in your files - enter if you have it
                      </p>
                    )}
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
                    {extractedData.payables ? (
                      <p className="text-xs text-success mt-1 font-body">
                        ✓ Auto-filled from {extractedData.sources.payables}
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted mt-1 font-body">
                        Bills, vendor invoices, or loans due
                      </p>
                    )}
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
                    {extractedData.ytdRevenue ? (
                      <p className="text-xs text-success mt-1 font-body">
                        ✓ Auto-filled from {extractedData.sources.ytdRevenue}
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted mt-1 font-body">
                        Total revenue earned so far this fiscal year
                      </p>
                    )}
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
                    {extractedData.ytdExpenses ? (
                      <p className="text-xs text-success mt-1 font-body">
                        ✓ Auto-filled from {extractedData.sources.ytdExpenses}
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted mt-1 font-body">
                        Total expenses incurred so far this fiscal year
                      </p>
                    )}
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
                    {extractedData.inventoryValue ? (
                      <p className="text-xs text-success mt-1 font-body">
                        ✓ Auto-filled from {extractedData.sources.inventoryValue}
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted mt-1 font-body">
                        Skip if your business doesn&apos;t carry inventory
                      </p>
                    )}
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
