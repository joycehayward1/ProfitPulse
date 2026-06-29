export interface GhlSignupContact {
  email: string;
  fullName: string;
}

export interface GhlSignupPayload {
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  source: string;
}

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

  return {
    email: contact.email.trim().toLowerCase(),
    name: contact.fullName.trim(),
    first_name: firstName,
    last_name: lastName,
    source: "MyProfitPulse App Signup",
  };
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
