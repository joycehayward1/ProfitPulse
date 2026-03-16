import { NextRequest } from "next/server";

interface CurrentSessionResponse {
  user?: {
    id?: string;
    email?: string;
  };
}

/**
 * Resolve authenticated user id from Bearer access token.
 * Returns null when token is missing/invalid.
 */
export async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const accessToken = authHeader.slice("Bearer ".length).trim();
  if (!accessToken) {
    return null;
  }

  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_INSFORGE_URL is not set.");
  }

  const response = await fetch(`${baseUrl}/api/auth/sessions/current`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as CurrentSessionResponse;
  return data.user?.id ?? null;
}
