/**
 * Waitlist email templates. Plain HTML strings (no React email framework
 * to keep things simple). Renders well in Gmail, Outlook, Apple Mail.
 */

interface WelcomeEmailArgs {
  name?: string | null;
}

export function buildWaitlistWelcomeEmail(args: WelcomeEmailArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = (args.name ?? "").trim().split(/\s+/)[0];
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  const subject = "You're on the ProfitPulse waitlist 🧸";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF8F5;font-family:Arial,Helvetica,sans-serif;color:#2D2A26;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF8F5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">

          <!-- Header accent bar -->
          <tr>
            <td style="background:linear-gradient(135deg,#E65100 0%,#FB8C00 100%);height:6px;"></td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:40px 40px 24px 40px;">
              <h1 style="margin:0 0 8px 0;font-family:Georgia,serif;font-size:28px;line-height:1.2;color:#2D2A26;font-weight:normal;">
                You're in. 🎉
              </h1>
              <p style="margin:0;font-size:15px;color:#6B6560;line-height:1.6;">
                ${greeting}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 16px 40px;">
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#2D2A26;">
                Thanks for joining the <strong>ProfitPulse</strong> waitlist. You're officially in line for early access to the financial dashboard built for service-based business owners.
              </p>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#2D2A26;">
                We built ProfitPulse because running a service business shouldn't mean drowning in spreadsheets or squinting at QuickBooks reports. You should be able to open one dashboard and know, in plain English, exactly where your business stands.
              </p>
            </td>
          </tr>

          <!-- What you'll get -->
          <tr>
            <td style="padding:8px 40px 0 40px;">
              <p style="margin:0 0 12px 0;font-size:14px;font-weight:bold;color:#2D2A26;text-transform:uppercase;letter-spacing:0.06em;">
                What you'll get
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF8F5;border-radius:8px;padding:20px;">
                <tr>
                  <td style="padding:8px 0;font-size:15px;color:#2D2A26;">
                    ✓ A daily business health score, in plain English
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:15px;color:#2D2A26;">
                    ✓ Cash runway, profit, and what-if planning — all in one place
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:15px;color:#2D2A26;">
                    ✓ Proactive alerts before small issues become big ones
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:15px;color:#2D2A26;">
                    ✓ Early-access pricing as a thank you for joining the waitlist
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What happens next -->
          <tr>
            <td style="padding:24px 40px 8px 40px;">
              <p style="margin:0 0 12px 0;font-size:14px;font-weight:bold;color:#2D2A26;text-transform:uppercase;letter-spacing:0.06em;">
                What happens next
              </p>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#2D2A26;">
                We'll email you the moment ProfitPulse goes live. No spam, no pitch decks — just one message when your early access is ready.
              </p>
            </td>
          </tr>

          <!-- Sign off -->
          <tr>
            <td style="padding:16px 40px 40px 40px;">
              <p style="margin:0 0 4px 0;font-size:16px;line-height:1.6;color:#2D2A26;">
                Talk soon,
              </p>
              <p style="margin:0;font-size:16px;line-height:1.6;color:#2D2A26;">
                <strong>The ProfitPulse team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#FAF8F5;padding:24px 40px;text-align:center;border-top:1px solid #EDE8E0;">
              <p style="margin:0;font-size:12px;color:#9A948E;line-height:1.5;">
                You're receiving this because you joined the ProfitPulse waitlist at<br>
                <a href="https://myprofitpulse.app" style="color:#E65100;text-decoration:none;">myprofitpulse.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${greeting}

Thanks for joining the ProfitPulse waitlist. You're officially in line for early access to the financial dashboard built for service-based business owners.

What you'll get:
  - A daily business health score, in plain English
  - Cash runway, profit, and what-if planning in one place
  - Proactive alerts before small issues become big ones
  - Early-access pricing as a thank you for joining

What happens next:
We'll email you the moment ProfitPulse goes live. No spam, no pitch decks.

Talk soon,
The ProfitPulse team

—
You're receiving this because you joined the ProfitPulse waitlist at https://myprofitpulse.app`;

  return { subject, html, text };
}
