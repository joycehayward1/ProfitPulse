# Assessment Feature

Multi-step health assessment questionnaire for new users.

## Files

- `page.tsx` - 6-step questionnaire with progress tracking
- `__tests__/page.test.tsx` - 19 tests covering all steps and navigation

## Implementation Patterns

### Multi-Step Form State
- Single `data` object holds all form values (keyed by question ID)
- `currentStep` index tracks position in questions array
- `direction` state ('forward' | 'backward') controls slide animation direction

### Validation
- Per-step validation before advancing
- Required fields enforced except textarea (biggest worry is optional)
- Error state cleared when user starts typing

### Keyboard Navigation
- Enter key advances to next step (currency and number inputs)
- Cmd/Ctrl+Enter submits from textarea (allows Enter for new lines)
- Implemented via `onKeyDown` handlers

### Animations
- CSS keyframe animations for slide-in effects
- Direction-aware: slide-in-right for forward, slide-in-left for backward
- Smooth progress bar transition with `transition-all duration-500`

### Currency Formatting
- Uses `CurrencyInput` component from `@/components/ui`
- Auto-formats with commas and $ prefix
- Parent receives raw numeric value (e.g., "12345.67")

## InsForge Integration

- Saves to `health_assessments` table on submit
- Current implementation uses placeholder user ID
- TODO: Replace with real auth once InsForge credentials available
- Database insert pattern: `client.database.from('table').insert({ ... })`

## Toast Notifications

- Success toast on completion
- Error toast on save failure
- Toast signature: `showToast(type, message)` - two parameters, not object

## Mobile Considerations

- Full-width inputs on small screens
- Buttons stack vertically on mobile
- Progress bar and text scale responsively
- Tested at 375px and 1280px widths
