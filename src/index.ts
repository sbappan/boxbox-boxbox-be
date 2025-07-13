import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env.js";
import { auth } from "./auth/index.js";
import { db } from "./db/index.js";
import { user, races, raceReviews, reviewLikes, follows } from "./db/schema/index.js";
import { eq, and, desc, sql, count } from "drizzle-orm";

// Helper function to get review like count
async function getReviewLikeCount(reviewId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(reviewLikes)
    .where(eq(reviewLikes.reviewId, reviewId));
  return Number(result.count);
}

const app = new Hono();

// Apply CORS middleware with proper configuration for better-auth
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
  })
);

// Mount better-auth routes with debugging
app.all("/api/auth/*", async (c) => {
  const url = new URL(c.req.url);
  console.log("[Auth Debug] Request:", {
    method: c.req.method,
    path: url.pathname,
    params: Object.fromEntries(url.searchParams),
    headers: {
      referer: c.req.header("referer"),
      origin: c.req.header("origin"),
    }
  });

  try {
    const response = await auth.handler(c.req.raw);
    console.log("[Auth Debug] Response status:", response.status);
    
    // Log error responses
    if (response.status >= 400) {
      const clonedResponse = response.clone();
      try {
        const body = await clonedResponse.text();
        console.error("[Auth Debug] Error response body:", body);
      } catch (e) {
        console.error("[Auth Debug] Could not read error response body");
      }
    }
    
    return response;
  } catch (error) {
    console.error("[Auth Debug] Handler error:", error);
    throw error;
  }
});

// Example: Public endpoint
app.get("/", (c) => {
  return c.json({
    message: "Welcome to the F1 Review Site API",
    endpoints: {
      auth: "/api/auth/*",
      user: "/api/user/:id",
      races: "/api/races",
      reviews: "/api/reviews",
    },
  });
});

// Get all races (protected)
app.get("/api/races", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const allRaces = await db
      .select({
        id: races.id,
        slug: races.slug,
        name: races.name,
        latestRace: races.latestRace,
        highlightsUrl: races.highlightsUrl,
      })
      .from(races);

    return c.json(allRaces);
  } catch (error) {
    console.error("Failed to fetch races:", error);
    return c.json({ error: "Failed to fetch races" }, 500);
  }
});

// Get race by slug (protected)
app.get("/api/races/:slug", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const slug = c.req.param("slug");

  try {
    const [race] = await db
      .select({
        id: races.id,
        slug: races.slug,
        name: races.name,
        latestRace: races.latestRace,
        highlightsUrl: races.highlightsUrl,
      })
      .from(races)
      .where(eq(races.slug, slug))
      .limit(1);

    if (!race) {
      return c.json({ error: "Race not found" }, 404);
    }

    return c.json({ race });
  } catch (error) {
    console.error("Failed to fetch race:", error);
    return c.json({ error: "Failed to fetch race" }, 500);
  }
});

// Get user profile (protected)
app.get("/api/user/:id", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = c.req.param("id");
  const currentUserId = session.user.id;

  try {
    const [userProfile] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        followerCount: user.followerCount,
        followingCount: user.followingCount,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userProfile) {
      return c.json({ error: "User not found" }, 404);
    }

    // Check if current user is following this user (only if viewing someone else's profile)
    let isFollowing = false;
    if (currentUserId !== userId) {
      const [followRelation] = await db
        .select({ id: follows.id })
        .from(follows)
        .where(
          and(
            eq(follows.userId, currentUserId),
            eq(follows.followingId, userId)
          )
        )
        .limit(1);
      
      isFollowing = !!followRelation;
    }

    // For own profile, include email. For others, exclude email for privacy
    const responseData = currentUserId === userId 
      ? { user: { ...userProfile, isFollowing } }
      : { user: { 
          id: userProfile.id,
          name: userProfile.name,
          image: userProfile.image,
          followerCount: userProfile.followerCount,
          followingCount: userProfile.followingCount,
          createdAt: userProfile.createdAt,
          isFollowing
        }};

    return c.json(responseData);
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    return c.json({ error: "Failed to fetch user" }, 500);
  }
});

