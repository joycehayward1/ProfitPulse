# ProfitPulse Payments Implementation Plan

## Overview

ProfitPulse is a financial dashboard SaaS with a single Pro tier and two billing options (monthly/annual). New users get a 7-day free trial with limited features — no credit card required. Payments are processed through Authorize.net using Accept.js (frontend tokenization), Customer Profiles (card vault), and ARB (Automated Recurring Billing).

**Stack:** Next.js 14, TypeScript, Tailwind CSS, InsForge (BaaS)

---

## Pricing & Tier Structure

### Single Tier: Pro

| Billing Option | Price | Billed |
|---|---|---|
| Monthly | $59.99/mo | Monthly |
| Annual | $49.99/mo | $599.88/yr upfront |

### Free Trial (7 Days, No Card Required)

Limited features during trial:
- Basic financial health score
- 2-3 dashboard metrics visible (rest blurred/locked)
- Manual data entry only (no CSV/spreadsheet upload)
- 1 scenario calculator

### Full Pro Access (After Subscription)

- All metrics and graphs unlocked
- All 4 scenario calculators
- Spreadsheet/CSV upload
- Weekly scorecard emails
- AI insights in plain English
- Proactive alerts
- Priority email support

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

### User Record Fields

Add these fields to the existing user record in InsForge:

```typescript
interface UserSubscription {
  // Plan info
  plan: 'pro' | 'none';
  billingInterval: 'monthly' | 'annual' | null;
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'canceled' | 'terminated' | 'expired';

  // Trial tracking
  trialStartDate: string | null;        // ISO date
  trialEndDate: string | null;          // ISO date (trialStartDate + 7 days)

  // Authorize.net references
  anetCustomerProfileId: string | null;
  anetPaymentProfileId: string | null;
  anetSubscriptionId: string | null;

  // Billing cycle tracking
  billingCycleStartDate: string | null;  // ISO date — when current paid period began
  currentPeriodEnd: string | null;       // ISO date — access valid until this date
  nextBillingDate: string | null;        // ISO date — when ARB will next charge

  // Plan switch tracking
  pendingSwitchTo: 'monthly' | 'annual' | null;  // if user is switching at next renewal
  pendingSwitchSubId: string | null;              // ARB sub ID for the upcoming plan (created in advance)

  // Payment history
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  lastPaymentStatus: 'success' | 'failed' | null;
}
```

### Payment History Collection

Separate collection/table in InsForge:

```typescript
interface PaymentRecord {
  id: string;
  userId: string;
  anetTransactionId: string;
  type: 'subscription' | 'plan_switch' | 'renewal' | 'refund';
  amount: number;
  status: 'success' | 'failed' | 'voided' | 'refunded';
  billingInterval: 'monthly' | 'annual';
  description: string;
  createdAt: string;
}
```

---

## Core Flows

### Flow 1: User Sign Up (Free Trial)

**Trigger:** New user visits ProfitPulse and signs up.

**No credit card required.** User gets 7 days of limited access.

**Backend (API route: `POST /api/auth/signup`):**

Step 1 — Create user account (standard auth flow).

Step 2 — Set trial fields in InsForge:
```
plan: 'none'
subscriptionStatus: 'trial'
trialStartDate: today
trialEndDate: today + 7 days
```

Step 3 — Return success, redirect to dashboard with limited features.

**During trial:**
- App shows countdown banner: "X days left in your trial"
- Blurred/locked features show "Upgrade to Pro" prompts
- No Authorize.net interaction at all during trial

**Trial expiration:**
- When `trialEndDate` has passed, app checks on each page load
- If expired: show paywall screen, lock app entirely
- Only option is to subscribe (→ Flow 2)

---

### Flow 2: Subscribe (From Trial or Paywall)

**Trigger:** User clicks "Upgrade to Pro" during trial, or sees paywall after trial expires.

**Frontend:**
1. Show plan selection: Monthly ($59.99/mo) or Annual ($49.99/mo billed $599.88/yr)
2. Show payment form using `react-acceptjs` with `useAcceptJs()` hook
3. User enters card — data never touches our server
4. Accept.js sends card data to Authorize.net, returns a nonce (`dataDescriptor` + `dataValue`)
5. Nonce is valid for 15 minutes
6. Send nonce + selected billing interval to API route

**Backend (API route: `POST /api/payments/subscribe`):**

