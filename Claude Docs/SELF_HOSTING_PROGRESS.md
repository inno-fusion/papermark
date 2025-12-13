# Papermark Self-Hosting Migration Progress

**Goal:** Make Papermark fully self-hostable by replacing cloud dependencies with local alternatives.

**Last Updated:** 2025-12-13

---

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| Background Jobs | ✅ Complete | BullMQ replaced Trigger.dev |
| Database | ✅ Complete | PostgreSQL in docker-compose |
| Redis | ✅ Complete | Unified client (ioredis + Upstash REST) |
| Document Conversion | ✅ Complete | Gotenberg for Office docs |
| Authentication | ✅ Complete | Hanko/Passkey removed |
| Integrations | ✅ Complete | Slack fully configurable for self-hosting |
| Webhook Delivery | ✅ Complete | BullMQ replaced QStash |
| Email | ✅ Complete | SMTP/Resend (auto-detect, graceful fallback) |
| Analytics | ✅ Complete | Tinybird optional (graceful fallback) |
| Feature Flags | ✅ Complete | Works without EDGE_CONFIG |
| Rate Limiting | ✅ Complete | Custom implementation, ioredis or Upstash |
| Cleanup | ✅ Complete | Trigger.dev fully removed |

---

## Completed Items

### 1. BullMQ Replaced Trigger.dev ✅

**What:** Replaced Trigger.dev cloud service with self-hosted BullMQ for background job processing.

**Files Created:**
- `lib/queues/connection.ts` - Redis connection for BullMQ
- `lib/queues/index.ts` - Queue definitions
- `lib/queues/types.ts` - TypeScript types for job payloads
- `lib/queues/helpers.ts` - Helper functions (addJobWithTags, cancelPendingDataroomNotifications, etc.)
- `lib/queues/workers/index.ts` - Worker exports
- `lib/queues/workers/pdf-to-image.worker.ts` - PDF page conversion
- `lib/queues/workers/file-conversion.worker.ts` - Office docs → PDF
- `lib/queues/workers/video-optimization.worker.ts` - Video processing
- `lib/queues/workers/export-visits.worker.ts` - CSV export
- `lib/queues/workers/scheduled-email.worker.ts` - Delayed emails
- `lib/queues/workers/notification.worker.ts` - Dataroom/conversation notifications
- `lib/queues/workers/billing.worker.ts` - Pause/unpause billing
- `lib/queues/workers/cleanup.worker.ts` - Scheduled cleanup jobs
- `lib/progress/index.ts` - Job progress tracking
- `lib/progress/use-job-progress.ts` - React hook for progress polling
- `lib/redis-job-store.ts` - Redis-based job metadata store
- `workers/index.ts` - Worker entry point
- `pages/api/jobs/progress.ts` - Progress polling API

**Files Modified:**
- `lib/api/documents/process-document.ts` - Uses BullMQ queues
- `lib/utils/use-progress-status.ts` - Re-exports BullMQ hook
- `lib/files/get-file.ts` - Fixed for worker environment (absolute URLs)
- Multiple API routes updated to use BullMQ instead of Trigger.dev

**Environment Variables Added:**
```bash
REDIS_URL=redis://localhost:6379
INTERNAL_API_KEY=your-secret-key
```

**Scripts Added to package.json:**
```json
"workers": "tsx workers/index.ts",
"workers:dev": "tsx watch workers/index.ts",
"dev:all": "concurrently \"npm run dev\" \"npm run workers:dev\""
```

---

### 2. Docker Compose Infrastructure ✅

**File:** `docker-compose.yml`

**Services Added:**
```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  gotenberg:
    image: gotenberg/gotenberg:8
    ports: ["3001:3000"]
```

**Usage:**
```bash
docker-compose up -d
```

---

### 3. Hanko/Passkey Removed ✅

**What:** Removed Hanko passkey authentication dependency.

**Files Deleted:**
- `lib/hanko.ts`
- `lib/api/auth/passkey.ts`
- `lib/swr/use-passkeys.ts`
- `pages/api/passkeys/register.ts`
- `pages/api/account/passkeys.ts`
- `components/shared/icons/passkey.tsx`
- `pages/account/security.tsx`

**Files Modified:**
- `package.json` - Removed `@teamhanko/passkeys-next-auth-provider`
- `pages/api/auth/[...nextauth].ts` - Removed PasskeyProvider
- `app/(auth)/login/page-client.tsx` - Removed passkey login button
- `components/account/account-header.tsx` - Removed Security nav link
- `components/layouts/breadcrumb.tsx` - Removed security breadcrumb
- `components/hooks/useLastUsed.tsx` - Removed "passkey" from LoginType
- `.env.example` - Removed HANKO env vars

