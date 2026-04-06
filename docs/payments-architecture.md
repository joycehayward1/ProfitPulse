# ProfitPulse Payments & Subscription Architecture

## Overview

This document maps every piece of the subscription system — from sign-up to cancellation — so nothing gets missed during implementation.

---

## 1. User Lifecycle

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Sign Up   │────▶│  7-Day Trial    │────▶│  Trial Expired   │
│  (no card)  │     │  (limited app)  │     │  (paywall only)  │
└─────────────┘     └────────┬────────┘     └────────┬─────────┘
                             │                       │
                     "Upgrade" at any time    "Subscribe Now"
                             │                       │
                             ▼                       ▼
                    ┌─────────────────────────────────┐
                    │         Authorize.net            │
                    │    Payment Form (Accept.js)      │
                    └────────────────┬────────────────┘
                                     │
                              Payment success
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │         Pro Account              │
                    │   (Monthly $59.99 or Annual      │
                    │    $49.99/mo billed $599.88/yr)  │
                    └────────────────┬────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              Auto-Renew        Upgrade/          Cancel
              (recurring)       Downgrade         (end of period)
```

---

## 2. What We Need from Authorize.net

Authorize.net has a specific API called **ARB (Automated Recurring Billing)** for subscriptions. Here's what each action maps to:

| Action | Authorize.net API | What Happens |
|--------|-------------------|--------------|
| **First payment** | ARB Create Subscription | Creates recurring billing, charges first payment |
| **Auto-renew** | Automatic (ARB handles it) | Authorize.net charges card on schedule |
| **Cancel** | ARB Cancel Subscription | Stops future billing, access continues until period ends |
| **Switch monthly → annual** | ARB Cancel old + Create new | Cancel current sub, create new annual sub |
| **Switch annual → monthly** | Wait for period end, then create new | Don't refund — switch at renewal |
| **Update payment method** | ARB Update Subscription | Update card on file |
| **Failed payment** | Webhook / Silent Post | We get notified, retry logic kicks in |

### Authorize.net Integration Components

1. **Accept.js** (frontend) — Tokenizes credit card info in the browser. Card numbers never touch our server.
2. **ARB API** (backend) — Creates/manages subscriptions via API calls from our Next.js API routes.
3. **Webhooks / Silent Post** (backend) — Authorize.net notifies us of payment success, failure, subscription cancelled, etc.

---

## 3. Database Schema (InsForge)

### `subscriptions` table (new)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → users |
| `status` | text | `trial`, `active`, `past_due`, `cancelled`, `expired` |
| `plan` | text | `monthly`, `annual` |
| `trial_ends_at` | timestamp | 7 days after signup |
| `current_period_start` | timestamp | Start of current billing period |
| `current_period_end` | timestamp | End of current billing period |
| `authorize_subscription_id` | text | Authorize.net ARB subscription ID |
| `authorize_customer_profile_id` | text | For updating payment methods |
| `cancel_at_period_end` | boolean | If true, don't renew |
| `created_at` | timestamp | — |
| `updated_at` | timestamp | — |

### `payment_history` table (new)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → users |
| `amount` | decimal | Amount charged |
| `status` | text | `succeeded`, `failed`, `refunded` |
| `authorize_transaction_id` | text | Authorize.net transaction ID |
| `description` | text | "Monthly subscription", "Annual subscription" |
| `created_at` | timestamp | — |

---

## 4. API Routes Needed

```
src/app/api/
├── payments/
│   ├── create-subscription/    POST — Create ARB subscription after trial
│   │                                  (receives Accept.js token + plan choice)
│   │
│   ├── cancel-subscription/    POST — Cancel at end of period
│   │                                  (sets cancel_at_period_end = true,
│   │                                   calls ARB Cancel)
│   │
│   ├── update-payment-method/  POST — Update card on file
│   │                                  (receives new Accept.js token,
│   │                                   calls ARB Update)
│   │
│   ├── switch-plan/            POST — Monthly ↔ Annual switch
│   │                                  (cancel old ARB sub, create new one,
│   │                                   prorate if needed)
│   │
│   └── webhook/                POST — Authorize.net Silent Post URL
│                                      (payment success/failure notifications,
│                                       update subscription status in DB)
```

---

## 5. Frontend Components Needed

### A. `<SubscriptionGate>` wrapper component
```
Wraps any feature that requires Pro access.
- Checks subscription status from AuthContext
- If trial/active → render children normally
- If expired → render blurred/locked version with upgrade CTA
```

### B. `<UpgradeBanner>` component
```
Shows during trial:
"You have X days left in your trial. Upgrade to Pro →"
```

### C. `<PaymentForm>` component
```
Uses Accept.js to collect card info securely.
- Card number, expiry, CVV
- Plan toggle (monthly/annual)
- Submits token to our API, NOT raw card data
- Shows on: dedicated /upgrade page + settings billing tab
```

### D. `<BillingSettings>` (update existing settings page)
```
- Current plan display
- Next billing date
- Switch plan button
- Update payment method
- Cancel subscription
- Payment history table
```

### E. Trial-specific UI changes
```
Dashboard:     Show 2-3 metrics, blur the rest with lock overlay
Graphs:        Show placeholder with "Upgrade to see trends"
Scenarios:     Allow break-even only, lock other 3
Upload:        Manual entry only, spreadsheet upload locked
Weekly emails: Don't send during trial
```

---

## 6. Auth Context Changes

Current AuthContext needs to be extended with subscription data:

```
user: {
  ...existing fields,
  subscription: {
    status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired',
    plan: 'monthly' | 'annual' | null,
    trialEndsAt: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: boolean,
    daysLeft: number  // computed
  }
}
```

---

## 7. Implementation Order

### Phase A: Database + Subscription Logic (no payment yet)
1. Create `subscriptions` table in InsForge
2. Auto-create trial subscription on user signup
3. Extend AuthContext with subscription data
4. Build `useSubscription()` hook
5. Build `<SubscriptionGate>` component
6. Gate dashboard features (blur/lock non-trial features)
7. Add trial banner with countdown
8. Build expired trial paywall screen

**At this point:** Users can sign up, see trial experience, and hit the paywall. No money flows yet.

### Phase B: Authorize.net Integration
9. Set up Authorize.net sandbox account
10. Add Accept.js script to payment page
11. Build `<PaymentForm>` component
12. Build `POST /api/payments/create-subscription` (ARB Create)
13. Build webhook handler for payment confirmations
14. On payment success → flip subscription to `active`
15. Test full flow: signup → trial → pay → pro access

**At this point:** Users can pay and get access. Core flow works.

### Phase C: Subscription Management
16. Build `POST /api/payments/cancel-subscription`
17. Build `POST /api/payments/switch-plan`
18. Build `POST /api/payments/update-payment-method`
19. Update billing settings page with real data
20. Handle failed payment notifications (past_due status)
21. Build `payment_history` table and display in settings
22. Add dunning emails (payment failed, please update card)

**At this point:** Full subscription lifecycle is handled.

---

## 8. Authorize.net Credentials Needed from Joyce

- **API Login ID** (sandbox first, then production)
- **Transaction Key** (sandbox first, then production)
- **Webhook/Silent Post URL** to be configured in Authorize.net dashboard
- **Client Key** (for Accept.js frontend tokenization)

We can build and test everything in Phase A without credentials. Phase B requires sandbox credentials.

---

## 9. Key Decisions Still Needed

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Card required at signup? | Yes / No | No — reduces friction, collect at upgrade |
| Proration on plan switch? | Yes / No | Yes for monthly→annual (credit remaining days) |
| Grace period after failed payment? | 3 days / 7 days / none | 3 days with dunning email |
| Refund policy | Full / Prorated / None | No refunds, cancel stops renewal |
| Can cancelled users re-subscribe? | Yes / No | Yes, same flow as new subscription |
