/**
 * InsForge Client
 *
 * Singleton client for InsForge BaaS.
 * Used for auth, database queries, AI gateway, storage, and email.
 *
 * Environment variables (set in .env.local):
 *   NEXT_PUBLIC_INSFORGE_URL - InsForge project base URL
 *   NEXT_PUBLIC_INSFORGE_ANON_KEY - Anonymous/public API key
 */

import { InsForgeClient } from "@insforge/sdk";

let client: InsForgeClient | null = null;

export function getInsForgeClient(): InsForgeClient {
  if (client) return client;

  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_INSFORGE_URL is not set. Add it to .env.local."
    );
  }

  client = new InsForgeClient({
    baseUrl,
    anonKey: anonKey || undefined,
  });

  return client;
}

/**
 * Server-side InsForge client with admin privileges.
 * Only use in API routes and server components — never expose to the browser.
 */
export function getInsForgeAdmin(): InsForgeClient {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_INSFORGE_URL is not set. Add it to .env.local."
    );
  }

  if (!apiKey) {
    throw new Error(
      "INSFORGE_API_KEY is not set. Add it to .env.local."
    );
  }

  return new InsForgeClient({
    baseUrl,
    anonKey: apiKey,
  });
}
