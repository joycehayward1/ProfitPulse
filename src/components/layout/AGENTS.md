# Layout Components

This directory contains layout components for the authenticated app experience.

## AppLayout

The main authenticated app wrapper that provides:

- **Top Navigation**: Sticky nav bar with logo, main nav items, and user menu
- **Desktop Navigation**: Horizontal nav with active state indicator (orange underline)
- **Mobile Navigation**: Hamburger menu that slides out from the right
- **User Menu**: Avatar dropdown with profile, billing, and logout options
- **Responsive Design**: Mobile-first with breakpoints at md (768px)

### Usage

```tsx
import { AppLayout } from "@/components/layout/AppLayout";

export default function DashboardPage() {
  return (
    <AppLayout>
      <h1>Dashboard Content</h1>
    </AppLayout>
  );
}
```

### Key Patterns

- **Active Navigation**: Uses `usePathname()` to detect active route and apply orange underline
- **Mobile Menu**: Slides in from right with backdrop overlay, closes on route change
- **User Menu**: Closes on outside click using `useEffect` + event listener
- **Mock User Data**: Currently uses hardcoded user object - will be replaced with InsForge auth
- **Client Component**: Marked `"use client"` for interactive features (dropdowns, mobile menu)

### Auth Guards (To Be Implemented)

Future iterations should add:
- Auth guard: redirect unauthenticated users to `/login`
- Subscription guard: redirect users without active subscription to `/checkout`
- Real user data from InsForge auth context

### Styling

- Warm cream background (#FFF8F5)
- Orange (#E65100) for active states and branding
- Smooth transitions and animations for dropdown/slide-out menus
- Sticky nav with backdrop blur for modern glass effect
- Consistent spacing using Tailwind custom scale (xs/sm/md/lg)
