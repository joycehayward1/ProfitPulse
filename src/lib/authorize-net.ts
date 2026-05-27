/**
 * Server-side Authorize.net helpers for ProfitPulse.
 *
 * Wraps the three API methods used in Flow 2 (Subscribe):
 *   1. createTransactionRequest       — charge first period with Accept.js nonce
 *   2. createCustomerProfileFrom-
 *      TransactionRequest             — vault the card for future use
 *   3. ARBCreateSubscriptionRequest   — set up recurring billing
 *
 * Uses the plain HTTPS JSON API (no SDK). Sandbox only for now — production
 * endpoint can be swapped via NEXT_PUBLIC_ANET_ENVIRONMENT.
 *
 * Auth credentials are read from server-side env vars:
 *   ANET_API_LOGIN_ID
 *   ANET_TRANSACTION_KEY
 */

import type { BillingInterval } from "@/components/payments/PricingCards";

const SANDBOX_URL = "https://apitest.authorize.net/xml/v1/request.api";
const PRODUCTION_URL = "https://api.authorize.net/xml/v1/request.api";

function apiUrl(): string {
  return process.env.NEXT_PUBLIC_ANET_ENVIRONMENT === "PRODUCTION"
    ? PRODUCTION_URL
    : SANDBOX_URL;
}

function merchantAuth() {
  const name = process.env.ANET_API_LOGIN_ID;
  const transactionKey = process.env.ANET_TRANSACTION_KEY;
  if (!name || !transactionKey) {
    throw new Error(
      "Authorize.net credentials missing: ANET_API_LOGIN_ID / ANET_TRANSACTION_KEY"
    );
  }
  return { name, transactionKey };
}

/**
 * Authorize.net returns JSON responses with a leading BOM / zero-width
 * character that breaks JSON.parse. Strip it before parsing.
 */
