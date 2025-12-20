# =============================================================================
# DocRoom Dockerfile
# Multi-stage build for Next.js app with BullMQ workers
# Optimized for smaller image size (~2GB reduction from devDependencies pruning)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:22-slim AS deps

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    openssl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:22-slim AS builder

WORKDIR /app

# Install openssl for prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build-time environment variables with placeholders for runtime injection
# These will be replaced by the entrypoint script at container start
ARG NEXT_PUBLIC_BASE_URL="__NEXT_PUBLIC_BASE_URL__"
ARG NEXT_PUBLIC_MARKETING_URL="__NEXT_PUBLIC_MARKETING_URL__"
ARG NEXT_PUBLIC_APP_BASE_HOST="__NEXT_PUBLIC_APP_BASE_HOST__"
ARG NEXT_PUBLIC_APP_DOMAIN="__NEXT_PUBLIC_APP_DOMAIN__"
ARG NEXT_PUBLIC_SELFHOSTED="1"
# IMPORTANT: Set to "s3" directly - this is used in server-side conditionals
# that get evaluated at build time. Docker deployments always use S3.
ARG NEXT_PUBLIC_UPLOAD_TRANSPORT="s3"
ARG NEXT_PUBLIC_DISABLE_SIGNUP="__NEXT_PUBLIC_DISABLE_SIGNUP__"
ARG NEXT_PUBLIC_WEBHOOK_BASE_URL="__NEXT_PUBLIC_WEBHOOK_BASE_URL__"
ARG NEXT_PUBLIC_WEBHOOK_BASE_HOST="__NEXT_PUBLIC_WEBHOOK_BASE_HOST__"

ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_MARKETING_URL=$NEXT_PUBLIC_MARKETING_URL
ENV NEXT_PUBLIC_APP_BASE_HOST=$NEXT_PUBLIC_APP_BASE_HOST
ENV NEXT_PUBLIC_APP_DOMAIN=$NEXT_PUBLIC_APP_DOMAIN
ENV NEXT_PUBLIC_SELFHOSTED=$NEXT_PUBLIC_SELFHOSTED
ENV NEXT_PUBLIC_UPLOAD_TRANSPORT=$NEXT_PUBLIC_UPLOAD_TRANSPORT
ENV NEXT_PUBLIC_DISABLE_SIGNUP=$NEXT_PUBLIC_DISABLE_SIGNUP
ENV NEXT_PUBLIC_WEBHOOK_BASE_URL=$NEXT_PUBLIC_WEBHOOK_BASE_URL
ENV NEXT_PUBLIC_WEBHOOK_BASE_HOST=$NEXT_PUBLIC_WEBHOOK_BASE_HOST

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Pruner - Remove devDependencies to reduce image size
# -----------------------------------------------------------------------------
FROM node:22-slim AS pruner

WORKDIR /app

# Copy package files and node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules

# Prune devDependencies (removes ~500MB+ of @types/*, typescript, prettier, etc.)
RUN npm prune --production

# -----------------------------------------------------------------------------
# Stage 4: Production Runner
# -----------------------------------------------------------------------------
FROM node:22-slim AS runner

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    openssl \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built Next.js standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy geoip-lite data files to where Next.js expects them
COPY --from=deps /app/node_modules/geoip-lite/data ./.next/server/data

# Copy Prisma schema and migrations for runtime
COPY --from=builder /app/prisma ./prisma

# Copy PRUNED node_modules (production dependencies only, ~500MB smaller)
COPY --from=pruner /app/node_modules ./node_modules

# Copy worker source files
COPY --from=builder /app/workers ./workers
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/ee ./ee
COPY --from=builder /app/components/emails ./components/emails
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json

# Copy entrypoint script with explicit permissions
COPY --chmod=755 docker/entrypoint.sh /entrypoint.sh

# Set ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Default environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV APP_ROLE="app"

ENTRYPOINT ["/entrypoint.sh"]
