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
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { user } from "./auth-schema.js";

export const races = pgTable("race", {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    latestRace: boolean("latestRace").default(false).notNull(),
    highlightsUrl: text("highlightsUrl")
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

export const raceReviewsRelations = relations(raceReviews, ({ one, many }) => ({
  user: one(user, {
    fields: [raceReviews.userId],
    references: [user.id],
  }),
  race: one(races, {
    fields: [raceReviews.raceId],
    references: [races.id],
  }),
  likes: many(reviewLikes),
}));

export const racesRelations = relations(races, ({ many }) => ({
  reviews: many(raceReviews),
}));

export const reviewLikes = pgTable(
  "review_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reviewId: uuid("reviewId")
      .notNull()
      .references(() => raceReviews.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    // Ensure a user can only like a review once
    unique("user_review_unique").on(table.userId, table.reviewId),
  ]
);

export const reviewLikesRelations = relations(reviewLikes, ({ one }) => ({
  user: one(user, {
    fields: [reviewLikes.userId],
    references: [user.id],
  }),
  review: one(raceReviews, {
    fields: [reviewLikes.reviewId],
    references: [raceReviews.id],
  }),
}));

// Follows table for user following functionality
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: uuid("followingId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    // Ensure a user can only follow another user once
    unique("user_following_unique").on(table.userId, table.followingId),
    // Prevent users from following themselves
    check(
      "no_self_follow",
      sql`${table.userId} != ${table.followingId}`
    ),
    // Index for finding all users that a user follows (userId lookup)
    index("follows_user_id_idx").on(table.userId),
    // Index for finding all followers of a user (followingId lookup)
    index("follows_following_id_idx").on(table.followingId),
  ]
);

export const followsRelations = relations(follows, ({ one }) => ({
  user: one(user, {
    fields: [follows.userId],
    references: [user.id],
  }),
  following: one(user, {
    fields: [follows.followingId],
    references: [user.id],
  }),
}));

// Type exports for TypeScript
export type Race = typeof races.$inferSelect;
export type NewRace = typeof races.$inferInsert;
export type RaceReview = typeof raceReviews.$inferSelect;
export type NewRaceReview = typeof raceReviews.$inferInsert;
export type ReviewLike = typeof reviewLikes.$inferSelect;
export type NewReviewLike = typeof reviewLikes.$inferInsert;
export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;
