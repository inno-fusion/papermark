# DocRoom (Papermark Fork) - Complete Self-Hosting Guide

**Version:** 0.22.0
**Fork:** 0xMetaLabs
**Base:** Papermark (commit 01c78129)
**Total Commits:** 14
**Lines Changed:** ~15,000+ additions, ~12,000+ deletions

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Complete Change Log](#2-complete-change-log)
3. [External Dependencies Removed](#3-external-dependencies-removed)
4. [New Systems Implemented](#4-new-systems-implemented)
5. [Code Deep Dive](#5-code-deep-dive)
6. [Docker Architecture](#6-docker-architecture)
7. [Configuration Reference](#7-configuration-reference)
8. [Deployment Guide](#8-deployment-guide)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Executive Summary

This fork completely transforms Papermark from a SaaS application dependent on multiple cloud services into a **fully self-hosted solution**. Every external dependency has been replaced with local alternatives that run in Docker containers.

### Before vs After

| Component | Original (SaaS) | Self-Hosted |
|-----------|-----------------|-------------|
| Background Jobs | Trigger.dev Cloud | BullMQ + Redis |
| Analytics/Time-series | Tinybird | PostgreSQL Tables |
| Webhook Delivery | QStash (Upstash) | BullMQ Worker |
| Rate Limiting | Upstash Redis REST | Local Redis (ioredis) |
| Email | Resend only | SMTP or Resend |
| Authentication | Hanko Passkeys | Removed (Email/OAuth only) |
| File Storage | Vercel Blob | S3/MinIO |
| Plan Limits | Plan-based | Unlimited |

### Key Metrics

- **11 BullMQ workers** created to replace Trigger.dev
- **5 new analytics tables** in PostgreSQL (replacing Tinybird)
- **~600 lines** unified Redis wrapper (supporting ioredis + Upstash)
- **~400 lines** unified email provider (supporting SMTP + Resend)
- **152 line** optimized multi-stage Dockerfile
- **175 line** smart entrypoint script with auto-seeding

---

## 2. Complete Change Log

### Commit 1: e4bcbda6 - Foundation & Documentation
**Files:** 7 | **+5,564 lines**

Created initial documentation and basic docker-compose with PostgreSQL:
- `Claude Docs/BULLMQ_MIGRATION.md` - Migration planning document
- `Claude Docs/DEPENDENCIES_ANALYSIS.md` - Full dependency audit
- `Claude Docs/PLAN_SELF_HOSTING.md` - Self-hosting roadmap
- `docker-compose.yml` - Initial PostgreSQL service

---

### Commit 2: 017d638b - BullMQ Migration & Hanko Removal
**Files:** 74 | **+5,088 / -7,183 lines**

This is the largest and most critical commit. It completely replaces Trigger.dev with BullMQ and removes Hanko passkey authentication.

#### A. Trigger.dev Removal

**Deleted Files:**
```
lib/trigger/pdf-to-image-route.ts
lib/trigger/convert-files.ts
lib/trigger/optimize-video-files.ts
lib/trigger/export-visits.ts
lib/trigger/send-scheduled-email.ts
lib/trigger/dataroom-change-notification.ts
lib/trigger/cleanup-expired-exports.ts
ee/features/conversations/lib/trigger/conversation-message-notification.ts
ee/features/billing/cancellation/lib/trigger/pause-resume-notification.ts
ee/features/billing/cancellation/lib/trigger/unpause-task.ts
trigger.config.ts
lib/utils/generate-trigger-auth-token.ts
lib/utils/generate-trigger-status.ts
```

**New BullMQ System:**
```
lib/queues/
├── connection.ts          # Redis connection factory
├── helpers.ts             # Job helper functions
├── index.ts               # Queue definitions (11 queues)
├── types.ts               # TypeScript interfaces
└── workers/
    ├── index.ts           # Worker exports
    ├── pdf-to-image.worker.ts
    ├── file-conversion.worker.ts
    ├── video-optimization.worker.ts
    ├── export-visits.worker.ts
    ├── scheduled-email.worker.ts
    ├── notification.worker.ts
    ├── billing.worker.ts
    ├── cleanup.worker.ts
    └── webhook-delivery.worker.ts

workers/
└── index.ts               # Worker process entry point
```

#### B. Queue Definitions (`lib/queues/index.ts`)

```typescript
// 11 Queues Created:
pdfToImageQueue        // PDF → page images
fileConversionQueue    // Office/CAD/Keynote → PDF
videoOptimizationQueue // Video transcoding
exportQueue            // CSV/Excel exports
emailQueue             // Scheduled emails
dataroomNotificationQueue
conversationNotificationQueue
pauseResumeQueue       // Billing pause notifications
automaticUnpauseQueue  // Auto unpause subscriptions
cleanupQueue           // Cron cleanup jobs
webhookDeliveryQueue   // Webhook delivery (replaces QStash)
```

#### C. Process Document Changes

The core document processing was rewritten:

**Before (Trigger.dev):**
```typescript
import { convertPdfToImageRoute } from "@/lib/trigger/pdf-to-image-route";

await convertPdfToImageRoute.trigger({
  documentId,
  documentVersionId,
  teamId,
}, {
  idempotencyKey: `${teamId}-${documentVersionId}`,
  queue: conversionQueue(teamPlan),
  concurrencyKey: teamId,
});
```

**After (BullMQ):**
```typescript
import { pdfToImageQueue, addJobWithTags } from "@/lib/queues";

await addJobWithTags(pdfToImageQueue, "pdf-to-image", {
  documentId,
  documentVersionId,
  teamId,
}, {
  jobId: `${teamId}-${documentVersionId}-pdf`,
  tags: [`team_${teamId}`, `document_${documentId}`],
});
```

#### D. Hanko Passkey Removal

**Deleted Files:**
```
lib/hanko.ts
lib/api/auth/passkey.ts
lib/swr/use-passkeys.ts
pages/account/security.tsx
pages/api/account/passkeys.ts
pages/api/passkeys/register.ts
components/shared/icons/passkey.tsx
```

**Changes to Login Page (`app/(auth)/login/page-client.tsx`):**
```typescript
// Removed:
import { signInWithPasskey } from "@teamhanko/passkeys-next-auth-provider/client";
import Passkey from "@/components/shared/icons/passkey";

// Changed auth methods:
const authMethods = ["google", "email", "linkedin"] as const;
// Previously: ["google", "email", "linkedin", "passkey"]

// Removed entire passkey button (27 lines)
```

**Changes to NextAuth (`pages/api/auth/[...nextauth].ts`):**
```typescript
// Removed:
import PasskeyProvider from "@teamhanko/passkeys-next-auth-provider";
import hanko from "@/lib/hanko";

// Removed from providers array:
PasskeyProvider({
  tenant: hanko,
  async authorize({ userId }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return user;
  },
}),
```

#### E. QStash Made Optional

**Changes to `lib/cron/index.ts`:**
```typescript
// Before: Direct QStash client initialization
export const qstash = new Client({
  token: process.env.QSTASH_TOKEN || "",
});

// After: Lazy-loaded with stub for BullMQ migration
export const qstash = {
  publishJSON: async () => {
    throw new Error(
      "QStash is no longer used for webhook delivery. " +
      "Webhooks are now delivered via BullMQ workers."
    );
  },
};
```

**Changes to `lib/cron/verify-qstash.ts`:**
```typescript
// Added skip conditions:
if (process.env.VERCEL !== "1") {
  return; // Skip in self-hosted
}

if (!process.env.QSTASH_CURRENT_SIGNING_KEY) {
  return; // Skip if not configured
}
```

#### F. Webhook Delivery via BullMQ

**Changes to `lib/webhook/send-webhooks.ts`:**
```typescript
// Before: QStash
const response = await qstash.publishJSON({
  url: webhook.url,
  body: payload,
  headers: { "X-Papermark-Signature": signature },
  callback: callbackUrl.href,
  failureCallback: callbackUrl.href,
});

// After: BullMQ
const job = await webhookDeliveryQueue.add(
  `webhook-${payload.event}-${payload.id}`,
  {
    webhookId: webhook.pId,
    webhookUrl: webhook.url,
    webhookSecret: webhook.secret,
    eventId: payload.id,
    event: payload.event,
    payload: payload,
  },
  { jobId: `${payload.id}-${webhook.pId}` }
);
```

#### G. Progress Tracking System

New job progress API:
```typescript
// lib/progress/index.ts
export type ProgressStatus = {
  state: "QUEUED" | "EXECUTING" | "COMPLETED" | "FAILED";
  progress: number;
  text: string;
};

// pages/api/jobs/progress.ts
// GET /api/jobs/progress?queue=pdf-to-image&jobId=xxx
```

#### H. Package.json Changes

```diff
- "@teamhanko/passkeys-next-auth-provider": "^0.3.1",
- "@trigger.dev/react-hooks": "^3.3.17",
- "@trigger.dev/sdk": "^3.3.17",
- "@trigger.dev/build": "^3.3.17",
+ "bullmq": "^5.66.0",
+ "ioredis": "^5.8.2",
+ "dotenv": "^17.2.3",
+ "concurrently": "^9.2.1",
+ "tsx": "^4.21.0",

scripts:
- "trigger:v3:dev": "npx trigger.dev@3 dev",
- "trigger:v3:deploy": "npx trigger.dev@3 deploy",
+ "workers": "tsx workers/index.ts",
+ "workers:dev": "tsx watch workers/index.ts",
+ "dev:all": "concurrently \"npm run dev\" \"npm run workers:dev\"",
```

#### I. Slack Client Made Safe

**Changes to `lib/integrations/slack/client.ts`:**
```typescript
// Before: Throws on missing config
constructor() {
  if (!this.clientId || !this.clientSecret) {
    throw new Error("SLACK_CLIENT_ID and SLACK_CLIENT_SECRET must be set");
  }
}

// After: Graceful handling
constructor() {
  this._isConfigured = !!(this.clientId && this.clientSecret);
}

get isConfigured(): boolean {
  return this._isConfigured;
}

private ensureConfigured(): void {
  if (!this._isConfigured) {
    throw new Error("Slack integration is not configured");
  }
}
```

#### J. File Access for Workers

**Changes to `lib/files/get-file.ts`:**
```typescript
// Added support for workers to access files via internal API
if (isServer && baseUrl) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.INTERNAL_API_KEY) {
    headers.Authorization = `Bearer ${process.env.INTERNAL_API_KEY}`;
  }
  return fetchPresignedUrl(`${baseUrl}/api/file/s3/get-presigned-get-url`, headers, key);
}
```

---

### Commit 3: 3652e638 - SMTP Email Support
**Files:** 8 | **+826 / -134 lines**

#### A. Unified Email Provider (`lib/email/provider.ts`)

Created 407-line email abstraction supporting both SMTP and Resend:

```typescript
type EmailProvider = "smtp" | "resend" | "none";

function getEmailProvider(): EmailProvider {
  // SMTP takes priority
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return "smtp";
  }
  if (process.env.RESEND_API_KEY) {
    return "resend";
  }
  return "none";
}

// SMTP via nodemailer
smtpTransport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: user && pass ? { user, pass } : undefined,
  tls: {
    rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
  },
});

// Graceful handling when not configured
if (config.provider === "none") {
  if (!hasLoggedNotConfigured) {
    console.warn("[Email] Email not configured...");
    hasLoggedNotConfigured = true;
  }
  return { id: `skipped-${nanoid()}`, skipped: true };
}
```

---

### Commit 4: 6b478720 - Redis Unification
**Files:** 29 | **+1,568 / -220 lines**

#### A. Unified Redis Wrapper (`lib/redis.ts`)

Created 659-line Redis abstraction supporting both ioredis and Upstash:

```typescript
type RedisProvider = "ioredis" | "upstash" | "none";

function getRedisProvider(): RedisProvider {
  if (process.env.REDIS_URL) return "ioredis";
  if (process.env.UPSTASH_REDIS_REST_URL) return "upstash";
  return "none";
}

// ioredis for self-hosting
ioredisClient = new Redis(url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

// Unified interface with 25+ methods
export interface UnifiedRedis {
  get, set, setex, del, incr, expire, ttl, exists,
  hget, hset, hincrby, hdel, hgetall,
  sadd, srem, smembers, sismember,
  lpush, rpush, lpop, rpop, lrange,
  zadd, zrem, zrange, zrangebyscore, zrevrange,
  keys, scan
}

// No-op client when not configured
return {
  get: async () => { logWarning(); return null; },
  set: async () => { logWarning(); return "OK"; },
  // ... graceful fallbacks
};
```

#### B. TUS Upload Locker (`lib/files/tus-redis-locker.ts`)

Rewrote for ioredis compatibility with in-memory fallback:

```typescript
// Supports both Redis and in-memory locking
constructor(options: RedisLockerOptions = {}) {
  this.redisClient = getLockerRedisClient();
  if (!this.redisClient) {
    console.warn("[TUS Locker] Using in-memory locking (single-process only).");
  }
}

newLock(id: string) {
  if (this.redisClient) {
    return new IoRedisLock(id, this.redisClient, this.timeout);
  }
  return new InMemoryLock(id, this.timeout);
}

// ioredis lock syntax
const lock = await this.redisClient.set(
  lockKey, "locked", "PX", this.timeout, "NX"
);
if (lock === "OK") { /* acquired */ }
```

---

### Commit 5: 8b8fde03 - Limitations Removed
**Files:** 58 | **+483 / -251 lines**

#### A. Self-Hosted Plan Limits (`ee/limits/constants.ts`)

```typescript
export const isSelfHosted = () => process.env.NEXT_PUBLIC_SELFHOSTED === "1";

export const SELF_HOSTED_PLAN_LIMITS: TPlanLimits = {
  users: 999999,
  links: null,           // unlimited
  documents: null,       // unlimited
  domains: 999999,
  datarooms: 999999,
  customDomainOnPro: true,
  customDomainInDataroom: true,
  advancedLinkControlsOnPro: true,
  watermarkOnBusiness: true,
  agreementOnBusiness: true,
};
```

#### B. Server-Side Limit Override (`ee/limits/server.ts`)

```typescript
export async function getLimits({ teamId }) {
  if (isSelfHosted()) {
    return {
      ...SELF_HOSTED_PLAN_LIMITS,
      links: Infinity,
      documents: Infinity,
      conversationsInDataroom: true,
      fileSizeLimits: {
        video: 10000,    // 10GB
        document: 10000, // 10GB
        maxFiles: 999999,
        maxPages: 999999,
      },
      usage: { documents: documentCount, links: linkCount, users: userCount },
    };
  }
  // ... regular plan logic
}
```

#### C. Client-Side Plan Hook (`lib/swr/use-billing.ts`)

```typescript
const selfHosted = isSelfHosted();

// Skip billing API in self-hosted mode
useSWR(!selfHosted && teamId ? `/api/teams/${teamId}/billing/plan` : null, fetcher);

if (selfHosted) {
  return {
    plan: "datarooms-premium",
    planName: "Self-Hosted",
    isTrial: false,
    isCustomer: true,
    isFree: false,
    isDatarooms: true,
    isDataroomsPlus: true,
    isDataroomsPremium: true,
    isSelfHosted: true,
    // All features enabled
  };
}
```

---

### Commit 6: 480f0ae2 - Rebranded as DocRoom
**Files:** 69 | **+405 / -761 lines**

#### A. Logo & Branding

**Changed files in `public/_static/`:**
- `papermark-logo.svg` → DocRoom logo
- `papermark-logo-light.svg` → DocRoom light logo
- `papermark-p.svg` → DocRoom icon
- `meta-image.png` → New meta image
- `favicon.ico` → New favicon

#### B. Sidebar (`components/sidebar/app-sidebar.tsx`)

```typescript
// Before: Text-based branding
<p className="text-2xl font-bold">
  <Link href="/dashboard">Papermark</Link>
</p>

// After: Image-based branding
<Link href="/dashboard" className="ml-2 flex items-center">
  <img src="/_static/papermark-logo.svg" alt="Logo" className="h-16 w-auto" />
  <img src="/_static/papermark-p.svg" alt="Logo" className="hidden h-12 w-auto group-data-[collapsible=icon]:block" />
</Link>
```

#### C. Email Templates

Updated 30+ email templates in `components/emails/`:
- Changed "Papermark" references to "DocRoom"
- Updated footer branding
- Changed support links

---

### Commit 7: 83b51ef6 - Docker Ready
**Files:** 20 | **+1,435 / -47 lines**

#### A. Multi-Stage Dockerfile (152 lines)

```dockerfile
# Stage 1: Dependencies
FROM node:22-slim AS deps
RUN apt-get install -y openssl python3 make g++
RUN npm ci

# Stage 2: Builder
FROM node:22-slim AS builder
RUN npx prisma generate
# Placeholder env vars for runtime injection
ARG NEXT_PUBLIC_BASE_URL="__NEXT_PUBLIC_BASE_URL__"
RUN npm run build

# Stage 3: Pruner - Remove devDependencies (~500MB savings)
FROM node:22-slim AS pruner
RUN npm prune --production

# Stage 4: Runner
FROM node:22-slim AS runner
RUN apt-get install -y ffmpeg openssl curl
# Copy standalone build
COPY --from=builder /app/.next/standalone ./
# Copy pruned node_modules
COPY --from=pruner /app/node_modules ./node_modules
# Copy worker files
COPY --from=builder /app/workers ./workers
COPY --from=builder /app/lib ./lib

USER nextjs
HEALTHCHECK CMD curl -f http://localhost:3000/api/health
ENTRYPOINT ["/entrypoint.sh"]
```

#### B. Smart Entrypoint Script (175 lines)

```bash
#!/bin/bash
# Runtime environment variable injection
for VAR_NAME in "${NEXT_PUBLIC_VARS[@]}"; do
    find /app/.next -type f -name "*.js" -exec \
        sed -i "s|__${VAR_NAME}__|${!VAR_NAME}|g" {} +
done

# Role-based startup
case "$APP_ROLE" in
    app)
        npx prisma migrate deploy
        # Smart auto-seed detection
        INTEGRATION_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"Integration\";")
        if [ "$INTEGRATION_COUNT" = "0" ]; then
            npx prisma db seed
        fi
        exec node server.js
        ;;
    worker)
        # Wait for database
        until npx prisma db execute --stdin <<< "SELECT 1"; do
            sleep 2
        done
        exec npx tsx workers/index.ts
        ;;
    migrate)
        npx prisma migrate deploy
        ;;
esac
```

#### C. Production Docker Compose

```yaml
services:
  postgres:
    image: postgres:16
    expose: ["5432"]  # Internal only
    volumes: [./data/postgres:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    expose: ["6379"]  # Internal only
    command: redis-server --appendonly yes

  gotenberg:
    image: gotenberg/gotenberg:8
    ports: ["3001:3000"]  # Exposed with basic auth
    command: ["gotenberg", "--api-enable-basic-auth=true"]

  docroom:
    build: .
    environment:
      APP_ROLE: app
      POSTGRES_PRISMA_URL: postgresql://...@postgres:5432/...
      REDIS_URL: redis://redis:6379
      NEXT_PRIVATE_CONVERSION_BASE_URL: http://gotenberg:3000
    ports: ["3000:3000"]
    depends_on: [postgres, redis]

  docroom-worker:
    image: docroom:latest
    environment:
      APP_ROLE: worker
      NEXT_PUBLIC_BASE_URL: http://docroom:3000  # Internal URL
    depends_on: [docroom, redis]

networks:
  docroom-network:
    driver: bridge
    enable_ipv6: true
```

---

### Commit 8: 5635925c - Support Email & Asset Upload
**Files:** 12 | **+190 / -19 lines**

#### A. Asset Presigned URL API

New API for uploading profile images and branding assets:

```typescript
// pages/api/file/s3/asset-presigned-url.ts
const uploadConfig = {
  profile: {
    allowedContentTypes: ["image/png", "image/jpg", "image/jpeg"],
    maximumSizeInBytes: 2 * 1024 * 1024, // 2MB
  },
  assets: {
    allowedContentTypes: ["image/png", "image/jpeg", "image/svg+xml", "image/ico"],
    maximumSizeInBytes: 5 * 1024 * 1024, // 5MB
  },
};
```

#### B. Support Email Configuration

Added `NEXT_PUBLIC_SUPPORT_EMAIL` environment variable.

---

### Commit 9: 7e777a5d - Next.js Config Refactor
**Files:** 2 | **+39 / -29 lines**

Conditional redirects/headers based on deployment environment.

---

### Commit 10: c50c4e5c - Branding Fixes
**Files:** 14 | **+473 / -282 lines**

#### A. Asset Serving API

```typescript
// pages/api/file/s3/serve-asset.ts
// Proxy for serving uploaded assets (logos, etc.)
```

#### B. Separate Docker Configs

- `docker-compose.yml` - Development (simplified)
- `docker-compose-prod.yml` - Production (full stack)

---

### Commit 11: 3ea79855 - Tinybird Base URL
**Files:** 9 | **+42 / -7 lines**

Added `TINYBIRD_BASE_URL` configuration for custom Tinybird deployments (preparation for PostgreSQL migration).

---

### Commit 12: dfdcabc5 - Tinybird to PostgreSQL Migration
**Files:** 62 | **+3,252 / -1,132 lines**

#### A. New Analytics Schema (`prisma/schema/analytics.prisma`)

```prisma
model PageView {
  id              String   @id @default(cuid())
  linkId          String
  documentId      String
  viewId          String
  dataroomId      String?
  versionNumber   Int      @default(1)
  time            BigInt
  duration        Int
  pageNumber      String
  country         String   @default("Unknown")
  city            String   @default("Unknown")
  browser         String   @default("Unknown")
  os              String   @default("Unknown")
  device          String   @default("Desktop")
  // ... 20+ fields

  @@index([documentId, time])
  @@index([viewId])
  @@map("page_views")
}

model VideoView { /* video playback events */ }
model ClickEvent { /* link clicks within documents */ }
model WebhookEvent { /* webhook delivery logs */ }
model LinkClickEvent { /* initial link clicks */ }
```

#### B. Analytics Queries (`lib/analytics/pipes.ts`)

Replaced 13 Tinybird pipe queries with Prisma:

```typescript
export const getTotalAvgPageDuration = createSafeQuery(
  async (params: { documentId, excludedLinkIds, excludedViewIds, since }) => {
    const result = await prisma.$queryRawUnsafe(`
      WITH DistinctDurations AS (
        SELECT "versionNumber", "pageNumber", "viewId", SUM(duration) AS distinct_duration
        FROM page_views
        WHERE "documentId" = $1 AND time >= $2
        GROUP BY "versionNumber", "pageNumber", "viewId"
      )
      SELECT "versionNumber", "pageNumber", AVG(distinct_duration)::float AS avg_duration
      FROM DistinctDurations
      GROUP BY "versionNumber", "pageNumber"
    `, params.documentId, BigInt(params.since));
    return result;
  },
  'get_total_average_page_duration'
);

export const getTotalDocumentDuration = createSafeQuery(
  async (params) => {
    const result = await prisma.pageView.aggregate({
      where: {
        documentId: params.documentId,
        time: { gte: BigInt(params.since) },
      },
      _sum: { duration: true },
    });
    return [{ sum_duration: result._sum.duration ?? 0 }];
  },
  'get_total_document_duration'
);
```

#### C. Data Ingestion (`lib/analytics/publish.ts`)

```typescript
export const publishPageView = createSafeIngest(
  async (data: any[]) => {
    await prisma.pageView.createMany({
      data: data.map(d => ({
        id: d.id,
        linkId: d.linkId,
        documentId: d.documentId,
        viewId: d.viewId,
        time: BigInt(d.time),
        duration: d.duration,
        pageNumber: d.pageNumber,
        country: d.country ?? 'Unknown',
        // ... map all fields
      })),
      skipDuplicates: true,
    });
  },
  'page_views'
);
```

#### D. Files Removed

```
lib/tinybird/
├── README.md
├── index.ts
├── pipes.ts (309 lines)
├── publish.ts (228 lines)
├── datasources/
│   ├── click_events.datasource
│   ├── page_views.datasource
│   ├── pm_click_events.datasource
│   ├── video_views.datasource
│   └── webhook_events.datasource
└── endpoints/
    ├── get_click_events_by_view.pipe
    ├── get_document_duration_per_viewer.pipe
    ├── get_page_duration_per_view.pipe
    ├── get_total_average_page_duration.pipe
    ├── get_total_dataroom_duration.pipe
    ├── get_total_document_duration.pipe
    ├── get_total_link_duration.pipe
    ├── get_total_viewer_duration.pipe
    ├── get_useragent_per_view.pipe
    ├── get_video_events_by_document.pipe
    ├── get_video_events_by_view.pipe
    └── get_webhook_events.pipe
```

---

### Commit 13: 49117456 - Final S3 Self-Hosted Version
**Files:** 3 | **+17 / -29 lines**

#### A. MinIO Compatibility (`lib/files/aws-client.ts`)

```typescript
export const getS3Client = (storageRegion?: string) => {
  return new S3Client({
    region: config.region || "us-east-1",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Required for MinIO and other S3-compatible services
    forcePathStyle: !!config.endpoint,
  });
};
```

This fix ensures that when using MinIO or other S3-compatible storage, the SDK uses path-style URLs (`http://minio:9000/bucket/key`) instead of virtual-hosted-style (`http://bucket.minio:9000/key`).

---

## 3. External Dependencies Removed

| Dependency | npm Package | Purpose | Replacement |
|------------|-------------|---------|-------------|
| Trigger.dev | `@trigger.dev/sdk` | Background jobs | BullMQ |
| Trigger.dev | `@trigger.dev/react-hooks` | Job status hooks | Custom hooks |
| Hanko | `@teamhanko/passkeys-next-auth-provider` | Passkey auth | Removed |
| Tinybird | (API) | Analytics | PostgreSQL |
| QStash | `@upstash/qstash` | Webhooks | BullMQ |
| Upstash Redis | `@upstash/redis` | Redis REST | ioredis (optional) |

---

## 4. New Systems Implemented

### 4.1 BullMQ Job System

**11 Workers:**
1. `pdf-to-image.worker.ts` - Convert PDF pages to images
2. `file-conversion.worker.ts` - Office/CAD/Keynote → PDF
3. `video-optimization.worker.ts` - Video transcoding with ffmpeg
4. `export-visits.worker.ts` - Generate CSV/Excel exports
5. `scheduled-email.worker.ts` - Send delayed emails
6. `notification.worker.ts` - Dataroom & conversation notifications
7. `billing.worker.ts` - Pause/resume & auto-unpause
8. `cleanup.worker.ts` - Cron cleanup jobs
9. `webhook-delivery.worker.ts` - Reliable webhook delivery

### 4.2 PostgreSQL Analytics

**5 New Tables:**
1. `page_views` - Document page view tracking
2. `video_views` - Video playback events
3. `click_events` - Link clicks within documents
4. `webhook_events` - Webhook delivery logs
5. `link_click_events` - Initial link clicks

### 4.3 Unified Abstractions

- **Email Provider** - SMTP (nodemailer) or Resend
- **Redis Client** - ioredis or Upstash REST
- **TUS Locker** - Redis or in-memory
- **S3 Client** - AWS S3 or MinIO (forcePathStyle)

---

## 5. Code Deep Dive

### 5.1 Worker Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      workers/index.ts                        │
├─────────────────────────────────────────────────────────────┤
│  import { createPdfToImageWorker, ... } from "lib/queues"   │
│                                                              │
│  const workers = [                                           │
│    createPdfToImageWorker(),      // concurrency: 5         │
│    createFileConversionWorker(),  // concurrency: 3         │
│    createVideoOptimizationWorker(),                         │
│    createExportVisitsWorker(),                              │
│    createScheduledEmailWorker(),                            │
│    createDataroomNotificationWorker(),                      │
│    createConversationNotificationWorker(),                  │
│    createPauseResumeWorker(),                               │
│    createAutomaticUnpauseWorker(),                          │
│    createCleanupWorker(),                                   │
│    createWebhookDeliveryWorker(),                           │
│  ];                                                          │
│                                                              │
│  scheduleCleanupJob();  // Cron scheduling                  │
│                                                              │
│  // Graceful shutdown                                        │
│  process.on("SIGTERM", () => workers.map(w => w.close()));  │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Document Processing Flow

```
Upload → API → Queue Job → Worker → Process → Update DB → Revalidate Cache

1. User uploads PDF to S3
2. API creates Document + DocumentVersion records
3. API adds job to pdfToImageQueue
4. Worker picks up job:
   a. Fetch PDF from S3 (via internal API)
   b. Call /api/mupdf/get-pages for page count
   c. For each page: /api/mupdf/convert-page
   d. Upload images to S3
   e. Create DocumentPage records
   f. Update DocumentVersion.hasPages = true
   g. Call /api/revalidate
```

### 5.3 Analytics Data Flow

```
View Event → recordPageView() → PostgreSQL → Query via pipes

1. User views document page
2. Frontend sends view data to /api/record_view
3. API calls publishPageView()
4. Data inserted into page_views table
5. Dashboard queries via getTotalAvgPageDuration(), etc.
```

---

## 6. Docker Architecture

### 6.1 Production Architecture

```
                            ┌─────────────────────────────┐
                            │      INTERNET / USERS       │
                            └──────────────┬──────────────┘
                                           │
                                           ▼
                            ┌─────────────────────────────┐
                            │      REVERSE PROXY          │
                            │    (Nginx / Traefik)        │
                            │      Port 443 / 80          │
                            │    ┌─────────────────┐      │
                            │    │  SSL Termination │      │
                            │    │  Load Balancing  │      │
                            │    └─────────────────┘      │
                            └──────────────┬──────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│      DOCROOM APP        │  │       MINIO (S3)        │  │      GOTENBERG          │
│      Port 3000          │  │     Port 9000/9001      │  │      Port 3001          │
│  ┌───────────────────┐  │  │  ┌───────────────────┐  │  │  ┌───────────────────┐  │
│  │    Next.js App    │  │  │  │  Object Storage   │  │  │  │  PDF Conversion   │  │
│  │   API Routes      │  │  │  │  Documents/Assets │  │  │  │  Office → PDF     │  │
│  │   SSR/SSG         │  │  │  │  Page Images      │  │  │  │  Basic Auth       │  │
│  └───────────────────┘  │  │  └───────────────────┘  │  │  └───────────────────┘  │
└───────────┬─────────────┘  └─────────────────────────┘  └─────────────────────────┘
            │
            │ Internal Docker Network (docroom-network)
            │
┌───────────┴─────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐    │
│   │     POSTGRESQL      │  │       REDIS         │  │    DOCROOM WORKER   │    │
│   │     Port 5432       │  │     Port 6379       │  │     (No Port)       │    │
│   │  ┌───────────────┐  │  │  ┌───────────────┐  │  │  ┌───────────────┐  │    │
│   │  │  Main DB      │  │  │  │  Job Queues   │  │  │  │  11 BullMQ    │  │    │
│   │  │  Analytics    │  │  │  │  Rate Limit   │  │  │  │  Workers      │  │    │
│   │  │  Sessions     │  │  │  │  Caching      │  │  │  │  Background   │  │    │
│   │  └───────────────┘  │  │  └───────────────┘  │  │  │  Processing   │  │    │
│   │      INTERNAL       │  │      INTERNAL       │  │  └───────────────┘  │    │
│   └─────────────────────┘  └─────────────────────┘  └─────────────────────┘    │
│                                                                                  │
│                              INTERNAL ONLY (Not Exposed)                         │
└──────────────────────────────────────────────────────────────────────────────────┘

                            ┌─────────────────────────────┐
                            │      DATA PERSISTENCE       │
                            │  ┌───────────────────────┐  │
                            │  │ ./data/postgres/      │  │
                            │  │ ./data/redis/         │  │
                            │  │ ./data/minio/         │  │
                            │  └───────────────────────┘  │
                            └─────────────────────────────┘
```

### 6.2 Network Topology (Docker Internal)

```
┌──────────────────────────────────────────────────────────────┐
│                    docroom-network (bridge)                   │
│                                                               │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│   │  postgres   │     │    redis    │     │  gotenberg  │   │
│   │  :5432      │     │   :6379     │     │   :3000     │   │
│   │  (internal) │     │  (internal) │     │  (internal) │   │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘   │
│          │                   │                   │           │
│          └───────────────────┼───────────────────┘           │
│                              │                               │
│          ┌───────────────────┼───────────────────┐           │
│          │                   │                   │           │
│   ┌──────▼──────┐     ┌──────▼──────┐                       │
│   │   docroom   │────▶│   worker    │                       │
│   │   :3000     │     │  (no port)  │                       │
│   │  (exposed)  │     │  (internal) │                       │
│   └─────────────┘     └─────────────┘                       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                        Host :3000
```

### 6.3 Data Persistence

```
./data/
├── postgres/     # PostgreSQL data (bind mount)
└── redis/        # Redis AOF persistence (bind mount)

# Using bind mounts instead of named volumes
# Data survives even `docker-compose down -v`
```

---

## 7. Configuration Reference

### 7.1 Required Variables

```bash
# Database
POSTGRES_USER=docroom
POSTGRES_PASSWORD=<secure-password>
POSTGRES_DB=docroom

# Authentication
NEXTAUTH_SECRET=<openssl rand -hex 32>

# URLs
NEXT_PUBLIC_BASE_URL=https://docs.yourdomain.com
NEXT_PUBLIC_APP_DOMAIN=docs.yourdomain.com

# Storage (S3/MinIO)
NEXT_PRIVATE_UPLOAD_BUCKET=your-bucket
NEXT_PRIVATE_UPLOAD_REGION=us-east-1
NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID=<access-key>
NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY=<secret-key>

# Email (choose one)
SMTP_HOST=smtp.provider.com
SMTP_PORT=587
SMTP_USER=<user>
SMTP_PASSWORD=<password>
# OR
RESEND_API_KEY=re_xxxxx

EMAIL_FROM=DocRoom <noreply@yourdomain.com>

# Security
INTERNAL_API_KEY=<openssl rand -hex 32>
NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY=<openssl rand -hex 32>

# Self-hosted mode
NEXT_PUBLIC_SELFHOSTED=1
```

### 7.2 Optional Variables

```bash
# MinIO endpoint (for S3-compatible storage)
NEXT_PRIVATE_UPLOAD_ENDPOINT=https://minio.yourdomain.com

# Google OAuth
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<secret>

# Slack Integration
SLACK_CLIENT_ID=<client-id>
SLACK_CLIENT_SECRET=<secret>
SLACK_INTEGRATION_ID=clslackintegration0x

# Gotenberg auth
GOTENBERG_USERNAME=gotenberg
GOTENBERG_PASSWORD=<password>

# Disable signups
NEXT_PUBLIC_DISABLE_SIGNUP=true
```

---

## 8. Deployment Guide

### 8.1 Quick Start

```bash
# Clone and configure
git clone https://github.com/0xMetaLabs/docroom.git
cd docroom
cp .env.docker.example .env
# Edit .env with your values

# Build and start
docker-compose -f docker-compose-prod.yml build
docker-compose -f docker-compose-prod.yml up -d

# View logs
docker-compose -f docker-compose-prod.yml logs -f
```

### 8.2 Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name docs.yourdomain.com;

    ssl_certificate /etc/ssl/certs/cert.pem;
    ssl_certificate_key /etc/ssl/private/key.pem;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

### 8.3 MinIO Setup

```bash
# Separate docker-compose for MinIO
docker-compose -f docker-compose-minio.yml up -d

# Access console at http://localhost:9001
# Create bucket and access keys
# Set NEXT_PRIVATE_UPLOAD_ENDPOINT to public MinIO URL
```

---

## 9. Troubleshooting

### 9.1 Worker Not Processing Jobs

```bash
# Check worker logs
docker-compose -f docker-compose-prod.yml logs docroom-worker

# Verify Redis connection
docker-compose -f docker-compose-prod.yml exec redis redis-cli ping

# Check queue status
docker-compose -f docker-compose-prod.yml exec docroom-worker \
  npx tsx -e "const { pdfToImageQueue } = require('./lib/queues'); \
  pdfToImageQueue.getJobCounts().then(console.log)"
```

### 9.2 S3/MinIO Issues

```bash
# For MinIO, ensure forcePathStyle is enabled (commit 49117456)
# Check endpoint is publicly accessible (not internal Docker URL)
# Browser needs to access presigned URLs directly

# Test S3 connectivity
docker-compose -f docker-compose-prod.yml exec docroom \
  node -e "const { getS3Client } = require('./lib/files/aws-client'); \
  console.log(getS3Client())"
```

### 9.3 Email Not Sending

```bash
# Check email provider detection
docker-compose -f docker-compose-prod.yml exec docroom \
  node -e "const { getEmailProviderName } = require('./lib/email/provider'); \
  console.log(getEmailProviderName())"

# Verify SMTP connection
docker-compose -f docker-compose-prod.yml exec docroom \
  node -e "const { verifyEmailConnection } = require('./lib/email/provider'); \
  verifyEmailConnection().then(console.log)"
```

### 9.4 Database Seeding

```bash
# Force re-seed
docker-compose -f docker-compose-prod.yml exec docroom \
  npx prisma db seed

# Check if seeded
docker-compose -f docker-compose-prod.yml exec postgres \
  psql -U docroom -c "SELECT COUNT(*) FROM \"Integration\";"
```

---

## Appendix: File Change Summary

| Category | Files Added | Files Modified | Files Deleted |
|----------|-------------|----------------|---------------|
| BullMQ Workers | 11 | - | - |
| Trigger.dev | - | - | 12 |
| Analytics | 4 | 15 | 18 |
| Email | 1 | 30+ | - |
| Redis | 1 | 5 | - |
| Docker | 4 | 2 | - |
| Auth/Passkeys | - | 3 | 7 |
| Limits | 2 | 50+ | - |
| Branding | 6 | 35 | - |

---

*Last Updated: December 2025*
*Version: 0.22.0*
*Total Lines Changed: ~27,000*
