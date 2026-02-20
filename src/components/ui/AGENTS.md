# src/components/ui - Core UI Components

## Components
- `Button.tsx` — Primary/Secondary/Cancel variants, sm/md/lg sizes, loading/disabled states, fullWidth option
- `Input.tsx` — Label, error/helper text, required indicator, accessible with aria attributes
- `Card.tsx` — Standard/Featured/Highlight variants, clickable with keyboard support
- `index.ts` — Barrel export for all components

## Usage Patterns
- Import from `@/components/ui` (barrel export): `import { Button, Input, Card } from "@/components/ui"`
- All components use `forwardRef` for ref forwarding
- All components accept `className` prop for additional styling
- Card with `onClick` automatically gets `role="button"`, `tabIndex`, and keyboard handlers
- Input with `error` prop shows red border and alert role on error message

## Design Tokens Used
- Colors: `bg-orange`, `text-orange`, `bg-surface`, `bg-background`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-error`, `text-error`
- Font: `font-body` (Arial) for all UI components
- Radius: `rounded-md` (10px) for buttons/inputs, `rounded-lg` (16px) for cards
- Spacing: `p-md` (24px) for card padding
