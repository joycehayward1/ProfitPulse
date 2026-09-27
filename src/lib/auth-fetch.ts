/**
 * fetch() for our own API routes that attaches the signed-in user's access
 * token. Routes resolve the caller with getAuthenticatedUser() and must never
 * trust a userId from the request body.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { getInsForgeClient } = await import("@/lib/insforge");
  const { data } = await getInsForgeClient().auth.getCurrentSession();
  const token = data?.session?.accessToken;

  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}