async function callAnet<T>(payload: unknown): Promise<T> {
  const res = await fetch(apiUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Authorize.net HTTP ${res.status}`);
  }

  const raw = await res.text();
  const cleaned = raw.replace(/^\uFEFF/, "").trim();
  return JSON.parse(cleaned) as T;
}

// ─── Types (narrow — only what we use) ───────────────────────────────────────

interface AnetMessages {
  resultCode: "Ok" | "Error";
  message: { code: string; text: string }[];
}

interface AnetError extends Error {
  code?: string;
}

function assertOk(result: { messages: AnetMessages }, context: string): void {
  if (result.messages?.resultCode !== "Ok") {
    const first = result.messages?.message?.[0];
    const err: AnetError = new Error(
      `[${context}] ${first?.text ?? "Unknown Authorize.net error"}`
    );
    err.code = first?.code;
    throw err;
  }
}

interface CreateTransactionResponse {
  transactionResponse?: {
    responseCode: string;
    transId: string;
    messages?: { message: { code: string; description: string }[] };
    errors?: { error: { errorCode: string; errorText: string }[] };
  };
  messages: AnetMessages;
}

interface CreateCustomerProfileFromTransactionResponse {
  customerProfileId: string;
  customerPaymentProfileIdList: string[];
  messages: AnetMessages;
}

interface ARBCreateSubscriptionResponse {
  subscriptionId: string;
  messages: AnetMessages;
}

// ─── 1. createTransactionRequest ─────────────────────────────────────────────

export interface CreateTransactionArgs {
  amount: number;
  /** opaqueData returned from Accept.js */
  nonce: {
    dataDescriptor: string;
    dataValue: string;
  };
  /** Optional customer info for better AVS / receipts */
  customer?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    zip?: string;
  };
  /** Friendly description that shows up on the transaction */
  description?: string;
}

export interface CreateTransactionResult {
  transId: string;
  authCode?: string;
}

/**
 * Authorize and capture a payment using an Accept.js nonce.
 */
export async function createTransaction(
  args: CreateTransactionArgs
): Promise<CreateTransactionResult> {
  const payload = {
    createTransactionRequest: {
      merchantAuthentication: merchantAuth(),
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: args.amount.toFixed(2),
        payment: {
          opaqueData: {
            dataDescriptor: args.nonce.dataDescriptor,
            dataValue: args.nonce.dataValue,
          },
        },
        // Schema order: customer BEFORE billTo
        ...(args.customer?.email && {
          customer: { email: args.customer.email },
        }),
        ...(args.customer?.firstName || args.customer?.lastName || args.customer?.zip
          ? {
              billTo: {
                ...(args.customer.firstName && { firstName: args.customer.firstName }),
                ...(args.customer.lastName && { lastName: args.customer.lastName }),
                ...(args.customer.zip && { zip: args.customer.zip }),
              },
            }
          : {}),
        transactionSettings: {
          setting: [
            { settingName: "emailCustomer", settingValue: "true" },
          ],
        },
      },
    },
  };

  const result = await callAnet<CreateTransactionResponse>(payload);

  // Top-level error (e.g. bad merchant auth)
  if (result.messages?.resultCode !== "Ok") {
    assertOk(result, "createTransaction");
  }

  // Transaction-specific error
  const tx = result.transactionResponse;
  if (!tx || tx.responseCode !== "1") {
    const first = tx?.errors?.error?.[0];
    const err: AnetError = new Error(
      `[createTransaction] ${first?.errorText ?? "Transaction declined"}`
    );
    err.code = first?.errorCode;
    throw err;
  }

  return {
    transId: tx.transId,
    authCode: tx.messages?.message?.[0]?.code,
  };
}

// ─── 2. createCustomerProfileFromTransactionRequest ──────────────────────────

export interface CreateCustomerProfileFromTransactionResult {
  customerProfileId: string;
  customerPaymentProfileId: string;
}

/**
 * After a successful authCaptureTransaction, vault the card + customer info
 * by creating a Customer Profile from the transaction ID.
 */
export async function createCustomerProfileFromTransaction(
  transId: string
): Promise<CreateCustomerProfileFromTransactionResult> {
  if (!transId || transId === "0") {
    throw new Error(
      "[createCustomerProfileFromTransaction] Invalid transaction ID. " +
        "Production Test Mode returns transId 0 — vault the card via " +
        "createCustomerProfileWithPayment instead, or turn Test Mode off."
    );
  }

  const payload = {
    createCustomerProfileFromTransactionRequest: {
      merchantAuthentication: merchantAuth(),
      transId,
    },
  };

  const result = await callAnet<CreateCustomerProfileFromTransactionResponse>(payload);
  assertOk(result, "createCustomerProfileFromTransaction");

  const paymentProfileId = result.customerPaymentProfileIdList?.[0];
  if (!result.customerProfileId || !paymentProfileId) {
    throw new Error(
      "[createCustomerProfileFromTransaction] Missing profile IDs in response"
    );
  }

  return {
    customerProfileId: result.customerProfileId,
    customerPaymentProfileId: paymentProfileId,
  };
}

interface CreateCustomerProfileResponse {
  customerProfileId: string;
  customerPaymentProfileIdList: string[];
  messages: AnetMessages;
}

export interface CreateCustomerProfileWithPaymentArgs {
  merchantCustomerId: string;
  email?: string;
  description?: string;
  nonce: {
    dataDescriptor: string;
    dataValue: string;
  };
  billTo?: {
    firstName?: string;
    lastName?: string;
    zip?: string;
  };
}

/**
 * Vault a card from an Accept.js nonce without needing a settled transaction ID.
 * Used for fresh signups — avoids createCustomerProfileFromTransaction, which
 * fails when the merchant account is in Test Mode (transId 0).
 */
export async function createCustomerProfileWithPayment(
  args: CreateCustomerProfileWithPaymentArgs
): Promise<CreateCustomerProfileFromTransactionResult> {
  const paymentProfile: Record<string, unknown> = {
    customerType: "individual",
  };
  if (
    args.billTo &&
    (args.billTo.firstName || args.billTo.lastName || args.billTo.zip)
  ) {
    paymentProfile.billTo = {
      ...(args.billTo.firstName && { firstName: args.billTo.firstName }),
      ...(args.billTo.lastName && { lastName: args.billTo.lastName }),
      ...(args.billTo.zip && { zip: args.billTo.zip }),
    };
  }
  paymentProfile.payment = {
    opaqueData: {
      dataDescriptor: args.nonce.dataDescriptor,
      dataValue: args.nonce.dataValue,
    },
  };

  // ANet XSD requires profile child order: merchantCustomerId → description → email → paymentProfiles
  const profile: Record<string, unknown> = {
    merchantCustomerId: toAnetMerchantCustomerId(args.merchantCustomerId),
  };
  if (args.description) {
    profile.description = args.description;
  }
  if (args.email) {
    profile.email = args.email;
  }
  profile.paymentProfiles = paymentProfile;

  const payload = {
    createCustomerProfileRequest: {
      merchantAuthentication: merchantAuth(),
      profile,
      // First period is charged immediately after vaulting.
      validationMode: "none",
    },
  };

  const result = await callAnet<CreateCustomerProfileResponse>(payload);
  assertOk(result, "createCustomerProfileWithPayment");

  const paymentProfileId = result.customerPaymentProfileIdList?.[0];
  if (!result.customerProfileId || !paymentProfileId) {
    throw new Error(
      "[createCustomerProfileWithPayment] Missing profile IDs in response"
    );
  }

  return {
    customerProfileId: result.customerProfileId,
    customerPaymentProfileId: paymentProfileId,
  };
}

function isAnetDuplicateError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const anetErr = err as AnetError;
  return (
    anetErr.code === "E00039" ||
    /duplicate record with id/i.test(err.message)
  );
}

function extractDuplicateRecordId(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  const match = err.message.match(/duplicate record with id (\d+)/i);
  return match?.[1] ?? null;
}

interface StoredPaymentProfile {
  customerPaymentProfileId: string;
  defaultPaymentProfile?: boolean;
}

interface GetCustomerProfileResponse {
  profile: {
    customerProfileId: string;
    paymentProfiles?: StoredPaymentProfile | StoredPaymentProfile[];
  };
  messages: AnetMessages;
}

export async function getCustomerProfile(customerProfileId: string): Promise<{
  customerProfileId: string;
  paymentProfileIds: string[];
  defaultPaymentProfileId: string | null;
}> {
  const payload = {
    getCustomerProfileRequest: {
      merchantAuthentication: merchantAuth(),
      customerProfileId,
    },
  };

  const result = await callAnet<GetCustomerProfileResponse>(payload);
  assertOk(result, "getCustomerProfile");

  const raw = result.profile.paymentProfiles;
  const profiles = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const paymentProfileIds = profiles
    .map((p) => p.customerPaymentProfileId)
    .filter(Boolean);
  const defaultProfile =
    profiles.find((p) => p.defaultPaymentProfile) ?? profiles[0];

  return {
    customerProfileId: result.profile.customerProfileId,
    paymentProfileIds,
    defaultPaymentProfileId: defaultProfile?.customerPaymentProfileId ?? null,
  };
}

function isInvalidOtsTokenError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /invalid ots token/i.test(err.message);
}

function pickPaymentProfileId(profile: {
  defaultPaymentProfileId: string | null;
  paymentProfileIds: string[];
}): string | null {
  return profile.defaultPaymentProfileId ?? profile.paymentProfileIds[0] ?? null;
}

/**
 * Create a vaulted customer + card, or reuse an existing ANet profile left
 * over from a prior failed subscribe attempt (same merchantCustomerId).
 */
export async function ensureCustomerProfileWithPayment(
  args: CreateCustomerProfileWithPaymentArgs
): Promise<CreateCustomerProfileFromTransactionResult> {
  try {
    return await createCustomerProfileWithPayment(args);
  } catch (err) {
    if (!isAnetDuplicateError(err)) throw err;

    const customerProfileId = extractDuplicateRecordId(err);
    if (!customerProfileId) throw err;

    const existing = await getCustomerProfile(customerProfileId);
    const storedPaymentProfileId = pickPaymentProfileId(existing);
    if (storedPaymentProfileId) {
      // Card already vaulted from a prior attempt — reuse it (nonce is single-use).
      return {
        customerProfileId,
        customerPaymentProfileId: storedPaymentProfileId,
      };
    }

    try {
      const added = await createCustomerPaymentProfile({
        customerProfileId,
        nonce: args.nonce,
        billTo: args.billTo,
      });
      return {
        customerProfileId,
        customerPaymentProfileId: added.customerPaymentProfileId,
      };
    } catch (paymentErr) {
      if (isAnetDuplicateError(paymentErr) || isInvalidOtsTokenError(paymentErr)) {
        const refreshed = await getCustomerProfile(customerProfileId);
        const paymentProfileId = pickPaymentProfileId(refreshed);
        if (paymentProfileId) {
          return { customerProfileId, customerPaymentProfileId: paymentProfileId };
        }
      }
      throw paymentErr;
    }
  }
}

// ─── 3. ARBCreateSubscriptionRequest ─────────────────────────────────────────

export interface CreateARBSubscriptionArgs {
  billingInterval: BillingInterval;
  customerProfileId: string;
  customerPaymentProfileId: string;
  /** Date the FIRST recurring charge should run (first period already paid). */
  nextBillingDate: Date;
  customerEmail?: string;
}

export interface CreateARBSubscriptionResult {
  subscriptionId: string;
}

/**
 * Set up ongoing automated recurring billing. The first period is already
 * paid via createTransaction — ARB starts at `nextBillingDate`.
 */
export async function createARBSubscription(
  args: CreateARBSubscriptionArgs
): Promise<CreateARBSubscriptionResult> {
  const amount = args.billingInterval === "monthly" ? 59.99 : 599.88;
  const interval =
    args.billingInterval === "monthly"
      ? { length: "1", unit: "months" }
      : { length: "12", unit: "months" };

  // Format YYYY-MM-DD
  const startDate = args.nextBillingDate.toISOString().slice(0, 10);

  const payload = {
    ARBCreateSubscriptionRequest: {
      merchantAuthentication: merchantAuth(),
      subscription: {
        name: `ProfitPulse Pro ${
          args.billingInterval === "monthly" ? "Monthly" : "Annual"
        }`,
        paymentSchedule: {
          interval,
          startDate,
          totalOccurrences: "9999",
        },
        amount: amount.toFixed(2),
        profile: {
          customerProfileId: args.customerProfileId,
          customerPaymentProfileId: args.customerPaymentProfileId,
        },
      },
    },
  };

  const result = await callAnet<ARBCreateSubscriptionResponse>(payload);
  assertOk(result, "ARBCreateSubscription");

  if (!result.subscriptionId) {
    throw new Error("[ARBCreateSubscription] Missing subscriptionId in response");
  }

  return { subscriptionId: result.subscriptionId };
}

// ─── 4. ARBCancelSubscriptionRequest ─────────────────────────────────────────

interface ARBCancelSubscriptionResponse {
  messages: AnetMessages;
}

/**
 * Cancel an active ARB subscription. Used by plan switching (Flow 4/5) and
 * cancel (Flow 6).
 */
export async function cancelARBSubscription(subscriptionId: string): Promise<void> {
  const payload = {
    ARBCancelSubscriptionRequest: {
      merchantAuthentication: merchantAuth(),
      subscriptionId,
    },
  };

  const result = await callAnet<ARBCancelSubscriptionResponse>(payload);
  assertOk(result, "cancelARBSubscription");
}

// ─── 5. chargeCustomerProfile (createTransaction with profile) ───────────────

export interface ChargeCustomerProfileArgs {
  amount: number;
  customerProfileId: string;
  customerPaymentProfileId: string;
  description?: string;
  email?: string;
}

/**
 * Charge a stored customer profile (vault card) without collecting a new
 * nonce. Used when upgrading a user from monthly → annual — their card is
 * already on file from the original subscribe flow.
 */
export async function chargeCustomerProfile(
  args: ChargeCustomerProfileArgs
): Promise<CreateTransactionResult> {
  const payload = {
    createTransactionRequest: {
      merchantAuthentication: merchantAuth(),
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: args.amount.toFixed(2),
        profile: {
          customerProfileId: args.customerProfileId,
          paymentProfile: {
            paymentProfileId: args.customerPaymentProfileId,
          },
        },
        ...(args.email && { customer: { email: args.email } }),
        transactionSettings: {
          setting: [{ settingName: "emailCustomer", settingValue: "true" }],
        },
      },
    },
  };

  const result = await callAnet<CreateTransactionResponse>(payload);

  if (result.messages?.resultCode !== "Ok") {
    assertOk(result, "chargeCustomerProfile");
  }

  const tx = result.transactionResponse;
  if (!tx || tx.responseCode !== "1") {
    const first = tx?.errors?.error?.[0];
    const err: AnetError = new Error(
      `[chargeCustomerProfile] ${first?.errorText ?? "Transaction declined"}`
    );
    err.code = first?.errorCode;
    throw err;
  }

  return {
    transId: tx.transId,
    authCode: tx.messages?.message?.[0]?.code,
  };
}

// ─── 6. createCustomerPaymentProfileRequest ─────────────────────────────────

interface CreateCustomerPaymentProfileResponse {
  customerPaymentProfileId: string;
  messages: AnetMessages;
}

export interface CreateCustomerPaymentProfileArgs {
  customerProfileId: string;
  nonce: {
    dataDescriptor: string;
    dataValue: string;
  };
  billTo?: {
    firstName?: string;
    lastName?: string;
    zip?: string;
  };
}

/**
 * Add a new payment profile (card) under an existing Customer Profile.
 * Used in Flow 7 (Resubscribe with new card) and Flow 8 (Update Card).
 */
export async function createCustomerPaymentProfile(
  args: CreateCustomerPaymentProfileArgs
): Promise<{ customerPaymentProfileId: string }> {
  const payload = {
    createCustomerPaymentProfileRequest: {
      merchantAuthentication: merchantAuth(),
      customerProfileId: args.customerProfileId,
      paymentProfile: {
        ...(args.billTo && {
          billTo: {
            ...(args.billTo.firstName && { firstName: args.billTo.firstName }),
            ...(args.billTo.lastName && { lastName: args.billTo.lastName }),
            ...(args.billTo.zip && { zip: args.billTo.zip }),
          },
        }),
        payment: {
          opaqueData: {
            dataDescriptor: args.nonce.dataDescriptor,
            dataValue: args.nonce.dataValue,
          },
        },
      },
      validationMode: "liveMode",
    },
  };

  const result = await callAnet<CreateCustomerPaymentProfileResponse>(payload);
  assertOk(result, "createCustomerPaymentProfile");

  if (!result.customerPaymentProfileId) {
    throw new Error(
      "[createCustomerPaymentProfile] Missing customerPaymentProfileId in response"
    );
  }

  return { customerPaymentProfileId: result.customerPaymentProfileId };
}

// ─── 7. ARBUpdateSubscriptionRequest ─────────────────────────────────────────

interface ARBUpdateSubscriptionResponse {
  messages: AnetMessages;
}

export interface UpdateARBSubscriptionArgs {
  subscriptionId: string;
  customerProfileId: string;
  customerPaymentProfileId: string;
}

/**
 * Swap an active ARB subscription's payment method to a new customer payment
 * profile. Used by Flow 8 (Update Card) to move a subscription onto a newly
 * added card.
 */
export async function updateARBSubscription(
  args: UpdateARBSubscriptionArgs
): Promise<void> {
  const payload = {
    ARBUpdateSubscriptionRequest: {
      merchantAuthentication: merchantAuth(),
      subscriptionId: args.subscriptionId,
      subscription: {
        profile: {
          customerProfileId: args.customerProfileId,
          customerPaymentProfileId: args.customerPaymentProfileId,
        },
      },
    },
  };

  const result = await callAnet<ARBUpdateSubscriptionResponse>(payload);
  assertOk(result, "updateARBSubscription");
}

// ─── 8. getTransactionDetailsRequest ─────────────────────────────────────────

interface GetTransactionDetailsResponse {
  transaction: {
    transId: string;
    transactionType: string;
    transactionStatus: string;
    authAmount?: number;
    settleAmount?: number;
    subscription?: {
      id: string;
      payNum: string;
    };
    customer?: {
      email?: string;
    };
  };
  messages: AnetMessages;
}

export interface TransactionDetails {
  transId: string;
  amount: number | null;
  subscriptionId: string | null;
  payNum: string | null;
  customerEmail: string | null;
}

/**
 * Fetch full details about a transaction. Needed for webhook handling since
 * ARB renewal webhook payloads do NOT include the subscription ID — we have
 * to look it up via the transaction.
 */
export async function getTransactionDetails(
  transId: string
): Promise<TransactionDetails> {
  const payload = {
    getTransactionDetailsRequest: {
      merchantAuthentication: merchantAuth(),
      transId,
    },
  };

  const result = await callAnet<GetTransactionDetailsResponse>(payload);
  assertOk(result, "getTransactionDetails");

  return {
    transId: result.transaction.transId,
    amount: result.transaction.settleAmount ?? result.transaction.authAmount ?? null,
    subscriptionId: result.transaction.subscription?.id ?? null,
    payNum: result.transaction.subscription?.payNum ?? null,
    customerEmail: result.transaction.customer?.email ?? null,
  };
}

// ─── 5. ARBGetSubscriptionRequest ────────────────────────────────────────────

interface ARBGetSubscriptionResponse {
  subscription: {
    name: string;
    paymentSchedule?: {
      startDate: string;
      totalOccurrences: string;
    };
    amount?: number;
    status?: string;
    arbTransactions?: {
      arbTransaction?:
        | {
            response?: string;
            submitTimeUTC?: string;
            payNum?: string;
            attemptNum?: string;
            transId?: string;
          }
        | {
            response?: string;
            submitTimeUTC?: string;
            payNum?: string;
            attemptNum?: string;
            transId?: string;
          }[];
    };
  };
  messages: AnetMessages;
}

export interface ARBSubscriptionStatus {
  subscriptionId: string;
  status: string;
  lastTransaction: {
    transId: string;
    payNum: string;
    submitTimeUTC: string;
    response: string;
  } | null;
}

/**
 * Fetch full details about an ARB subscription including all past billing
 * attempts. Used by the reconciliation cron to detect recent renewal
 * charges that may have missed the webhook.
 */
export async function getARBSubscription(
  subscriptionId: string
): Promise<ARBSubscriptionStatus> {
  const payload = {
    ARBGetSubscriptionRequest: {
      merchantAuthentication: merchantAuth(),
      refId: "reconcile",
      subscriptionId,
      includeTransactions: true,
    },
  };

  const result = await callAnet<ARBGetSubscriptionResponse>(payload);
  assertOk(result, "getARBSubscription");

  const sub = result.subscription;
  const arbTxRaw = sub.arbTransactions?.arbTransaction;
  const arbTxs = Array.isArray(arbTxRaw) ? arbTxRaw : arbTxRaw ? [arbTxRaw] : [];

  // Find the most recent successful transaction (response code "1" = approved)
  const successful = arbTxs
    .filter((t) => t.response === "1" && t.transId)
    .sort((a, b) => {
      const aTime = new Date(a.submitTimeUTC ?? 0).getTime();
      const bTime = new Date(b.submitTimeUTC ?? 0).getTime();
      return bTime - aTime;
    });
  const latest = successful[0] ?? null;

  return {
    subscriptionId,
    status: sub.status ?? "unknown",
    lastTransaction: latest
      ? {
          transId: latest.transId!,
          payNum: latest.payNum ?? "",
          submitTimeUTC: latest.submitTimeUTC ?? "",
          response: latest.response ?? "",
        }
      : null,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Authorize.net merchantCustomerId max length is 20. */
export function toAnetMerchantCustomerId(id: string): string {
  return id.replace(/-/g, "").slice(0, 20);
}

export function getPlanAmount(billingInterval: BillingInterval): number {
  return billingInterval === "monthly" ? 59.99 : 599.88;
}

/**
 * Returns the date when the current paid period ends (and when ARB should
 * first charge). Monthly → +30 days, Annual → +365 days.
 */
export function computePeriodEnd(
  billingInterval: BillingInterval,
  from: Date = new Date()
): Date {
  const end = new Date(from);
  if (billingInterval === "monthly") {
    end.setDate(end.getDate() + 30);
  } else {
    end.setDate(end.getDate() + 365);
  }
  return end;
}
