/**
 * The Tutorials link in the sidebar and mobile menu, which opens a page in
 * Joyce's Go High Level community.
 *
 * Where the address comes from, highest priority first:
 *   1. The address an admin saved in the Admin Panel (Settings tab), stored in
 *      the `app_settings` table. No redeploy is needed to change it. Saving it
 *      empty hides the link.
 *   2. NEXT_PUBLIC_TUTORIALS_URL, if set. This is only a fallback for when
 *      nothing has been saved. It is compiled into the app, so changing it
 *      takes a redeploy.
 *   3. DEFAULT_TUTORIALS_URL below.
 *
 * Anything that is not an absolute http(s) URL is treated as empty, and the
 * link is hidden rather than pointing somewhere broken or unsafe.
 */

export const DEFAULT_TUTORIALS_URL =
  "https://community.fusion4business.net/courses/products/cf34560e-fbf3-4779-878f-e747bf2ed247";

export const TUTORIALS_URL_SETTING_KEY = "tutorials_url";

const MAX_LENGTH = 2000;

/** The URL in normal form, or null when it isn't a safe absolute http(s) URL. */
export function normalizeTutorialsUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || raw.length > MAX_LENGTH) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export type TutorialsUrlSource = "saved" | "hidden" | "env" | "default";

export interface TutorialsUrlChoice {
  url: string | null;
  source: TutorialsUrlSource;
}

/**
 * `saved` is the admin-saved value: undefined or null when nothing has been
 * saved, an empty string when an admin cleared it on purpose.
 */
export function chooseTutorialsUrl(
  saved: string | null | undefined,
  env: string | undefined = process.env.NEXT_PUBLIC_TUTORIALS_URL
): TutorialsUrlChoice {
  if (typeof saved === "string") {
    const url = normalizeTutorialsUrl(saved);
    return url ? { url, source: "saved" } : { url: null, source: "hidden" };
  }
  const fromEnv = normalizeTutorialsUrl(env);
  if (fromEnv) return { url: fromEnv, source: "env" };
  return { url: normalizeTutorialsUrl(DEFAULT_TUTORIALS_URL), source: "default" };
}

export function resolveTutorialsUrl(
  saved: string | null | undefined,
  env?: string
): string | null {
  return chooseTutorialsUrl(saved, env).url;
}

export type TutorialsUrlInput = { ok: true; value: string } | { ok: false; error: string };

/**
 * Checks what an admin typed. An empty box is allowed (it hides the link);
 * anything else must be an absolute http(s) address.
 */
export function parseTutorialsUrlInput(raw: unknown): TutorialsUrlInput {
  if (typeof raw !== "string") return { ok: false, error: "Enter a web address." };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: "" };
  const url = normalizeTutorialsUrl(trimmed);
  if (!url) {
    return {
      ok: false,
      error: "Enter a full web address starting with https:// (no username or password in it).",
    };
  }
  return { ok: true, value: url };
}
