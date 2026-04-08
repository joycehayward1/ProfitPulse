# ProfitPulse Payments Implementation Plan

## Overview

ProfitPulse is a financial dashboard SaaS with a single subscription plan and a 7-day free trial. Payments are processed through Authorize.net using Accept.js (frontend tokenization), Customer Profiles (card vault), and ARB (Automated Recurring Billing) for ongoing charges.

**Stack:** Next.js 14, TypeScript, Tailwind CSS, InsForge (BaaS)

---

## Subscription Plan

| | Free Trial | Pro (Monthly) | Pro (Annual) |
|---|---|---|---|
| **Price** | $0 for 7 days | $59.99/mo | $49.99/mo ($599.88/yr) |
| **Card required** | No | Yes | Yes |
| **Features** | Limited (see Trial Gating below) | Full access | Full access |

### Pro Features (Full Access)
- Financial health score with full breakdown
- Dashboard with all metrics and graphs
- All 4 scenario calculators (break-even, hiring, goal planning, runway)
- Manual data entry + spreadsheet/CSV upload
- Weekly scorecard emails
- Email support

### Trial Gating (Limited Access)
During the 7-day free trial, users see a limited version of the app:

| Feature | Trial | Pro |
|---------|-------|-----|
| Health score | Number only (no breakdown) | Full with breakdown |
| Dashboard metrics | 2-3 visible, rest blurred/locked | All visible |
| Graphs/charts | Placeholder with "Upgrade to see trends" | Full access |
| Scenario calculators | Break-even only | All 4 |
| Data entry | Manual only | Manual + spreadsheet upload |
| QuickBooks | Locked | Available |
| Weekly emails | None | Active |

Locked features are **visible but blurred** with a lock icon and "Upgrade to Pro" CTA. This builds desire rather than hiding what the product can do.

---

## User Lifecycle

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
                    │   Monthly ($59.99/mo) or         │
                    │   Annual ($49.99/mo @ $599.88)   │
                    └────────────────┬────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              Auto-Renew      Switch Plan         Cancel
              (recurring)     (monthly↔annual)    (end of period)
```

---

## Authorize.net Credentials & Environment
### Environment Variables

```env
# Frontend (safe to expose)
NEXT_PUBLIC_ANET_API_LOGIN_ID=your_api_login_id
NEXT_PUBLIC_ANET_CLIENT_KEY=your_public_client_key
NEXT_PUBLIC_ANET_ENVIRONMENT=SANDBOX  # or PRODUCTION

# Server-side only (never expose)
ANET_API_LOGIN_ID=your_api_login_id
ANET_TRANSACTION_KEY=your_transaction_key
```

### API Endpoints

| Environment | Accept.js Script | API Endpoint |
|---|---|---|
| Sandbox | `https://jstest.authorize.net/v1/Accept.js` | `https://apitest.authorize.net/xml/v1/request.api` |
| Production | `https://js.authorize.net/v1/Accept.js` | `https://api.authorize.net/xml/v1/request.api` |

---

## InsForge Data Model

### User Subscription Fields

Add these fields to the existing user record in InsForge:

```typescript
interface UserSubscription {
  // Plan info
  plan: 'pro_monthly' | 'pro_annual' | 'trial' | 'expired';
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired';

  // Trial tracking
  trialEndsAt: string | null;           // ISO date string, 7 days after signup

  // Authorize.net references
  anetCustomerProfileId: string | null;
  anetPaymentProfileId: string | null;
  anetSubscriptionId: string | null;

  // Billing cycle tracking
  billingCycleStartDate: string | null;
  nextBillingDate: string | null;
  currentPeriodEnd: string | null;       // access valid until this date
  cancelAtPeriodEnd: boolean;            // if true, don't renew

  // History
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  lastPaymentStatus: 'success' | 'failed' | null;
}
```

### Payment History Collection

Create a separate collection/table in InsForge for transaction records:

```typescript
interface PaymentRecord {
  id: string;
  userId: string;
  anetTransactionId: string;
  type: 'initial' | 'recurring' | 'plan_switch' | 'refund';
  amount: number;
  status: 'success' | 'failed' | 'voided' | 'refunded';
  plan: 'pro_monthly' | 'pro_annual';
  description: string;
  createdAt: string;  // ISO date string
}
```

---

## Core Flows

### Flow 1: User Signup (Trial)

**Trigger:** User clicks "Start Your Free Trial" on landing page or pricing section.

**Steps:**
1. User creates account (email + password) — no card required
2. InsForge user record is created with:
   ```
   plan: 'trial'
   subscriptionStatus: 'trial'
   trialEndsAt: today + 7 days
   ```
3. User is redirected to dashboard with limited/gated experience
4. Trial countdown banner shows "X days left — Upgrade to Pro"

