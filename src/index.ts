import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env.js";
import { auth } from "./auth/index.js";
import { db } from "./db/index.js";
import { user, races, raceReviews } from "./db/schema/index.js";
import { eq, and, desc } from "drizzle-orm";

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

// Mount better-auth routes
app.all("/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
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

// Get all races (public)
app.get("/api/races", async (c) => {
  try {
    const allRaces = await db
      .select({
        id: races.id,
        slug: races.slug,
        name: races.name,
        latestRace: races.latestRace,
      })
      .from(races);

    return c.json(allRaces);
  } catch (error) {
    console.error("Failed to fetch races:", error);
    return c.json({ error: "Failed to fetch races" }, 500);
  }
});

// Get race by slug (public)
app.get("/api/races/:slug", async (c) => {
  const slug = c.req.param("slug");

  try {
    const [race] = await db
      .select({
        id: races.id,
        slug: races.slug,
        name: races.name,
        latestRace: races.latestRace,
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

// Example: Get user profile (protected)
app.get("/api/user/:id", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const userId = c.req.param("id");

  // Users can only view their own profile (you can modify this logic)
  if (session.user.id !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  try {
    const [userProfile] = await db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!userProfile) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ user: userProfile });
  } catch (error) {
    return c.json({ error: "Failed to fetch user" }, 500);
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

    const baseQuery = db
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
      .orderBy(desc(raceReviews.createdAt));

    const reviews = raceId
      ? await baseQuery.where(eq(raceReviews.raceId, raceId))
      : await baseQuery;

    // Transform to match frontend Review type
    const transformedReviews = reviews.map((review) => ({
      id: review.id,
      author: review.author || "Anonymous",
      avatarUrl: review.avatarUrl || "",
      rating: review.rating,
      text: review.comment || "",
      date: review.createdAt.toISOString(),
      raceId: review.raceId,
    }));

    return c.json(transformedReviews);
  } catch (error) {
    console.error("Failed to fetch reviews:", error);
    return c.json({ error: "Failed to fetch reviews" }, 500);
  }
});

// Get a specific review by ID
app.get("/api/reviews/:id", async (c) => {
  const reviewId = c.req.param("id");

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
      })
      .from(raceReviews)
      .innerJoin(user, eq(raceReviews.userId, user.id))
      .where(eq(raceReviews.id, reviewId))
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
    const { author, text, rating, raceId } = body;

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
