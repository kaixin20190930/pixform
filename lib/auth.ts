import { betterAuth } from "better-auth";
import type { Env } from "./cloudflare";

export function createAuth(env: Env) {
  const origin = env.APP_ORIGIN || "https://pixform.ai";
  return betterAuth({
    appName: "Pixform",
    baseURL: origin,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! },
    },
    trustedOrigins: [origin],
    advanced: { useSecureCookies: origin.startsWith("https://") },
  });
}
