# PinPoint Server

> Backend API for the PinPoint visual website feedback platform.
> Built with Express.js, PostgreSQL, Sequelize, Redis, and Socket.io.

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Node.js 22 (ESM) |
| Framework | Express.js 5 |
| Database | PostgreSQL 16 |
| ORM | Sequelize 6 (with raw query support) |
| Cache / Queue | Redis + BullMQ |
| Validation | Zod |
| Auth | JWT + API Keys |
| Real-time | Socket.io |
| Email | Resend |
| File Storage | Cloudflare R2 |
| Screenshots | html-to-image (client) + Puppeteer (server) |

## Project Structure

```
PinPoint-server/
├── src/
│   ├── config/               # Database, Redis, CORS, env config
│   ├── database/
│   │   ├── migrations/       # Sequelize migrations
│   │   ├── models/           # Sequelize models + associations
│   │   └── seeders/          # Seed data
│   ├── modules/              # Feature modules (domain-driven)
│   │   ├── auth/             # Register, login, JWT
│   │   ├── workspace/        # Workspace CRUD + member management
│   │   ├── project/          # Project CRUD
│   │   ├── website/          # Website CRUD + widget config
│   │   ├── feedback/         # Feedback submission + management
│   │   ├── timeline/         # Activity timeline (per feedback)
│   │   ├── comment/          # Feedback comments
│   │   ├── notification/     # User notifications
│   │   ├── analytics/        # Dashboard stats + trends
│   │   ├── billing/          # Stripe subscriptions
│   │   └── webhook/          # External integrations
│   ├── common/
│   │   ├── errors/           # AppError classes + handler
│   │   ├── middleware/       # Auth, validation, rate limiting
│   │   ├── utils/            # Response builder, async handler
│   │   └── services/         # Cache, email, screenshot
│   ├── app.js                # Express app setup
│   └── server.js             # HTTP server start
├── tests/
├── Dockerfile
├── package.json
└── .env.example
```

## Prerequisites

- **Node.js** v22 or later
- **PostgreSQL** 14+ running locally or remotely
- **Redis** (for cache + queue + Socket.io pub/sub)
- **npm** or **yarn**

## Installation

### 1. Clone the repository

```bash
git clone <repo-url>
cd PinPoint-server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `4000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `pinpoint_dev` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | *(required)* |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `AUTH_SECRET` | JWT signing secret (min 32 chars) | *(required)* |
| `APP_URL` | Frontend URL (for CORS) | `http://localhost:3000` |
| `RESEND_API_KEY` | Resend API key (emails) | *(optional for dev)* |

### 4. Create the database

```bash
# Using PostgreSQL CLI
createdb pinpoint_dev

# Or via psql
psql -U postgres -c "CREATE DATABASE pinpoint_dev;"
```

### 5. Run migrations

```bash
npm run migrate
```

### 6. (Optional) Seed data

```bash
npm run seed
```

### 7. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will start on `http://localhost:4000`.

## API Endpoints

### Health Check

```
GET /health
```

Response: `{ "status": "ok", "timestamp": "..." }`

### Authentication

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/v1/auth/register` | Register new user | No |
| POST | `/v1/auth/login` | Login | No |
| GET | `/v1/auth/me` | Get current user | Yes |

**Register example:**

```bash
curl -X POST http://localhost:4000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"John Doe"}'
```

### Workspaces

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/workspaces` | List user workspaces |
| POST | `/v1/workspaces` | Create workspace |
| GET | `/v1/workspaces/:id` | Get workspace |
| PUT | `/v1/workspaces/:id` | Update workspace |
| DELETE | `/v1/workspaces/:id` | Delete workspace |
| GET | `/v1/workspaces/:id/members` | List members |
| POST | `/v1/workspaces/:id/members` | Invite member |
| PUT | `/v1/workspaces/:id/members/:userId` | Update member role |
| DELETE | `/v1/workspaces/:id/members/:userId` | Remove member |

### Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/projects/workspace/:workspaceId` | List projects |
| POST | `/v1/projects/workspace/:workspaceId` | Create project |
| GET | `/v1/projects/:id` | Get project |
| PUT | `/v1/projects/:id` | Update project |
| DELETE | `/v1/projects/:id` | Delete project |

