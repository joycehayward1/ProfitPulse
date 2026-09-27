/**
 * Business info entered on the signup form, held in localStorage until the
 * user has a session (email verification comes first) and it can be saved to
 * their profile under RLS.
 */
const KEY = "profitpulse_pending_profile";

export interface PendingProfile {
  email: string;
  businessName: string;
  industry: string;
}

export function savePendingProfile(profile: PendingProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Storage unavailable — the profile can still be edited in Settings.
  }
}

export function readPendingProfile(email: string | undefined): PendingProfile | null {
  if (!email) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingProfile;
    return parsed.email?.toLowerCase() === email.toLowerCase() ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingProfile(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
