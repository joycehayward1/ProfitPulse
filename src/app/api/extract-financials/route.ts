import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getInsForgeAdmin } from "@/lib/insforge";
import { getAuthenticatedUserId } from "@/lib/server-auth";

export const maxDuration = 300;

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseLedgerDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  // Formats like "1-Jun-26", "01 Jun 2026", "1/Jun/26"
  const dmy = value.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,})[-/ ](\d{2,4})$/);
  if (dmy) {
    const month = MONTH_NAMES[dmy[2].slice(0, 3).toLowerCase()];
    if (month === undefined) return null;
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    const date = new Date(year, month, parseInt(dmy[1], 10));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime()) && fallback.getFullYear() > 1990) {
    return fallback;
  }
  return null;
}

function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const value = parseFloat(cleaned);
  return Number.isNaN(value) ? null : value;
}

/**
 * Bank statement exports are hundreds of raw transaction rows — sending them
 * straight to the AI makes it "show its work" past the output token limit and
 * the extraction fails. Detect the ledger format (date + debit + credit
 * columns) and pre-aggregate into per-month totals the AI can map reliably.
 */
function tryAggregateBankLedger(fileContent: string): string | null {
  const parsed = Papa.parse<string[]>(fileContent.replace(/^\uFEFF/, ""), {
    skipEmptyLines: true,
  });
  const rows = parsed.data;
  if (!rows || rows.length < 10) return null;

  let headerIdx = -1;
  let dateCol = -1;
  let debitCol = -1;
  let creditCol = -1;
  let balanceCol = -1;

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = rows[i].map((c) => (c || "").toLowerCase().trim());
    const d = cells.findIndex((c) => c.includes("date"));
    const de = cells.findIndex((c) => c.includes("debit") || c.includes("withdrawal"));
    const cr = cells.findIndex((c) => c.includes("credit") || c.includes("deposit"));
    if (d !== -1 && de !== -1 && cr !== -1 && de !== cr) {
      headerIdx = i;
      dateCol = d;
      debitCol = de;
      creditCol = cr;
      balanceCol = cells.findIndex((c) => c.includes("balance"));
      break;
    }
  }
  if (headerIdx === -1) return null;

  interface MonthAgg {
    credits: number;
    debits: number;
    count: number;
    latestTime: number;
    endBalance: number | null;
  }
  const months = new Map<string, MonthAgg>();
  let totalTransactions = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const date = parseLedgerDate(row[dateCol]);
    if (!date) continue;
    const debit = parseAmount(row[debitCol]);
    const credit = parseAmount(row[creditCol]);
    if (debit === null && credit === null) continue;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const agg = months.get(key) || {
      credits: 0,
      debits: 0,
      count: 0,
      latestTime: -Infinity,
      endBalance: null,
    };
    agg.credits += credit ?? 0;
    agg.debits += debit ?? 0;
    agg.count += 1;
    if (balanceCol !== -1 && date.getTime() > agg.latestTime) {
      const balance = parseAmount(row[balanceCol]);
      if (balance !== null) {
        agg.latestTime = date.getTime();
        agg.endBalance = balance;
      }
    }
    months.set(key, agg);
    totalTransactions += 1;
  }

  if (months.size === 0 || totalTransactions < 10) return null;

  const lines = Array.from(months.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, agg]) => {
      const balance =
        agg.endBalance !== null ? `, month-end bank balance ${agg.endBalance.toFixed(2)}` : "";
      return `${month}: total credits (money in) ${agg.credits.toFixed(2)}, total debits (money out) ${agg.debits.toFixed(2)}${balance} (${agg.count} transactions)`;
    });

  return `BANK STATEMENT MONTHLY SUMMARY (pre-aggregated from ${totalTransactions} transactions)
Mapping guidance: credits = total_income, debits = total_expenses, net_profit = credits - debits, month-end bank balance = cash on hand (current_assets), net_cash_flow = change in month-end balance vs the prior month. Leave balance-sheet fields that cannot be derived as null.

${lines.join("\n")}`;
}

