import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";

export async function POST(request: NextRequest) {
  try {
    const { fileContent } = await request.json();

    if (!fileContent || typeof fileContent !== "string" || !fileContent.trim()) {
      return NextResponse.json(
        { error: "No file content provided" },
        { status: 400 }
      );
    }

    const client = getInsForgeAdmin();

    const prompt = `You are a financial data parser. The spreadsheet may contain data for ONE month or MULTIPLE months, and may span multiple sheets (Profit & Loss, Balance Sheet, Cash Flow). Extract data from ALL sheets/sections and ALL months.

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
${fileContent}`;

    // Retry up to 3 times for transient AI gateway failures
    let aiResponse = "";
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const completion = await client.ai.chat.completions.create({
          model: "anthropic/claude-sonnet-4.6",
          messages: [{ role: "user", content: prompt }],
          maxTokens: 8000,
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
