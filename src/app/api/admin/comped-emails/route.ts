import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * Admin management of the comped-emails allowlist. Emails on this list get
 * lifetime Pro automatically when they sign up (see /api/auth/start-trial).
 *
 *   GET    — list all allowlisted emails
 *   POST   — add one: { email: string, note?: string }
 *   DELETE — remove one: { email: string } (does not revoke already-granted access)
 *
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */

function getClient() {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_API_KEY || process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { data, error } = await getClient()
    .database.from("comped_emails")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch list" }, { status: 500 });
  }

  return NextResponse.json({ compedEmails: data ?? [] });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { email?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const client = getClient();

  const { data: existing } = await client.database
    .from("comped_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Email is already on the list" },
      { status: 409 }
    );
  }

  const { data, error } = await client.database
    .from("comped_emails")
    .insert({ email, note: body.note?.trim() || null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to add email" }, { status: 500 });
  }

  return NextResponse.json({ success: true, compedEmail: data });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const { error } = await getClient()
    .database.from("comped_emails")
    .delete()
    .eq("email", email);

  if (error) {
    return NextResponse.json({ error: "Failed to remove email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
