"use client";
import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({ baseURL: typeof window === "undefined" ? "https://pixform.ai" : window.location.origin });
