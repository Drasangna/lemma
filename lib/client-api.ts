/** Browser-side helpers for calling Lemma's own API. Shared by the workspace UI and WebMCP tools. */

/** A fresh Idempotency-Key. Reuse one key only when you mean "this exact request, again". */
export const newKey = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

/** Fetches JSON and throws the server's error message (not a bare status code) on failure. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok)
    throw new Error(typeof body.error === "string" ? body.error : `Request failed (${response.status})`);
  return body as T;
}

/** Sends a JSON request. Pass `keyPrefix` for mutations that require an Idempotency-Key. */
export function send<T>(
  method: "POST" | "PATCH",
  url: string,
  body?: unknown,
  keyPrefix?: string,
): Promise<T> {
  return api<T>(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(keyPrefix ? { "Idempotency-Key": newKey(keyPrefix) } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
