/**
 * Simple admin allowlist — email addresses permitted to access /admin/*
 * routes and APIs.
 *
 * Reads from the ADMIN_EMAILS env var, comma-separated. Case-insensitive
 * comparison. Falls back to an empty list if not set (nobody has access).
 */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
