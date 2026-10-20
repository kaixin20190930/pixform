import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedOutput, digest, imageType, retryableError, sign, verify } from "../lib/security.ts";

test("job capabilities are scoped, authenticated and expiring", async () => {
  const secret = "test-only-secret-at-least-32-characters";
  const id = "12345678-1234-1234-1234-123456789abc";
  const token = await sign(secret, id, "job", 2000);
  assert.equal((await verify(secret, token, "job", 1000))?.id, id);
  assert.equal(await verify(secret, token, "input", 1000), null);
  assert.equal(await verify("different-secret", token, "job", 1000), null);
  assert.equal(await verify(secret, token, "job", 2000), null);
  assert.equal(await verify(secret, token + ".extra", "job", 1000), null);
});
test("image sniffing rejects mismatched and active formats", () => {
  assert.equal(imageType(new Uint8Array([255,216,255])), "image/jpeg");
  assert.equal(imageType(new Uint8Array([137,80,78,71,13,10,26,10])), "image/png");
  assert.equal(imageType(new TextEncoder().encode("RIFF0000WEBP")), "image/webp");
  assert.equal(imageType(new TextEncoder().encode("<svg onload='alert(1)'>")), null);
  assert.equal(imageType(new TextEncoder().encode("GIF89a")), null);
});
test("provider output URLs cannot redirect fetching to arbitrary hosts", () => {
  assert.ok(allowedOutput("https://replicate.delivery/example.png"));
  assert.ok(allowedOutput("https://pbxt.replicate.delivery/example.png"));
  for (const url of ["http://replicate.delivery/a", "https://replicate.delivery.evil.test/a", "https://127.0.0.1/a", "https://user:pass@replicate.delivery/a", "javascript:alert(1)"]) assert.equal(allowedOutput(url), null);
});
test("only known transient failures are eligible for one server retry", () => {
  assert.equal(retryableError("CUDA out of memory"), true);
  assert.equal(retryableError("NSFW content detected; internal server error"), false);
  assert.equal(retryableError("Invalid input"), false);
  assert.equal(retryableError("Unknown failure"), false);
});
test("IP keys are deterministic keyed hashes, not raw addresses", async () => {
  assert.equal(await digest("secret", "ip:192.0.2.1"), await digest("secret", "ip:192.0.2.1"));
  assert.notEqual(await digest("secret", "ip:192.0.2.1"), await digest("other", "ip:192.0.2.1"));
  assert.ok(!(await digest("secret", "ip:192.0.2.1")).includes("192.0.2.1"));
});
