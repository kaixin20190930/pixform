import { betterAuth } from "better-auth";
import type { Env } from "./cloudflare";

export function createAuth(env: Env) {
  return betterAuth({
    appName: "Pixform",
    baseURL: "https://pixform.ai",
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! },
    },
    trustedOrigins: ["https://pixform.ai"],
    advanced: { useSecureCookies: true },
  });
}
