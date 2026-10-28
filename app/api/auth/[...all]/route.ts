import { environment, authReady } from "@/lib/cloudflare";
import { createAuth } from "@/lib/auth";

async function handler(request: Request) {
  const env = await environment();
  if (!authReady(env)) return Response.json({ error: "Sign in is being prepared." }, { status: 503 });
  return createAuth(env).handler(request);
}
export const GET = handler;
export const POST = handler;