---

### 4. Gotenberg for Document Conversion ✅

**What:** Added Gotenberg service for LibreOffice document conversion (Office docs → PDF).

**Docker Service:**
```yaml
gotenberg:
  image: gotenberg/gotenberg:8
  ports: ["3001:3000"]
```

**Environment Variables:**
```bash
NEXT_PRIVATE_CONVERSION_BASE_URL=http://localhost:3001
```

**Supports:**
- .docx, .doc (Word)
- .xlsx, .xls (Excel)
- .pptx, .ppt (PowerPoint)

---

### 5. Slack Integration Graceful Fallback ✅

**What:** Made Slack integration fail gracefully when not configured instead of crashing.

**Files Modified:**
- `lib/integrations/slack/client.ts` - Constructor no longer throws; added `isConfigured` property
- `lib/integrations/slack/events.ts` - Returns early if Slack not configured

---

### 6. Environment Variables Updated ✅

**File:** `.env.example`

**Added:**
```bash
# Redis for BullMQ
REDIS_URL=redis://localhost:6379

# Internal API key for workers
INTERNAL_API_KEY=your-internal-api-key-here

# Document conversion
NEXT_PRIVATE_CONVERSION_BASE_URL=http://localhost:3001
NEXT_PRIVATE_INTERNAL_AUTH_TOKEN=

# CloudConvert (optional, for CAD/Keynote)
NEXT_PRIVATE_CONVERT_API_URL=
NEXT_PRIVATE_CONVERT_API_KEY=
```

**Removed:**
```bash
# Hanko (removed)
HANKO_API_KEY=
NEXT_PUBLIC_HANKO_TENANT_ID=

# Trigger.dev (no longer needed for self-hosting)
TRIGGER_SECRET_KEY=
TRIGGER_API_URL=
```

### 7. Webhook Delivery via BullMQ ✅

**What:** Replaced QStash with BullMQ worker for webhook delivery.

**Files Created:**
- `lib/queues/workers/webhook-delivery.worker.ts` - Delivers webhooks with retries

**Files Modified:**
- `lib/queues/types.ts` - Added `WebhookDeliveryPayload` type
- `lib/queues/index.ts` - Added `webhookDeliveryQueue` and events
- `lib/queues/workers/index.ts` - Export webhook worker
- `workers/index.ts` - Start webhook worker
- `lib/webhook/send-webhooks.ts` - Use BullMQ instead of QStash
- `lib/cron/index.ts` - Made QStash optional (lazy-loaded)
- `lib/cron/verify-qstash.ts` - Skip verification if not configured
- `app/api/webhooks/callback/route.ts` - Deprecated (no longer needed)
- `.env.example` - Marked QStash as optional

**Features:**
- 5 retry attempts with exponential backoff
- HMAC signature for webhook authentication
- Optional Tinybird event recording
- 30 second timeout per request

---

### 8. Trigger.dev Cleanup ✅

**What:** Removed all Trigger.dev dependencies and migrated remaining usages to BullMQ.

**Files Deleted:**
- `lib/trigger/` (entire directory - 9 files)
  - `billing.ts`, `client.ts`, `conversation-notification.ts`
  - `dataroom-notification.ts`, `export-visits.ts`, `file-conversion.ts`
  - `notification.ts`, `pdf-to-image.ts`, `video-optimization.ts`
- `ee/features/billing/cancellation/lib/trigger/automatic-unpause.ts`
- `ee/features/billing/cancellation/lib/trigger/pause-resume-billing.ts`
- `ee/features/conversations/lib/trigger/conversation-notification.ts`
- `trigger.config.ts`
- `lib/utils/generate-trigger-auth-token.ts`
- `lib/utils/generate-trigger-status.ts`

**Files Modified:**
- `ee/stripe/webhooks/checkout-session-completed.ts` - Use BullMQ emailQueue for 40-day check-in emails
- `ee/features/conversations/api/conversations-route.ts` - Use BullMQ for conversation notifications
- `ee/features/conversations/api/team-conversations-route.ts` - Use BullMQ for conversation notifications
- `ee/features/billing/cancellation/api/unpause-route.ts` - Use BullMQ helpers
- `lib/queues/helpers.ts` - Added `cancelPendingBillingJobs()` helper

**Packages Removed from package.json:**
```json
"@trigger.dev/react-hooks": "^3.3.17",
"@trigger.dev/sdk": "^3.3.17",
"@trigger.dev/build": "^3.3.17"
```

**Result:** 98 packages removed from node_modules

---

### 9. Slack Integration Self-Hosting ✅

