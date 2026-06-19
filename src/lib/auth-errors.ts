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
