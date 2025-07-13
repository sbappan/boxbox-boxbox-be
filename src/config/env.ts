import { config } from "dotenv";
import { expand } from "dotenv-expand";

// Load environment variables from .env file
expand(config());

// Validate required environment variables
const requiredEnvVars = ["DATABASE_URL", "BETTER_AUTH_SECRET"] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Export validated environment variables
export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  PORT: parseInt(process.env.PORT || "3000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  
  // Frontend URL configuration
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  
  // Additional trusted origins for production
  TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS?.split(",") || [],

  // OAuth providers (optional)
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,
} as const;

// Helper function to get all trusted origins
export const getTrustedOrigins = (): string[] => {
  const origins = [env.FRONTEND_URL];
  
  // Add additional trusted origins from environment
  if (env.TRUSTED_ORIGINS.length > 0) {
    origins.push(...env.TRUSTED_ORIGINS);
  }
  
  // In development, also allow backend URL
  if (env.NODE_ENV === "development") {
    origins.push(env.BETTER_AUTH_URL);
  }
  
  return origins;
};
