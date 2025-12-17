# DocRoom Docker Strategy

This document outlines the Docker deployment strategy for DocRoom (Papermark self-hosted).

## Overview

The goal is to create a production-ready Docker setup that:
- Builds a single Docker image that can run in multiple modes (app/worker)
- Handles Next.js runtime environment variables correctly
- Manages database migrations safely
- Integrates with the existing docker-compose stack (postgres, redis, gotenberg)
- Includes ffmpeg for video processing

---

## Architecture

### Single Image, Multiple Roles

We use a **single Docker image** that can operate in different modes based on the `APP_ROLE` environment variable:

| Role | Command | Purpose |
|------|---------|---------|
| `app` | `node server.js` | Next.js web application |
| `worker` | `node worker.js` | BullMQ background job workers |
| `migrate` | `prisma migrate deploy` | Run database migrations (one-off) |

This approach:
- Simplifies CI/CD (build once, deploy multiple roles)
- Ensures consistency between app and worker code
- Reduces image storage requirements

### Services Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   postgres   │  │    redis     │  │      gotenberg       │  │
│  │   :5432      │  │    :6379     │  │       :3001          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │               │
│         └────────┬────────┴──────────────────────┘               │
│                  │                                               │
│         ┌────────▼────────┐                                      │
│         │    docroom      │                                      │
│         │  (APP_ROLE=app) │◄──── Port 3000                      │
│         │                 │                                      │
│         └────────┬────────┘                                      │
│                  │                                               │
│         ┌────────▼────────┐                                      │
│         │  docroom-worker │                                      │
│         │(APP_ROLE=worker)│                                      │
│         └─────────────────┘                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables Strategy

### The Problem with Next.js

Next.js has two types of environment variables:
- **Server-side only**: Available at runtime, not exposed to browser
- **`NEXT_PUBLIC_*`**: Baked into the JavaScript bundle at **build time**

For Docker deployments, we need `NEXT_PUBLIC_*` variables to be configurable at **runtime**, not build time.

### Solution: Runtime Injection

We use a multi-step approach:

#### 1. Build with Placeholders
During Docker build, we use placeholder values for `NEXT_PUBLIC_*` variables:
```dockerfile
ARG NEXT_PUBLIC_BASE_URL="__NEXT_PUBLIC_BASE_URL__"
ARG NEXT_PUBLIC_MARKETING_URL="__NEXT_PUBLIC_MARKETING_URL__"
# ... etc
```

#### 2. Runtime Replacement
The entrypoint script replaces placeholders with actual environment values:
```bash
# Find all JS files and replace placeholders
find /app/.next -type f -name "*.js" -exec sed -i \
  "s|__NEXT_PUBLIC_BASE_URL__|${NEXT_PUBLIC_BASE_URL}|g" {} +
```

#### 3. Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_BASE_URL` | Application base URL | `https://docs.example.com` |
| `NEXT_PUBLIC_MARKETING_URL` | Marketing site URL | `https://example.com` |
| `NEXT_PUBLIC_APP_BASE_HOST` | App host for subdomain handling | `docs.example.com` |
| `NEXT_PUBLIC_APP_DOMAIN` | Default link domain | `docs.example.com` |
| `NEXT_PUBLIC_SELFHOSTED` | Enable self-hosted mode | `1` |
| `NEXT_PUBLIC_UPLOAD_TRANSPORT` | Storage type (`vercel` or `s3`) | `s3` |

---

## Dockerfile Strategy

### Multi-Stage Build

```
Stage 1: deps      - Install all dependencies
Stage 2: builder   - Build Next.js application
Stage 3: runner    - Production runtime (minimal)
```

### Key Components

#### Base Image
- Use `node:20-slim` for production (smaller image)
- Install system dependencies: `ffmpeg`, `openssl`, `libc6`

#### Build Stage
```dockerfile
FROM node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build with placeholder env vars
ARG NEXT_PUBLIC_BASE_URL="__NEXT_PUBLIC_BASE_URL__"
# ... more placeholders

RUN npm run build
```

#### Production Stage
```dockerfile
FROM node:20-slim AS runner

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

---

## Migration Strategy

### Safe Migration Approach

Database migrations must run **before** the application starts, but we need to handle:
1. Multiple container replicas trying to migrate simultaneously
2. Workers waiting for migrations to complete
3. Rollback scenarios

### Implementation

#### App Container (Runs Migrations)
```bash
# In entrypoint.sh for APP_ROLE=app
echo "Running database migrations..."
npx prisma migrate deploy