---

### Flow 2: Subscribe (Trial → Pro or Expired → Pro)

**Trigger:** User clicks "Upgrade to Pro" during trial, or "Subscribe Now" after trial expires.

**Frontend (React component):**
1. Show plan toggle (monthly $59.99 / annual $49.99/mo)
2. Display payment form using `react-acceptjs` with `useAcceptJs()` hook
3. User enters card details — card data never touches our server
4. Accept.js sends card data directly to Authorize.net, receives a nonce (`dataDescriptor` + `dataValue`)
5. Nonce is valid for 15 minutes
6. Send nonce + selected plan to our API route

**Backend (API route: `POST /api/payments/subscribe`):**

Step 1 — Charge the first period in real time:
```
API Method: createTransactionRequest
Transaction Type: authCaptureTransaction
Amount: 59.99 (monthly) or 599.88 (annual)
Payment: Use the nonce (opaqueData: dataDescriptor + dataValue)
```
- If charge fails → return error to frontend, do not proceed
- If charge succeeds → continue to step 2

Step 2 — Create a Customer Profile from the transaction:
```
API Method: createCustomerProfileFromTransactionRequest
Transaction ID: from step 1 response
```
- Creates a reusable Customer Profile + Payment Profile from the card used
- Store the returned `customerProfileId` and `customerPaymentProfileId` in InsForge

Step 3 — Create ARB subscription for ongoing billing:
```
API Method: ARBCreateSubscriptionRequest
Interval: { length: 1, unit: months } (monthly) or { length: 12, unit: months } (annual)
Start Date: 30 days from today (monthly) or 1 year from today (annual)
Amount: 59.99 (monthly) or 599.88 (annual)
Payment: Use the Customer Profile payment info (NOT the nonce — it's already been used)
```
- Store the returned `subscriptionId` in InsForge

Step 4 — Update InsForge user record:
```
plan: 'pro_monthly' or 'pro_annual'
subscriptionStatus: 'active'
anetCustomerProfileId: from step 2
anetPaymentProfileId: from step 2
anetSubscriptionId: from step 3
billingCycleStartDate: today
nextBillingDate: today + 30 days (monthly) or today + 1 year (annual)
currentPeriodEnd: today + 30 days (monthly) or today + 1 year (annual)
cancelAtPeriodEnd: false
lastPaymentDate: today
lastPaymentAmount: 59.99 or 599.88
lastPaymentStatus: 'success'
```

Step 5 — Create payment record in InsForge:
```
type: 'initial'
amount: 59.99 or 599.88
status: 'success'
anetTransactionId: from step 1
```

Step 6 — Return success to frontend, unlock full Pro access immediately.

---

### Flow 3: Switch Plan (Monthly ↔ Annual)

**Trigger:** User clicks "Switch to Annual" or "Switch to Monthly" in billing settings.

**Backend (API route: `POST /api/payments/switch-plan`):**

#### Monthly → Annual
Step 1 — Cancel existing monthly ARB subscription:
```
API Method: ARBCancelSubscriptionRequest
Subscription ID: from InsForge user record
```

Step 2 — Charge annual amount against Customer Profile:
```
API Method: createTransactionRequest
Transaction Type: authCaptureTransaction
Amount: 599.88
Payment: Use customerProfileId + customerPaymentProfileId from InsForge
```

Step 3 — Create new annual ARB subscription:
```
API Method: ARBCreateSubscriptionRequest
Interval: { length: 12, unit: months }
Start Date: 1 year from today
Amount: 599.88
Payment: Use Customer Profile
```

Step 4 — Update InsForge:
```
plan: 'pro_annual'
anetSubscriptionId: new subscription ID
billingCycleStartDate: today
nextBillingDate: today + 1 year
currentPeriodEnd: today + 1 year
```

#### Annual → Monthly
- No immediate charge or refund
- Set flag: `switchToMonthlyAtRenewal: true`
- At end of annual period, create new monthly ARB subscription instead of renewing annual
- User keeps annual access until period ends

---

### Flow 4: Cancellation

**Trigger:** User clicks cancel subscription button.

**Backend (API route: `POST /api/payments/cancel`):**

Step 1 — Cancel ARB subscription:
```
API Method: ARBCancelSubscriptionRequest
Subscription ID: from InsForge user record
```

Step 2 — Update InsForge:
```
subscriptionStatus: 'canceled'
cancelAtPeriodEnd: true
```
- Do NOT delete the Customer Profile — keep it in case they resubscribe
- User retains full Pro access until `currentPeriodEnd`

Step 3 — After `currentPeriodEnd`, access reverts to expired state. User sees resubscribe prompt.

---