Step 1 — Charge first period in real time:
```
API Method: createTransactionRequest
Transaction Type: authCaptureTransaction
Amount: $59.99 (monthly) or $599.88 (annual)
Payment: opaqueData (nonce from Accept.js)
```
- If charge fails → return error to frontend, user retries
- If charge succeeds → continue

Step 2 — Create Customer Profile from the transaction:
```
API Method: createCustomerProfileFromTransactionRequest
Transaction ID: from step 1 response
```
- Stores card securely on Authorize.net servers
- Returns `customerProfileId` + `customerPaymentProfileId`

Step 3 — Create ARB subscription for ongoing billing:
```
API Method: ARBCreateSubscriptionRequest

Monthly:
  interval: { length: 1, unit: months }
  startDate: today + 30 days
  amount: 59.99

Annual:
  interval: { length: 12, unit: months }
  startDate: today + 365 days
  amount: 599.88
```
- First period was already charged in step 1
- ARB handles month 2+ (or year 2+)

Step 4 — Update InsForge:
```
plan: 'pro'
billingInterval: 'monthly' or 'annual'
subscriptionStatus: 'active'
anetCustomerProfileId: from step 2
anetPaymentProfileId: from step 2
anetSubscriptionId: from step 3
billingCycleStartDate: today
currentPeriodEnd: today + 30 days (monthly) or today + 365 days (annual)
nextBillingDate: same as currentPeriodEnd
lastPaymentDate: today
lastPaymentAmount: 59.99 or 599.88
lastPaymentStatus: 'success'
```

Step 5 — Create payment record:
```
type: 'subscription'
amount: 59.99 or 599.88
status: 'success'
```

Step 6 — Return success, unlock full Pro access.

---

### Flow 3: Auto-Renew (ARB Handles This)

**Trigger:** ARB runs at ~2 AM PST on the scheduled billing date.

This is fully automatic. No code runs on your side to trigger the charge.

**If payment succeeds:**
- Subscription continues
- Authorize.net sends webhook notification
- Your webhook handler updates InsForge:
  ```
  lastPaymentDate: today
  lastPaymentAmount: 59.99 or 599.88
  lastPaymentStatus: 'success'
  billingCycleStartDate: today
  currentPeriodEnd: today + 30 days (monthly) or today + 365 days (annual)
  nextBillingDate: same as new currentPeriodEnd
  ```

**If payment fails:**
- ARB automatically changes subscription status to suspended
- Authorize.net sends webhook notification

**Your webhook handler (API route: `POST /api/webhooks/authorize-net`):**

1. Identify user by `subscriptionId`
2. Update InsForge:
   ```
   subscriptionStatus: 'past_due'
   lastPaymentStatus: 'failed'
   ```
3. Send dunning email: "Your payment failed — update your card to keep your Pro access"
4. Show in-app banner: "Payment failed — update your billing info"
5. Start 3-day grace period (user keeps Pro access during this window)

**After 3-day grace period:**
- If card not updated → ARB terminates the subscription
- Update InsForge: `subscriptionStatus: 'terminated'`
- Revoke Pro access, show paywall with resubscribe option

NOTE: The 3-day grace period is enforced on your side. Your app checks: if `subscriptionStatus === 'past_due'` and `lastPaymentDate` was more than 3 days ago, treat as terminated. Authorize.net's own suspension/termination cycle runs on its own schedule (next billing date), but you can enforce a tighter window.

---

### Flow 4: Switch Plan — Monthly → Annual

**Trigger:** User clicks "Switch to Annual" (save money).

**Backend (API route: `POST /api/payments/switch-plan`):**

Step 1 — Cancel current monthly ARB:
```
API Method: ARBCancelSubscriptionRequest
Subscription ID: current anetSubscriptionId
```

Step 2 — Charge annual amount immediately via Customer Profile:
```
API Method: createTransactionRequest
Transaction Type: authCaptureTransaction
Amount: 599.88
Payment: customerProfileId + customerPaymentProfileId
```
- If charge fails → re-create monthly ARB (rollback), return error
- If charge succeeds → continue

Step 3 — Create new annual ARB:
```
API Method: ARBCreateSubscriptionRequest
interval: { length: 12, unit: months }
startDate: today + 365 days
amount: 599.88
Payment: customerProfileId + customerPaymentProfileId
```