# Seed if needed (first run)
if [ "$RUN_SEED" = "true" ]; then
  npx prisma db seed
fi

echo "Starting application..."
exec node server.js
```

#### Worker Container (Waits for App)
```bash
# In entrypoint.sh for APP_ROLE=worker
echo "Waiting for database to be ready..."
until npx prisma db execute --stdin <<< "SELECT 1" 2>/dev/null; do
  echo "Database not ready, waiting..."
  sleep 2
done

echo "Starting worker..."
exec node worker.js
```

### Docker Compose Dependencies
```yaml
docroom-worker:
  depends_on:
    docroom:
      condition: service_healthy
```

---

## State Persistence

### Persistent Data Locations

| Data Type | Storage | Notes |
|-----------|---------|-------|
| Database | PostgreSQL volume | `postgres_data:/var/lib/postgresql/data` |
| Job queues | Redis volume | `redis_data:/data` |
| Uploaded files | S3/Object storage | External to Docker |
| Session data | PostgreSQL | Via NextAuth |

### Volume Configuration
```yaml
volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

### File Storage

For self-hosted deployments, configure S3-compatible storage:
```env
NEXT_PUBLIC_UPLOAD_TRANSPORT=s3
NEXT_PRIVATE_UPLOAD_BUCKET=docroom-files
NEXT_PRIVATE_UPLOAD_REGION=us-east-1
NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID=xxx
NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY=xxx
NEXT_PRIVATE_UPLOAD_ENDPOINT=https://s3.example.com  # For MinIO/etc
```

---

## Docker Compose Structure

### Complete Stack

```yaml
version: '3.8'

services:
  # ===================
  # Database
  # ===================
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: docroom
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: docroom
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U docroom"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ===================
  # Cache & Queue
  # ===================
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ===================
  # Document Conversion
  # ===================
  gotenberg:
    image: gotenberg/gotenberg:8
    command:
      - "gotenberg"
      - "--api-timeout=300s"
      - "--libreoffice-restart-after=10"

  # ===================
  # Application
  # ===================
  docroom:
    image: docroom:latest
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      APP_ROLE: app
      NODE_ENV: production
      # Database
      POSTGRES_PRISMA_URL: postgresql://docroom:${POSTGRES_PASSWORD}@postgres:5432/docroom?schema=public
      POSTGRES_PRISMA_URL_NON_POOLING: postgresql://docroom:${POSTGRES_PASSWORD}@postgres:5432/docroom?schema=public
      # Redis
      REDIS_URL: redis://redis:6379
      # Services
      NEXT_PRIVATE_CONVERSION_BASE_URL: http://gotenberg:3000
      # App URLs (runtime injected)
      NEXT_PUBLIC_BASE_URL: ${NEXT_PUBLIC_BASE_URL}
      NEXT_PUBLIC_MARKETING_URL: ${NEXT_PUBLIC_MARKETING_URL}
      NEXT_PUBLIC_SELFHOSTED: "1"
      # ... other env vars
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ===================
  # Background Workers
  # ===================
  docroom-worker:
    image: docroom:latest
    environment:
      APP_ROLE: worker
      NODE_ENV: production
      # Same env vars as app...
    depends_on:
      docroom:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
```

---

## Entrypoint Script

### Full Implementation

