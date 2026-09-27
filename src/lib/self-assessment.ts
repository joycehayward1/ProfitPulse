/**
 * Business Financial Self-Assessment (Fusion 4 Business short form).
 *
 * Taken once during onboarding, before the data step. The ratings produce a
 * Financial Habits score that is kept separate from the numbers-based Health
 * Score; pain points choose which focus areas the dashboard leads with; and
 * ratings are compared against the uploaded numbers to surface reality checks.
 */

export const RATING_SCALE = [
  { value: 1, label: "Strongly Disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly Agree" },
] as const;

export const RATING_QUESTIONS = [
  { id: "understand_statements", text: "I understand my financial statements (P&L, Balance Sheet, Cash Flow)." },
  { id: "consistent_profit", text: "My business consistently generates a profit." },
  { id: "budget", text: "I have a clear monthly and annual budget I actively use." },
  { id: "owner_pay", text: "I pay myself a regular and sufficient salary from the business." },
  { id: "cash_reserve", text: "I have a cash reserve that covers at least 3 months of business expenses." },
  { id: "debt_strategy", text: "I have a strategy for reducing debt or managing loans." },
  { id: "top_revenue", text: "I know my top revenue-generating products or services." },
  { id: "track_kpis", text: "I track KPIs (Key Performance Indicators) related to financial growth." },
  { id: "reconciled", text: "My accounts and bank statements are reconciled regularly." },
] as const;

export type RatingId = (typeof RATING_QUESTIONS)[number]["id"];
export type Ratings = Record<RatingId, number>;

export const PAIN_POINTS = [
  { id: "cash_flow", label: "Cash flow is unpredictable" },
  { id: "revenue_stagnant", label: "Revenue is stagnant or declining" },
  { id: "debt", label: "Too much debt / high-interest loans" },
  { id: "owner_pay", label: "I'm not paying myself consistently" },
  { id: "reports", label: "I don't understand my financial reports" },
  { id: "expenses", label: "Expenses are too high" },
  { id: "no_budget", label: "No budget or financial plan in place" },
  { id: "pricing", label: "I need help with pricing/profitability" },
  { id: "other", label: "Other" },
] as const;

export type PainPointId = (typeof PAIN_POINTS)[number]["id"];
export const MAX_PAIN_POINTS = 3;

export const ACCOUNTING_SYSTEMS = [
  "QuickBooks Online",
  "QuickBooks Desktop",
  "Xero",
  "Wave",
  "FreshBooks",
  "Excel / spreadsheets",
  "Nothing yet",
  "Other",
] as const;

export interface SelfAssessment {
  id: string;
  user_id: string;
  ratings: Ratings;
  pain_points: PainPointId[];
  pain_point_other: string | null;
  vision: string | null;
  accounting_system: string | null;
  habits_score: number;
  created_at: string;
}

export type SelfAssessmentInsert = Omit<SelfAssessment, "id" | "created_at">;

/** Average rating mapped to 0–100 (all 1s = 0, all 5s = 100). */
export function calculateHabitsScore(ratings: Ratings): number {
  const values = RATING_QUESTIONS.map((q) => ratings[q.id]).filter(
    (v) => Number.isFinite(v) && v >= 1 && v <= 5
  );
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(((avg - 1) / 4) * 100);
}

export function getPainPointLabel(id: PainPointId): string {
  return PAIN_POINTS.find((p) => p.id === id)?.label ?? id;
}

/** Plain-text summary of pain points, used as AI context. */
export function describePainPoints(
  painPoints: PainPointId[],
  other: string | null
): string {
  return painPoints
    .map((id) => (id === "other" && other ? `Other: ${other}` : getPainPointLabel(id)))
    .join("; ");
}

/** The numbers the dashboard already has, used to personalize focus areas. */
export interface FinancialContext {
  cashOnHand: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  /** Latest month's net profit; falls back to revenue − expenses. */
  netProfit: number;
  /** Current + long-term liabilities from the latest snapshot, if known. */
  totalLiabilities: number | null;
  /** Oldest → newest monthly income, for trend. */
  incomeHistory: number[];
  /** Runway is a paid feature; trial users don't see the months figure. */
  runwayLocked?: boolean;
}

export interface FocusArea {
  painPoint: PainPointId;
  title: string;
  detail: string;
  actionLabel: string;
  href: string;
}