Step 4 — Update InsForge:
```
billingInterval: 'annual'
anetSubscriptionId: new annual sub ID
billingCycleStartDate: today
currentPeriodEnd: today + 365 days
nextBillingDate: today + 365 days
lastPaymentAmount: 599.88
lastPaymentDate: today
```

Step 5 — Create payment record:
```
type: 'plan_switch'
amount: 599.88
description: 'Switched from monthly to annual'
```

Step 6 — Return success. User continues with Pro access, now billed annually.

---

### Flow 5: Switch Plan — Annual → Monthly

**Trigger:** User clicks "Switch to Monthly."

This is different from monthly → annual because the user has already paid for the full year. No refund, no immediate charge. The switch happens at the end of the current annual period.

**Backend (API route: `POST /api/payments/switch-plan`):**

Step 1 — Cancel current annual ARB:
```
API Method: ARBCancelSubscriptionRequest
Subscription ID: current anetSubscriptionId
```

Step 2 — Create new monthly ARB with a future start date:
```
API Method: ARBCreateSubscriptionRequest
interval: { length: 1, unit: months }
startDate: user's currentPeriodEnd (when annual period expires)
amount: 59.99
Payment: customerProfileId + customerPaymentProfileId
```
- This ARB sits dormant until the annual period ends, then starts charging monthly

Step 3 — Update InsForge:
```
billingInterval: 'annual' (still annual until period ends)
pendingSwitchTo: 'monthly'
pendingSwitchSubId: new monthly sub ID
anetSubscriptionId: new monthly sub ID
```
- NOTE: The old annual sub is canceled. The new monthly sub is created but won't charge until currentPeriodEnd.

Step 4 — Return success. User keeps annual access until period ends.

**When the annual period expires:**
- The monthly ARB kicks in automatically on `currentPeriodEnd`
- Your webhook handler for the first monthly charge updates InsForge:
  ```
  billingInterval: 'monthly'
  pendingSwitchTo: null
  pendingSwitchSubId: null
  billingCycleStartDate: today
  currentPeriodEnd: today + 30 days
  ```

---

### Flow 6: Cancel Subscription

**Trigger:** User clicks "Cancel Subscription."

**Backend (API route: `POST /api/payments/cancel`):**

Step 1 — Show confirmation: "Are you sure? You'll keep Pro access until [currentPeriodEnd]."

Step 2 — Cancel ARB subscription:
```
API Method: ARBCancelSubscriptionRequest
Subscription ID: anetSubscriptionId
```

Step 3 — Update InsForge:
```
subscriptionStatus: 'canceled'
anetSubscriptionId: null
```
- Do NOT delete the Customer Profile — keep it for resubscription

Step 4 — User retains Pro access until `currentPeriodEnd`.

**After `currentPeriodEnd`:**
- App checks subscription status + date on page load
- If `canceled` and `currentPeriodEnd` has passed:
  - Update `subscriptionStatus: 'expired'`
  - Revoke Pro access
  - Show paywall with resubscribe option

---

### Flow 7: Resubscribe (After Cancellation)

**Trigger:** Previously canceled/expired user clicks "Resubscribe."

Same flow as Flow 2 (Subscribe), except:
- If their Customer Profile still exists on Authorize.net, you can reuse it
- Show Accept.js form to confirm or update their card
- Charge first period in real time
- Create new ARB subscription
- Update InsForge back to active

If reusing existing Customer Profile:
- Skip `createCustomerProfileFromTransactionRequest`
- Charge via `createTransactionRequest` using stored `customerProfileId` + `customerPaymentProfileId`
- Create ARB with same profile IDs

If card is expired or user wants a new card:
- Collect new card via Accept.js
- Create new payment profile under existing customer profile via `createCustomerPaymentProfileRequest`
- Charge and create ARB with updated profile

---

### Flow 8: Update Payment Method

**Trigger:** User clicks "Update Card" in billing settings, or prompted after failed payment.

**Frontend:**
1. Show Accept.js payment form
2. User enters new card details
3. Accept.js tokenizes, returns nonce

**Backend (API route: `POST /api/payments/update-card`):**

Step 1 — Create new payment profile (or update existing):
```
API Method: createCustomerPaymentProfileRequest
customerProfileId: from InsForge
payment: opaqueData (nonce)
```
- Returns new `customerPaymentProfileId`

