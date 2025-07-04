import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "../db/index.js";
import { env } from "../config/env.js";
import * as schema from "../db/schema/index.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  // Allow requests from the frontend development server
  trustedOrigins: ["http://localhost:5173"],
  // Add the baseURL and redirect configuration
  baseURL: "http://localhost:3000",
  // Configure redirect URLs for OAuth success/error
  redirectTo: "http://localhost:5173",
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID as string,
      clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      // Add redirect URI configuration
      redirectURI: "http://localhost:3000/api/auth/callback/google",
    },
  },
  // Add success/error redirect URLs
  callbacks: {
    signIn: {
      before: async (session, request) => {
        return session;
      },
      after: async (session, request) => {
        return session;
      },
    },
  },
  // Configure where to redirect after successful authentication
  pages: {
    signIn: "http://localhost:5173",
    signUp: "http://localhost:5173",
    error: "http://localhost:5173",
  },
  advanced: {
    database: {
      generateId: false,
    },
    // Override default redirect behavior
    defaultRedirectURL: "http://localhost:5173",
  },
});

export type AuthType = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};