```bash
#!/bin/bash
set -e

# ===========================================
# Runtime Environment Variable Injection
# ===========================================
echo "Injecting runtime environment variables..."

# List of NEXT_PUBLIC_ variables to inject
NEXT_PUBLIC_VARS=(
  "NEXT_PUBLIC_BASE_URL"
  "NEXT_PUBLIC_MARKETING_URL"
  "NEXT_PUBLIC_APP_BASE_HOST"
  "NEXT_PUBLIC_APP_DOMAIN"
  "NEXT_PUBLIC_SELFHOSTED"
  "NEXT_PUBLIC_UPLOAD_TRANSPORT"
  "NEXT_PUBLIC_DISABLE_SIGNUP"
  "NEXT_PUBLIC_WEBHOOK_BASE_URL"
  "NEXT_PUBLIC_WEBHOOK_BASE_HOST"
)

# Replace placeholders in built JS files
for VAR_NAME in "${NEXT_PUBLIC_VARS[@]}"; do
  VAR_VALUE="${!VAR_NAME}"
  if [ -n "$VAR_VALUE" ]; then
    echo "  Injecting $VAR_NAME"
    find /app/.next -type f \( -name "*.js" -o -name "*.json" \) -exec \
      sed -i "s|__${VAR_NAME}__|${VAR_VALUE}|g" {} +
  fi
done

# ===========================================
# Role-based Startup
# ===========================================
APP_ROLE="${APP_ROLE:-app}"

case "$APP_ROLE" in
  app)
    echo "Starting as APPLICATION..."

    # Run migrations
    echo "Running database migrations..."
    npx prisma migrate deploy

    # Optional: Run seed on first start
    if [ "$RUN_SEED" = "true" ]; then
      echo "Running database seed..."
      npx prisma db seed || true
    fi

    echo "Starting Next.js server..."
    exec node server.js
    ;;

  worker)
    echo "Starting as WORKER..."

    # Wait for database connection
    echo "Waiting for database..."
    MAX_RETRIES=30
    RETRY_COUNT=0
    until npx prisma db execute --stdin <<< "SELECT 1" 2>/dev/null; do
      RETRY_COUNT=$((RETRY_COUNT + 1))
      if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "Database connection timeout!"
        exit 1
      fi
      echo "  Attempt $RETRY_COUNT/$MAX_RETRIES - waiting..."
      sleep 2
    done

    echo "Starting BullMQ workers..."
    exec node worker.js
    ;;

  migrate)
    echo "Running migrations only..."
    npx prisma migrate deploy
    echo "Migrations complete!"
    exit 0
    ;;

  seed)
    echo "Running database seed..."
    npx prisma db seed
    echo "Seed complete!"
    exit 0
    ;;

  *)
    echo "Unknown APP_ROLE: $APP_ROLE"
    echo "Valid roles: app, worker, migrate, seed"
    exit 1
    ;;
esac
```

---

## Build & Deploy Commands

### Building the Image
```bash
# Build the Docker image
docker build -t docroom:latest .

# Or with specific tag
docker build -t docroom:v1.0.0 .
```

### Running with Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f docroom docroom-worker

# Run migrations manually
docker-compose run --rm docroom npx prisma migrate deploy

# Run seed
docker-compose run --rm -e RUN_SEED=true docroom

# Rebuild and restart
docker-compose up -d --build
```

### Scaling Workers
```bash
# Scale workers horizontally
docker-compose up -d --scale docroom-worker=3
```

---

## Health Checks

### Application Health Endpoint

Create `/pages/api/health.ts`:
```typescript
export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}
```

### Docker Health Check
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

---

## Security Considerations

### Secrets Management
- Never commit `.env` files with real secrets
- Use Docker secrets or external secret management (Vault, AWS Secrets Manager)
- Rotate secrets regularly

### Network Security
```yaml
services:
  postgres:
    # Don't expose to host network
    expose:
      - "5432"
    # Only accessible within Docker network
```

### File Permissions
```dockerfile
# Run as non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs
```

---

## Troubleshooting

### Common Issues

#### 1. Environment variables not applied
- Check if placeholders are being replaced in entrypoint
- Verify variable names match exactly
- Check logs: `docker-compose logs docroom | grep "Injecting"`

#### 2. Database connection fails
- Ensure postgres is healthy: `docker-compose ps`
- Check connection string format
- Verify network connectivity: `docker-compose exec docroom ping postgres`

#### 3. Worker not processing jobs
- Check Redis connection: `docker-compose exec redis redis-cli ping`
- View worker logs: `docker-compose logs -f docroom-worker`
- Ensure `REDIS_URL` is set correctly

#### 4. File uploads failing
- Verify S3 credentials and bucket permissions
- Check `NEXT_PUBLIC_UPLOAD_TRANSPORT` is set to `s3`
- Ensure bucket CORS is configured for your domain

### Debug Mode
```bash
# Start with debug logging
docker-compose run --rm -e DEBUG=* docroom
```

---

## Implementation Checklist

- [ ] Create `Dockerfile` with multi-stage build
- [ ] Create `docker/entrypoint.sh` script
- [ ] Create `docker-compose.yml` for full stack
- [ ] Create `docker-compose.override.yml` for development
- [ ] Add health check endpoint (`/api/health`)
- [ ] Create `.env.docker.example` with all required variables
- [ ] Test build process
- [ ] Test migration flow
- [ ] Test worker startup
- [ ] Test runtime environment injection
- [ ] Document any gotchas

---

## Next Steps

1. **Create the Dockerfile** following the multi-stage build pattern
2. **Create the entrypoint script** with environment injection
3. **Update docker-compose.yml** to use the new image
4. **Test the complete stack** locally
5. **Document deployment process** for production