Step 2 — Update ARB subscription with new payment profile:
```
API Method: ARBUpdateSubscriptionRequest
subscriptionId: from InsForge
payment: new customerPaymentProfileId
```

Step 3 — Optionally run a $0 or $0.01 test auth to validate the card:
```
API Method: createTransactionRequest
Transaction Type: authOnlyTransaction
Amount: 0.00 (Visa) or 0.01 (other cards, then void immediately)
```

Step 4 — Update InsForge:
```
anetPaymentProfileId: new profile ID
subscriptionStatus: 'active' (if was 'past_due')
```

Step 5 — Return success. "Card updated successfully."

---

## File Structure

```
/app
  /api
    /auth
      /signup
        route.ts              ← Flow 1: user signup + trial creation
    /payments
      /subscribe
        route.ts              ← Flow 2: first payment + ARB creation
      /switch-plan
        route.ts              ← Flow 4 & 5: monthly ↔ annual switching
      /cancel
        route.ts              ← Flow 6: cancel subscription
      /update-card
        route.ts              ← Flow 8: update payment method
    /webhooks
      /authorize-net
        route.ts              ← Flow 3: webhook handler for renewals + failures

  /(app)
    /billing
      page.tsx                ← Billing management (current plan, history, update card, cancel)
    /pricing
      page.tsx                ← Plan selection + payment form (trial upgrade or paywall)

/components
  PaymentForm.tsx             ← Accept.js card form (react-acceptjs + Tailwind)
  PricingCards.tsx             ← Monthly vs Annual plan cards
  TrialBanner.tsx             ← "X days left" countdown banner
  PaywallScreen.tsx           ← Locked screen after trial expires
  BillingStatus.tsx           ← Current plan, next billing date, status alerts
  DunningBanner.tsx           ← "Payment failed — update your card" in-app banner

/lib
  authorize-net.ts            ← Server-side helpers for all Authorize.net API calls
  billing-utils.ts            ← Date calculations (trial expiry, period end, etc.)
  feature-gate.ts             ← Checks plan + status to gate features
```

---

## Authorize.net API Methods Reference

| Method | Used In | Purpose |
|---|---|---|
| `createTransactionRequest` (authCaptureTransaction) | Flow 2, Flow 4 | Charge a card in real time (first payment or plan switch) |
| `createTransactionRequest` (authOnlyTransaction) | Flow 8 | Validate a new card with $0 auth |
| `createTransactionRequest` (voidTransaction) | Flow 8 | Void the validation auth if needed |
| `createCustomerProfileFromTransactionRequest` | Flow 2 | Create customer + payment profile from first transaction |
| `createCustomerPaymentProfileRequest` | Flow 7, Flow 8 | Add new card to existing customer profile |
| `ARBCreateSubscriptionRequest` | Flow 2, Flow 4, Flow 5 | Create monthly or annual recurring subscription |
| `ARBUpdateSubscriptionRequest` | Flow 8 | Update subscription payment info |
| `ARBCancelSubscriptionRequest` | Flow 4, Flow 5, Flow 6 | Cancel a subscription |
| `ARBGetSubscriptionRequest` | Status checks | Get current subscription details |

---

## Feature Gating Logic

The app needs to check what the user can access on every page load:

```typescript
// lib/feature-gate.ts

function getUserAccessLevel(user: UserSubscription): 'full' | 'trial' | 'locked' {
  const now = new Date();

  // Active paid subscriber
  if (
    user.subscriptionStatus === 'active' &&
    user.plan === 'pro' &&
    new Date(user.currentPeriodEnd) > now
  ) {
    return 'full';
  }

  // Canceled but still in paid period
  if (
    user.subscriptionStatus === 'canceled' &&
    user.currentPeriodEnd &&
    new Date(user.currentPeriodEnd) > now
  ) {
    return 'full';
  }

  // Past due but within 3-day grace period
  if (
    user.subscriptionStatus === 'past_due' &&
    user.lastPaymentDate &&
    daysSince(user.lastPaymentDate) <= 3
  ) {
    return 'full'; // grace period
  }

  // Active trial
  if (
    user.subscriptionStatus === 'trial' &&
    user.trialEndDate &&
    new Date(user.trialEndDate) > now
  ) {
    return 'trial';
  }

  // Everything else: expired, terminated, trial ended, etc.
  return 'locked';
}
```

