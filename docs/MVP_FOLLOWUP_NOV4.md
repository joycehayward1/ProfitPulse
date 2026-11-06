# MVP follow-up (Nov 4): setup and activation notes

What the Nov 4 follow-up changes in the app, and what still has to be set up
outside the code (Vercel, Resend, InsForge, Go High Level) before each part
works in production. Nothing in this branch changes production settings,
schedules, GHL workflows or data. Values are never listed here, only names.

---

## 1. Tutorials link

A **Tutorials** item sits under **Glossary** in the Help section of the
sidebar and the mobile menu. It opens the community tutorials page in a new
tab and is styled like the Glossary item.

**Current address:**
`https://community.fusion4business.net/courses/products/cf34560e-fbf3-4779-878f-e747bf2ed247`
(built into the app as the default).

### Changing it without a redeploy

An admin (anyone in `ADMIN_EMAILS`) opens **Admin Panel, Settings tab, Tutorials
link**, types the new address and clicks **Save**. People see it the next time
they open or refresh the app. Each change is recorded in the Activity tab.

- **Empty address:** save the box empty to hide the link.
- **Invalid address:** only absolute `https://` (or `http://`) addresses are
  accepted, with no username or password in them. Anything else is refused when
  saving, and a stored value that isn't valid hides the link rather than
  pointing somewhere broken or unsafe.
- **Use the default:** removes the saved address, so the fallbacks below apply
  again.
- **Where it is stored:** the `app_settings` table (key `tutorials_url`). Anyone
  can read that one key, since it is a public link. Only the admin route
  `/api/admin/tutorials-url` can write it, and it checks `ADMIN_EMAILS` first.

### Which address the app uses

In this order:

1. The address saved in the Admin Panel (an empty one hides the link).
2. `NEXT_PUBLIC_TUTORIALS_URL`, if set. This is now **only a fallback** for when
   nothing has been saved. It is compiled into the app, so changing it needs a
   redeploy. It does not need to be set.
3. The built-in default above.

| Setting | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_TUTORIALS_URL` | Vercel env (optional) | Fallback only; an admin-saved address always wins. |

- **Until migration 009 is applied** (see below) the app can't read or store a
  saved address. It uses steps 2 and 3, and saving in the Admin Panel shows an
  error that names the migration.
- **The link appears after a moment on each fresh page load**, once the saved
  setting has been read, so a link an admin removed never flashes up first.

**Pending: migration `src/lib/migrations/009_app_settings.sql`** (not yet
applied to production). It creates the `app_settings` table. Apply it before
the Settings tab can save anything.

- **Login and redirects:** the community is a separate GHL site with its own
  login. Someone who isn't signed in there will likely see the community login
  page first. Whether they land back on the tutorials page afterwards depends
  on GHL, and some GHL sign-in flows drop the original page and go to the
  community home instead. Test with a member account that is signed out of
  the community. If it doesn't return them, change the address in the Admin
  Panel to the page that does work after login (or the community home), and
  mention the extra click in the welcome email.

## 2. New-user tour and example dashboard

Accounts with no numbers yet see a clearly labelled **example dashboard**
(made-up business "Example Studio Co.", every card tagged "Example") plus a
7-step guided tour, after the Pulse intro.

- The tour covers the dashboard and Health Score, the key metrics, the Data
  page, Scenarios (what-if), the Glossary and Tutorials, and finishes on the
  assessment.
- The example data lives only in the page code (`src/lib/sample-dashboard.ts`)
  and is never written to the account.
- "Skip for now", the close button or Escape pauses the tour. The example
  then shows **Resume tour** and **Hide example**.
- Finishing the tour (or hiding the example) removes the example for good.
  Real numbers replace it as soon as the account has an assessment.
- Progress is saved per user, in the browser right away and in the database
  when the table below exists. The Glossary has a "Take the product tour"
  link to replay it (`/dashboard?tour=restart`).
- The tour supports keyboard use and screen readers (focus moves with the
  tour, and Escape closes it). On phones the card docks to the bottom and
  points to the menu. It respects reduced-motion settings.

**Pending: migration `src/lib/migrations/008_onboarding_progress.sql`** (not
yet applied to production). Until it is applied, the tour still works but
progress is only kept in the browser, so it can show again on another device.

## 3. Weekly summary email

### Why Joyce wasn't receiving it

The code had several ways to fail without telling anyone. Which one hit
Joyce's account can only be confirmed with production access (Vercel cron
logs, env vars, her database rows). In order of likelihood:

1. **`CRON_SECRET` not set in Vercel.** Vercel only sends the
   `Authorization` header when it is set. Without it, every scheduled run
   is rejected with 401 and nothing is sent. The old check also accepted the
   literal header `Bearer undefined`, which is now rejected.
2. **Her account is filtered out.** The summary goes only to accounts that
   have a health assessment, haven't turned weekly emails off, aren't
   locked (an expired trial with no subscription is locked), and aren't
   project admins in InsForge. Her account was set up as a 7-day trial by
   `scripts/activate-joyce.mjs`, so it may have expired.
3. **Resend refused the email.** Resend v6 reports errors in its response
   instead of throwing, and the old code ignored them, so a refused email
   (for example from an unverified sending domain) looked like a success.
4. **Timeouts and rate limits.** Sends ran back to back with no time limit
   set, so a long list could hit Resend's rate limit or the function timeout
   partway through.
5. **Not a production deployment.** Vercel only runs crons on the production
   deployment, from the `vercel.json` on the deployed branch.

### What changed

- `src/app/api/cron/weekly-summary/route.ts` requires a real `CRON_SECRET`
  match outside local development, allows up to 300 seconds, and returns a
  report (counts, plus skip reasons by user id, with no emails or figures).
- `src/lib/weekly-summary.ts`:
  - Resend errors now count as failures, and a failed send can be retried.
  - Sends are spaced out to stay under Resend's rate limit.
  - Each account gets at most one email per week (recorded in `email_log`
    as `weekly_summary` for that week), so a re-run or retry won't send
    duplicates.
  - The Health Score in the email matches the one on the dashboard.
- **Dry run:** `?dryRun=1` lists who would get the email, and why anyone
  would be skipped, without sending. Add `&email=<address>` to check one
  account.

### Production activation (not done; needs someone with Vercel/Resend access)

- [ ] `CRON_SECRET` set in Vercel (Production), then redeploy.
- [ ] `RESEND_API_KEY` set (Production), and the sending domain
      `contact.myprofitpulse.app` verified in Resend (SPF/DKIM).
- [ ] `NEXT_PUBLIC_APP_URL` set to the production domain (links in the email).
- [ ] Migration `007_email_log.sql` applied (the weekly and trial emails
      depend on `email_log` to avoid sending twice).
- [ ] A production deployment that includes this change and `vercel.json`.
      The Vercel plan must allow 300-second functions, otherwise lower
      `maxDuration` in the route.
- [ ] Confirm the cron shows under Vercel → Settings → Cron Jobs.
- [ ] Check Joyce's account with a dry run (sends nothing):
      `GET https://<production-domain>/api/cron/weekly-summary?dryRun=1&email=<her address>`
      with header `Authorization: Bearer <CRON_SECRET>`. The response says
      `wouldSend` or the reason she's skipped (`no_assessment`, `no_access`,
      `opted_out`, `already_sent`).
