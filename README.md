# F1 Review Site Backend

A modern backend API built with Hono, PostgreSQL, Drizzle ORM, and better-auth for authentication.

## 🚀 Features

- **Hono** - Ultra-fast web framework
- **PostgreSQL** - Robust relational database
- **Drizzle ORM** - Type-safe database queries
- **Better Auth** - Modern authentication system
- **TypeScript** - Full type safety
- **CORS** enabled
- Email/password authentication
- OAuth providers support (GitHub, Google)

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- pnpm (or npm/yarn)

## 🛠️ Setup

### 1. Clone and Install Dependencies

```bash
pnpm install
```

### 2. Set up Environment Variables

Copy the example environment file and update with your values:

```bash
cp env.example .env
```

Update `.env` with your database credentials and auth configuration:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/your_database_name

# Server
PORT=3000

# Better Auth (generate secret with: openssl rand -base64 32)
BETTER_AUTH_SECRET=your-generated-secret-key
BETTER_AUTH_URL=http://localhost:3000

# Optional: OAuth providers
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 3. Database Setup

Create your PostgreSQL database if it doesn't exist:

```bash
createdb your_database_name
```

Generate and run database migrations:

```bash
# Generate migration files from schema
pnpm db:generate

# Run migrations
pnpm db:migrate

# Or push schema directly (for development)
pnpm db:push
```

### 4. Start Development Server

```bash
pnpm dev
```

The server will start at `http://localhost:3000`

## 📚 API Endpoints

### Authentication

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/signin` - Login user
- `POST /api/auth/signout` - Logout user
- `GET /api/auth/session` - Get current session
- `GET /api/auth/user` - Get current user

### Example Endpoints

- `GET /` - API welcome message
- `GET /health` - Health check endpoint
- `GET /api/users/:id` - Get user profile (protected)

## 🗄️ Database Management

### Drizzle Studio (Database GUI)

```bash
pnpm db:studio
```

Opens Drizzle Studio at `https://local.drizzle.studio`

### Migration Commands

```bash
# Generate new migration
pnpm db:generate

# Run migrations
pnpm db:migrate

# Push schema changes (development)
pnpm db:push
```

## 🔐 Authentication Usage

### Register a New User

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "securepassword", "name": "John Doe"}'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "securepassword"}'
```

### Protected Route Example

```bash
# First login to get session cookie
# Then use the cookie for protected routes
curl http://localhost:3000/api/races \
  -H "Cookie: your-session-cookie"
```

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── index.ts          # Main server file
│   ├── auth/
│   │   └── index.ts      # Better-auth configuration
│   ├── config/
│   │   └── env.ts        # Environment configuration
│   └── db/
│       ├── index.ts      # Database connection
│       ├── schema.ts     # Drizzle schema definitions
│       └── migrate.ts    # Migration runner
├── drizzle/              # Generated migrations
├── package.json
├── tsconfig.json
├── drizzle.config.ts     # Drizzle configuration
└── env.example           # Example environment variables
```

## 🚀 Production Build

```bash
# Build TypeScript
pnpm build

# Run production server
pnpm start
```

## 🔧 Development Tips

1. **Hot Reload**: The dev server automatically restarts on file changes
2. **Type Safety**: Drizzle provides full TypeScript support for database queries
3. **Database Changes**: After modifying `schema.ts`, run `pnpm db:generate` and `pnpm db:migrate`
4. **Auth Testing**: Use tools like Postman or Thunder Client for testing auth endpoints

## 📝 License

MIT

```

```

open http://localhost:3000

```

```