**Trial features (limited):**
- Basic financial health score: visible
- Dashboard metrics: 2-3 visible, rest blurred with lock icon
- Calculators: 1 available, other 3 locked
- Data entry: manual only, CSV upload locked
- Weekly emails: not sent during trial

**Full Pro features:**
- All metrics and graphs
- All 4 scenario calculators
- CSV/spreadsheet upload
- Weekly scorecard emails
- AI insights
- Proactive alerts
- Priority email support

---

## Authorize.net Documentation Links

- Accept.js: https://developer.authorize.net/api/reference/features/acceptjs.html
- Payment Transactions: https://developer.authorize.net/api/reference/features/payment-transactions.html
- Payment Transactions API: https://developer.authorize.net/api/reference/index.html#payment-transactions
- Customer Profiles: https://developer.authorize.net/api/reference/features/customer-profiles.html
- Customer Profiles API: https://developer.authorize.net/api/reference/index.html#customer-profiles
- Recurring Billing (ARB): https://developer.authorize.net/api/reference/features/recurring-billing.html
- Recurring Billing API: https://developer.authorize.net/api/reference/index.html#recurring-billing
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
- [ ] User signup → trial starts, features limited
- [ ] Trial countdown banner shows correct days remaining
- [ ] Trial expires → paywall screen shown, app locked
- [ ] Subscribe monthly from trial → card charged $59.99, full access
- [ ] Subscribe annual from trial → card charged $599.88, full access
- [ ] Subscribe from paywall (after trial expired)
- [ ] Declined card on subscription attempt
- [ ] Auto-renew success (webhook updates InsForge)
- [ ] Auto-renew failure → past_due status → dunning email → in-app banner
- [ ] 3-day grace period enforced, then access revoked
- [ ] Switch monthly → annual ($599.88 charged, new ARB created)
- [ ] Switch annual → monthly (monthly ARB created with future start date)
- [ ] Cancel subscription → access until period end → paywall after
- [ ] Resubscribe after cancellation (reuse Customer Profile)
- [ ] Update payment method
- [ ] Update payment method after failed renewal (clears past_due)

---

## Build Phases

### Phase 1: Data Model
- Add subscription/trial fields to InsForge user schema
- Create payment history collection in InsForge

### Phase 2: Trial System
- Build signup flow that creates trial user
- Build `TrialBanner.tsx` countdown component
- Build `PaywallScreen.tsx` for expired trials
- Build `feature-gate.ts` utility for access checks
- Implement feature blurring/locking on dashboard

### Phase 3: Accept.js Frontend
- Install `react-acceptjs`
- Build `PaymentForm.tsx` with Tailwind styling
- Build `PricingCards.tsx` (monthly vs annual selection)
- Build pricing page: plan selection → payment form flow

### Phase 4: Core Subscription API
- Build `lib/authorize-net.ts` with helper functions for each API method
- Build `POST /api/payments/subscribe` (Flow 2)
- Test full signup → trial → subscribe flow in sandbox

### Phase 5: Auto-Renew & Webhooks
- Build `POST /api/webhooks/authorize-net` handler
- Handle successful renewal (update dates in InsForge)
- Handle failed renewal (set past_due, send dunning email)
- Build `DunningBanner.tsx` in-app alert
- Implement 3-day grace period logic

### Phase 6: Plan Switching
- Build `POST /api/payments/switch-plan` (Flow 4 & 5)
- Handle monthly → annual (cancel + charge + new ARB)
- Handle annual → monthly (cancel + create future-dated ARB)

### Phase 7: Cancel & Resubscribe
- Build `POST /api/payments/cancel` (Flow 6)
- Handle access retention through period end
- Handle resubscription with existing Customer Profile (Flow 7)

### Phase 8: Card Update & Billing UI
- Build `POST /api/payments/update-card` (Flow 8)
- Build `/billing` page (current plan, next billing date, payment history)
- Add upgrade/switch/cancel buttons
- Add update payment method form

### Phase 9: Testing & Go-Live
- Run through all sandbox test scenarios
- Swap environment variables to production
- Swap API endpoints: `apitest.authorize.net` → `api.authorize.net`
- Swap Accept.js script: `jstest.authorize.net` → `js.authorize.net`
- Set `NEXT_PUBLIC_ANET_ENVIRONMENT=PRODUCTION`
- Verify first live transaction
