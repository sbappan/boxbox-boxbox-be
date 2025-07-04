import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  varchar,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./auth-schema.js";

export const races = pgTable("race", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  latestRace: boolean("latestRace").notNull().default(false),
});

export const raceReviews = pgTable(
  "race-review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    raceId: uuid("raceId")
      .notNull()
      .references(() => races.id, { onDelete: "cascade" }),
    reviewNumber: integer("review_number").notNull(), // 1-5 to limit reviews per user per race
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    // Ensure unique combination of userId, raceId, and reviewNumber
    unique("user_race_review_number").on(
      table.userId,
      table.raceId,
      table.reviewNumber
    ),
    // Add check constraint to limit reviewNumber to 1-5
    check(
      "review_number_check",
      sql`${table.reviewNumber} >= 1 AND ${table.reviewNumber} <= 5`
    ),
  ]
);

export const raceReviewsRelations = relations(raceReviews, ({ one }) => ({
  user: one(user, {
    fields: [raceReviews.userId],
    references: [user.id],
  }),
  race: one(races, {
    fields: [raceReviews.raceId],
    references: [races.id],
  }),
}));

export const racesRelations = relations(races, ({ many }) => ({
  reviews: many(raceReviews),
}));

// Type exports for TypeScript
export type Race = typeof races.$inferSelect;
export type NewRace = typeof races.$inferInsert;
export type RaceReview = typeof raceReviews.$inferSelect;
export type NewRaceReview = typeof raceReviews.$inferInsert;
