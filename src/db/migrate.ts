import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../config/env.js";
import { races } from "./schema/other-schema.js";

const sql = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(sql);

async function seedRaces() {
  console.log("🌱 Seeding races...");

  const existingRaces = await db.select().from(races).limit(1);

  if (existingRaces.length === 0) {
    await db.insert(races).values([
      {
        slug: "austrian-gp-2025",
        name: "Austrian Grand Prix 2025",
        latestRace: true,
      },
      {
        slug: "bahrain-gp-2025",
        name: "Bahrain Grand Prix 2025",
        latestRace: false,
      },
      {
        slug: "saudi-arabia-gp-2025",
        name: "Saudi Arabia Grand Prix 2025",
        latestRace: false,
      },
      {
        slug: "australian-gp-2025",
        name: "Australian Grand Prix 2025",
        latestRace: false,
      },
    ]);
    console.log("✅ Races seeded successfully");
  } else {
    console.log("ℹ️ Races already exist, skipping seed");
  }
}

async function main() {
  console.log("🚀 Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ Migrations completed");

  await seedRaces();

  console.log("🎉 Database setup completed");
  await sql.end();
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
