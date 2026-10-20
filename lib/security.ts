export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 65536;

export function imageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)) return "image/png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0,4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8,12)) === "WEBP") return "image/webp";
  return null;
}
export function allowedOutput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (url.hostname === "replicate.delivery" || url.hostname.endsWith(".replicate.delivery")) ? url.href : null;
  } catch { return null; }
}
export function retryableError(value: unknown): boolean {
  // Only positively identified transient provider failures may incur a second call.
  return typeof value === "string" && !/nsfw|safety|policy|sensitive|content|invalid|input/i.test(value) && /out of memory|cuda|temporar|internal server|service unavailable/i.test(value);
}
async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return { key, data: new TextEncoder().encode(value) };
}
export async function digest(secret: string, value: string) {
  const { key, data } = await hmac(secret, value);
  return Buffer.from(await crypto.subtle.sign("HMAC", key, data)).toString("base64url");
}
export async function sign(secret: string, id: string, scope: string, exp: number) {
  const payload = Buffer.from(JSON.stringify({ id, scope, exp })).toString("base64url");
  return `${payload}.${await digest(secret, payload)}`;
}
export async function verify(secret: string, token: string, scope: string, now = Date.now()) {
  try {
    if (!secret || token.length > 1024) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    const { key, data } = await hmac(secret, payload);
    if (!await crypto.subtle.verify("HMAC", key, Buffer.from(signature, "base64url"), data)) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as { id: string; scope: string; exp: number };
    return /^[a-f0-9-]{36}$/.test(value.id) && value.scope === scope && Number.isFinite(value.exp) && value.exp > now ? value : null;
  } catch { return null; }
}
