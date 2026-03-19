# ProfitPulse Product Roadmap

## Current Version (v1) — Core Financial Dashboard
Status: In Development

### What's Built
- Business health score with gauge visualization
- KPI cards: Profit, Cash Flow, Runway, Cash Position
- AI Insight block with dynamic financial commentary
- What-If Scenarios: Break-Even, Goal Planning, Can I Hire, Cash Runway
- P&L page with income trend chart and variance table
- Cash Flow page with trend chart and activity breakdown
- Balance Sheet page with ratio cards and trend charts
- Left sidebar navigation
- QuickBooks Online OAuth integration with on-demand sync
- AI-powered spreadsheet upload (CSV/Excel) with tab selector and confirmation screen
- Data Ledger with sync history
- financial_snapshots database table with full P&L, Balance Sheet, and Cash Flow data per period

### Data Sources Supported
- QuickBooks Online (primary — automatic sync)
- CSV/Excel upload (secondary — AI-parsed)

---

## Version 2 — Intelligence & Planning Layer

### 2.1 Budget vs Actual
Priority: High
- Pull budget data from QBO Budget Manager if available
- Manual budget entry fallback per line item
- New "Budget" page showing:
  Actuals vs Budget variance for current month and YTD
  Green/red variance indicators
  Progress bars toward budget targets
- Budget vs Actual columns added to P&L page
- Alert when expense category exceeds budget by >10%

### 2.2 6-Month Cash Forecast
Priority: High
- Auto-calculated from historical financial_snapshots
- Formula: Beginning Cash + Projected Inflows - Projected Expenses = Ending Cash per month
- Projected inflows/expenses = 3-month rolling average from actual data
- User can adjust assumptions: expected revenue change %, planned one-time expenses
- Visual: line chart showing projected vs actual cash
- Shows "months of runway at current burn rate"

### 2.3 Additional What-If Scenarios (Tier 2)
Priority: Medium
- Hit My Budget: Gap between budget target and YTD actual, required monthly revenue to close the gap
- Reach Income Target: Work backward from desired net income to required revenue
- Increase Revenue by X%: Project new revenue, profit, and margins at a target growth rate
- Equipment Purchase: Monthly savings needed to afford a major purchase by a target date

### 2.4 Labor Cost % and AR Days KPIs
Priority: Medium
- Labor Cost % = Payroll ÷ Revenue (pulled from QBO payroll expense accounts)
- AR Days = Receivables ÷ (Annual Revenue ÷ 365)
- Add both to dashboard KPI cards
- Add to P&L page as supporting metrics
- Flag AR Days > 45 as attention needed

### 2.5 Revenue Projections
Priority: Medium
- Forward-looking revenue by stream
- Based on historical trend + user-defined growth assumptions
- Quarterly view: Q1, Q2, Q3, Q4 projected totals
- Compare projections vs actuals as months pass

### 2.6 Webhook Auto-Sync
Priority: Low
- QBO pushes updates to app automatically when books change
- No manual "Sync Now" required
- Requires: deployed production URL + Intuit webhook registration + signature verification
- Prerequisite: app must be deployed to production domain

---

## Version 3 — Multi-Entity & Collaboration

### 3.1 Multi-Company Support
- Users can connect multiple QBO company accounts
- Switch between companies in the sidebar
- Consolidated view across companies
- Separate financial_snapshots per company

### 3.2 Accountant / Advisor Access
- Invite an accountant or advisor to view dashboards
- Read-only access with optional comment/annotation layer
- Audit log of who viewed what and when

### 3.3 Custom KPI Builder
- Users define their own metrics with custom formulas
- Example: Revenue per Employee = Revenue ÷ Headcount
- Pin custom KPIs to dashboard
- Industry benchmarking: compare KPIs to industry averages

### 3.4 Automated AI Insights
- Weekly email digest: key changes in financial health
- Anomaly detection: flag unusual expense spikes
- Trend alerts: notify when runway drops below threshold
- Natural language Q&A: "Why did my profit drop in March?"

### 3.5 Report Export
- Export any dashboard view as PDF
- Branded with company name and logo
- Shareable link for board presentations
- Export Data Ledger as CSV

### 3.6 Hiring & Compensation Planning
- Full hiring scenario with role, salary, burden rate, revenue needed to break even
- Director comp calculator
- Team headcount planning view
- Revenue per employee trend

---

## Guiding Principles
- ProfitPulse is a visualization and intelligence layer — not a data entry tool. Data lives in QBO or spreadsheets. This app makes sense of it.
- Every feature should answer a question a business owner actually asks, not just display numbers.
- Partial data is better than no data — show what's available, hide what isn't. Never show blank charts.
- QBO users are the primary target. Spreadsheet upload is the bridge for everyone else.