**What:** Made Slack integration fully configurable for self-hosted deployments.

**Setup Required:**
1. Create Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Configure OAuth redirect: `{BASE_URL}/api/integrations/slack/oauth/callback`
3. Add bot scopes: `channels:read`, `chat:write`, `chat:write.public`, `groups:read`, `team:read`, `users:read`
4. Run: `npx tsx prisma/seed-slack.ts` to create Integration record

**Environment Variables:**
```bash
SLACK_CLIENT_ID=<from Slack app>
SLACK_CLIENT_SECRET=<from Slack app>
SLACK_APP_INSTALL_URL=https://slack.com/oauth/v2/authorize?client_id=...
SLACK_INTEGRATION_ID=<from seed script>
NEXT_PRIVATE_SLACK_ENCRYPTION_KEY=<openssl rand -hex 32>
```

**Files Modified:**
- `lib/integrations/slack/env.ts` - Returns null instead of throwing when not configured
- `lib/integrations/slack/events.ts` - Handles null env gracefully
- `lib/integrations/slack/install.ts` - Throws clear error if not configured
- `app/api/integrations/slack/oauth/callback/route.ts` - Returns 503 if not configured
- `.env.example` - Added Slack config section

**Files Created:**
- `prisma/seed-slack.ts` - Seed script for Integration record

**Behavior:**
- If Slack vars not set: Integration silently disabled (no errors)
- If partially configured: Warning logged, integration disabled
- If fully configured: Full Slack notifications available

---

### 10. Email Provider Migration ✅

**What:** Added unified email provider supporting both SMTP and Resend with auto-detection.

**Files Created:**
- `lib/email/provider.ts` - Unified email provider with SMTP and Resend support

**Files Modified:**
- `lib/resend.ts` - Re-exports from unified provider for backwards compatibility
- `.env.example` - Added SMTP configuration section
- `SELF_HOSTING.md` - Added Email Configuration section

**Environment Variables:**
```bash
# SMTP (Recommended for self-hosting)
SMTP_HOST=smtp.email.ap-mumbai-1.oci.oraclecloud.com  # OCI
# SMTP_HOST=email-smtp.us-east-1.amazonaws.com        # AWS SES
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
EMAIL_FROM=Papermark <noreply@yourdomain.com>

# OR Resend (cloud service)
RESEND_API_KEY=re_xxxxxxxx
```

**Supported Providers:**
- AWS SES (via SMTP)
- OCI Email (via SMTP)
- SendGrid (via SMTP)
- Mailgun (via SMTP)
- Any SMTP server
- Resend (cloud API)

**Features:**
- Auto-detection: SMTP used if `SMTP_HOST` and `SMTP_PORT` are set, else Resend
- Graceful fallback: If neither configured, logs warning once and skips emails silently
- Same API for both providers
- TLS support with configurable certificate verification
- Multiple sender addresses (default, marketing, system, verify)
- Connection verification utility
- Errors don't crash the app - logged but not thrown

---

### 11. Tinybird Analytics Graceful Fallback ✅

**What:** Made Tinybird analytics optional - silently skips when not configured instead of throwing errors.

**Files Modified:**
- `lib/tinybird/publish.ts` - Wrapper functions that skip ingestion if not configured
- `lib/tinybird/pipes.ts` - Wrapper functions that return empty data if not configured

**Behavior:**
- If `TINYBIRD_TOKEN` not set: All analytics calls silently return success/empty data
- If configured but error occurs: Logs warning but doesn't throw
- Analytics should never break core application functionality

**Features:**
- `isTinybirdConfigured()` helper exported from publish.ts
- All ingest functions wrapped with error handling
- All query functions return empty arrays when not configured

---

### 12. Feature Flags Self-Hosting Fix ✅

**What:** Fixed feature flags to not enable infrastructure-dependent features by default when `EDGE_CONFIG` is not set.

**Files Modified:**
- `lib/featureFlags/index.ts` - Added `INFRASTRUCTURE_DEPENDENT_FEATURES` list to exclude from default enablement

**Problem:**
- When `EDGE_CONFIG` not set, ALL features were enabled including `usStorage`
- `usStorage` requires `NEXT_PRIVATE_UPLOAD_BUCKET_US` env var (separate US bucket)
- Self-hosted setups typically use a single bucket, causing errors

**Solution:**
- Created `INFRASTRUCTURE_DEPENDENT_FEATURES` list for features requiring extra infrastructure
- These features stay disabled in self-hosted mode unless explicitly configured
- All other features remain enabled for full functionality

---

### 13. Unified Redis Client & Rate Limiting ✅

