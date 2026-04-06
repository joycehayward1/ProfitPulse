interface WeeklySummaryData {
  userName: string;
  healthScore: number;
  cashOnHand: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  runwayMonths: number;
  profitMargin: number;
  netProfit: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getHealthColor(score: number): string {
  if (score >= 70) return "#2E7D32"; // green
  if (score >= 40) return "#F57C00"; // amber
  return "#C62828"; // red
}

function getHealthLabel(score: number): string {
  if (score >= 70) return "Healthy";
  if (score >= 40) return "Needs Attention";
  return "Critical";
}

export function buildWeeklySummaryEmail(data: WeeklySummaryData): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.VERCEL_URL}` || 'https://myprofitpulse.app';
  const healthColor = getHealthColor(data.healthScore);
  const healthLabel = getHealthLabel(data.healthScore);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #F5F3F0; font-family: Arial, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 16px;">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="font-family: Georgia, serif; color: #2D2A26; font-size: 22px; margin: 0;">
        ProfitPulse Weekly Summary
      </h1>
      <p style="color: #9A948E; font-size: 13px; margin: 8px 0 0;">
        Hi ${data.userName}, here's your business snapshot for this week.
      </p>
    </div>

    <!-- Health Score Card -->
    <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; text-align: center; border: 1px solid #E8E4E0;">
      <p style="color: #6B6560; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Business Health Score</p>
      <div style="font-family: Georgia, serif; font-size: 48px; font-weight: bold; color: ${healthColor}; margin: 0;">
        ${data.healthScore}
      </div>
      <p style="color: ${healthColor}; font-size: 14px; font-weight: 600; margin: 4px 0 0;">${healthLabel}</p>
    </div>

    <!-- Key Metrics -->
    <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #E8E4E0;">
      <p style="color: #6B6560; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px;">Key Metrics</p>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #F5F3F0;">
            <span style="color: #6B6560; font-size: 14px;">Cash on Hand</span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #F5F3F0; text-align: right;">
            <span style="color: #2D2A26; font-size: 14px; font-weight: 600;">${formatCurrency(data.cashOnHand)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #F5F3F0;">
            <span style="color: #6B6560; font-size: 14px;">Monthly Revenue</span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #F5F3F0; text-align: right;">
            <span style="color: #2D2A26; font-size: 14px; font-weight: 600;">${formatCurrency(data.monthlyRevenue)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #F5F3F0;">
            <span style="color: #6B6560; font-size: 14px;">Monthly Expenses</span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #F5F3F0; text-align: right;">
            <span style="color: #2D2A26; font-size: 14px; font-weight: 600;">${formatCurrency(data.monthlyExpenses)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #F5F3F0;">
            <span style="color: #6B6560; font-size: 14px;">Net Profit</span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #F5F3F0; text-align: right;">
            <span style="color: ${data.netProfit >= 0 ? '#2E7D32' : '#C62828'}; font-size: 14px; font-weight: 600;">${formatCurrency(data.netProfit)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #F5F3F0;">
            <span style="color: #6B6560; font-size: 14px;">Profit Margin</span>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #F5F3F0; text-align: right;">
            <span style="color: ${data.profitMargin >= 0 ? '#2E7D32' : '#C62828'}; font-size: 14px; font-weight: 600;">${data.profitMargin.toFixed(1)}%</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 0;">
            <span style="color: #6B6560; font-size: 14px;">Cash Runway</span>
          </td>
          <td style="padding: 10px 0; text-align: right;">
            <span style="color: ${data.runwayMonths >= 3 ? '#2E7D32' : data.runwayMonths >= 1 ? '#F57C00' : '#C62828'}; font-size: 14px; font-weight: 600;">${data.runwayMonths.toFixed(1)} months</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${baseUrl}/dashboard" style="display: inline-block; background: #E8690A; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
        View Full Dashboard
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center;">
      <p style="color: #9A948E; font-size: 12px; margin: 0;">
        You're receiving this because you have weekly summaries enabled in your
        <a href="${baseUrl}/settings?tab=notifications" style="color: #E8690A;">notification settings</a>.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
