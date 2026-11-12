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


test("PNG encoding, decoding and composition run inside Cloudflare workerd", async () => {
  const { build } = await import("esbuild");
  const bundle = await build({stdin:{contents:`import {encodePng,decodePng,pasteResult} from "./lib/multiple-image.ts";
    export default {async fetch(){const image={width:100,height:100,data:new Uint8Array(40000)};
      const base=decodePng(encodePng(image));pasteResult(base,{width:40,height:40,data:new Uint8Array(6400).fill(255)},{x:20,y:20,width:40,height:40});
      const result=decodePng(encodePng(base));return Response.json({inside:result.data[(40*100+40)*4],outside:result.data[0],width:result.width});}};`,resolveDir:process.cwd(),loader:"ts"},bundle:true,write:false,platform:"node",format:"esm"});
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:"2026-10-20",compatibilityFlags:["nodejs_compat"],script:bundle.outputFiles[0].text}));
  try{const result=await mf.dispatchFetch("http://localhost/");const body=await result.text();assert.equal(result.status,200,body);assert.deepEqual(JSON.parse(body),{inside:255,outside:0,width:100});}finally{await mf.dispose();}
});
