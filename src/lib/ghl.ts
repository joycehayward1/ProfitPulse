export interface GhlSignupContact {
  email: string;
  fullName: string;
  /** When the trial ends (ISO 8601). Omitted for accounts without a trial. */
  trialEndDate?: string | null;
}

export interface GhlSignupPayload {
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  source: string;
  trial_end_date?: string;
}

/** `source` on every event except the original sign-up payload. */
export const GHL_EVENT_SOURCE = "myprofitpulse-app";

/** Upper bound on how long a GHL call may hold up the request that triggered it. */
export const GHL_WEBHOOK_TIMEOUT_MS = 3000;

export type GhlWebhookEnvVar =
  | "GHL_PURCHASE_WEBHOOK_URL"
  | "GHL_TRIAL_UPDATE_WEBHOOK_URL"
  | "GHL_CANCEL_WEBHOOK_URL";

/** Split a display name into first/last for Go High Level field mapping. */
export function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) {
    return { firstName: trimmed, lastName: "" };
  }

  return {
    firstName: trimmed.slice(0, spaceIndex),
    lastName: trimmed.slice(spaceIndex + 1).trim(),
  };
}

export function buildGhlSignupPayload(
  contact: GhlSignupContact
): GhlSignupPayload {
  const { firstName, lastName } = splitFullName(contact.fullName);

  const payload: GhlSignupPayload = {
    email: normalizeEmail(contact.email),
    name: contact.fullName.trim(),
    first_name: firstName,
    last_name: lastName,
    source: "MyProfitPulse App Signup",
  };
  if (contact.trialEndDate) {
    payload.trial_end_date = new Date(contact.trialEndDate).toISOString();
  }
  return payload;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface GhlContact {
  email: string;
  fullName: string;
}

export interface GhlPurchasePayload {
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  plan: string;
  amount: number;
  currency: string;
  purchase_date: string;
  subscription_id: string;
  transaction_id: string;
  source: string;
}

export interface GhlPurchaseInput extends GhlContact {
  billingInterval: "monthly" | "annual";
  amount: number;
  purchasedAt: Date | string;
  subscriptionId: string;
  transactionId: string;
}

export function buildGhlPurchasePayload(
  input: GhlPurchaseInput
): GhlPurchasePayload {
  const { firstName, lastName } = splitFullName(input.fullName);

  return {
    email: normalizeEmail(input.email),
    name: input.fullName.trim(),
    first_name: firstName,
    last_name: lastName,
    plan: `pro_${input.billingInterval}`,
    amount: Math.round(input.amount * 100) / 100,
    currency: "USD",
    purchase_date: new Date(input.purchasedAt).toISOString(),
    subscription_id: input.subscriptionId,
    transaction_id: input.transactionId,
    source: GHL_EVENT_SOURCE,
  };
}

export interface GhlTrialUpdatedPayload {
  email: string;
  first_name: string;
  last_name: string;
  trial_end_date: string;
  event: "trial_updated";
  source: string;
}

export function buildGhlTrialUpdatedPayload(
  input: GhlContact & { trialEndDate: Date | string }
): GhlTrialUpdatedPayload {
  const { firstName, lastName } = splitFullName(input.fullName);

  return {
    email: normalizeEmail(input.email),
    first_name: firstName,
    last_name: lastName,
    trial_end_date: new Date(input.trialEndDate).toISOString(),
    event: "trial_updated",
    source: GHL_EVENT_SOURCE,
  };
}

export interface GhlCancelPayload {
  email: string;
  first_name: string;
  last_name: string;
  subscription_id: string;
  cancelled_at: string;
  event: "subscription_cancelled";
  source: string;
}

export function buildGhlCancelPayload(
  input: GhlContact & { subscriptionId: string; cancelledAt: Date | string }
): GhlCancelPayload {
  const { firstName, lastName } = splitFullName(input.fullName);

  return {
    email: normalizeEmail(input.email),
    first_name: firstName,
    last_name: lastName,
    subscription_id: input.subscriptionId,
    cancelled_at: new Date(input.cancelledAt).toISOString(),
    event: "subscription_cancelled",
    source: GHL_EVENT_SOURCE,
  };
}

/** True when the given GHL webhook env var holds a non-empty URL. */
export function isGhlWebhookConfigured(envVar: GhlWebhookEnvVar): boolean {
  return Boolean(process.env[envVar]?.trim());
}

/**
 * POST an event to the Go High Level webhook named by `envVar`.
 *
 * Never throws and never logs the URL (it carries a token): an unset env var
 * is skipped silently, and failures log only the label and a status or error
 * name. The call is capped at GHL_WEBHOOK_TIMEOUT_MS. Returns true only when
 * GHL accepted the event.
 */
export async function postGhlEvent(
  envVar: GhlWebhookEnvVar,
  label: string,
  payload: object
): Promise<boolean> {
  const webhookUrl = process.env[envVar]?.trim();
  if (!webhookUrl) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GHL_WEBHOOK_TIMEOUT_MS);
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`[ghl] ${label} webhook failed with status ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown error";
    console.error(`[ghl] ${label} webhook request failed (${reason})`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST signup contact data to the Go High Level inbound webhook.
 * Returns null on success; returns an error message string on failure.
 */
export async function syncSignupContactToGhl(
  contact: GhlSignupContact
): Promise<string | null> {
  const webhookUrl = process.env.GHL_SIGNUP_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn("[ghl] GHL_SIGNUP_WEBHOOK_URL is not configured — skipping sync");
    return null;
  }

  const payload = buildGhlSignupPayload(contact);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("[ghl] webhook failed:", response.status, responseText);
      return `Go High Level webhook returned ${response.status}`;
    }

    return null;
  } catch (error) {
    console.error("[ghl] webhook request failed:", error);
    return "Failed to reach Go High Level webhook";
  }
}
