import { defineConfig } from "drizzle-kit";
import { expand } from "dotenv-expand";

import { config } from "dotenv";

// Load environment variables with expansion
expand(config());

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
