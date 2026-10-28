import type { Env } from "./cloudflare";
import { authReady } from "./cloudflare";
import { createAuth } from "./auth";

export async function currentSession(env: Env, headers: Headers) {
  if (!authReady(env)) return null;
  return createAuth(env).api.getSession({ headers });
}

export function sameOrigin(request: Request) {
  const origin = new URL(request.url).origin;
  return request.headers.get("origin") === origin;
}