### Flow 5: Failed Payment Handling

**Trigger:** ARB charge fails (runs at ~2 AM PST on billing date).

Authorize.net behavior:
- First failed payment → subscription status changes to **suspended**
- Merchant has until the next billing date to fix it
- If not fixed → subscription is **terminated**

**Webhook handler (API route: `POST /api/webhooks/authorize-net`):**

On receiving a failed payment webhook:
1. Identify the user by `subscriptionId`
2. Update InsForge: `subscriptionStatus: 'past_due'`, `lastPaymentStatus: 'failed'`
3. Send the user an email: "Your payment failed — please update your card"
4. Show an in-app banner: "Payment failed — update your billing info to continue using ProfitPulse"

**Card update flow:**
1. User clicks "Update Payment" → show Accept.js form again
2. Collect new card → get nonce
3. Create new Payment Profile or update existing one via `createCustomerPaymentProfileRequest`
4. Update the ARB subscription with the new payment profile via `ARBUpdateSubscriptionRequest`
5. Optionally run a real-time test charge to validate the new card
6. Update InsForge: `subscriptionStatus: 'active'`

---

### Flow 6: Resubscription (After Cancellation)

**Trigger:** Previously canceled user clicks "Resubscribe."

This follows the same flow as Flow 2 (Subscribe), except:
- If their Customer Profile still exists in Authorize.net, you can skip creating a new one
- Show the Accept.js form to confirm/update their card
- Run a real-time charge for the first period
- Create a new ARB subscription

---

## File Structure

```
/app
  /api
    /payments
      /subscribe
        route.ts          ← Flow 2: new subscription (trial→pro or expired→pro)
      /switch-plan
        route.ts          ← Flow 3: monthly↔annual switch
      /cancel
        route.ts          ← Flow 4: cancel subscription
      /update-card
        route.ts          ← update payment method
    /webhooks
      /authorize-net
        route.ts          ← Flow 5: webhook handler for failed payments, etc.

  /(app)                   ← your app routes (behind auth)
    /upgrade
      page.tsx             ← upgrade page with plan toggle + payment form
    /settings
      page.tsx             ← billing tab: current plan, payment history, cancel, update card

/components
  PaymentForm.tsx          ← Accept.js card form (uses react-acceptjs + Tailwind)
  SubscriptionGate.tsx     ← wraps features, shows blurred/locked state for trial/expired
  UpgradeBanner.tsx        ← trial countdown banner
  BillingStatus.tsx        ← current plan, next billing date, status alerts

/lib
  authorize-net.ts         ← server-side helper functions for all Authorize.net API calls
  billing-utils.ts         ← date calculations, period tracking
```

---

## Frontend Components

### `<SubscriptionGate>` wrapper component
Wraps any feature that requires Pro access.
- Checks subscription status from AuthContext
- If `trial` with limited feature → render blurred/locked version with upgrade CTA
- If `active` → render children normally
- If `expired` or `past_due` → render paywall

### `<UpgradeBanner>` component
Shows during trial at top of dashboard:
"You have X days left in your trial. Upgrade to Pro →"

### `<PaymentForm>` component
Uses Accept.js to collect card info securely:
- Card number, expiry, CVV
- Plan toggle (monthly $59.99 / annual $49.99/mo)
- Submits token to our API, NOT raw card data
- Shows on: /upgrade page + settings billing tab

### Auth Context Changes

Extend existing AuthContext with subscription data:
```typescript
user: {
  ...existingFields,
  subscription: {
    status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired',
    plan: 'pro_monthly' | 'pro_annual' | 'trial' | null,
    trialEndsAt: Date | null,
    currentPeriodEnd: Date | null,
    cancelAtPeriodEnd: boolean,
    daysLeft: number  // computed — trial days or billing period days
  }
}
```

---

## Authorize.net API Methods Reference

| Method | Used In | Purpose |
|---|---|---|
| `createTransactionRequest` (authCaptureTransaction) | Flow 2, Flow 3 | Charge a card in real time |
| `createCustomerProfileFromTransactionRequest` | Flow 2 | Create reusable customer + payment profile from a completed transaction |
| `createCustomerPaymentProfileRequest` | Flow 5 (card update) | Add a new payment method to an existing customer profile |
| `ARBCreateSubscriptionRequest` | Flow 2, Flow 3 | Create a recurring subscription |
| `ARBUpdateSubscriptionRequest` | Flow 3, Flow 5 | Update subscription amount or payment info |
| `ARBCancelSubscriptionRequest` | Flow 3, Flow 4 | Cancel a subscription |
| `ARBGetSubscriptionRequest` | Status checks | Get current subscription details |

---

## Authorize.net API Documentation Links