- [ ] Only then, a single real send to her with the same URL without
      `dryRun=1`, or wait for Monday 09:00 UTC.

The schedule is Mondays at 09:00 UTC (`vercel.json`). This branch does not
turn it on and has not been checked against production.

## 4. Purchase webhook and lifecycle (Go High Level / Mastermind)

GHL here means Joyce's own GHL account behind Mastermind
(thehub.mastermind.com), not ABWAI.

### Environment variables (names only)

| Variable | Needed for |
|---|---|
| `GHL_SIGNUP_WEBHOOK_URL` | New sign-up → contact in GHL (drives the welcome and trial nurture) |
| `GHL_PURCHASE_WEBHOOK_URL` | First successful purchase → "MyProfitPulse Purchase" workflow |
| `GHL_TRIAL_UPDATE_WEBHOOK_URL` | Optional: real trial end date once the trial starts, or an admin extension |
| `GHL_CANCEL_WEBHOOK_URL` | Optional: subscription cancelled |
| `INSFORGE_API_KEY`, `NEXT_PUBLIC_INSFORGE_URL` | Looking up the contact's email/name for each event |
| `ANET_API_LOGIN_ID`, `ANET_TRANSACTION_KEY`, `ANET_SIGNATURE_KEY`, `NEXT_PUBLIC_ANET_API_LOGIN_ID`, `NEXT_PUBLIC_ANET_CLIENT_KEY`, `NEXT_PUBLIC_ANET_ENVIRONMENT` | Real purchases (the purchase event only fires after a real charge) |
| `RESEND_API_KEY`, `CRON_SECRET` | The app's own trial-ending / trial-ended emails (daily cron) |

Each GHL URL is the inbound-webhook URL from the trigger of the matching
GHL workflow. An unset URL just skips that event. A failing or slow
webhook never blocks sign-up or payment.

### Payloads the app sends

All are JSON `POST`s. Emails are lowercased.

- **Sign-up** (`GHL_SIGNUP_WEBHOOK_URL`): `email`, `name`, `first_name`,
  `last_name`, `source: "MyProfitPulse App Signup"`, and `trial_end_date`
  (ISO 8601). `trial_end_date` is an estimate (now + 7 days) and is left out
  for comped accounts.
- **Purchase** (`GHL_PURCHASE_WEBHOOK_URL`): `email`, `name`, `first_name`,
  `last_name`, `plan` (`pro_monthly` or `pro_annual`), `amount`,
  `currency: "USD"`, `purchase_date`, `subscription_id`, `transaction_id`,
  `source: "myprofitpulse-app"`.
- **Trial update** (`GHL_TRIAL_UPDATE_WEBHOOK_URL`): `email`, `first_name`,
  `last_name`, `trial_end_date`, `event: "trial_updated"`,
  `source: "myprofitpulse-app"`.
