import { NextRequest, NextResponse } from "next/server";
import { getInsForgeAdmin } from "@/lib/insforge";
import { requireAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";
import {
  DEFAULT_TUTORIALS_URL,
  TUTORIALS_URL_SETTING_KEY,
  chooseTutorialsUrl,
  parseTutorialsUrlInput,
} from "@/lib/tutorials";

/**
 * The Tutorials link shown under Glossary, editable without a redeploy.
 *
 *   GET    — what's saved, and which address the app is using right now
 *   PUT    — save: { url: string }. An empty string hides the link.
 *   DELETE — remove the saved value, so the default applies again
 *
 * Stored in app_settings (migration 009). Anyone can read the value (the link
 * is public), but only these routes write it.
 * Admin-only — identity verified via Bearer token (requireAdmin).
 */

const UNAVAILABLE =
  "Couldn't reach the saved setting. If this keeps happening, check that database migration 009 (app_settings) has been applied.";

async function readSaved(): Promise<{ ok: true; saved: string | null } | { ok: false }> {
  const { data, error } = await getInsForgeAdmin()
    .database.from("app_settings")
    .select("value")
    .eq("key", TUTORIALS_URL_SETTING_KEY)
    .maybeSingle();
  if (error) return { ok: false };
  return { ok: true, saved: typeof data?.value === "string" ? data.value : null };
}

function view(saved: string | null) {
  const choice = chooseTutorialsUrl(saved);
  return {
    saved,
    effectiveUrl: choice.url,
    source: choice.source,
    defaultUrl: DEFAULT_TUTORIALS_URL,
  };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const result = await readSaved();
  if (!result.ok) {
    return NextResponse.json({ ...view(null), available: false, error: UNAVAILABLE });
  }
  return NextResponse.json({ ...view(result.saved), available: true });
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseTutorialsUrlInput(body.url);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { error } = await getInsForgeAdmin()
    .database.from("app_settings")
    .upsert(
      {
        key: TUTORIALS_URL_SETTING_KEY,
        value: parsed.value,
        updated_by: admin.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  if (error) {
    console.error("[admin/tutorials-url] save failed", error);
    return NextResponse.json({ error: UNAVAILABLE }, { status: 500 });
  }

  await logAdminAction(admin, "tutorials_url_update", {}, { url: parsed.value || null });
  return NextResponse.json({ ...view(parsed.value), available: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { error } = await getInsForgeAdmin()
    .database.from("app_settings")
    .delete()
    .eq("key", TUTORIALS_URL_SETTING_KEY);
  if (error) {
    console.error("[admin/tutorials-url] reset failed", error);
    return NextResponse.json({ error: UNAVAILABLE }, { status: 500 });
  }

  await logAdminAction(admin, "tutorials_url_reset", {});
  return NextResponse.json({ ...view(null), available: true });
}
