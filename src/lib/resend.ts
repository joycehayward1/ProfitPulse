import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

type SendEmailOptions = Parameters<Resend["emails"]["send"]>[0];

/**
 * Send one email. The Resend SDK reports API failures (rate limit, unverified
 * domain, bad recipient) in the returned `error` instead of throwing, so this
 * throws on them: callers that catch can then count, log and retry correctly.
 * Returns the Resend email id.
 */
export async function sendEmail(payload: SendEmailOptions): Promise<string | null> {
  const result = await getResend().emails.send(payload);
  if (result?.error) {
    throw new Error(`Resend rejected the email (${result.error.name}): ${result.error.message}`);
  }
  return result?.data?.id ?? null;
}

export const FROM_EMAIL = "MyProfitPulse <hello@contact.myprofitpulse.app>";

// Customer-facing inbox. Replies to any MyProfitPulse email route here.
// Kept separate from FROM_EMAIL so the sending domain (contact.*) stays
// transactional-only and deliverability isn't tied to human-mail issues.
export const REPLY_TO_EMAIL = "hello@myprofitpulse.app";
