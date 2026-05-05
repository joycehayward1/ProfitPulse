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

    const completion = await client.ai.chat.completions.create({
      model: "anthropic/claude-sonnet-4-6",
      messages: [
        {
          role: "user",
          content: `You are a financial data parser. The spreadsheet may contain data for ONE month or MULTIPLE months, and may span multiple sheets (Profit & Loss, Balance Sheet, Cash Flow). Extract data from ALL sheets/sections and ALL months.

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
${fileContent}`,
        },
      ],
      maxTokens: 4000,
    });

    const aiResponse = completion.choices[0]?.message?.content || "";

    // Parse response — try array first, then single object
    const arrayMatch = aiResponse.match(/\[[\s\S]*\]/);
    const objectMatch = aiResponse.match(/\{[\s\S]*\}/);

    let result;
    if (arrayMatch) {
      result = JSON.parse(arrayMatch[0]);
    } else if (objectMatch) {
      result = [JSON.parse(objectMatch[0])];
    } else {
      return NextResponse.json(
        { error: "Could not parse financial data from the AI response" },
        { status: 422 }
      );
    }

    if (!Array.isArray(result) || result.length === 0) {
      return NextResponse.json(
        { error: "No financial data found" },
        { status: 422 }
      );
    }

    return NextResponse.json({ snapshots: result });
  } catch (error) {
    console.error("AI extraction error:", error);
    return NextResponse.json(
      { error: "AI extraction failed. Please try again." },
      { status: 500 }
    );
  }
}