- **Cancel** (`GHL_CANCEL_WEBHOOK_URL`): `email`, `first_name`, `last_name`,
  `subscription_id`, `cancelled_at`, `reason` (`user_cancel`,
  `admin_cancel`, `authnet_cancel` or `authnet_terminated`),
  `event: "subscription_cancelled"`, `source: "myprofitpulse-app"`.

### When each transition happens

| Moment | What the app does | Who sends the email |
|---|---|---|
| Sign-up | Sign-up webhook, **once per account** (new in this branch). The signup page calls it right after the account is created, before email verification. | Welcome: **GHL**. The app sends no welcome email. The verification email comes from InsForge. |
| Trial starts | The trial row is created on first signed-in load, then `trial_updated` is sent with the real end date (once per account). | — |
| Trial ending (0–60 hours left) | Daily cron at 10:00 UTC sends "trial ends soon", once per trial end date. | **App** (Resend) |
| Trial ended, not subscribed (up to 3 days after) | Same daily cron sends "trial ended", once per trial end date. **No GHL event is sent.** | **App** (Resend) |
| Non-converter nurture | Nothing from the app. GHL must time it from `trial_end_date` on the sign-up/trial-update event. | **GHL** |
| First successful purchase | After the card is charged **and** the recurring subscription is created, the purchase event is sent. | **GHL** (Purchase workflow) |
| Renewals, webhook redeliveries | No purchase event. Authorize.net renewal webhooks are de-duplicated by transaction id and never trigger it. | — |
| Cancel | One cancel event per subscription, whether the user, an admin or Authorize.net cancelled (existing claim logic). | GHL, if a cancel workflow exists |

### Done in this branch

- The sign-up webhook can no longer fire twice for the same account (for
  example a double-submit or a page retry). Before this, a repeat would
  re-enroll the contact in the GHL signup workflow and could resend the
  welcome. It is claimed in `email_log` (`ghl_signup`) before sending, and
  the claim is released if GHL rejects it so a later retry can still go
  through.
- Checked against PR #1: the purchase event fires only from
  `/api/payments/subscribe` after a real charge plus recurring-subscription
  creation (first purchase or resubscribe after a lapse). Active
  subscribers are blocked from subscribing again. Renewals and webhook
  retries can't send it. That matches "start paid subscriber only on a real
  successful purchase". No change was needed there.

### Needs setting up in GHL / production (not done here)

- [ ] `GHL_PURCHASE_WEBHOOK_URL` in Vercel = the inbound-webhook URL of the
      published **MyProfitPulse Purchase** workflow (`bf4b35c3`). The
      workflow itself was tested in GHL on Nov 4. What hasn't been tested is
      the app calling it. Check the workflow's trigger accepts the purchase
      fields above.
- [ ] `GHL_SIGNUP_WEBHOOK_URL` in Vercel = the sign-up workflow's inbound
      webhook. That workflow sends the welcome and starts trial nurture.
- [ ] **Active Subscriber workflow:** it currently triggers on the
      "profitpulse-new sign up" tag. That would treat every new sign-up as a
      subscriber. It should start from the purchase webhook (or the
      "pp - subscriber" tag the Purchase workflow adds) instead. Not assumed
      fixed.
- [ ] **Trial / non-converter nurture removal** happens in GHL. The Purchase
      workflow already removes the signup/non-converter tags and takes the
      contact out of New Signups / Trial Non-Converter. Confirm any other
      trial-only workflows also stop on the "pp - subscriber" tag.
- [ ] **Trial-ended email overlap:** the app already emails "trial ended".
      If GHL's non-converter sequence also sends one at the same moment, the
      contact gets two. Joyce to choose which one stays.
- [ ] **Comped accounts** (allowlisted emails get free Pro without paying)
      still send the sign-up event, without `trial_end_date`, and never send
      a purchase event. GHL may put them in trial/non-converter nurture.
      Decide whether to tag or exclude them in GHL.
- [ ] Optional: `GHL_TRIAL_UPDATE_WEBHOOK_URL` and `GHL_CANCEL_WEBHOOK_URL`
      only matter if GHL workflows exist to receive them. The sign-up date is
      an estimate, so date-based GHL steps are more accurate with the
      trial-update webhook.
- [ ] GHL email dates/placeholders are being handled by Joyce's VA.

### Purchase prerequisites (no test purchases were made)

Live Authorize.net credentials and webhooks: see
`docs/PRODUCTION_CHECKLIST.md` sections 2–4. On top of those,
`GHL_PURCHASE_WEBHOOK_URL` is the only extra setting the purchase hookup
needs.

### Known limits (existing behaviour, unchanged)

- If the card is charged but the recurring subscription can't be created,
  the request fails with no account update and no purchase event. It needs
  manual follow-up in Authorize.net.
- Two subscribe requests sent at the same moment (double-click across tabs)
  aren't locked against each other and could charge twice.
- The sign-up webhook is triggered from the browser right after the account
  is created. If the page is closed before that request goes out, GHL never
  hears about the sign-up. The server only accepts it for accounts created
  in the last 15 minutes.
