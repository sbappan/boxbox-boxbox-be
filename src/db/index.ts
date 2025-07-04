import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";
import { env } from "../config/env.js";

// Get database URL from environment configuration
const connectionString = env.DATABASE_URL;

// Create postgres connection
const client = postgres(connectionString);

// Create drizzle database instance
export const db = drizzle(client, { schema });

// Export the client for direct queries if needed
export { client };
