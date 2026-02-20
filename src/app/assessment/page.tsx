"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Papa from "papaparse";
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
  sources: {
    cash?: string;
    revenue?: string;
    expenses?: string;
    receivables?: string;
  };
}

export default function AssessmentPage() {
  const { user } = useRequireAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [currentStep, setCurrentStep] = useState<Step>("choose-source");
  const [dataSource, setDataSource] = useState<DataSource>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Extracted data from AI
  const [extractedData, setExtractedData] = useState<ExtractedData>({
    cash: "",
    revenue: "",
    expenses: "",
    receivables: "",
    sources: {},
  });

  // User-confirmed data
  const [formData, setFormData] = useState({
    cash: "",
    revenue: "",
    expenses: "",
    receivables: "",
    employeeCount: "",
    biggestWorry: "",
  });

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

    let extracted: ExtractedData = {
      cash: "",
      revenue: "",
      expenses: "",
      receivables: "",
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
                    content: `Analyze this financial spreadsheet and extract these 4 metrics (if present):

1. **Current Cash Balance** - The amount of cash the business has right now
2. **Monthly Revenue** - Average monthly sales/income
3. **Monthly Expenses** - Average monthly costs/spending
4. **Accounts Receivable** - Money owed to the business by customers

Spreadsheet data:
${csvText}

Return ONLY a JSON object with these exact keys (use empty string "" if not found):
{
  "cash": "number only, no $ or commas",
  "revenue": "number only, no $ or commas",
  "expenses": "number only, no $ or commas",
  "receivables": "number only, no $ or commas"
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
    }));

    setIsProcessing(false);
    setCurrentStep("review");

    const foundCount = [
      extracted.cash,
      extracted.revenue,
      extracted.expenses,
      extracted.receivables,
    ].filter(Boolean).length;

    console.log(`✅ Found ${foundCount} of 4 metrics`);

    showToast(
      "success",
      `Found ${foundCount} of 4 financial metrics in your files!`
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

      // Calculate health score
      const healthScore = calculateHealthScore(
        cash,
        revenue,
        expenses,
        receivables
      );

      // Save assessment
      const { data, error } = await client.database
        .from("health_assessments")
        .insert({
          user_id: user.id,
          cash_on_hand: cash,
          monthly_revenue: revenue,
          monthly_expenses: expenses,
          accounts_receivable: receivables,
          employee_count: parseInt(formData.employeeCount) || 0,
          biggest_worry: formData.biggestWorry || null,
          health_score: healthScore,
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving assessment:", error);
        showToast("error", "Failed to save assessment");
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

      // Redirect to results
      router.push("/assessment/results");
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

  return (
    <AppLayout>
      <div className="min-h-screen bg-background py-8">
        <div className="max-w-3xl mx-auto px-4">
          {/* Choose Source */}
          {currentStep === "choose-source" && (
            <div className="animate-fade-in">
              <div className="text-center mb-12">
                <h1 className="text-4xl sm:text-5xl font-display text-text-primary mb-4">
                  Let's get you some clarity on your business.
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

                {/* QuickBooks (Coming Soon) */}
                <div className="relative p-8 bg-surface/50 rounded-xl border-2 border-text-muted/10 opacity-60">
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
                      <h3 className="text-xl font-display text-text-primary mb-2">
                        Connect QuickBooks
                      </h3>
                      <p className="text-body text-text-secondary font-body">
                        Automatically sync your QuickBooks data for instant
                        insights.
                      </p>
                      <div className="mt-3 inline-block px-3 py-1 bg-purple/10 text-purple text-xs font-medium rounded-full">
                        Coming Soon
                      </div>
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
                    : "Enter Your Financial Data"}
                </h1>
                <p className="text-base text-text-secondary font-body">
                  {dataSource === "upload"
                    ? "Check what we found and fill in any missing details."
                    : "Enter your current financial numbers."}
                </p>
              </div>

              {/* AI Extraction Results */}
              {dataSource === "upload" &&
                uploadedFiles.length > 0 &&
                (extractedData.cash ||
                  extractedData.revenue ||
                  extractedData.expenses ||
                  extractedData.receivables) && (
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
                        Couldn't find this in your files - enter if you have it
                      </p>
                    )}
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
                        What's your biggest financial worry right now?
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
