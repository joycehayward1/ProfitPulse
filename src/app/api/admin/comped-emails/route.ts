import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { adminSql, logAdminAction } from "@/lib/admin-log";

/**
 * Admin management of the comped-emails allowlist. Emails on this list get
 * free Pro automatically when they sign up (see /api/auth/start-trial) —
 * lifetime by default, or for `access_months` months from signup.
 *
 *   GET    — list all allowlisted emails
 *   POST   — add one: { email: string, note?: string, accessMonths?: number | null }
 *   DELETE — remove one: { email: string } (does not revoke already-granted access)
 *
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */

function getClient() {
  return getInsForgeAdmin();
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

  let body: { email?: string; note?: string; accessMonths?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const accessMonths = body.accessMonths ?? null;
  if (
    accessMonths !== null &&
    (!Number.isInteger(accessMonths) || accessMonths < 1 || accessMonths > 120)
  ) {
    return NextResponse.json(
      { error: "accessMonths must be a whole number between 1 and 120, or empty for lifetime" },
      { status: 400 }
    );
  }

  // The list only applies at signup; an existing account would never claim it.
  const accounts = await adminSql<{ id: string }>(
    "SELECT id FROM auth.users WHERE lower(email) = $1",
    [email]
  );
  if (accounts && accounts.length > 0) {
    return NextResponse.json(
      {
        error:
          "They already have an account. Find them under People and use Give free Pro instead.",
      },
      { status: 409 }
    );
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
    .insert([{ email, note: body.note?.trim() || null, access_months: accessMonths }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to add email" }, { status: 500 });
  }

  await logAdminAction(admin, "comped_email_add", { email }, {
    access_months: accessMonths,
    note: body.note?.trim() || null,
  });

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

  await logAdminAction(admin, "comped_email_remove", { email });

  return NextResponse.json({ success: true });
}
