import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { resend, FROM_EMAIL } from "@/lib/resend";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: "ProfitPulse — Test Email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #2D2A26; font-family: Georgia, serif;">It works!</h2>
          <p style="color: #6B6560;">This is a test email from ProfitPulse. If you're reading this, Resend is connected and working correctly.</p>
          <p style="color: #9A948E; font-size: 13px; margin-top: 24px;">— The ProfitPulse Team</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, id: result.data?.id });
  } catch (err) {
    console.error("Resend test error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send test email" },
      { status: 500 }
    );
  }
}
