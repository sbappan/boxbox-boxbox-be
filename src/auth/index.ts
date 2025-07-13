import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";

import { db } from "../db/index.js";
import { env, getTrustedOrigins } from "../config/env.js";
import * as schema from "../db/schema/index.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  // Environment-aware trusted origins configuration
  trustedOrigins: getTrustedOrigins(),
  // Environment-aware base URL configuration
  baseURL: env.BETTER_AUTH_URL,
  // Environment-aware redirect configuration
  redirectTo: env.FRONTEND_URL,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID as string,
      clientSecret: env.GOOGLE_CLIENT_SECRET as string,
      // Environment-aware redirect URI configuration
      redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/google`,
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
          redirectURI: `${env.BETTER_AUTH_URL}/api/auth/oauth2/callback/twitter`,
          scopes: ["tweet.read", "users.read", "offline.access", "users.email"],
          pkce: true,
          // Use Basic authentication for token exchange
          authentication: "basic",
          // Map user data and provide a fallback email
          getUserInfo: async (token: any) => {
            const response = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url,confirmed_email", {
              headers: {
                Authorization: `Bearer ${token.accessToken}`,
              },
            });
            
            if (!response.ok) {
              throw new Error("Failed to fetch user info from Twitter");
            }
            
            const data = await response.json();
            const user = data.data || data;
            
            return {
              id: user.id,
              email: user.confirmed_email || `${user.username}@twitter.local`,
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
  // Environment-aware page redirects
  pages: {
    signIn: env.FRONTEND_URL,
    signUp: env.FRONTEND_URL,
    error: env.FRONTEND_URL,
  },
  advanced: {
    database: {
      generateId: false,
    },
    // Environment-aware default redirect
    defaultRedirectURL: env.FRONTEND_URL,
  },
});

export type AuthType = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};
