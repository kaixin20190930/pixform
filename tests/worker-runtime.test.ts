import test from "node:test";
import assert from "node:assert/strict";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { provider } from "../lib/jobs.ts";

test("provider requests work in workerd and reject redirects without following them", async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    compatibilityDate: "2026-10-20",
    script: `
      const provider = ${provider.toString()};
      export default { async fetch(request) {
        const status = Number(new URL(request.url).searchParams.get("status"));
        globalThis.fetch = async (url, init) => {
          const outgoing = new Request(url, init);
          if (outgoing.redirect !== "manual") throw new Error("Unsafe redirect mode");
          return new Response(JSON.stringify({id: "test"}), {status});
        };
        try {
          return Response.json(await provider({REPLICATE_API_TOKEN: "test"}, "predictions", {method:"POST",body:"{}"}));
        } catch(error) { return Response.json({error:error.message}, {status:502}); }
      } };
    `,
  }));
  try {
    const success = await mf.dispatchFetch("http://localhost/?status=201");
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), { id: "test" });
    const redirect = await mf.dispatchFetch("http://localhost/?status=302");
    assert.equal(redirect.status, 502);
    assert.deepEqual(await redirect.json(), { error: "Provider HTTP 302" });
  } finally { await mf.dispose(); }
});
