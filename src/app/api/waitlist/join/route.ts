import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { getResend, FROM_EMAIL } from "@/lib/resend";
import { forwardToMarketingPlatform } from "@/lib/marketing-platform";
import { buildWaitlistWelcomeEmail } from "@/lib/waitlist-emails";

/**
 * POST /api/waitlist/join
 *
 * Body: {
 *   email: string,
 *   name?: string,
 *   businessName?: string,
 *   utm?: { source, medium, campaign, term, content },
 *   referrer?: string,
 *   landingUrl?: string,
 * }
 *
 * Flow:
 *   1. Validate email
 *   2. Insert into `waitlist` table (idempotent — duplicate emails return "already on list")
 *   3. Forward to marketing platform (GHL, no-op if not configured)
 *   4. Send welcome email via Resend
 *   5. Return success
 */
export async function POST(request: NextRequest) {
  let body: {
    email?: string;
    name?: string;
    businessName?: string;
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
      term?: string;
      content?: string;
    };
    referrer?: string;
    landingUrl?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address" },
      { status: 400 }
    );
  }

  const client = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });

  // Step 1: Insert into waitlist (unique constraint on email)
  const row = {
    email,
    name: body.name?.trim() || null,
    business_name: body.businessName?.trim() || null,
    utm_source: body.utm?.source || null,
    utm_medium: body.utm?.medium || null,
    utm_campaign: body.utm?.campaign || null,
    utm_term: body.utm?.term || null,
    utm_content: body.utm?.content || null,
    referrer: body.referrer || null,
    landing_url: body.landingUrl || null,
  };

  const { error: insertError } = await client.database
    .from("waitlist")
    .insert(row);

  if (insertError) {
    const msg = String(insertError.message ?? "").toLowerCase();
    // Unique violation — user is already on the list. Idempotent success.
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json({
        success: true,
        alreadyOnList: true,
      });
    }
    console.error("[waitlist] insert failed:", insertError);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }

  // Step 2: Forward to marketing platform (non-blocking — log errors)
  try {
    await forwardToMarketingPlatform({
      email,
      name: row.name,
      businessName: row.business_name,
      utmSource: row.utm_source,
      utmMedium: row.utm_medium,
      utmCampaign: row.utm_campaign,
      utmTerm: row.utm_term,
      utmContent: row.utm_content,
      referrer: row.referrer,
      landingUrl: row.landing_url,
      tags: ["waitlist"],
    });
  } catch (err) {
    console.error("[waitlist] marketing platform forward failed:", err);
    // Don't fail the signup — the row is already in InsForge
  }

  // Step 3: Send welcome email
  try {
    const emailContent = buildWaitlistWelcomeEmail({ name: row.name });
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
  } catch (err) {
    console.error("[waitlist] welcome email failed:", err);
    // Don't fail the signup — the row is already in InsForge
  }

  return NextResponse.json({ success: true });
}