// Delete user account (protected)
app.delete("/api/user/:id", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = c.req.param("id");

  // Users can only delete their own account
  if (session.user.id !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    // Delete the user and return deleted rows (cascade delete will handle related records)
    const deletedUsers = await db
      .delete(user)
      .where(eq(user.id, userId))
      .returning({ id: user.id });

    // Check if any rows were deleted
    if (deletedUsers.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }

    // for Audit Trail purposes
    console.log(`Account deleted: userId=${userId}, deletedAt=${new Date().toISOString()}`);
    return c.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Failed to delete account:", error);
    return c.json({ error: "Failed to delete account" }, 500);
  }
});

// Follow user endpoint (protected)
app.post("/api/users/:id/follow", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userIdToFollow = c.req.param("id");
  const currentUserId = session.user.id;

  try {
    // Validate that user isn't trying to follow themselves
    if (currentUserId === userIdToFollow) {
      return c.json({ error: "Cannot follow yourself" }, 400);
    }

    // Check if the user to follow exists
    const [targetUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userIdToFollow))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: "User not found" }, 404);
    }

    // Check if already following
    const [existingFollow] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(
        and(
          eq(follows.userId, currentUserId),
          eq(follows.followingId, userIdToFollow)
        )
      )
      .limit(1);

    if (existingFollow) {
      return c.json({ error: "Already following this user" }, 409);
    }

    // Create the follow relationship
    await db.insert(follows).values({
      userId: currentUserId,
      followingId: userIdToFollow,
    });

    // Update follower counts
    await db
      .update(user)
      .set({ followingCount: sql`${user.followingCount} + 1` })
      .where(eq(user.id, currentUserId));

    await db
      .update(user)
      .set({ followerCount: sql`${user.followerCount} + 1` })
      .where(eq(user.id, userIdToFollow));

    return c.json({ message: "Successfully followed user" }, 201);
  } catch (error) {
    console.error("Failed to follow user:", error);
    return c.json({ error: "Failed to follow user" }, 500);
  }
});

// Unfollow user endpoint (protected)
app.delete("/api/users/:id/follow", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userIdToUnfollow = c.req.param("id");
  const currentUserId = session.user.id;

  try {
    // Check if the follow relationship exists
    const [existingFollow] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(
        and(
          eq(follows.userId, currentUserId),
          eq(follows.followingId, userIdToUnfollow)
        )
      )
      .limit(1);

    if (!existingFollow) {
      return c.json({ error: "Not following this user" }, 404);
    }

    // Delete the follow relationship
    await db
      .delete(follows)
      .where(
        and(
          eq(follows.userId, currentUserId),
          eq(follows.followingId, userIdToUnfollow)
        )
      );

    // Update follower counts
    await db
      .update(user)
      .set({ followingCount: sql`${user.followingCount} - 1` })
      .where(eq(user.id, currentUserId));

    await db
      .update(user)
      .set({ followerCount: sql`${user.followerCount} - 1` })
      .where(eq(user.id, userIdToUnfollow));

    return c.json({ message: "Successfully unfollowed user" });
  } catch (error) {
    console.error("Failed to unfollow user:", error);
    return c.json({ error: "Failed to unfollow user" }, 500);
  }
});

// Get user's followers (protected)
app.get("/api/users/:id/followers", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = c.req.param("id");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    // Check if the user exists
    const [targetUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: "User not found" }, 404);
    }

    // Get followers with pagination
    const followers = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        followerCount: user.followerCount,
        followingCount: user.followingCount,
        followedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(user, eq(follows.userId, user.id))
      .where(eq(follows.followingId, userId))
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination metadata
    const [totalResult] = await db
      .select({ total: count() })
      .from(follows)
      .where(eq(follows.followingId, userId));

    const total = Number(totalResult.total);
    const totalPages = Math.ceil(total / limit);

    return c.json({
      followers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Failed to fetch followers:", error);
    return c.json({ error: "Failed to fetch followers" }, 500);
  }
});

