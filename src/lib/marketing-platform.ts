/**
 * Marketing platform forwarding layer.
 *
 * Waitlist signups get written to InsForge (source of truth) and then
 * forwarded to an external marketing automation platform (GoHighLevel
 * initially, but could swap to Customer.io, Mailchimp, etc.).
 *
 * When GHL credentials are configured in env, the stub calls GHL's contact
 * creation endpoint. Otherwise it no-ops, making the waitlist work out of
 * the box without a marketing platform.
 */

export interface MarketingContact {
  email: string;
  name?: string | null;
  businessName?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  referrer?: string | null;
  landingUrl?: string | null;
  tags?: string[];
}

/**
 * Forward a waitlist signup to the configured marketing platform.
 *
 * Returns `true` on success, `false` if the platform wasn't configured
 * (not an error — the signup is already safely in InsForge).
 *
 * Throws on actual API errors so the caller can log + mark the row as
 * unsynced for retry.
 */
export async function forwardToMarketingPlatform(
  contact: MarketingContact
): Promise<boolean> {
  const ghlToken = process.env.GHL_API_TOKEN;
  const ghlLocationId = process.env.GHL_LOCATION_ID;

  if (!ghlToken || !ghlLocationId) {
    // Not configured — signups stay in InsForge only. This is fine for v1.
    return false;
  }

  return await forwardToGoHighLevel(contact, ghlToken, ghlLocationId);
}

// ─── GoHighLevel implementation ──────────────────────────────────────────────

/**
 * POST a contact to GoHighLevel via their v2 API.
 *
 * Docs: https://highlevel.stoplight.io/docs/integrations/e957726e8625d-create-contact
 *
 * Requires:
 *   GHL_API_TOKEN      — Private Integration token from GHL location
 *   GHL_LOCATION_ID    — GHL sub-account (location) ID
 */
async function forwardToGoHighLevel(
  contact: MarketingContact,
  token: string,
  locationId: string
): Promise<boolean> {
  const [firstName, ...rest] = (contact.name ?? "").trim().split(/\s+/);
  const lastName = rest.join(" ") || undefined;

  const payload: Record<string, unknown> = {
    locationId,
    email: contact.email,
    firstName: firstName || undefined,
    lastName,
    companyName: contact.businessName ?? undefined,
    source: "ProfitPulse Waitlist",
    tags: contact.tags ?? ["waitlist"],
    customFields: [
      contact.utmSource && { key: "utm_source", field_value: contact.utmSource },
      contact.utmMedium && { key: "utm_medium", field_value: contact.utmMedium },
      contact.utmCampaign && { key: "utm_campaign", field_value: contact.utmCampaign },
      contact.utmTerm && { key: "utm_term", field_value: contact.utmTerm },
      contact.utmContent && { key: "utm_content", field_value: contact.utmContent },
      contact.referrer && { key: "referrer", field_value: contact.referrer },
      contact.landingUrl && { key: "landing_url", field_value: contact.landingUrl },
    ].filter(Boolean),
  };

  const res = await fetch("https://services.leadconnectorhq.com/contacts/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Version: "2021-07-28",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL contact create failed (${res.status}): ${text}`);
  }

  return true;
}
