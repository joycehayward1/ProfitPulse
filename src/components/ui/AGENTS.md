# src/components/ui - Core UI Components

## Components
- `Button.tsx` — Primary/Secondary/Cancel variants, sm/md/lg sizes, loading/disabled states, fullWidth option
- `Input.tsx` — Label, error/helper text, required indicator, accessible with aria attributes
- `Card.tsx` — Standard/Featured/Highlight variants, clickable with keyboard support
- `CurrencyInput.tsx` — Currency input with $ prefix, auto-formatting (commas, 2 decimals). Parent receives raw numeric string.
- `HealthScoreGauge.tsx` — SVG circular gauge: dark bg, colored ring (green/amber/red by score), white number. Also exports `getScoreColor()` utility.
- `TrafficLightDot.tsx` — Small colored dot with optional label. Pulse animation for critical status.
- `StatusBadge.tsx` — Pill badge: "Healthy"/"Attention"/"Critical" with tinted bg colors.
- `ProgressBar.tsx` — Orange fill bar on gray track with label and percentage display.
- `Toast.tsx` — Toast notifications with ToastProvider context. Use `useToast()` hook. Signature: `showToast(type, message)`.
- `index.ts` — Barrel export for all components

## Usage Patterns
- Import from `@/components/ui` (barrel export): `import { Button, Input, Card, CurrencyInput } from "@/components/ui"`
- All components use `forwardRef` for ref forwarding
- All components accept `className` prop for additional styling
- Card with `onClick` automatically gets `role="button"`, `tabIndex`, and keyboard handlers
- Input with `error` prop shows red border and alert role on error message
- CurrencyInput: pass `value` and `onChange(rawValue)`. Component handles formatting internally. Raw value has no commas (e.g., "12345.67").
- Toast: call `showToast(type, message)` where type is "success" | "error" | "info". Not an object - two parameters.

## Design Tokens Used
- Colors: `bg-orange`, `text-orange`, `bg-surface`, `bg-background`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-error`, `text-error`
- Font: `font-body` (Arial) for all UI components
- Radius: `rounded-md` (10px) for buttons/inputs, `rounded-lg` (16px) for cards
- Spacing: `p-md` (24px) for card padding
- Health colors: `bg-success`/`text-success`, `bg-warning`/`text-warning`, `bg-error`/`text-error` — FUNCTIONAL ONLY

## Health Component Notes
- `HealthScoreGauge` needs a parent with `relative` positioning for the centered score number (uses `absolute`)
- `getScoreColor(score)` returns hex color — reuse this wherever score→color mapping is needed
- Green/Amber/Red are NEVER used decoratively — only on health/status components
- `HealthStatus` type ("healthy" | "attention" | "critical") shared by TrafficLightDot and StatusBadge