**What:** Created unified Redis client supporting both ioredis and Upstash REST API, replaced @upstash/ratelimit with custom implementation.

**Files Created/Modified:**
- `lib/redis.ts` - Complete rewrite with unified interface
  - Supports both ioredis (REDIS_URL) and Upstash REST API
  - Graceful fallback when Redis not configured
  - Custom sliding window rate limiter
- `ee/features/security/lib/ratelimit.ts` - Uses unified rate limiter
- `lib/files/tus-redis-locker.ts` - Uses ioredis with in-memory fallback
- `pages/api/assistants/chat.ts` - Uses unified rate limiter

**Environment Variables:**
```bash
# Option 1: Standard Redis (recommended for self-hosting)
REDIS_URL=redis://localhost:6379

# Option 2: Upstash REST API (for serverless)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

**Features:**
- Auto-detection: REDIS_URL takes priority if both configured
- Full Redis API: get, set, setex, del, incr, hset, hincrby, zadd, zrange, etc.
- Sliding window rate limiting without @upstash/ratelimit
- TUS file locking with in-memory fallback
- Graceful fallback when Redis not configured

---

## Remaining Items

**🎉 Migration Complete!**

All cloud dependencies have been replaced with self-hostable alternatives:

| Cloud Service | Replacement |
|---------------|-------------|
| Trigger.dev | BullMQ + Redis |
| QStash | BullMQ webhook worker |
| Hanko | Removed (NextAuth only) |
| @upstash/redis | ioredis (or Upstash REST) |
| @upstash/ratelimit | Custom sliding window |
| Resend (required) | SMTP or Resend (optional) |
| Tinybird (required) | Optional with graceful fallback |
| Vercel Edge Config | Works without it |

---

## Running Self-Hosted Papermark

> **See the full guide**: [SELF_HOSTING.md](../SELF_HOSTING.md)

### Quick Start

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Run migrations
npx prisma migrate deploy

# 3. Seed integrations (optional)
npx tsx prisma/seed-slack.ts

# 4. Start app + workers (two terminals, or use dev:all)
npm run dev
npm run workers:dev

# Or all at once:
npm run dev:all
```

### Required Environment Variables

```bash
# Database
POSTGRES_PRISMA_URL=postgresql://postgres:papermark@localhost:5432/papermark

# Redis
REDIS_URL=redis://localhost:6379

# Auth
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000

# App URLs
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Internal API
INTERNAL_API_KEY=your-internal-api-key

# Storage (S3)
NEXT_PRIVATE_UPLOAD_BUCKET=your-bucket
NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID=your-key
NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY=your-secret
NEXT_PRIVATE_UPLOAD_REGION=us-east-1

# Document conversion (optional, for Office docs)
NEXT_PRIVATE_CONVERSION_BASE_URL=http://localhost:3001
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Self-Hosted Papermark                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Next.js    │    │   Workers    │    │   Gotenberg  │   │
│  │   (App)      │◄──►│   (BullMQ)   │◄──►│  (LibreOffice)│  │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                               │
│         ▼                   ▼                               │
│  ┌──────────────┐    ┌──────────────┐                       │
│  │  PostgreSQL  │    │    Redis     │                       │
│  │  (Database)  │    │   (Queues)   │                       │
│  └──────────────┘    └──────────────┘                       │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐                                           │
│  │     S3       │                                           │
│  │  (Storage)   │                                           │
│  └──────────────┘                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Change Log

| Date | Change |
|------|--------|
| 2025-12-13 | Initial BullMQ migration completed |
| 2025-12-13 | Hanko/Passkey removed |
| 2025-12-13 | Gotenberg added for Office docs |
| 2025-12-13 | Slack graceful fallback added |
| 2025-12-13 | Docker compose updated with all services |
| 2025-12-13 | QStash replaced with BullMQ for webhook delivery |
| 2025-12-13 | Trigger.dev fully removed (98 packages) |
| 2025-12-13 | Slack integration fully self-hostable |
| 2025-12-13 | Comprehensive SELF_HOSTING.md guide created |
| 2025-12-13 | Email provider unified (SMTP + Resend with auto-detect) |
| 2025-12-13 | Tinybird analytics made optional (graceful fallback) |
| 2025-12-13 | Feature flags fixed for self-hosting (usStorage disabled by default) |
| 2025-12-13 | Email provider graceful fallback when not configured |
| 2025-12-13 | **Unified Redis client** - ioredis + Upstash REST support |
| 2025-12-13 | **Rate limiting migrated** - Custom sliding window, no @upstash/ratelimit |
| 2025-12-13 | **🎉 MIGRATION COMPLETE** - All cloud dependencies replaced |
