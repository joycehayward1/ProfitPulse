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

export const FROM_EMAIL = "MyProfitPulse <hello@contact.myprofitpulse.app>";

// Customer-facing inbox. Replies to any MyProfitPulse email route here.
// Kept separate from FROM_EMAIL so the sending domain (contact.*) stays
// transactional-only and deliverability isn't tied to human-mail issues.
export const REPLY_TO_EMAIL = "hello@myprofitpulse.app";
