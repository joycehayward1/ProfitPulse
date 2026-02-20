# src/components/auth - Authentication Components

## Files
- `AuthLayout.tsx` — Shared layout wrapper for auth pages (signup, login, forgot-password)

## AuthLayout
- Split layout: dark left panel (desktop only, hidden on mobile), off-white right panel with form
- Left panel: logo, testimonial quote, attribution, copyright footer
- Right panel: heading, subheading, form slot (children), footer link
- Mobile: collapses to single-column with logo header bar + form

## Props
- `heading` / `subheading` — page-specific title and description
- `footerText` / `footerLinkText` / `footerLinkHref` — bottom navigation link

## Patterns
- All auth pages use this layout for visual consistency
- InsForge SDK must be dynamically imported (`await import("@/lib/insforge")`) in event handlers, NOT at module level — SSR will fail otherwise
- Form validation is inline (per-field errors cleared on change)
- Auth API calls wrapped in try/catch with generic fallback error message
