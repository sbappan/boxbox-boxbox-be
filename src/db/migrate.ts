import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { env } from "../config/env.js";
import { races, follows } from "./schema/other-schema.js";
import { user } from "./schema/auth-schema.js";

const connection = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(connection);

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

async function seedFollows() {
  console.log("🤝 Seeding follow relationships...");

  const existingFollows = await db.select().from(follows).limit(1);

  if (existingFollows.length === 0) {
    // Get all existing users to create sample relationships
    const allUsers = await db.select({ id: user.id }).from(user).limit(10);

    if (allUsers.length >= 2) {
      // Create some sample follow relationships between existing users
      const sampleFollows = [];
      
      for (let i = 0; i < allUsers.length - 1; i++) {
        // Each user follows the next user in the list
        sampleFollows.push({
          userId: allUsers[i].id,
          followingId: allUsers[i + 1].id,
        });
        
        // Some users follow multiple people
        if (i < allUsers.length - 2) {
          sampleFollows.push({
            userId: allUsers[i].id,
            followingId: allUsers[i + 2].id,
          });
        }
      }

      if (sampleFollows.length > 0) {
        await db.insert(follows).values(sampleFollows);
        
        // Update follower counts for affected users
        for (const follow of sampleFollows) {
          // Increment following count for the user who followed
          await db
            .update(user)
            .set({ followingCount: sql`${user.followingCount} + 1` })
            .where(eq(user.id, follow.userId));
          
          // Increment follower count for the user being followed
          await db
            .update(user)
            .set({ followerCount: sql`${user.followerCount} + 1` })
            .where(eq(user.id, follow.followingId));
        }
        
        console.log(`✅ Follow relationships seeded successfully (${sampleFollows.length} relationships)`);
      } else {
        console.log("ℹ️ No follow relationships to seed");
      }
    } else {
      console.log("ℹ️ Not enough users to create follow relationships");
    }
  } else {
    console.log("ℹ️ Follow relationships already exist, skipping seed");
  }
}

async function main() {
  console.log("🚀 Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ Migrations completed");

  await seedRaces();
  await seedFollows();

  console.log("🎉 Database setup completed");
  await connection.end();
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
