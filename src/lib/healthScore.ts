/**
 * Health Score Calculation Utility
 *
 * Calculates the business health score based on financial data.
 * Formula breakdown:
 * - Cash Runway: 40% (cash/expenses normalized, 6+ months = 100)
 * - Profit Margin: 30% ((revenue-expenses)/revenue * 100)
 * - Receivables Health: 30% (lower ratio = healthier)
 */

export interface HealthScoreInputs {
  cashOnHand: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  accountsReceivable: number;
}

export interface HealthScoreBreakdown {
  cashRunway: {
    score: number;
    weight: number;
    months: number;
    description: string;
  };
  profitMargin: {
    score: number;
    weight: number;
    percentage: number;
    description: string;
  };
  receivablesHealth: {
    score: number;
    weight: number;
    ratio: number;
    description: string;
  };
  totalScore: number;
}

export function calculateHealthScore(inputs: HealthScoreInputs): HealthScoreBreakdown {
  const { cashOnHand, monthlyRevenue, monthlyExpenses, accountsReceivable } = inputs;

  // Calculate Cash Runway (40% weight)
  const cashRunwayMonths = monthlyExpenses > 0 ? cashOnHand / monthlyExpenses : 0;
  const cashRunwayScore = Math.min(100, (cashRunwayMonths / 6) * 100); // 6+ months = 100
  const cashRunwayWeighted = cashRunwayScore * 0.4;

  // Calculate Profit Margin (30% weight)
  const profit = monthlyRevenue - monthlyExpenses;
  const profitMarginPct = monthlyRevenue > 0 ? (profit / monthlyRevenue) * 100 : 0;
  const profitMarginScore = Math.min(100, Math.max(0, profitMarginPct)); // Clamp 0-100
  const profitMarginWeighted = profitMarginScore * 0.3;

  // Calculate Receivables Health (30% weight)
  // Lower ratio = healthier (less money tied up in receivables)
  // If no revenue, can't calculate meaningful receivables health
  const receivablesRatio = monthlyRevenue > 0 ? (accountsReceivable / monthlyRevenue) * 100 : 0;
  const receivablesScore = monthlyRevenue > 0 ? Math.max(0, 100 - receivablesRatio) : 0;
  const receivablesWeighted = receivablesScore * 0.3;

  // Total Score
  const totalScore = Math.round(cashRunwayWeighted + profitMarginWeighted + receivablesWeighted);

  return {
    cashRunway: {
      score: Math.round(cashRunwayScore),
      weight: 40,
      months: Math.round(cashRunwayMonths * 10) / 10, // Round to 1 decimal
      description: `You have ${Math.round(cashRunwayMonths * 10) / 10} months of cash runway`,
    },
    profitMargin: {
      score: Math.round(profitMarginScore),
      weight: 30,
      percentage: Math.round(profitMarginPct * 10) / 10, // Round to 1 decimal
      description: `Your profit margin is ${Math.round(profitMarginPct)}%`,
    },
    receivablesHealth: {
      score: Math.round(receivablesScore),
      weight: 30,
      ratio: Math.round(receivablesRatio),
      description: `You have ${Math.round(receivablesRatio)}% of monthly revenue in receivables`,
    },
    totalScore: Math.max(0, Math.min(100, totalScore)), // Clamp final score 0-100
  };
}

export function getHealthStatus(score: number): "healthy" | "attention" | "critical" {
  if (score >= 80) return "healthy";
  if (score >= 50) return "attention";
  return "critical";
}