function money(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function runwayMonths(ctx: FinancialContext): number | null {
  if (ctx.runwayLocked) return null;
  return ctx.monthlyExpenses > 0 ? ctx.cashOnHand / ctx.monthlyExpenses : null;
}

export function getFocusAreas(
  assessment: Pick<SelfAssessment, "pain_points" | "pain_point_other">,
  ctx: FinancialContext
): FocusArea[] {
  const runway = runwayMonths(ctx);
  const margin = ctx.monthlyRevenue > 0 ? (ctx.netProfit / ctx.monthlyRevenue) * 100 : null;

  return assessment.pain_points.slice(0, MAX_PAIN_POINTS).map((id): FocusArea => {
    switch (id) {
      case "cash_flow":
        return {
          painPoint: id,
          title: "Steadier cash flow",
          detail:
            runway !== null
              ? `Your cash covers about ${runway.toFixed(1)} months of expenses. See how changes in spending or sales would stretch that.`
              : "See how many months your cash will last, and how changes in spending or sales would stretch it.",
          actionLabel: "Run a runway scenario",
          href: "/scenarios/runway",
        };
      case "revenue_stagnant": {
        const h = ctx.incomeHistory;
        let detail = "Upload a few more months and we'll show whether revenue is rising or falling.";
        if (h.length >= 2 && h[0] > 0) {
          const change = ((h[h.length - 1] - h[0]) / h[0]) * 100;
          detail = `Revenue is ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(0)}% over the last ${h.length} months. Set a target and work backward to what it takes.`;
        }
        return { painPoint: id, title: "Growing revenue", detail, actionLabel: "Plan a revenue goal", href: "/scenarios/goal-planning" };
      }
      case "debt":
        return {
          painPoint: id,
          title: "Getting debt under control",
          detail:
            ctx.totalLiabilities !== null && ctx.totalLiabilities > 0
              ? `Your balance sheet shows ${money(ctx.totalLiabilities)} in liabilities. Start by seeing what's owed and when.`
              : "Upload a balance sheet to see everything you owe in one place.",
          actionLabel: "View balance sheet",
          href: "/reports/balance-sheet",
        };
      case "owner_pay":
        return {
          painPoint: id,
          title: "Paying yourself consistently",
          detail:
            ctx.netProfit > 0
              ? `Last month left ${money(ctx.netProfit)} in profit. Ask Pulse what a sustainable owner's salary looks like at that level.`
              : "Your numbers are tight right now. Ask Pulse how to build toward a regular owner's salary.",
          actionLabel: "Ask Pulse",
          href: "/chat",
        };
      case "reports":
        return {
          painPoint: id,
          title: "Understanding your numbers",
          detail: "Every figure on your dashboard has a plain-English explanation. Tap the ⓘ icons, or browse the glossary.",
          actionLabel: "Open the glossary",
          href: "/glossary",
        };
      case "expenses":
        return {
          painPoint: id,
          title: "Bringing expenses down",
          detail:
            ctx.monthlyRevenue > 0
              ? `Expenses are ${((ctx.monthlyExpenses / ctx.monthlyRevenue) * 100).toFixed(0)}% of revenue. Your P&L shows where the money goes.`
              : `You spend about ${money(ctx.monthlyExpenses)} a month. Your P&L shows where the money goes.`,
          actionLabel: "Review your P&L",
          href: "/reports/pl",
        };
      case "no_budget":
        return {
          painPoint: id,
          title: "Building a financial plan",
          detail: `A good first budget starts with your break-even point: the revenue needed to cover about ${money(ctx.monthlyExpenses)} in monthly costs.`,
          actionLabel: "Find your break-even",
          href: "/scenarios/break-even",
        };
      case "pricing":
        return {
          painPoint: id,
          title: "Pricing for profit",
          detail:
            margin !== null
              ? `You keep about ${margin.toFixed(0)}¢ of every dollar you bring in. See how a price change moves your break-even.`
              : "See how your prices affect the revenue you need to break even.",
          actionLabel: "Run a break-even scenario",
          href: "/scenarios/break-even",
        };
      case "other":
      default:
        return {
          painPoint: "other",
          title: "Your concern",
          detail: assessment.pain_point_other
            ? `"${assessment.pain_point_other}". Pulse can talk it through with your numbers in view.`
            : "Pulse can talk it through with your numbers in view.",
          actionLabel: "Ask Pulse",
          href: "/chat",
        };
    }
  });
}

export interface RealityCheck {
  tone: "positive" | "caution";
  message: string;
}

/**
 * Compares self-ratings with the actual numbers. Only speaks up when they
 * clearly disagree (rating ≥4 vs. bad numbers, or ≤2 vs. good numbers).
 */
export function getRealityChecks(ratings: Ratings, ctx: FinancialContext): RealityCheck[] {
  const checks: RealityCheck[] = [];
  const hasPnl = ctx.monthlyRevenue > 0 || ctx.monthlyExpenses > 0;

  if (hasPnl) {
    if (ratings.consistent_profit >= 4 && ctx.netProfit < 0) {
      checks.push({
        tone: "caution",
        message: `You rated your business as consistently profitable, but your latest month shows a loss of ${money(Math.abs(ctx.netProfit))}. Worth a closer look.`,
      });
    } else if (ratings.consistent_profit <= 2 && ctx.netProfit > 0) {
      checks.push({
        tone: "positive",
        message: `You're doing better than you gave yourself credit for: your latest month shows ${money(ctx.netProfit)} in profit.`,
      });
    }
  }

  const runway = runwayMonths(ctx);
  if (runway !== null) {
    if (ratings.cash_reserve >= 4 && runway < 3) {
      checks.push({
        tone: "caution",
        message: `You said you have 3 months of expenses in reserve, but your cash covers about ${runway.toFixed(1)} months right now.`,
      });
    } else if (ratings.cash_reserve <= 2 && runway >= 3) {
      checks.push({
        tone: "positive",
        message: `Good news: your cash already covers about ${runway.toFixed(1)} months of expenses, more than the 3-month cushion.`,
      });
    }
  }

  return checks;
}
