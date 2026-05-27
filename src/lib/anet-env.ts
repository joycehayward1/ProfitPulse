import type { AuthNetEnvironment } from "react-acceptjs";

/** Accept.js + server API environment from NEXT_PUBLIC_ANET_ENVIRONMENT. */
export function getAnetEnvironment(): AuthNetEnvironment {
  return process.env.NEXT_PUBLIC_ANET_ENVIRONMENT === "PRODUCTION"
    ? "PRODUCTION"
    : "SANDBOX";
}

export function isAnetProduction(): boolean {
  return getAnetEnvironment() === "PRODUCTION";
}
