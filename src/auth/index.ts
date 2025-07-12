import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";

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
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: "twitter",
          clientId: env.TWITTER_CLIENT_ID as string,
          clientSecret: env.TWITTER_CLIENT_SECRET as string,
          authorizationUrl: "https://twitter.com/i/oauth2/authorize",
          tokenUrl: "https://api.twitter.com/2/oauth2/token",
          userInfoUrl: "https://api.twitter.com/2/users/me",
          redirectURI: "http://localhost:3000/api/auth/oauth2/callback/twitter",
          scopes: ["tweet.read", "users.read", "offline.access"],
          pkce: true,
          // Use Basic authentication for token exchange
          authentication: "basic",
          // Map user data and provide a fallback email
          getUserInfo: async (token: any) => {
            const response = await fetch("https://api.twitter.com/2/users/me", {
              headers: {
                Authorization: `Bearer ${token.accessToken}`,
              },
            });
            
            if (!response.ok) {
              throw new Error("Failed to fetch user info from Twitter");
            }
            
            const data = await response.json();
            const user = data.data || data;
            
            // Twitter doesn't provide email, so we generate a placeholder
            return {
              id: user.id,
              email: `${user.username}@twitter.local`,
              name: user.name,
              image: user.profile_image_url,
              emailVerified: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          },
        },
      ],
    }),
  ],
  // Add success/error redirect URLs
  callbacks: {
    signIn: {
      before: async (session: any) => {
        return session;
      },
      after: async (session: any) => {
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
