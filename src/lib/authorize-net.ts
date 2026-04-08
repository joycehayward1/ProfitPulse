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

// ─── 4. getTransactionDetailsRequest ─────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
