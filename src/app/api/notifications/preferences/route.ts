import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { createClient } from "@insforge/sdk";
import { resend, FROM_EMAIL } from "@/lib/resend";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prefs = await request.json();

  // Save preferences to database
  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

  const { error: dbError } = await client.database
    .from("notification_preferences")
    .upsert(
      {
        user_id: user.id,
        email: user.email,
        weekly_summary: prefs.weekly_summary ?? true,
        product_updates: prefs.product_updates ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (dbError) {
    console.error("DB error saving preferences:", dbError);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }

  // Send a confirmation email
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: "ProfitPulse — Notification preferences updated",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #2D2A26; font-family: Georgia, serif;">Notification Preferences Updated</h2>
          <p style="color: #6B6560;">Your email notification preferences have been saved:</p>
          <ul style="color: #2D2A26; line-height: 1.8;">
            <li>Weekly Summary: <strong>${prefs.weekly_summary ? "On" : "Off"}</strong></li>
            <li>Product Updates: <strong>${prefs.product_updates ? "On" : "Off"}</strong></li>
          </ul>
          <p style="color: #9A948E; font-size: 13px; margin-top: 24px;">— The ProfitPulse Team</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Resend error:", err);
    // Don't fail the whole request if just the confirmation email fails
  }

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

  const { data, error } = await client.database
    .from("notification_preferences")
    .select("weekly_summary, product_updates")
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    // Return defaults if no preferences saved yet
    return NextResponse.json({ weekly_summary: true, product_updates: true });
  }

  return NextResponse.json(data);
}
