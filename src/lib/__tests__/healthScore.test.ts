import { calculateHealthScore, getHealthStatus, type HealthScoreInputs } from '../healthScore';

describe('calculateHealthScore', () => {
  it('should calculate a high score for healthy business', () => {
    const inputs: HealthScoreInputs = {
      cashOnHand: 60000, // 6 months runway
      monthlyRevenue: 20000,
      monthlyExpenses: 10000, // 50% profit margin
      accountsReceivable: 0, // No receivables
    };

    const result = calculateHealthScore(inputs);

    // Cash runway: 100 * 0.4 = 40
    // Profit margin: 50 * 0.3 = 15
    // Receivables: 100 * 0.3 = 30
    // Total = 85
    expect(result.totalScore).toBe(85);
    expect(result.cashRunway.score).toBe(100);
    expect(result.cashRunway.months).toBe(6);
    expect(result.profitMargin.score).toBe(50);
    expect(result.profitMargin.percentage).toBe(50);
    expect(result.receivablesHealth.score).toBe(100);
  });

  it('should calculate a low score for struggling business', () => {
    const inputs: HealthScoreInputs = {
      cashOnHand: 5000, // 0.5 months runway
      monthlyRevenue: 10000,
      monthlyExpenses: 12000, // Negative margin
      accountsReceivable: 8000, // 80% of revenue in receivables
    };

    const result = calculateHealthScore(inputs);

    expect(result.totalScore).toBeLessThan(30);
    expect(result.cashRunway.score).toBeLessThan(10);
    expect(result.profitMargin.score).toBe(0); // Negative margin = 0
    expect(result.receivablesHealth.score).toBe(20); // 100 - 80
  });

  it('should handle zero expenses (cash runway)', () => {
    const inputs: HealthScoreInputs = {
      cashOnHand: 50000,
      monthlyRevenue: 10000,
      monthlyExpenses: 0,
      accountsReceivable: 0,
    };

    const result = calculateHealthScore(inputs);

    expect(result.cashRunway.score).toBe(0);
    expect(result.cashRunway.months).toBe(0);
  });

  it('should handle zero revenue (profit margin and receivables)', () => {
    const inputs: HealthScoreInputs = {
      cashOnHand: 10000,
      monthlyRevenue: 0,
      monthlyExpenses: 5000,
      accountsReceivable: 0,
    };

    const result = calculateHealthScore(inputs);

    expect(result.profitMargin.score).toBe(0);
    expect(result.profitMargin.percentage).toBe(0);
    expect(result.receivablesHealth.score).toBe(0);
  });

  it('should clamp cash runway score at 100 for 6+ months', () => {
    const inputs: HealthScoreInputs = {
      cashOnHand: 120000, // 12 months runway
      monthlyRevenue: 20000,
      monthlyExpenses: 10000,
      accountsReceivable: 0,
    };

    const result = calculateHealthScore(inputs);

    expect(result.cashRunway.score).toBe(100);
    expect(result.cashRunway.months).toBe(12);
  });

  it('should clamp profit margin score at 100', () => {
    const inputs: HealthScoreInputs = {
      cashOnHand: 60000,
      monthlyRevenue: 20000,
      monthlyExpenses: 5000, // 75% profit margin
      accountsReceivable: 0,
    };

    const result = calculateHealthScore(inputs);

    expect(result.profitMargin.score).toBe(75);
    expect(result.profitMargin.percentage).toBe(75);
  });

  it('should handle high receivables correctly', () => {
    const inputs: HealthScoreInputs = {
      cashOnHand: 60000,
      monthlyRevenue: 20000,
      monthlyExpenses: 10000,
      accountsReceivable: 30000, // 150% of revenue
    };

    const result = calculateHealthScore(inputs);

    expect(result.receivablesHealth.score).toBe(0); // Max(0, 100 - 150)
    expect(result.receivablesHealth.ratio).toBe(150);
  });

  it('should calculate a moderate score', () => {
    const inputs: HealthScoreInputs = {
      cashOnHand: 30000, // 3 months runway
      monthlyRevenue: 15000,
      monthlyExpenses: 10000, // 33% profit margin
      accountsReceivable: 5000, // 33% of revenue
    };

    const result = calculateHealthScore(inputs);

    // Cash runway: 3 months = 50% of 100 = 50 * 0.4 = 20
    // Profit margin: 33% * 0.3 = 9.9
    // Receivables: (100 - 33) = 67 * 0.3 = 20.1
    // Total ≈ 50 (moderate)
    expect(result.totalScore).toBeGreaterThanOrEqual(45);
    expect(result.totalScore).toBeLessThanOrEqual(55);
  });

  it('should clamp final score between 0 and 100', () => {
    const inputs: HealthScoreInputs = {
      cashOnHand: 0,
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      accountsReceivable: 0,
    };

    const result = calculateHealthScore(inputs);

    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });

  it('should include descriptive text in breakdown', () => {
    const inputs: HealthScoreInputs = {
      cashOnHand: 30000,
      monthlyRevenue: 15000,
      monthlyExpenses: 10000,
      accountsReceivable: 5000,
    };

    const result = calculateHealthScore(inputs);

    expect(result.cashRunway.description).toContain('3');
    expect(result.cashRunway.description).toContain('months');
    expect(result.profitMargin.description).toContain('%');
    expect(result.receivablesHealth.description).toContain('receivables');
  });

  it('should have correct weights', () => {
    const inputs: HealthScoreInputs = {
      cashOnHand: 60000,
      monthlyRevenue: 20000,
      monthlyExpenses: 10000,
      accountsReceivable: 0,
    };

    const result = calculateHealthScore(inputs);

    expect(result.cashRunway.weight).toBe(40);
    expect(result.profitMargin.weight).toBe(30);
    expect(result.receivablesHealth.weight).toBe(30);
  });
});

describe('getHealthStatus', () => {
  it('should return "healthy" for scores 80-100', () => {
    expect(getHealthStatus(100)).toBe('healthy');
    expect(getHealthStatus(85)).toBe('healthy');
    expect(getHealthStatus(80)).toBe('healthy');
  });

  it('should return "attention" for scores 50-79', () => {
    expect(getHealthStatus(79)).toBe('attention');
    expect(getHealthStatus(65)).toBe('attention');
    expect(getHealthStatus(50)).toBe('attention');
  });

  it('should return "critical" for scores 0-49', () => {
    expect(getHealthStatus(49)).toBe('critical');
    expect(getHealthStatus(25)).toBe('critical');
    expect(getHealthStatus(0)).toBe('critical');
  });
});