- Payment Transactions: https://developer.authorize.net/api/reference/features/payment-transactions.html
- Payment Transactions API Reference: https://developer.authorize.net/api/reference/index.html#payment-transactions
- Customer Profiles: https://developer.authorize.net/api/reference/features/customer-profiles.html
- Customer Profiles API Reference: https://developer.authorize.net/api/reference/index.html#customer-profiles
- Recurring Billing (ARB): https://developer.authorize.net/api/reference/features/recurring-billing.html
- Recurring Billing API Reference: https://developer.authorize.net/api/reference/index.html#recurring-billing
- Accept.js: https://developer.authorize.net/api/reference/features/acceptjs.html
- Webhooks: https://developer.authorize.net/api/reference/features/webhooks.html
- Testing Guide: https://developer.authorize.net/hello_world/testing_guide.html
- Response/Error Codes: https://developer.authorize.net/api/reference/responseCodes.html

---

## Sandbox Testing

### Test Card Numbers
- Visa: `4111111111111111`
- Mastercard: `5424000000000015`
- Amex: `370000000000002`
- Use any future expiration date
- Use any 3-digit CVV (4-digit for Amex)

### Test Scenarios to Validate
- [ ] Sign up → 7-day trial starts, limited features visible
- [ ] Trial gating: blurred metrics, locked scenarios, no spreadsheet upload
- [ ] Trial expiry: paywall shown after 7 days
- [ ] Upgrade during trial → monthly ($59.99)
- [ ] Upgrade during trial → annual ($599.88)
- [ ] Upgrade after trial expired → monthly
- [ ] Upgrade after trial expired → annual
- [ ] Declined card on upgrade
- [ ] Switch monthly → annual
- [ ] Switch annual → monthly (queued for renewal)
- [ ] Cancel subscription (verify Pro access through end of period)
- [ ] Resubscribe after cancellation
- [ ] Update payment method
- [ ] Failed recurring payment webhook handling
- [ ] Expired card webhook handling
- [ ] Trial countdown banner accuracy

---

## Build Phases

### Phase A: Trial System (no Authorize.net credentials needed)
1. Add subscription fields to InsForge user schema
2. Auto-create trial subscription on user signup (`trialEndsAt: today + 7 days`)
3. Extend AuthContext with subscription data
4. Build `useSubscription()` hook
5. Build `<SubscriptionGate>` component
6. Gate dashboard features (blur/lock non-trial features)
7. Build `<UpgradeBanner>` with trial countdown
8. Build expired trial paywall screen

**Result:** Users can sign up, see trial experience, hit the paywall. No money flows yet.

### Phase B: Authorize.net Payment (needs sandbox credentials)
9. Set up Authorize.net sandbox account
10. Add Accept.js script to upgrade page
11. Build `<PaymentForm>` component with plan toggle
12. Build `lib/authorize-net.ts` helper with functions for each API method
13. Build `POST /api/payments/subscribe` (Flow 2)
14. Build webhook handler for payment confirmations
15. On payment success → flip subscription to `active`, unlock Pro
16. Test full flow: signup → trial → pay → full access

**Result:** Users can pay and get full access. Core flow works.

### Phase C: Subscription Management
17. Build `POST /api/payments/cancel` (Flow 4)
18. Build `POST /api/payments/switch-plan` (Flow 3)
19. Build `POST /api/payments/update-card`
20. Update billing settings tab with real subscription data
21. Handle failed payment notifications (past_due status)
22. Build payment history display in settings
23. Add dunning emails (payment failed, please update card)

**Result:** Full subscription lifecycle handled.

### Phase D: Testing & Go-Live
24. Run through all sandbox test scenarios
25. Swap to production Authorize.net credentials
26. Swap API endpoints from sandbox to production
27. Swap Accept.js script from jstest to js
28. Verify first live transaction

---

## Credentials Needed from Joyce

- **Authorize.net API Login ID** (sandbox first, then production)
- **Authorize.net Transaction Key** (sandbox first, then production)
- **Authorize.net Client Key** (for Accept.js frontend tokenization)
- Webhook/Silent Post URL to be configured in Authorize.net dashboard (we provide the URL)

Phase A can be built entirely without credentials. Phase B requires sandbox credentials.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Card required at signup? | No | Reduces friction — collect at upgrade |
| Trial length | 7 days | Enough to explore, short enough to convert |
| Proration on monthly→annual switch? | No — charge full annual, cancel monthly | Simpler, user gets immediate value |
| Grace period after failed payment | 3 days with dunning email | Gives time to fix card without losing access |
| Refund policy | No refunds, cancel stops renewal | User keeps access through paid period |
| Can cancelled users resubscribe? | Yes, same flow as new subscription | Retain Customer Profile for easier re-entry |
