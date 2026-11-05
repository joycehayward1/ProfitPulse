/**
 * Link to the MyProfitPulse tutorials page in Joyce's Go High Level community.
 *
 * Set NEXT_PUBLIC_TUTORIALS_URL to the full https:// address of that page.
 * NEXT_PUBLIC_* values are inlined at build time, so a change only takes
 * effect after a redeploy. Anything that is not an absolute http(s) URL is
 * treated as unset, and the Tutorials link is hidden rather than pointing
 * somewhere broken.
 */
export function getTutorialsUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_TUTORIALS_URL
): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
