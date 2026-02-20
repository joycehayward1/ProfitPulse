"use client";

import { useState, useRef, useEffect } from "react";
import Papa, { ParseResult } from "papaparse";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button, Card, CurrencyInput } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getInsForgeClient } from "@/lib/insforge";

type Tab = "manual" | "upload";

interface FormData {
  cash: string;
  revenue: string;
  expenses: string;
  receivables: string;
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
  createdAt: string;
  dataSource: string;
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

export default function DataPage() {
  const { user } = useRequireAuth();
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

  // Load financial data history
  useEffect(() => {
    async function loadHistory() {
      if (!user) return;

      try {
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

        if (data) {
          const entries: HistoryEntry[] = data.map((row: any) => ({
            id: row.id,
            period: row.period_date || getCurrentPeriod(),
            cash: row.cash_balance || 0,
            revenue: row.revenue || 0,
            expenses: row.expenses || 0,
            receivables: row.receivables || 0,
            createdAt: row.created_at,
            dataSource: row.data_source || "manual",
          }));
          setHistoryEntries(entries);
        }
      } catch (error) {
        console.error("Error loading history:", error);
      } finally {
        setLoadingHistory(false);
      }
    }

    loadHistory();
  }, [user]);

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

      // Save to InsForge financial_data table
      const { error } = await client.database.from("financial_data").insert({
        user_id: user.id,
        period_date: formData.period,
        cash_balance: cashValue,
        revenue: revenueValue,
        expenses: expensesValue,
        receivables: receivablesValue,
        data_source: "manual",
      });

      if (error) {
        console.error("Error saving financial data:", error);
        showToast("error", "Failed to save data. Please try again.");
        return;
      }

      showToast("success", "Financial data saved successfully");

      // Reset form
      setFormData({
        cash: "",
        revenue: "",
        expenses: "",
        receivables: "",
        period: getCurrentPeriod(),
      });
      setExpenseBreakdown({
        rent: "",
        payroll: "",
        supplies: "",
        marketing: "",
        other: "",
      });
      setShowExpenseBreakdown(false);

      // Reload history
      setLoadingHistory(true);
      const { data: historyData } = await client.database
        .from("financial_data")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (historyData) {
        const entries: HistoryEntry[] = historyData.map((row: any) => ({
          id: row.id,
          period: row.period_date || getCurrentPeriod(),
          cash: row.cash_balance || 0,
          revenue: row.revenue || 0,
          expenses: row.expenses || 0,
          receivables: row.receivables || 0,
          createdAt: row.created_at,
          dataSource: row.data_source || "manual",
        }));
        setHistoryEntries(entries);
      }
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
    let allHeaders: Set<string> = new Set();

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

          // Skip rows with invalid data
          if (isNaN(revenue) && isNaN(expenses) && isNaN(cashBalance)) {
            skippedCount++;
            continue;
          }

          const { error } = await client.database.from("financial_data").insert({
            user_id: user.id,
            period_date: columnMapping.date ? row[columnMapping.date] : getCurrentPeriod(),
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

        // Reload history
        setLoadingHistory(true);
        const { data: historyData } = await client.database
          .from("financial_data")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (historyData) {
          const entries: HistoryEntry[] = historyData.map((row: any) => ({
            id: row.id,
            period: row.period_date || getCurrentPeriod(),
            cash: row.cash_balance || 0,
            revenue: row.revenue || 0,
            expenses: row.expenses || 0,
            receivables: row.receivables || 0,
            createdAt: row.created_at,
            dataSource: row.data_source || "manual",
          }));
          setHistoryEntries(entries);
        }
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

  const isMappingValid =
    columnMapping.revenue && columnMapping.expenses && columnMapping.cashBalance;

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

          {/* Tabs */}
          <div
            className="mb-8 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="border-b border-text-muted/20 relative">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab("manual")}
                  className={`pb-4 px-1 font-body text-sm sm:text-base font-medium transition-colors relative ${
                    activeTab === "manual"
                      ? "text-orange"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Enter Manually
                  {activeTab === "manual" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange animate-slide-in" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("upload")}
                  className={`pb-4 px-1 font-body text-sm sm:text-base font-medium transition-colors relative ${
                    activeTab === "upload"
                      ? "text-orange"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Upload Spreadsheet
                  {activeTab === "upload" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange animate-slide-in" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Manual Entry Form */}
          {activeTab === "manual" && (
            <div
              className="animate-fade-in"
              style={{ animationDelay: "0.3s" }}
            >
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

                    <a
                      href="#"
                      className="text-sm font-body text-text-secondary hover:text-orange transition-colors text-center sm:text-right order-1 sm:order-2"
                    >
                      Or connect QuickBooks for automatic sync →
                    </a>
                  </div>
                </form>
              </Card>

              {/* History Section */}
              <div
                className="animate-fade-in"
                style={{ animationDelay: "0.4s" }}
              >
                <h2 className="text-2xl font-display text-text-primary mb-6">
                  Previous Entries
                </h2>

                {loadingHistory ? (
                  <Card className="text-center py-12">
                    <div className="text-text-muted mb-2">
                      <div className="w-12 h-12 mx-auto mb-4 border-4 border-orange/20 border-t-orange rounded-full animate-spin" />
                      <p className="font-body text-sm">Loading your financial history...</p>
                    </div>
                  </Card>
                ) : historyEntries.length === 0 ? (
                  <Card className="text-center py-12">
                    <div className="text-text-muted mb-2">
                      <svg
                        className="w-12 h-12 mx-auto mb-4 opacity-40"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="font-body text-sm">
                        No entries yet. Your financial history will appear here.
                      </p>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {historyEntries.map((entry, index) => (
                      <Card
                        key={entry.id}
                        className="hover:shadow-lg transition-all duration-300 cursor-pointer group animate-fade-in"
                        style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-display text-text-primary group-hover:text-orange transition-colors">
                                {formatPeriodDisplay(entry.period)}
                              </h3>
                              <span className="text-xs font-body text-text-muted bg-background px-2 py-1 rounded">
                                {entry.dataSource}
                              </span>
                            </div>
                            <p className="text-xs font-body text-text-muted">
                              Entered {formatDate(entry.createdAt)}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                            <div>
                              <p className="text-xs font-body text-text-secondary mb-1">
                                Cash
                              </p>
                              <p className="text-sm font-display font-semibold text-text-primary">
                                {formatCurrency(entry.cash)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-body text-text-secondary mb-1">
                                Revenue
                              </p>
                              <p className="text-sm font-display font-semibold text-text-primary">
                                {formatCurrency(entry.revenue)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-body text-text-secondary mb-1">
                                Expenses
                              </p>
                              <p className="text-sm font-display font-semibold text-text-primary">
                                {formatCurrency(entry.expenses)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-body text-text-secondary mb-1">
                                Receivables
                              </p>
                              <p className="text-sm font-display font-semibold text-text-primary">
                                {formatCurrency(entry.receivables)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === "upload" && (
            <div
              className="animate-fade-in"
              style={{ animationDelay: "0.3s" }}
            >
              {csvFiles.length === 0 ? (
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
                      Upload multiple files at once - we'll combine them automatically
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
        </div>
      </div>
    </AppLayout>
  );
}