// Get users that a user is following (protected)
app.get("/api/users/:id/following", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = c.req.param("id");
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    // Check if the user exists
    const [targetUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: "User not found" }, 404);
    }

    // Get following with pagination
    const following = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        followerCount: user.followerCount,
        followingCount: user.followingCount,
        followedAt: follows.createdAt,
      })
      .from(follows)
      .innerJoin(user, eq(follows.followingId, user.id))
      .where(eq(follows.userId, userId))
      .orderBy(desc(follows.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination metadata
    const [totalResult] = await db
      .select({ total: count() })
      .from(follows)
      .where(eq(follows.userId, userId));

    const total = Number(totalResult.total);
    const totalPages = Math.ceil(total / limit);

    return c.json({
      following,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Failed to fetch following:", error);
    return c.json({ error: "Failed to fetch following" }, 500);
  }
});

// Get personalized feed of reviews from followed users (protected)
app.get("/api/feed/following", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const currentUserId = session.user.id;
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    // Get reviews from users that the current user follows
    const reviews = await db
      .select({
        id: raceReviews.id,
        rating: raceReviews.rating,
        comment: raceReviews.comment,
        createdAt: raceReviews.createdAt,
        author: user.name,
        authorId: user.id,
        avatarUrl: user.image,
        raceId: raceReviews.raceId,
        raceName: races.name,
        raceSlug: races.slug,
        likeCount: sql<number>`count(distinct ${reviewLikes.id})::int`,
        isLikedByUser: sql<boolean>`bool_or(${reviewLikes.userId} = ${currentUserId})`,
      })
      .from(raceReviews)
      .innerJoin(user, eq(raceReviews.userId, user.id))
      .innerJoin(races, eq(raceReviews.raceId, races.id))
      .innerJoin(follows, eq(follows.followingId, raceReviews.userId))
      .leftJoin(reviewLikes, eq(reviewLikes.reviewId, raceReviews.id))
      .where(eq(follows.userId, currentUserId))
      .groupBy(
        raceReviews.id,
        raceReviews.rating,
        raceReviews.comment,
        raceReviews.createdAt,
        user.name,
        user.id,
        user.image,
        raceReviews.raceId,
        races.name,
        races.slug
      )
      .orderBy(desc(raceReviews.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination metadata
    const [totalResult] = await db
      .select({ total: count() })
      .from(raceReviews)
      .innerJoin(follows, eq(follows.followingId, raceReviews.userId))
      .where(eq(follows.userId, currentUserId));

    const total = Number(totalResult.total);
    const totalPages = Math.ceil(total / limit);

    // Transform the results to match frontend Review type
    const reviewsWithLikes = reviews.map((review) => ({
      id: review.id,
      author: review.author || "Anonymous",
      authorId: review.authorId,
      avatarUrl: review.avatarUrl || "",
      rating: review.rating,
      text: review.comment || "",
      date: review.createdAt.toISOString(),
      raceId: review.raceId,
      raceName: review.raceName,
      raceSlug: review.raceSlug,
      likeCount: review.likeCount || 0,
      isLikedByUser: review.isLikedByUser || false,
    }));

    return c.json({
      reviews: reviewsWithLikes,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Failed to fetch following feed:", error);
    return c.json({ error: "Failed to fetch following feed" }, 500);
  }
});

// Get user suggestions for discovery (protected)
app.get("/api/users/suggestions", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const currentUserId = session.user.id;
  const limit = parseInt(c.req.query("limit") || "10");

  try {
    // Get users who have written reviews, ordered by activity, excluding:
    // 1. Current user
    // 2. Users already being followed
    const suggestions = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        followerCount: user.followerCount,
        followingCount: user.followingCount,
        reviewCount: sql<number>`count(distinct ${raceReviews.id})::int`,
        latestReviewDate: sql<string>`max(${raceReviews.createdAt})`,
      })
      .from(user)
      .innerJoin(raceReviews, eq(raceReviews.userId, user.id))
      .leftJoin(
        follows,
        and(
          eq(follows.userId, currentUserId),
          eq(follows.followingId, user.id)
        )
      )
      .where(
        and(
          sql`${user.id} != ${currentUserId}`, // Exclude current user
          sql`${follows.id} IS NULL` // Exclude already followed users
        )
      )
      .groupBy(
        user.id,
        user.name,
        user.email,
        user.image,
        user.followerCount,
        user.followingCount
      )
      .orderBy(
        desc(sql<number>`count(distinct ${raceReviews.id})`), // Most active reviewers first
        desc(sql<string>`max(${raceReviews.createdAt})`) // Then by most recent activity
      )
      .limit(limit);

    // Transform the results
    const suggestedUsers = suggestions.map((suggestion) => ({
      id: suggestion.id,
      name: suggestion.name || "Anonymous",
      email: suggestion.email,
      image: suggestion.image || "",
      followerCount: suggestion.followerCount || 0,
      followingCount: suggestion.followingCount || 0,
      reviewCount: suggestion.reviewCount || 0,
      latestReviewDate: suggestion.latestReviewDate,
    }));

    return c.json({
      suggestions: suggestedUsers,
      total: suggestedUsers.length,
    });
  } catch (error) {
    console.error("Failed to fetch user suggestions:", error);
    return c.json({ error: "Failed to fetch user suggestions" }, 500);
  }
});

