# Data Entry Page

## Overview
Data entry page at `/data` for manual financial data input and CSV upload.

## Features
- **Two tabs**: Enter Manually | Upload Spreadsheet
- **Manual entry**: CurrencyInput fields for cash, revenue, expenses, receivables
- **CSV upload**: Drag-and-drop with Papa Parse parsing, column mapping, preview table
- **History list**: Previous entries with formatted dates and currencies

## CSV Upload Pattern

### File Processing Flow
1. User drops/selects CSV file
2. Validate file type (.csv only) and size (10MB max)
3. Parse with Papa Parse: `Papa.parse<CSVRow>(file, { header: true, complete: callback })`
4. Auto-detect column mapping from headers
5. Show preview table (first 10 rows)
6. User confirms/adjusts column mapping
7. Import saves to `financial_data` table with `data_source: "spreadsheet"`

### Auto-Detection Logic
Pattern matching on lowercase column headers:
- **Revenue**: sales, revenue, income, rev
- **Expenses**: expense, cost, spending, exp
- **Cash Balance**: cash, balance, bank, bal
- **Date**: date, period, month, year

### Column Mapping UI
- Required fields: Revenue, Expenses, Cash Balance (marked with red asterisk)
- Optional field: Date
- Import button disabled until all required fields mapped

## Component Patterns

### CurrencyInput
Used for all financial inputs. Accepts string value, calls onChange with unformatted numeric string.

### Period Selector
HTML `<input type="month">` with value format `YYYY-MM`.

### Expense Breakdown
Expandable section with smooth height animation (`max-h-0` → `max-h-[600px]`).

## State Management

### Manual Entry State
- `formData`: cash, revenue, expenses, receivables, period
- `expenseBreakdown`: rent, payroll, supplies, marketing, other
- `isSubmitting`: loading state during save

### CSV Upload State
- `csvFile`: File | null
- `csvData`: CSVRow[] (parsed data)
- `csvHeaders`: string[] (column names)
- `columnMapping`: { revenue, expenses, cashBalance, date }
- `isImporting`: loading state during import
- `isDragging`: drag-and-drop hover state

## Utilities

### Format Functions
- `formatPeriodDisplay(period: string)`: "2026-01" → "January 2026"
- `formatDate(dateString: string)`: "2026-01-31T10:30:00Z" → "Jan 31, 2026, 10:30 AM"
- `formatCurrency(amount: number)`: 12400 → "$12,400"

## Testing Notes
- Mock Papa Parse: `jest.mock("papaparse", () => ({ default: { parse: jest.fn() } }))`
- Test file uploads: create File objects, use `Object.defineProperty(input, "files", { value: [file] })`
- Mock InsForge SDK with dynamic imports for data save operations
- 33 total tests (21 manual entry + 12 CSV upload)

## Future Enhancement
When InsForge credentials available:
- Save manual entries to `financial_data` table
- Import CSV rows to `financial_data` table
- Real-time history list from database
- Auto-calculate health score after data entry
