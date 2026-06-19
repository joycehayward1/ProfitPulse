type AuthLikeError = {
  message?: string;
  error?: string;
  statusCode?: number;
};

/** True when InsForge blocks sign-in because the email is not verified yet. */
export function isEmailVerificationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const { message = "", error: code = "" } = error as AuthLikeError;
  const haystack = `${message} ${code}`.toLowerCase();

  return (
    haystack.includes("verif") ||
    haystack.includes("unverified") ||
    haystack.includes("not verified")
  );
}

export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const { message = "", error: code = "", statusCode } = error as AuthLikeError;
  const haystack = `${message} ${code}`.toLowerCase();

  return (
    statusCode === 429 ||
    haystack.includes("too_many") ||
    haystack.includes("rate limit") ||
    haystack.includes("too many requests")
  );
}

export function getResendVerificationErrorMessage(
  error: unknown,
  fallback = "Failed to resend code. Please try again."
): string {
  if (isRateLimitError(error)) {
    return "Too many code requests. Wait a few minutes, then try Resend code again—or use the most recent code already in your inbox.";
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as AuthLikeError).message || "").trim();
    if (message) return message;
  }

  return fallback;
}
