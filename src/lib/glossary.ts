export type GlossaryCategory = "Score" | "Cash" | "Profit" | "Position" | "Planning";

export interface GlossaryTerm {
  slug: string;
  term: string;
  category: GlossaryCategory;
  definition: string;
  example: string;
  whereToFind?: string;
  whereToFindHref?: string;
}

export const GLOSSARY_CATEGORIES: {
  id: GlossaryCategory;
  label: string;
  description: string;
}[] = [
  { id: "Score", label: "The Score", description: "How we summarize your overall financial health." },
  { id: "Cash", label: "Cash", description: "The money you actually have right now." },
  { id: "Profit", label: "Profit", description: "What you keep after the bills are paid." },
  { id: "Position", label: "Position", description: "What your business owns, owes, and is worth." },
  { id: "Planning", label: "Planning", description: "Tools for thinking ahead." },
];

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    slug: "business-health-score",
    term: "Business Health Score",
    category: "Score",
    definition: "A single number from 0 to 100 that gives you a quick read on how your business is doing financially. It rolls up cash, profit margin, runway, and a few other signals into one snapshot you can check at a glance.",
    example: "A score of 78 means you're in solid shape — strong cash, healthy margins, no urgent fires.",
    whereToFind: "Right at the top of your Dashboard.",
    whereToFindHref: "/dashboard",
  },
  {
    slug: "cash-position",
    term: "Cash Position",
    category: "Cash",
    definition: "How much actual money you have in the bank right now. Not what you'll be paid, not what you've earned — what's available to you today.",
    example: "If your bank balance is $48,000, that's your cash position.",
    whereToFind: "Cash Position card on your Dashboard.",
    whereToFindHref: "/dashboard",
  },
  {
    slug: "cash-flow",
    term: "Cash Flow",
    category: "Cash",
    definition: "The money moving in and out of your business each month. It's different from profit — you can be profitable on paper and still be short on cash if customers haven't paid you yet.",
    example: "You bring in $12K and spend $9K this month — your cash flow is +$3K.",
    whereToFind: "Cash Flow report under Reports.",
    whereToFindHref: "/reports/cashflow",
  },
  {
    slug: "runway",
    term: "Runway",
    category: "Cash",
    definition: "How many months your business can keep running if no new money came in. It's a quick reality check on how much breathing room you have.",
    example: "If you have $30K in the bank and spend $5K a month, your runway is 6 months.",
    whereToFind: "On your Dashboard, right next to Cash Position.",
    whereToFindHref: "/dashboard",
  },
  {
    slug: "burn-rate",
    term: "Burn Rate",
    category: "Cash",
    definition: "How fast you're spending money each month. Most useful when you compare it to your runway and your incoming revenue.",
    example: "If your monthly expenses come to $8K, your burn rate is $8K per month.",
    whereToFind: "Tweak it in the Cash Runway scenario.",
    whereToFindHref: "/scenarios/runway",
  },
  {
    slug: "revenue",
    term: "Revenue",
    category: "Profit",
    definition: "All the money your business brings in from sales, before any expenses come out. Sometimes called the \"top line\" because it sits at the top of a P&L.",
    example: "If you sold $20K worth of services this month, your revenue is $20K — even if you haven't been paid for all of it yet.",
    whereToFind: "Top of your P&L report.",
    whereToFindHref: "/reports/pl",
  },
  {
    slug: "expenses",
    term: "Expenses",
    category: "Profit",
    definition: "Everything you spend to run the business. They come in two flavors — fixed (rent, salaries, software) and variable (materials, contractors, anything that scales with sales).",
    example: "Rent is a fixed expense. Hiring a contractor for one project is variable.",
    whereToFind: "Broken down by category on your P&L report.",
    whereToFindHref: "/reports/pl",
  },
  {
    slug: "cogs",
    term: "Cost of Goods Sold (COGS)",
    category: "Profit",
    definition: "The direct costs of delivering your service or product — materials, sub-contractors, anything you wouldn't have spent if you hadn't taken the job.",
    example: "If you run a renovation business, lumber and the tile-setter you hired are COGS. Your office rent isn't.",
    whereToFind: "P&L report, right below Revenue.",
    whereToFindHref: "/reports/pl",
  },
  {
    slug: "gross-profit",
    term: "Gross Profit",
    category: "Profit",
    definition: "What's left after you subtract COGS from your revenue. Tells you how much each project or sale actually puts in your pocket before overhead.",
    example: "$20K in revenue minus $8K of COGS = $12K of gross profit.",
    whereToFind: "P&L report.",
    whereToFindHref: "/reports/pl",
  },
  {
    slug: "net-profit",
    term: "Net Profit",
    category: "Profit",
    definition: "What's left after every expense — COGS, rent, salaries, software, all of it. The actual money you kept this month.",
    example: "$20K revenue, $8K COGS, $7K overhead = $5K of net profit.",
    whereToFind: "Bottom of your P&L. It's the \"bottom line.\"",
    whereToFindHref: "/reports/pl",
  },
  {
    slug: "profit-margin",
    term: "Profit Margin",
    category: "Profit",
    definition: "Your net profit as a percentage of revenue. A way to compare how efficient your business is, regardless of size.",
    example: "$5K of net profit on $20K of revenue = a 25% profit margin.",
    whereToFind: "P&L Snapshot card on your Dashboard.",
    whereToFindHref: "/dashboard",
  },
  {
    slug: "assets",
    term: "Assets",
    category: "Position",
    definition: "Things your business owns that have value. Cash, equipment, money owed to you by customers, inventory if you carry any.",
    example: "$50K in the bank, a $10K work truck, and $15K in unpaid invoices = $75K in assets.",
    whereToFind: "Balance Sheet report.",
    whereToFindHref: "/reports/balance-sheet",
  },
  {
    slug: "liabilities",
    term: "Liabilities",
    category: "Position",
    definition: "What your business owes. Loans, credit card balances, money owed to vendors, taxes due.",
    example: "A $20K business loan plus $3K on a credit card = $23K in liabilities.",
    whereToFind: "Balance Sheet report.",
    whereToFindHref: "/reports/balance-sheet",
  },
  {
    slug: "equity",
    term: "Equity",
    category: "Position",
    definition: "What your business is actually worth to you, the owner — assets minus liabilities. The \"net worth\" of your business.",
    example: "$75K in assets minus $23K in liabilities = $52K of equity.",
    whereToFind: "Balance Sheet report.",
    whereToFindHref: "/reports/balance-sheet",
  },
  {
    slug: "working-capital",
    term: "Working Capital",
    category: "Position",
    definition: "How much short-term breathing room you have. It's your current assets (cash, unpaid invoices) minus your current bills due in the next year. Positive working capital means you can cover what's coming.",
    example: "$40K in cash and receivables minus $15K in upcoming bills = $25K of working capital.",
    whereToFind: "Balance Sheet report.",
    whereToFindHref: "/reports/balance-sheet",
  },
  {
    slug: "current-ratio",
    term: "Current Ratio",
    category: "Position",
    definition: "A quick health check on whether you can pay your bills over the next year. Take your current assets and divide by your current liabilities. Anything above 1 means you can cover what's due.",
    example: "$40K in current assets divided by $20K in current liabilities = a current ratio of 2.0. Comfortable.",
    whereToFind: "Balance Sheet ratio cards.",
    whereToFindHref: "/reports/balance-sheet",
  },
  {
    slug: "return-on-equity",
    term: "Return on Equity (ROE)",
    category: "Position",
    definition: "How hard the money you've kept in the business is working for you. It's your net profit divided by your equity, shown as a percentage. A higher ROE means each dollar you've invested in the business is generating more profit.",
    example: "$10K of net profit on $50K of equity = a 20% ROE. Every dollar you've built up in the business earned 20 cents this year.",
    whereToFind: "Balance Sheet ratio cards.",
    whereToFindHref: "/reports/balance-sheet",
  },
  {
    slug: "return-on-investment",
    term: "Return on Investment (ROI)",
    category: "Planning",
    definition: "How much you got back compared to what you put in, shown as a percentage. Use it to judge whether a specific spend — a new hire, equipment, a marketing campaign — was worth it.",
    example: "You spend $5K on marketing and it brings back $15K. Your gain is $10K on a $5K spend — a 200% ROI, or $3 back for every $1 you put in.",
    whereToFind: "Use the Scenarios tab to test an investment before you make it.",
    whereToFindHref: "/scenarios",
  },
  {
    slug: "break-even-point",
    term: "Break-Even Point",
    category: "Planning",
    definition: "The level of sales you need to hit just to cover your expenses — no profit, no loss. Knowing this number tells you the floor you can never drop below.",
    example: "If your monthly costs are $10K and your gross margin is 50%, your break-even is $20K in monthly sales.",
    whereToFind: "Run the Break-Even scenario.",
    whereToFindHref: "/scenarios/break-even",
  },
  {
    slug: "scenario",
    term: "Scenario / What-If",
    category: "Planning",
    definition: "A way to ask \"what would happen if...\" without actually doing it. Profit Pulse has these built in so you can try out a hire, a price change, or a goal before you commit to it.",
    example: "\"What if I hired someone for $60K?\" The Hiring scenario will show you what that does to your cash and profit.",
    whereToFind: "The Scenarios tab.",
    whereToFindHref: "/scenarios",
  },
];
