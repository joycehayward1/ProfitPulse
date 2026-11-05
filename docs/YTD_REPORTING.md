# Year-to-date and monthly reporting

How ProfitPulse turns saved monthly figures into the latest month, year-to-date
totals, trends and calculator defaults. All of these rules live in
`src/lib/financial-periods.ts`; the dashboard, P&L, Cash Flow, Balance Sheet,
Goal Planning, Break-Even and Runway all go through it, so they agree.

No migration is needed. `financial_snapshots.ytd_revenue` and `ytd_expenses`
already exist (migration 003). Existing rows are read as they are; nothing is
rewritten or deleted.

## Rules

| Topic | Rule |
| --- | --- |
| Period | A calendar month (`YYYY-MM`). The day a row is dated on doesn't matter: manual entry uses the 1st, uploads the last day of the month, QuickBooks its report end date. Dates are read from their digits, so `2026-04-01` is April in every time zone. |
| Duplicate months | If a month was saved more than once, the most recently saved row (`created_at`) is used. The others are kept in the database and the screens say "saved more than once". |
| Future months | Months after the current month are left out of every total, with a note naming them. |
| Year to date | January of a calendar year up to the latest saved month in that year, labelled "January–April 2026 (year to date)". Earlier and later years are never included. There is a year selector when more than one year has data. |
| Missing months | Shown as "3 of 4 months saved · not saved: January 2026". Totals add up only what was saved, and the gaps are named. Charts show gaps as breaks, not zeros. |
| Flows vs balances | Income, expenses, profit and cash-flow lines are added up across months. Cash, assets, liabilities, equity, receivables, inventory and working capital are balances: they are read **as of** the latest month that has them and never added up. |
| Latest month | Labelled "Latest saved month — April 2026", never "current". It is compared with the calendar month before it (March 2026) and the same month last year (April 2025). If that month isn't saved, the comparison says so instead of jumping to an older month. |
| Year-on-year comparisons | A period is compared with the same months a year earlier only when the same months are saved in both. Otherwise no percentage is shown, and the screen says why ("January–April 2025 has 1 of 4 months saved…"). |
| Change and colour | Percentage change divides by the absolute prior value, and shows "—" when the prior value is zero or missing. Rising income or profit is green; rising expenses is red. (The Balance Sheet keeps its existing colouring.) |
| Margins | Worked out from the period's totals (net profit ÷ income), not by adding up monthly margins, and shown as a percentage. |
| Monthly estimates | The calculators' "monthly" figures are the average of up to the 3 most recent saved months within the last 12, skipping gaps. They are labelled with the months used, for example "average of February–April 2026 (3 months)". A year-to-date total is never used as a monthly figure. |
| Cash for Runway | The latest saved cash balance, labelled "as of April 2026 (a balance, not added up across months)". |
| Dashboard insight | "Latest month at a glance" (`src/lib/dashboard-insight.ts`) only restates saved figures: the latest month's margin against the calendar month before, and how income and expenses moved. If the month before isn't saved, it says so. With nothing saved, it asks for data. (It replaced a fixed "profit margin improved 8%" sentence that every account saw.) |
| Stated YTD | If a saved row has a typed-in year-to-date figure that differs from the sum of saved months, both are shown. The saved months are used for the totals. |

## Goal Planning

- Months done = whichever is later: the calendar months completed this year, or the latest saved month. It is capped at 11, so there is always at least one month left. Months left = 12 − months done, counting the current month.
- Revenue so far = the saved months of this year. If months that have already finished aren't saved (for example May–October when the latest save is April and today is November), they are listed with a warning, and the shortfall is not estimated silently.
- If the year-to-date fields are left blank, revenue so far is estimated as monthly revenue × months done and labelled "Estimate".
- A saved scenario stores the year-to-date figures exactly as entered (or blank), and records how revenue so far was worked out and how many months were done.

Worked example (sample data, viewed on 5 November 2026, saved months February–April 2026, $70,500 income): 10 months done, 2 left, so a $300,000 goal needs ($300,000 − $70,500) ÷ 2 = $114,750 a month.

## Uploads

- An uploaded month is dated on its last day.
- If the same month appears twice in one file, the last one is saved and the user is told.
- Rows whose date can't be read are passed through unchanged.

## Needs the owner's sign-off

1. **Calendar year.** Year to date runs from January. There is no fiscal-year setting; a business whose year starts in another month would need one.
2. **Latest save wins** for a month saved more than once. The alternative is asking the user to pick.
3. **Three-month average** for calculator defaults, as opposed to one month, six months or year-to-date ÷ months.
4. **Months left in Goal Planning** follow the calendar and count the current month. With nothing saved since April, a November view gives 2 months left, not 8.
5. **Expenses as fixed costs.** Break-Even pre-fills fixed costs with total monthly expenses, which includes costs that change with sales. The hint asks the user to adjust.
6. **Existing duplicate rows** stay in the database. Cleaning them up is a separate, reviewed data task.