export async function POST(request: NextRequest) {
  try {
    // Signed-in users only — each call spends AI credits.
    if (!(await getAuthenticatedUserId(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileContent } = await request.json();

    if (!fileContent || typeof fileContent !== "string" || !fileContent.trim()) {
      return NextResponse.json(
        { error: "No file content provided" },
        { status: 400 }
      );
    }

    const client = getInsForgeAdmin();

    // Bank statement exports (raw transaction ledgers) are aggregated into
    // monthly totals first — see tryAggregateBankLedger.
    const aggregated = tryAggregateBankLedger(fileContent);
    const promptContent = aggregated ?? fileContent;

    const prompt = `You are a financial data parser. The spreadsheet may contain data for ONE month or MULTIPLE months, and may span multiple sheets (Profit & Loss, Balance Sheet, Cash Flow). Extract data from ALL sheets/sections and ALL months.

CRITICAL: Respond with ONLY the JSON array. Your response MUST start with the character [ — no explanation, no reasoning, no markdown, no code fences.

IMPORTANT: The spreadsheet may have columns for different months (e.g. Jan, Feb, Mar) or separate sheets per month. Extract EACH month as a separate object.

Return ONLY a JSON array (no markdown, no backticks, no explanation). Each element is one month. Use null for any field truly not found. All monetary values as plain numbers (no $ or commas). Return percentages and ratios as DECIMALS (e.g. 68.3% → 0.683, NOT 68.3).

If the data only covers one month, return an array with one element.

[
  {
    "period_date": "YYYY-MM-DD last day of the month this data covers",
    "total_income": total revenue/income/sales (number or null),
    "gross_profit": gross profit (number or null),
    "total_expenses": total expenses/operating expenses (number or null),
    "net_operating_income": operating income/EBIT (number or null),
    "net_profit": net income/net profit/bottom line (number or null),
    "gross_profit_margin": as decimal e.g. 0.683 (number or null),
    "net_profit_margin": as decimal e.g. 0.157 (number or null),
    "current_assets": cash + receivables + inventory + other current assets (number or null),
    "fixed_assets": property/equipment/long-term assets (number or null),
    "total_assets": total assets (number or null),
    "current_liabilities": AP + short-term debt + other current liabilities (number or null),
    "long_term_liabilities": long-term debt/notes payable (number or null),
    "equity": owner equity/retained earnings/shareholders equity (number or null),
    "operating_activities": cash from operations (number or null),
    "investing_activities": cash from investing (number or null),
    "financing_activities": cash from financing (number or null),
    "net_cash_flow": net change in cash (number or null),
    "working_capital": current_assets minus current_liabilities — calculate if not explicit (number or null),
    "current_ratio": current_assets / current_liabilities — calculate if not explicit (number or null),
    "roa": net_profit / total_assets as decimal — calculate if not explicit (number or null),
    "roe": net_profit / equity as decimal — calculate if not explicit (number or null)
  }
]

Look for common labels: "Total Revenue", "Sales", "Income", "COGS", "Cost of Goods Sold", "Operating Expenses", "Cash and Cash Equivalents", "Accounts Receivable", "Accounts Payable", "Total Current Assets", "Fixed Assets", "Property Plant & Equipment", "Total Liabilities", "Owner's Equity", "Retained Earnings", "Cash from Operations", "Cash from Investing", "Cash from Financing".

If working_capital, current_ratio, roa, or roe are not explicitly stated but can be calculated from other extracted values, calculate them.

Spreadsheet content:
${promptContent}`;

    // Retry up to 3 times for transient AI gateway failures
    let aiResponse = "";
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const completion = await client.ai.chat.completions.create({
          model: "anthropic/claude-sonnet-4.6",
          messages: [{ role: "user", content: prompt }],
          maxTokens: 16000,
        });
        aiResponse = completion.choices[0]?.message?.content || "";
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        console.error(`AI extraction attempt ${attempt}/3 failed:`, err);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }

    if (lastError) {
      console.error("AI extraction failed after 3 attempts:", lastError);
      return NextResponse.json(
        { error: "AI extraction failed after multiple attempts. Please try again." },
        { status: 500 }
      );
    }

    // Parse response — robust JSON extraction
    console.log("AI raw response length:", aiResponse.length);

    let result: unknown[] | null = null;

    // Strategy 1: Try parsing the whole response as JSON directly
    try {
      const parsed = JSON.parse(aiResponse.trim());
      if (Array.isArray(parsed)) result = parsed;
      else if (parsed && typeof parsed === "object") result = [parsed];
    } catch {
      // not pure JSON, try extraction
    }

    // Strategy 2: Find the first [ and try parsing substrings ending at each ] from the end
    if (!result) {
      const firstBracket = aiResponse.indexOf("[");
      if (firstBracket !== -1) {
        for (let i = aiResponse.lastIndexOf("]"); i > firstBracket; i = aiResponse.lastIndexOf("]", i - 1)) {
          try {
            const candidate = aiResponse.substring(firstBracket, i + 1);
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed) && parsed.length > 0) {
              result = parsed;
              break;
            }
          } catch {
            continue;
          }
        }
      }
    }

    // Strategy 3: Extract individual JSON objects with period_date field
    if (!result) {
      const objects: unknown[] = [];
      const objRegex = /\{[^{}]*"period_date"[^{}]*\}/g;
      let match;
      while ((match = objRegex.exec(aiResponse)) !== null) {
        try {
          objects.push(JSON.parse(match[0]));
        } catch {
          // skip malformed
        }
      }
      if (objects.length > 0) result = objects;
    }

    if (!result || result.length === 0) {
      console.error("Could not parse AI response:", aiResponse.substring(0, 500));
      return NextResponse.json(
        { error: "Could not parse financial data from the AI response" },
        { status: 422 }
      );
    }

    console.log("Parsed snapshots count:", result.length);
    return NextResponse.json({ snapshots: result });
  } catch (error) {
    console.error("AI extraction error:", error);
    return NextResponse.json(
      { error: "AI extraction failed. Please try again." },
      { status: 500 }
    );
  }
}
