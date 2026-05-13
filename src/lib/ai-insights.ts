/**
 * AI Insights Engine
 *
 * Centralized service for generating plain-English AI explanations
 * across dashboard, health assessment, and scenario calculators.
 *
 * Uses InsForge AI Gateway with response caching.
 */

import { getInsForgeClient } from "./insforge";
import {
  DASHBOARD_INSIGHT_PROMPT,
  ASSESSMENT_SUMMARY_PROMPT,
  SCENARIO_EXPLANATION_PROMPT,
} from "./prompts";
import type {
  FinancialData,
  ScenarioType,
  Recommendation,
} from "./database.types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AssessmentData {
  cash_on_hand: number;
  monthly_revenue: number;
  monthly_expenses: number;
  accounts_receivable: number;
  employee_count?: number;
  biggest_worry?: string;
  health_score: number;
}

interface ScenarioInputs {
  [key: string]: unknown;
}

interface ScenarioResult {
  [key: string]: unknown;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  response: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

function getCacheKey(data: unknown): string {
  return JSON.stringify(data);
}

function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_DURATION_MS) {
    cache.delete(key);
    return null;
  }

  return entry.response;
}

function setCache(key: string, response: string): void {
  cache.set(key, { response, timestamp: Date.now() });
}

// ─── AI Generation ────────────────────────────────────────────────────────────

/**
 * Generate AI chat completion with error handling
 */
async function generateCompletion(
  model: string,
  systemPrompt: string,
  userMessage: string
): Promise<string | null> {
  try {
    const insforge = getInsForgeClient();

    const completion = await insforge.ai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      maxTokens: 500,
    });

    return completion.choices[0]?.message?.content || null;
  } catch (error) {
    console.error("AI generation error:", error);
    return null;
  }
}

// ─── Dashboard Insight ────────────────────────────────────────────────────────

/**
 * Generate a single-sentence AI insight for the dashboard
 * Uses GPT-4o Mini for cost efficiency
 */
export async function generateDashboardInsight(
  financialData: FinancialData
): Promise<string | null> {
  const cacheKey = getCacheKey({ type: "dashboard", data: financialData });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const systemPrompt = DASHBOARD_INSIGHT_PROMPT;

  const userMessage = `Based on this business data:
- Cash: $${financialData.cash_balance.toLocaleString()}
- Revenue: $${financialData.revenue.toLocaleString()}
- Expenses: $${financialData.expenses.toLocaleString()}
- Receivables: $${financialData.receivables.toLocaleString()}
- Period: ${financialData.period_date}

What's one actionable insight you'd give this business owner?`;

  const response = await generateCompletion(
    "openai/gpt-4o-mini",
    systemPrompt,
    userMessage
  );

  if (response) {
    setCache(cacheKey, response);
  }

  return response;
}

// ─── Health Assessment Summary ────────────────────────────────────────────────

interface AssessmentSummaryResult {
  summary: string;
  recommendations: Recommendation[];
}

/**
 * Generate AI summary and recommendations for health assessment
 * Uses GPT-4o Mini
 */
export async function generateAssessmentSummary(
  data: AssessmentData
): Promise<AssessmentSummaryResult | null> {
  const cacheKey = getCacheKey({ type: "assessment", data });
  const cached = getCached(cacheKey);
  if (cached) return JSON.parse(cached);

  const systemPrompt = ASSESSMENT_SUMMARY_PROMPT;

  const profit = data.monthly_revenue - data.monthly_expenses;
  const profitMargin =
    data.monthly_revenue > 0
      ? ((profit / data.monthly_revenue) * 100).toFixed(1)
      : "0";
  const runway =
    data.monthly_expenses > 0
      ? (data.cash_on_hand / data.monthly_expenses).toFixed(1)
      : "N/A";

  const userMessage = `Business financial snapshot:
- Health Score: ${data.health_score}/100
- Cash on hand: $${data.cash_on_hand.toLocaleString()}
- Monthly revenue: $${data.monthly_revenue.toLocaleString()}
- Monthly expenses: $${data.monthly_expenses.toLocaleString()}
- Profit margin: ${profitMargin}%
- Cash runway: ${runway} months
- Accounts receivable: $${data.accounts_receivable.toLocaleString()}
${data.employee_count ? `- Employees: ${data.employee_count}` : ""}
${data.biggest_worry ? `- Owner's biggest worry: "${data.biggest_worry}"` : ""}

Generate a summary and 3 recommendations in JSON format.`;

  const response = await generateCompletion(
    "openai/gpt-4o-mini",
    systemPrompt,
    userMessage
  );

  if (!response) return null;

  try {
    const parsed = JSON.parse(response);
    setCache(cacheKey, response);
    return parsed;
  } catch (error) {
    console.error("Failed to parse AI response:", error);
    return null;
  }
}

// ─── Scenario Explanations ────────────────────────────────────────────────────

/**
 * Generate plain-English explanation for scenario results
 * Uses Claude Sonnet 4.5 for nuanced financial analysis
 */
export async function generateScenarioExplanation(
  scenarioType: ScenarioType,
  inputs: ScenarioInputs,
  result: ScenarioResult
): Promise<string | null> {
  const cacheKey = getCacheKey({ type: "scenario", scenarioType, inputs, result });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const systemPrompt = SCENARIO_EXPLANATION_PROMPT;

  let userMessage = "";

  switch (scenarioType) {
    case "break-even":
      userMessage = `Break-Even Analysis:
Inputs: ${JSON.stringify(inputs, null, 2)}
Result: ${JSON.stringify(result, null, 2)}

Explain what this break-even point means for the business owner in simple terms.`;
      break;

    case "goal-planning":
      userMessage = `Goal Planning:
Inputs: ${JSON.stringify(inputs, null, 2)}
Result: ${JSON.stringify(result, null, 2)}

Explain whether this goal is realistic and what it means for their monthly targets.`;
      break;

    case "hiring":
      userMessage = `Hiring Readiness:
Inputs: ${JSON.stringify(inputs, null, 2)}
Result: ${JSON.stringify(result, null, 2)}

Explain whether they can afford to hire and what to consider.`;
      break;

    case "runway":
      userMessage = `Cash Runway:
Inputs: ${JSON.stringify(inputs, null, 2)}
Result: ${JSON.stringify(result, null, 2)}

Explain what this runway means and whether they should be concerned.`;
      break;

    default:
      return null;
  }

  const response = await generateCompletion(
    "anthropic/claude-sonnet-4.5",
    systemPrompt,
    userMessage
  );

  if (response) {
    setCache(cacheKey, response);
  }

  return response;
}