### Websites

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/websites/project/:projectId` | List websites |
| POST | `/v1/websites/project/:projectId` | Add website |
| GET | `/v1/websites/:id` | Get website |
| PUT | `/v1/websites/:id` | Update website |
| DELETE | `/v1/websites/:id` | Delete website |

### Feedback

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/v1/feedback/widget/:projectId/feedback` | Submit feedback from widget | No (widget) |
| GET | `/v1/feedback/widget/:projectId/config` | Get widget config for project | Yes |
| GET | `/v1/feedback/workspace/:workspaceId` | List feedback across entire workspace (paginated, filterable) | Yes |
| GET | `/v1/feedback/website/:websiteId` | List feedback for a website | Yes |
| GET | `/v1/feedback/:id` | Get feedback detail | Yes |
| PUT | `/v1/feedback/:id` | Update feedback | Yes |
| DELETE | `/v1/feedback/:id` | Delete feedback | Yes |

### Timeline & Comments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/timeline/feedback/:feedbackId` | Get activity timeline |
| GET | `/v1/comments/feedback/:feedbackId` | List comments |
| POST | `/v1/comments/feedback/:feedbackId` | Add comment |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/analytics/overview/:workspaceId` | Dashboard stats |
| GET | `/v1/analytics/trends/:workspaceId` | Feedback trends |
| GET | `/v1/analytics/activity/:workspaceId` | Recent activity |

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/notifications` | List notifications |
| PATCH | `/v1/notifications/:id/read` | Mark as read |
| PATCH | `/v1/notifications/read-all` | Mark all as read |

## Widget Endpoint

The widget endpoint is designed for **unauthenticated submissions** from the feedback widget:

```bash
curl -X POST http://localhost:4000/v1/feedback/widget/{projectId}/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "The header overlaps the logo",
    "pageUrl": "https://example.com/pricing",
    "coordinates": { "x": 150, "y": 42, "element": ".header" },
    "metadata": {
      "browser": "Chrome 125",
      "os": "macOS",
      "screenResolution": "1920x1080",
      "viewport": "1440x900",
      "deviceType": "desktop"
    }
  }'
```

## Filtering & Pagination

List endpoints support:

```
?page=1&limit=25
&status=open,in_progress
&priority=critical,high
&assigneeId=uuid
&search=header+bug
&tags=bug,design
&date_from=2026-01-01&date_to=2026-06-01
```

## Standard API Response Format

**Success:**

```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 142,
    "totalPages": 6
  }
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [{ "field": "email", "message": "Invalid email" }]
  }
}
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `AUTHENTICATION_ERROR` | 401 | Missing/invalid auth |
| `AUTHORIZATION_ERROR` | 403 | Insufficient role |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource |
| `RATE_LIMIT_ERROR` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected error |

## Database Management

```bash
# Run all pending migrations
npm run migrate

# Undo last migration
npm run migrate:undo

# Run all seeders
npm run seed

# Undo all seeders
npm run seed:undo
```

## Real-time Events (Socket.io)

The server uses Socket.io for real-time updates.

**Client connection:**

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:4000');

// Join a feedback room (for timeline updates)
socket.emit('join:feedback', feedbackId);

// Leave a feedback room
socket.emit('leave:feedback', feedbackId);

// Listen for new activity
socket.on('activity:new', (activity) => {
  console.log('New activity:', activity);
});
```

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## Docker

```bash
# Build image
docker build -t pinpoint-server .

# Run container
docker run -p 4000:4000 --env-file .env pinpoint-server
```

## Common Issues

### "Missing required environment variables"
Copy `.env.example` to `.env` and fill in all required values.

### "ECONNREFUSED :6379"
Redis is not running. Start it with `redis-server` or update `REDIS_URL`.

### "Cannot find module 'pino-pretty'"
This is a dev dependency. Install it: `npm install -D pino-pretty`.

---

## Related

- [PinPoint Client](../PinPoint-client) — Frontend Next.js application
- [PLAN.md](../PLAN.md) — Full product plan and architecture
