# Papermark Self-Hosting Migration Progress

**Goal:** Make Papermark fully self-hostable by replacing cloud dependencies with local alternatives.

**Last Updated:** 2025-12-13

---

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| Background Jobs | ✅ Complete | BullMQ replaced Trigger.dev |
| Database | ✅ Complete | PostgreSQL in docker-compose |
| Redis | ✅ Complete | Redis in docker-compose |
| Document Conversion | ✅ Complete | Gotenberg for Office docs |
| Authentication | ✅ Complete | Hanko/Passkey removed |
| Integrations | ✅ Graceful | Slack fails gracefully if not configured |
| Webhook Delivery | ✅ Complete | BullMQ replaced QStash |
| Email | 🔄 Pending | Still uses Resend |
| Rate Limiting | 🔄 Pending | Still uses @upstash/ratelimit |
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

## Remaining Items

### Priority 1: Remove @upstash/redis

**Current:** Uses `@upstash/redis` for caching/misc Redis operations.

**Files Using:**
- Various files importing from `@upstash/redis`

**Replacement:** Use `ioredis` (already installed for BullMQ).

---

### Priority 3: Remove @upstash/ratelimit

**Current:** Uses `@upstash/ratelimit` for API rate limiting.

**Replacement:** Use `rate-limiter-flexible` with local Redis.

---

### Priority 4: Replace Resend with SMTP

**Current:** Uses Resend for email sending.

**Replacement:**
- Use `nodemailer` with SMTP
- Add Mailhog to docker-compose for development

---

## Running Self-Hosted Papermark

### Quick Start

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Run migrations
npx prisma migrate deploy

# 3. Start app + workers (two terminals, or use dev:all)
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
