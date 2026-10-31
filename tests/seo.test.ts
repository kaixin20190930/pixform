import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalRedirectLocation } from "../lib/canonical-url.ts";

test("production HTTP and www URLs permanently converge on HTTPS apex", () => {
  assert.equal(canonicalRedirectLocation("http://pixform.ai/terms"), "https://pixform.ai/terms");
  assert.equal(canonicalRedirectLocation("http://www.pixform.ai/about"), "https://pixform.ai/about");
  assert.equal(canonicalRedirectLocation("https://www.pixform.ai/privacy"), "https://pixform.ai/privacy");
  assert.equal(canonicalRedirectLocation("https://pixform.ai/face-swap"), null);
});

test("style query URLs converge on a clean homepage with a client-only style hash", () => {
  assert.equal(canonicalRedirectLocation("https://pixform.ai/?style=anime"), "https://pixform.ai/#studio-anime");
  assert.equal(canonicalRedirectLocation("http://pixform.ai/?style=oil-painting"), "https://pixform.ai/#studio-oil-painting");
  assert.equal(canonicalRedirectLocation("https://pixform.ai/?style=unknown"), "https://pixform.ai/");
  assert.equal(canonicalRedirectLocation("http://localhost:3000/?style=anime"), null);
});
