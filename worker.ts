// The adapter generates this module at build time.
import app from "./.open-next/worker.js";
import { sweep } from "./lib/cleanup";
import type { Env } from "./lib/cloudflare";
import type { ExecutionContext, ScheduledController } from "@cloudflare/workers-types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.hostname === "www.pixform.ai") {
      url.hostname = "pixform.ai";
      return Response.redirect(url, 308);
    }
    const response = await app.fetch(request, env, ctx);
    if (url.hostname === "pixform.ai") return response;
    // Preview deployments must not compete with the canonical production domain.
    const preview = new Response(response.body, response);
    preview.headers.set("X-Robots-Tag", "noindex, nofollow");
    return preview;
  },
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sweep(env));
  },
};