// Health check endpoint
app.get("/health", async (c) => {
  try {
    // Test database connection
    await db.select().from(user).limit(1);
    return c.json({ status: "healthy", database: "connected" });
  } catch (error) {
    return c.json({ status: "unhealthy", database: "disconnected" }, 503);
  }
});

// Review API endpoints

// Get all reviews (with optional race filter)
app.get("/api/reviews", async (c) => {
  try {
    const raceId = c.req.query("raceId");
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const currentUserId = session?.user?.id;

    // Build the optimized query with like counts and user like status
    const reviewsQuery = db
      .select({
        id: raceReviews.id,
        rating: raceReviews.rating,
        comment: raceReviews.comment,
        createdAt: raceReviews.createdAt,
        author: user.name,
        authorId: user.id,
        avatarUrl: user.image,
        raceId: raceReviews.raceId,
        likeCount: sql<number>`count(distinct ${reviewLikes.id})::int`,
        isLikedByUser: currentUserId
          ? sql<boolean>`bool_or(${reviewLikes.userId} = ${currentUserId})`
          : sql<boolean>`false`,
      })
      .from(raceReviews)
      .innerJoin(user, eq(raceReviews.userId, user.id))
      .leftJoin(reviewLikes, eq(reviewLikes.reviewId, raceReviews.id))
      .groupBy(
        raceReviews.id,
        raceReviews.rating,
        raceReviews.comment,
        raceReviews.createdAt,
        user.name,
        user.id,
        user.image,
        raceReviews.raceId
      )
      .orderBy(desc(raceReviews.createdAt));

    const reviews = raceId
      ? await reviewsQuery.where(eq(raceReviews.raceId, raceId))
      : await reviewsQuery;

    // Transform the results to match frontend Review type
    const reviewsWithLikes = reviews.map((review) => ({
      id: review.id,
      author: review.author || "Anonymous",
      avatarUrl: review.avatarUrl || "",
      rating: review.rating,
      text: review.comment || "",
      date: review.createdAt.toISOString(),
      raceId: review.raceId,
      likeCount: review.likeCount || 0,
      isLikedByUser: review.isLikedByUser || false,
    }));

    return c.json(reviewsWithLikes);
  } catch (error) {
    console.error("Failed to fetch reviews:", error);
    return c.json({ error: "Failed to fetch reviews" }, 500);
  }
});

// Get a specific review by ID
app.get("/api/reviews/:id", async (c) => {
  const reviewId = c.req.param("id");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const currentUserId = session?.user?.id;

  try {
    const [review] = await db
      .select({
        id: raceReviews.id,
        rating: raceReviews.rating,
        comment: raceReviews.comment,
        createdAt: raceReviews.createdAt,
        author: user.name,
        authorId: user.id,
        avatarUrl: user.image,
        raceId: raceReviews.raceId,
        likeCount: sql<number>`count(distinct ${reviewLikes.id})::int`,
        isLikedByUser: currentUserId
          ? sql<boolean>`bool_or(${reviewLikes.userId} = ${currentUserId})`
          : sql<boolean>`false`,
      })
      .from(raceReviews)
      .innerJoin(user, eq(raceReviews.userId, user.id))
      .leftJoin(reviewLikes, eq(reviewLikes.reviewId, raceReviews.id))
      .where(eq(raceReviews.id, reviewId))
      .groupBy(
        raceReviews.id,
        raceReviews.rating,
        raceReviews.comment,
        raceReviews.createdAt,
        user.name,
        user.id,
        user.image,
        raceReviews.raceId
      )
      .limit(1);

    if (!review) {
      return c.json({ error: "Review not found" }, 404);
    }

    // Transform to match frontend Review type
    const transformedReview = {
      id: review.id,
      author: review.author || "Anonymous",
      avatarUrl: review.avatarUrl || "",
      rating: review.rating,
      text: review.comment || "",
      date: review.createdAt.toISOString(),
      raceId: review.raceId,
      likeCount: review.likeCount || 0,
      isLikedByUser: review.isLikedByUser || false,
    };

    return c.json(transformedReview);
  } catch (error) {
    console.error("Failed to fetch review:", error);
    return c.json({ error: "Failed to fetch review" }, 500);
  }
});

