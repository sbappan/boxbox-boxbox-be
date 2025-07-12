# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Backend Overview

This is an F1 review site backend built with:
- **Hono** - Ultra-fast web framework
- **PostgreSQL** - Database
- **Drizzle ORM** - Type-safe SQL query builder
- **Better Auth** - Authentication system
- **TypeScript** - Full type safety with ESM modules

## Common Development Commands

### Database Management
```bash
# Start PostgreSQL container
pnpm db:up

# Generate migration files from schema changes
pnpm db:generate

# Run migrations and seed initial data
pnpm db:migrate

# Push schema directly to database (dev only)
pnpm db:push

# Open Drizzle Studio GUI
pnpm db:studio
```

### Development
```bash
# Start development server with hot reload
pnpm dev

# Build TypeScript
pnpm build

# Run production server
pnpm start
```

### Testing Individual API Endpoints
```bash
# Example: Create a review
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"text": "Great race!", "rating": 5, "raceId": "race-id"}'
```

**Note**: No linting or type-checking scripts are currently configured. When implementing code changes, ensure TypeScript compiles successfully with `pnpm build`.

## Architecture and Code Structure

### Key Directories
- `src/index.ts` - Main server entry point with all API routes
- `src/auth/` - Better-auth configuration with OAuth providers
- `src/db/schema/` - Drizzle schema definitions
  - `auth-schema.ts` - Authentication tables (users, sessions, accounts, verifications)
  - `other-schema.ts` - Application tables (races, race-reviews)
- `src/config/env.ts` - Environment variable validation
- `drizzle/` - Generated SQL migrations

### API Routes Structure

**Authentication** (handled by better-auth):
- `/api/auth/signup` - User registration
- `/api/auth/signin` - User login
- `/api/auth/signout` - User logout
- `/api/auth/session` - Get current session
- `/api/auth/user` - Get current user

**Races API** (protected):
- `GET /api/races` - List all races
- `GET /api/races/:slug` - Get race by slug

**Reviews API**:
- `GET /api/reviews` - List all reviews (public)
- `GET /api/reviews/:id` - Get specific review (public)
- `POST /api/reviews` - Create review (protected)
- `PUT /api/reviews/:id` - Update review (protected, own reviews only)
- `DELETE /api/reviews/:id` - Delete review (protected, own reviews only)

**Other**:
- `GET /api/user/:id` - Get user profile (protected, own profile only)
- `GET /health` - Health check with database connectivity test

### Database Schema

**Race Table**:
- `id` (uuid) - Primary key
- `slug` (text) - URL-friendly identifier
- `name` (text) - Display name
- `latestRace` (boolean) - Flag for most recent race

**Race Review Table**:
- `id` (uuid) - Primary key
- `userId` (text) - Foreign key to user
- `raceId` (text) - Foreign key to race
- `rating` (integer 1-5) - Review rating
- `comment` (text) - Review text
- `reviewNumber` (integer 1-5) - Allows up to 5 reviews per user per race
- Constraint: Unique on (userId, raceId, reviewNumber)

### Authentication Flow

1. Session-based authentication using cookies
2. All protected endpoints check session via `auth.api.getSession()`
3. OAuth providers configured: Google, Twitter, GitHub
4. CORS configured for credentials with allowed origins

### Key Implementation Patterns

**Protected Route Pattern**:
```typescript
const session = await auth.api.getSession({ headers: c.req.raw.headers });
if (!session) {
  return c.json({ error: "Unauthorized" }, 401);
}
```

**Database Query Pattern**:
```typescript
const [result] = await db
  .select({ /* fields */ })
  .from(table)
  .where(eq(table.field, value))
  .limit(1);
```

**Review Response Transformation**:
Reviews are transformed to match frontend expectations with fields: id, author, avatarUrl, rating, text, date, raceId

### Environment Configuration

Required environment variables (see env.example):
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Server port (default: 3000)
- `BETTER_AUTH_SECRET` - Authentication secret
- `BETTER_AUTH_URL` - Base URL for auth
- OAuth provider credentials (optional)

### Development Workflow

1. Make schema changes in `src/db/schema/`
2. Run `pnpm db:generate` to create migration
3. Run `pnpm db:migrate` to apply changes
4. Use `pnpm db:studio` to inspect database
5. Test endpoints with session cookie from auth endpoints