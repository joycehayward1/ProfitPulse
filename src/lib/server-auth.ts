import { NextRequest } from "next/server";

interface CurrentSessionResponse {
  user?: {
    id?: string;
    email?: string;
  };
}

interface AuthenticatedUser {
  id: string;
  email: string;
}

/**
 * Resolve authenticated user from Bearer access token.
 * Returns null when token is missing/invalid.
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
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
  if (!data.user?.id || !data.user?.email) {
    return null;
  }
  return { id: data.user.id, email: data.user.email };
}

/**
 * Backward-compatible helper that returns just the user ID.
 */
export async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const user = await getAuthenticatedUser(request);
  return user?.id ?? null;
}