// Create a new review (protected)
app.post("/api/reviews", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const { text, rating, raceId } = body;

    // Validate required fields
    if (!text || typeof rating !== "number" || !raceId) {
      return c.json(
        { error: "Missing required fields: text, rating, raceId" },
        400
      );
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return c.json({ error: "Rating must be between 1 and 5" }, 400);
    }

    // Check if race exists
    const [race] = await db
      .select({ id: races.id })
      .from(races)
      .where(eq(races.id, raceId))
      .limit(1);

    if (!race) {
      return c.json({ error: "Race not found" }, 404);
    }

    // Check if user already has a review for this race
    const existingReview = await db
      .select({ id: raceReviews.id })
      .from(raceReviews)
      .where(
        and(
          eq(raceReviews.userId, session.user.id),
          eq(raceReviews.raceId, raceId)
        )
      )
      .limit(1);

    if (existingReview.length > 0) {
      return c.json({ error: "You have already reviewed this race" }, 409);
    }

    // Create the review
    const [newReview] = await db
      .insert(raceReviews)
      .values({
        userId: session.user.id,
        raceId,
        rating,
        comment: text,
        reviewNumber: 1, // For now, always use 1. Could be enhanced later
      })
      .returning();

    // Fetch the created review with user data
    const [createdReview] = await db
      .select({
        id: raceReviews.id,
        rating: raceReviews.rating,
        comment: raceReviews.comment,
        createdAt: raceReviews.createdAt,
        author: user.name,
        authorId: user.id,
        avatarUrl: user.image,
        raceId: raceReviews.raceId,
      })
      .from(raceReviews)
      .innerJoin(user, eq(raceReviews.userId, user.id))
      .where(eq(raceReviews.id, newReview.id))
      .limit(1);

    // Transform to match frontend Review type
    const transformedReview = {
      id: createdReview.id,
      author: createdReview.author || "Anonymous",
      avatarUrl: createdReview.avatarUrl || "",
      rating: createdReview.rating,
      text: createdReview.comment || "",
      date: createdReview.createdAt.toISOString(),
      raceId: createdReview.raceId,
    };

    return c.json(transformedReview, 201);
  } catch (error) {
    console.error("Failed to create review:", error);
    return c.json({ error: "Failed to create review" }, 500);
  }
});

// Update a review (protected)
app.put("/api/reviews/:id", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const reviewId = c.req.param("id");

  try {
    // Check if review exists and belongs to the user
    const [existingReview] = await db
      .select({
        id: raceReviews.id,
        userId: raceReviews.userId,
      })
      .from(raceReviews)
      .where(eq(raceReviews.id, reviewId))
      .limit(1);

    if (!existingReview) {
      return c.json({ error: "Review not found" }, 404);
    }

    if (existingReview.userId !== session.user.id) {
      return c.json(
        { error: "Forbidden: You can only edit your own reviews" },
        403
      );
    }

    const body = await c.req.json();
    const { text, rating } = body;

    const updateData: any = {};
    if (text !== undefined) updateData.comment = text;
    if (rating !== undefined) {
      if (typeof rating !== "number" || rating < 1 || rating > 5) {
        return c.json(
          { error: "Rating must be a number between 1 and 5" },
          400
        );
      }
      updateData.rating = rating;
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: "No valid fields to update" }, 400);
    }

    updateData.updatedAt = new Date();

    // Update the review
    await db
      .update(raceReviews)
      .set(updateData)
      .where(eq(raceReviews.id, reviewId));

    // Fetch the updated review with user data
    const [updatedReview] = await db
      .select({
        id: raceReviews.id,
        rating: raceReviews.rating,
        comment: raceReviews.comment,
        createdAt: raceReviews.createdAt,
        author: user.name,
        authorId: user.id,
        avatarUrl: user.image,
        raceId: raceReviews.raceId,
      })
      .from(raceReviews)
      .innerJoin(user, eq(raceReviews.userId, user.id))
      .where(eq(raceReviews.id, reviewId))
      .limit(1);

    // Transform to match frontend Review type
    const transformedReview = {
      id: updatedReview.id,
      author: updatedReview.author || "Anonymous",
      avatarUrl: updatedReview.avatarUrl || "",
      rating: updatedReview.rating,
      text: updatedReview.comment || "",
      date: updatedReview.createdAt.toISOString(),
      raceId: updatedReview.raceId,
    };

    return c.json(transformedReview);
  } catch (error) {
    console.error("Failed to update review:", error);
    return c.json({ error: "Failed to update review" }, 500);
  }
});

// Delete a review (protected)
app.delete("/api/reviews/:id", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const reviewId = c.req.param("id");

  try {
    // Check if review exists and belongs to the user
    const [existingReview] = await db
      .select({
        id: raceReviews.id,
        userId: raceReviews.userId,
      })
      .from(raceReviews)
      .where(eq(raceReviews.id, reviewId))
      .limit(1);

    if (!existingReview) {
      return c.json({ error: "Review not found" }, 404);
    }

    if (existingReview.userId !== session.user.id) {
      return c.json(
        { error: "Forbidden: You can only delete your own reviews" },
        403
      );
    }

    // Delete the review
    await db.delete(raceReviews).where(eq(raceReviews.id, reviewId));

    return c.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Failed to delete review:", error);
    return c.json({ error: "Failed to delete review" }, 500);
  }
});

// POST /api/reviews/:id/like - Like a review
// User should be able to like their own review - this is a common feature in some applications like Twitter (X) 
app.post("/api/reviews/:id/like", async (c) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const reviewId = c.req.param("id");

    // Check if the review exists
    const review = await db.query.raceReviews.findFirst({
      where: eq(raceReviews.id, reviewId),
    });

    if (!review) {
      return c.json({ error: "Review not found" }, 404);
    }

    // Check if user already liked this review
    const existingLike = await db.query.reviewLikes.findFirst({
      where: and(
        eq(reviewLikes.userId, session.user.id),
        eq(reviewLikes.reviewId, reviewId)
      ),
    });

    if (existingLike) {
      return c.json({ error: "Review already liked" }, 400);
    }

    // Create the like
    await db.insert(reviewLikes).values({
      userId: session.user.id,
      reviewId: reviewId,
    });

    // Get updated like count
    const likeCount = await getReviewLikeCount(reviewId);

    return c.json({ 
      message: "Review liked successfully",
      likeCount: likeCount
    });
  } catch (error) {
    console.error("Failed to like review:", error);
    return c.json({ error: "Failed to like review" }, 500);
  }
});

// DELETE /api/reviews/:id/like - Unlike a review
app.delete("/api/reviews/:id/like", async (c) => {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session?.user) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const reviewId = c.req.param("id");

    // Check if the like exists
    const existingLike = await db.query.reviewLikes.findFirst({
      where: and(
        eq(reviewLikes.userId, session.user.id),
        eq(reviewLikes.reviewId, reviewId)
      ),
    });

    if (!existingLike) {
      return c.json({ error: "Review not liked" }, 404);
    }

    // Delete the like
    await db.delete(reviewLikes).where(
      and(
        eq(reviewLikes.userId, session.user.id),
        eq(reviewLikes.reviewId, reviewId)
      )
    );

    // Get updated like count
    const likeCount = await getReviewLikeCount(reviewId);

    return c.json({ 
      message: "Review unliked successfully",
      likeCount: likeCount
    });
  } catch (error) {
    console.error("Failed to unlike review:", error);
    return c.json({ error: "Failed to unlike review" }, 500);
  }
});

// Start the server
serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`🚀 Server is running on http://localhost:${info.port}`);
    console.log(`📚 API Documentation: http://localhost:${info.port}`);
    console.log(`🔐 Auth endpoints: http://localhost:${info.port}/api/auth/*`);
    console.log(`🏁 Races endpoint: http://localhost:${info.port}/api/races`);
  }
);
