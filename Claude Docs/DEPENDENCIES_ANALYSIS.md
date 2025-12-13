# Papermark - Complete External Dependencies Analysis & Localization Plan

**Generated:** December 13, 2024
**Repository:** https://github.com/mfts/papermark
**Version:** Analyzed from current codebase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Complete External Dependencies Flow](#part-1-complete-external-dependencies-flow)
3. [Localization Plan - Minimal External Dependencies](#part-2-localization-plan---minimal-external-dependencies)
4. [Minimal Viable Local Setup](#minimal-viable-local-setup)
5. [Cost Analysis](#cost-analysis)
6. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

Papermark is a sophisticated document sharing and analytics platform (DocSend alternative) built with:
- **Framework:** Next.js 14 (App Router + Pages Router hybrid)
- **Database:** PostgreSQL via Prisma ORM (50+ models)
- **API Routes:** 215 endpoints total
- **Background Jobs:** 11 async job types
- **External Services:** 20+ third-party integrations

**Key Findings:**
- ✅ Core infrastructure can be self-hosted (PostgreSQL, S3/MinIO, Redis)
- ⚠️ Background job system (Trigger.dev) requires significant refactoring to replace
- ⚠️ Analytics system (Tinybird) is deeply integrated; replacement is a major project
- ✅ Email system can be replaced with SMTP/Nodemailer
- ✅ File storage works seamlessly with S3-compatible MinIO

**Recommended Approach:** Hybrid setup keeping free-tier SaaS for complex services (Trigger.dev, Tinybird) while self-hosting infrastructure (DB, storage, cache).

---

## PART 1: COMPLETE EXTERNAL DEPENDENCIES FLOW

### Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PAPERMARK APPLICATION                     │
│                    (Next.js 14 + Prisma)                     │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    ┌───▼────┐         ┌──────▼──────┐      ┌──────▼──────┐
    │ Client │         │ API Routes  │      │  Background │
    │  Side  │         │ (215 total) │      │    Jobs     │
    └────────┘         └─────────────┘      └─────────────┘
```

### 1. CRITICAL INFRASTRUCTURE

**Cannot run without these services**

#### Database Layer

```
PostgreSQL Database (Prisma ORM)
├── Connection: POSTGRES_PRISMA_URL (pooled)
├── Direct: POSTGRES_PRISMA_URL_NON_POOLING
├── Tables: 50+ models (User, Team, Document, Link, View, etc.)
├── Schema Location: prisma/schema/
│   ├── schema.prisma (main)
│   ├── annotation.prisma
│   ├── conversation.prisma
│   ├── dataroom.prisma
│   ├── document.prisma
│   ├── integration.prisma
│   ├── link.prisma
│   ├── team.prisma
│   └── workflow.prisma
└── Usage: Every single API route depends on this
```

**Key Models:**
- **User & Auth:** User, Account, Session, VerificationToken, UserTeam
- **Teams:** Team (with Stripe billing), Brand
- **Documents:** Document, DocumentVersion, DocumentPage, Folder, DocumentUpload
- **Sharing:** Link (3 types: DOCUMENT_LINK, DATAROOM_LINK, WORKFLOW_LINK), LinkPreset
- **Datarooms:** Dataroom, DataroomDocument, DataroomFolder, DataroomBrand
- **Access Control:** Domain, Viewer, ViewerGroup, PermissionGroup, RestrictedToken
- **Analytics:** View, Reaction, Feedback, FeedbackResponse
- **Agreements:** Agreement, AgreementResponse, CustomField, CustomFieldResponse
- **Integrations:** Webhook, IncomingWebhook, InstalledIntegration
- **Communication:** Conversation, ConversationParticipant, Message, DataroomFaqItem
- **AI:** Chat, ChatMessage (with vector store references)
- **Workflows:** Workflow, WorkflowStep, WorkflowExecution, WorkflowStepLog

#### Authentication System

```
NextAuth.js v4.24.13
├── Session Management: Database-backed
├── Configuration: pages/api/auth/[...nextauth].ts
├── Providers:
│   ├── Google OAuth
│   │   ├── GOOGLE_CLIENT_ID
│   │   └── GOOGLE_CLIENT_SECRET
│   ├── LinkedIn OAuth
│   │   ├── LINKEDIN_CLIENT_ID
│   │   └── LINKEDIN_CLIENT_SECRET
│   ├── Email Magic Links
│   │   └── Via Resend API
│   └── Passkeys/WebAuthn (Hanko)
│       ├── Package: @teamhanko/passkeys-next-auth-provider
│       ├── HANKO_API_KEY
│       ├── NEXT_PUBLIC_HANKO_TENANT_ID
│       └── Files: lib/hanko.ts, lib/api/auth/passkey.ts
├── Adapter: @next-auth/prisma-adapter
└── Required for: All authenticated routes (99% of app)
```

#### File Storage

**Choice: AWS S3 OR Vercel Blob**

```
Option A: AWS S3 + CloudFront (Recommended for self-hosting)
├── Configuration:
│   ├── NEXT_PUBLIC_UPLOAD_TRANSPORT="s3"
│   ├── NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID
│   ├── NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY
│   ├── NEXT_PRIVATE_UPLOAD_BUCKET
│   ├── NEXT_PRIVATE_UPLOAD_REGION (default: us-east-1)
│   ├── NEXT_PRIVATE_UPLOAD_ENDPOINT (optional, for S3-compatible services)
│   └── NEXT_PRIVATE_UPLOAD_DISTRIBUTION_HOST (required)
├── Optional CloudFront CDN:
│   ├── NEXT_PRIVATE_UPLOAD_DISTRIBUTION_DOMAIN
│   ├── NEXT_PRIVATE_UPLOAD_DISTRIBUTION_KEY_ID
│   └── NEXT_PRIVATE_UPLOAD_DISTRIBUTION_KEY_CONTENTS (PEM RSA 2048)
├── Packages:
│   ├── @aws-sdk/client-s3
│   ├── @aws-sdk/s3-request-presigner
│   ├── @aws-sdk/lib-storage
│   ├── @aws-sdk/cloudfront-signer
│   └── @aws-sdk/client-lambda
├── Files:
│   ├── lib/files/aws-client.ts (S3 client)
│   ├── lib/files/put-file.ts (upload logic)
│   ├── lib/files/get-file.ts (download/streaming)
│   ├── lib/files/delete-file-server.ts
│   ├── lib/files/copy-file-server.ts
│   └── ee/features/storage/config.ts (region config)
└── Usage:
    ├── Document uploads (PDF, Office, images, videos)
    ├── Thumbnail generation
    ├── Export files (Excel/CSV)
    └── User-uploaded content (via viewers)

Option B: Vercel Blob
├── Configuration:
│   ├── NEXT_PUBLIC_UPLOAD_TRANSPORT="vercel"
│   ├── BLOB_READ_WRITE_TOKEN
│   └── NEXT_PRIVATE_UPLOAD_DISTRIBUTION_HOST (blob hostname)
├── Package: @vercel/blob@2.0.0
├── Files: lib/files/put-file.ts (conditional logic)
└── Usage: Same as S3

TUS Resumable Upload Protocol
├── Packages:
│   ├── @tus/server@1.10.2
│   ├── @tus/s3-store@1.9.1
│   ├── @tus/utils@0.5.1
│   └── tus-js-client@4.3.1
├── Redis Locker (concurrent upload safety):
│   ├── UPSTASH_REDIS_REST_LOCKER_URL
│   └── UPSTASH_REDIS_REST_LOCKER_TOKEN
├── Files:
│   ├── lib/files/tus-upload.ts
│   ├── lib/files/viewer-tus-upload.ts
│   ├── lib/files/tus-redis-locker.ts
│   └── pages/api/file/tus/[[...file]].ts (endpoint)
└── Usage: Large file uploads (>100MB)
```

---

### 2. EMAIL SYSTEM

**Required for core functionality**

```
Primary Email Service: Resend
├── Package: resend@6.5.2
├── Configuration:
│   └── RESEND_API_KEY
├── Rate Limiting: 10 req/s (via Bottleneck)
├── Files:
│   ├── lib/resend.ts (client initialization)
│   └── lib/emails/ (React Email templates)
├── Email Templates (React Email):
│   ├── components/emails/welcome.tsx
│   ├── components/emails/upgrade-plan.tsx
│   ├── components/emails/slack-integration.tsx
│   ├── components/emails/installed-integration-notification.tsx
│   ├── ee/emails/pause-resume-reminder.tsx
│   └── 20+ other templates
└── Usage:
    ├── Authentication magic links
    ├── Document view notifications
    ├── Team invitations
    ├── Dataroom update alerts
    ├── Conversation notifications
    ├── Export ready notifications
    ├── Billing reminders
    └── Marketing/onboarding emails

Secondary Email Service: Unsend
├── Package: unsend@1.5.1
├── Configuration:
│   ├── UNSEND_API_KEY
│   ├── UNSEND_BASE_URL
│   └── UNSEND_CONTACT_BOOK_ID
├── Files:
│   ├── lib/unsend.ts
│   └── lib/utils/unsubscribe.ts
└── Usage:
    ├── Contact subscription management
    ├── Unsubscribe handling
    └── Email list management

Email Sending Flow:
1. Trigger → lib/emails/send-*.ts
2. Render React Email → HTML (via @react-email/render)
3. Rate limit check (Bottleneck)
4. Send via Resend API
5. Track in SentEmail table
6. Manage contacts in Unsend
```

---

### 3. BACKGROUND JOB PROCESSING

**Required for async tasks**

#### Trigger.dev v3 (Primary Job System)

```
Trigger.dev v3
├── Configuration:
│   ├── TRIGGER_SECRET_KEY
│   ├── TRIGGER_API_URL=https://api.trigger.dev
│   ├── Project ID: proj_plmsfqvqunboixacjjus
│   └── Config: trigger.config.ts
├── Packages:
│   ├── @trigger.dev/sdk@3.3.17
│   ├── @trigger.dev/react-hooks@3.3.17
│   └── @trigger.dev/build@3.3.17
├── Extensions:
│   ├── Prisma (database access in jobs)
│   └── FFmpeg (video processing)
├── Job Configuration:
│   ├── Max Duration: None (unlimited)
│   ├── Retries: 3 attempts, exponential backoff
│   └── Location: lib/trigger/
└── Jobs (11 total):

1. convert-files-to-pdf (lib/trigger/convert-files.ts)
   ├── Converts Office documents to PDF
   ├── External Service: LibreOffice API
   │   ├── NEXT_PRIVATE_CONVERSION_BASE_URL
   │   └── NEXT_PRIVATE_INTERNAL_AUTH_TOKEN
   ├── Supported: .doc, .docx, .xls, .xlsx, .ppt, .pptx, .odt, .ods, .odp
   ├── Queue Concurrency: 10
   └── Triggers: pdf-to-image-route on completion

2. convert-cad-to-pdf (lib/trigger/convert-files.ts)
   ├── Converts CAD files to PDF
   ├── External Service: ConvertAPI
   │   ├── NEXT_PRIVATE_CONVERT_API_URL
   │   └── NEXT_PRIVATE_CONVERT_API_KEY
   ├── Supported: .dwg, .dxf
   └── Queue Concurrency: 2

3. convert-keynote-to-pdf (lib/trigger/convert-files.ts)
   ├── Converts Apple Keynote to PDF
   ├── External Service: ConvertAPI
   ├── Supported: .key
   └── Queue Concurrency: 2

4. pdf-to-image-route (lib/trigger/pdf-to-image-route.ts)
   ├── Converts PDF pages to images for viewer
   ├── Uses: AWS Lambda invocations for parallel processing
   ├── Output: PNG images per page
   └── Invoked after: File conversion jobs

5. optimize-video-files (lib/trigger/optimize-video-files.ts)
   ├── Video transcoding and optimization
   ├── Uses: FFmpeg (via Trigger.dev extension)
   ├── Output formats: MP4 (H.264)
   └── Features: Compression, format conversion

6. export-visits (lib/trigger/export-visits.ts)
   ├── Exports analytics data to Excel/CSV
   ├── Types: Document visits, Dataroom visits, Group visits
   ├── Package: exceljs@4.4.0
   ├── Storage: Blob storage (S3/Vercel)
   ├── TTL: 3 days
   └── Notification: Email when ready

7. cleanup-expired-exports (lib/trigger/cleanup-expired-exports.ts)
   ├── Deletes expired export files
   ├── Runs: Scheduled (daily)
   └── Cleans: Blob storage + Redis queue

8. send-scheduled-email (lib/trigger/send-scheduled-email.ts)
   ├── Scheduled email campaigns
   └── Used for: Delayed notifications, drip campaigns

9. dataroom-change-notification (lib/trigger/dataroom-change-notification.ts)
   ├── Notifies viewers of dataroom updates
   └── Triggers: Document added/removed, folder changes

10. conversation-message-notification (lib/trigger/conversation-message-notification.ts)
    ├── Real-time conversation notifications
    └── Location: ee/features/conversations/lib/trigger/

11. pause-reminder-notification (lib/trigger/pause-reminder-notification.ts)
    ├── Billing pause/resume reminders
    └── Location: ee/features/billing/cancellation/lib/trigger/

Job Invocation Points:
├── Document upload → convert-files-to-pdf
├── PDF upload → pdf-to-image-route
├── Video upload → optimize-video-files
├── Export request → export-visits
├── Dataroom update → dataroom-change-notification
└── Scheduled emails → send-scheduled-email
```

#### Upstash QStash (Message Queue)

```
Upstash QStash
├── Configuration:
│   ├── QSTASH_TOKEN
│   ├── QSTASH_CURRENT_SIGNING_KEY
│   └── QSTASH_NEXT_SIGNING_KEY
├── Package: @upstash/qstash@2.8.4
├── Files:
│   ├── lib/cron/index.ts (QStash client)
│   ├── lib/webhook/send-webhooks.ts
│   └── pages/api/webhooks/callback.ts
└── Usage:
    ├── Webhook delivery with retries
    │   ├── Signature: HMAC-SHA256
    │   ├── Callback URL: /api/webhooks/callback
    │   └── Status tracking: Tinybird
    ├── Scheduled cron jobs
    │   └── Domain verification (daily)
    └── Rate limiting for Resend (1 req/100ms)
```

---

### 4. CACHING & RATE LIMITING

```
Upstash Redis
├── Primary Instance:
│   ├── UPSTASH_REDIS_REST_URL
│   └── UPSTASH_REDIS_REST_TOKEN
├── TUS Locker Instance:
│   ├── UPSTASH_REDIS_REST_LOCKER_URL
│   └── UPSTASH_REDIS_REST_LOCKER_TOKEN
├── Package: @upstash/redis@1.35.7
├── Rate Limiting: @upstash/ratelimit@2.0.7
├── Files:
│   ├── lib/redis.ts (client)
│   ├── lib/redis-job-store.ts (export job queue)
│   ├── lib/files/tus-redis-locker.ts (upload locking)
│   └── lib/middleware/*.ts (rate limiting)
└── Usage:
    ├── API rate limiting (per IP/user)
    ├── Export job queue (3-day TTL)
    │   ├── Job statuses: PENDING, PROCESSING, COMPLETED, FAILED
    │   ├── User job index (sorted sets)
    │   └── Team job index
    ├── TUS upload concurrency control
    └── Session caching (optional)
```

---

### 5. ANALYTICS & TRACKING

**Multiple systems for different purposes**

#### Tinybird (Primary Real-Time Analytics)

```
Tinybird
├── Configuration:
│   └── TINYBIRD_TOKEN (admin rights)
├── Package: @chronark/zod-bird@0.3.10
├── Files:
│   ├── lib/tinybird/pipes.ts (API client)
│   ├── lib/tinybird/publish.ts (event publishing)
│   └── lib/tinybird/ (datasources, endpoints)
├── Infrastructure:
│   ├── CLI: tinybird-cli (Python)
│   ├── Config: lib/tinybird/tinybird.datasources
│   └── Deployment: tb push datasources/* && tb push endpoints/get_*
├── Datasources (Event Streams):
│   ├── page_views__v3
│   │   ├── Fields: linkId, documentId, viewId, pageNumber, duration, versionNumber
│   │   └── TTL: 90 days
│   ├── video_views__v1
│   │   ├── Fields: linkId, documentId, viewId, duration, playbackRate
│   │   └── Usage: Video playback analytics
│   ├── click_events__v1
│   │   ├── Fields: linkId, clicks, cta
│   │   └── Usage: CTA tracking
│   ├── webhook_events__v1
│   │   ├── Fields: webhookId, status, deliveryTime, responseCode
│   │   └── Usage: Webhook delivery metrics
│   └── pm_click_events__v1
│       └── Usage: Marketing click tracking
├── Endpoints (20+ analytical queries):
│   ├── get_page_views (page-level analytics)
│   ├── get_total_views (document totals)
│   ├── get_visitor_stats (unique visitors)
│   ├── get_video_analytics (playback metrics)
│   ├── get_webhook_stats (delivery success rates)
│   └── ... (geo, device, referrer analytics)
└── Publishing Points:
    ├── pages/api/record_view.ts → page_views__v3
    ├── pages/api/record_video_view.ts → video_views__v1
    ├── pages/api/record_click.ts → click_events__v1
    └── pages/api/webhooks/callback.ts → webhook_events__v1
```

#### PostHog (Product Analytics)

```
PostHog
├── Configuration:
│   ├── NEXT_PUBLIC_POSTHOG_KEY
│   └── Proxy: NEXT_PUBLIC_BASE_URL/ingest
├── Package: posthog-js@1.302.2
├── Files:
│   ├── lib/posthog.ts (config)
│   ├── lib/analytics/index.ts (useAnalytics hook)
│   └── components/gtm-component.tsx (initialization)
├── Features:
│   ├── Event capture (client-side)
│   ├── User identification
│   ├── Session recording (optional)
│   └── Feature flags
└── Usage:
    ├── User behavior tracking
    ├── Funnel analysis
    └── A/B testing
```

#### Jitsu (Server-Side Tracking)

```
Jitsu
├── Configuration:
│   ├── JITSU_HOST
│   └── JITSU_WRITE_KEY
├── Package: @jitsu/js@1.10.4
├── Files:
│   └── lib/analytics/index.ts
└── Usage:
    ├── Server-side event tracking
    ├── identifyUser() - User traits
    └── trackAnalytics() - Custom events
```

#### Dub.co (Link Attribution)

```
Dub.co
├── Configuration:
│   └── DUB_API_KEY
├── Package: dub@0.69.0
├── Files:
│   └── lib/dub.ts
└── Usage:
    ├── Customer discount/coupon lookup
    ├── External ID mapping
    └── Stripe checkout integration
```

---

### 6. PAYMENT PROCESSING

```
Stripe
├── Configuration:
│   ├── STRIPE_SECRET_KEY
│   └── STRIPE_WEBHOOK_SECRET
├── Packages:
│   ├── stripe@16.12.0 (server)
│   └── @stripe/stripe-js@4.10.0 (client)
├── Files:
│   ├── ee/stripe/client.ts (Stripe client)
│   ├── ee/stripe/index.ts (utilities)
│   ├── ee/stripe/functions/ (pricing, plans)
│   ├── ee/stripe/webhooks/ (event handlers)
│   └── pages/api/stripe/webhook.ts (webhook endpoint)
├── Webhook Events:
│   ├── checkout.session.completed
│   │   └── Handler: ee/stripe/webhooks/checkout-session-completed.ts
│   ├── customer.subscription.updated
│   │   └── Handler: ee/stripe/webhooks/customer-subscription-updated.ts
│   ├── customer.subscription.deleted
│   │   └── Handler: ee/stripe/webhooks/customer-subscription-deleted.ts
│   ├── payment_intent.payment_failed
│   │   └── Handler: (inline in webhook.ts)
│   └── invoice.upcoming
│       └── Handler: ee/stripe/webhooks/invoice-upcoming.ts
├── Plans & Pricing:
│   ├── Free: $0/mo (3 users, 5 documents)
│   ├── Pro: $29/mo (unlimited)
│   ├── Business: $79/mo (advanced features)
│   └── Data Rooms: $99/mo (virtual data rooms)
├── Database Fields:
│   └── Team table:
│       ├── stripeId (customer ID)
│       ├── subscriptionId
│       ├── plan (enum)
│       ├── startsAt, endsAt (subscription period)
│       ├── pausedAt (pause feature)
│       └── limits (JSON: datarooms, users, domains)
└── CLI Tool:
    └── npm run stripe:webhook (local testing)
```

---

### 7. AI/ML SERVICES

```
OpenAI
├── Configuration:
│   └── OPENAI_API_KEY
├── Packages:
│   ├── openai@6.10.0
│   ├── @ai-sdk/openai@2.0.80
│   ├── @ai-sdk/react@2.0.109
│   └── ai@5.0.108 (Vercel AI SDK)
├── Files:
│   ├── lib/openai.ts (client initialization)
│   ├── ee/features/ai/lib/models/openai.ts
│   ├── ee/features/ai/lib/file-processing/ (vector stores)
│   ├── app/api/ai/chat/route.ts (chat endpoint)
│   └── app/api/ai/store/ (vector store management)
├── Features:
│   ├── Chat Assistance (GPT-4)
│   │   ├── Models: Chat, ChatMessage
│   │   ├── Context: Document, Dataroom, Link, View
│   │   └── UI: ee/features/ai/components/
│   ├── Document Q&A (RAG)
│   │   ├── File API: Upload documents
│   │   ├── Vector Stores: Team-level, Dataroom-level
│   │   ├── Embeddings: text-embedding-3-small
│   │   └── Processing: ee/features/ai/lib/file-processing/
│   └── Token Management
│       └── Package: tokenlens@1.3.1 (token counting)
├── Vector Store Architecture:
│   ├── Team Vector Store: All team documents
│   ├── Dataroom Vector Store: Per-dataroom documents
│   ├── Storage: Team.vectorStoreId, Dataroom.vectorStoreId
│   └── Sync: Document upload → process-document-for-vector-store
└── API Endpoints:
    ├── POST /api/ai/chat - Create chat session
    ├── GET /api/ai/chat/[chatId] - Get chat history
    ├── POST /api/ai/chat/[chatId]/messages - Send message
    └── POST /api/ai/store/teams/[teamId]/process - Process document
```

---

### 8. DOCUMENT PROCESSING

#### PDF Processing

```
MuPDF (WASM Library)
├── Package: mupdf@1.26.4
├── WASM Files: node_modules/mupdf/dist/*.wasm
├── Configuration:
│   └── next.config.mjs: outputFileTracingIncludes
├── Files:
│   └── pages/api/mupdf/
│       ├── convert-page.ts (PDF → image)
│       ├── get-pages.ts (extract pages)
│       └── annotate-document.ts (add annotations)
└── Usage:
    ├── PDF page rendering
    ├── Page extraction
    └── Annotation overlay

pdf-lib
├── Package: pdf-lib@1.17.1
├── Fontkit: @pdf-lib/fontkit@1.1.1
├── Files:
│   └── (Used throughout for PDF manipulation)
└── Usage:
    ├── PDF generation
    ├── Watermarking
    ├── Page merging
    └── Metadata editing

react-pdf (Viewer)
├── Package: react-pdf@8.0.2
├── Files:
│   └── components/view/ (document viewer)
└── Usage:
    ├── Client-side PDF rendering
    └── Page navigation
```

#### Office Document Conversion

```
LibreOffice API (External Service)
├── Configuration:
│   ├── NEXT_PRIVATE_CONVERSION_BASE_URL
│   └── NEXT_PRIVATE_INTERNAL_AUTH_TOKEN
├── Supported Formats:
│   ├── Word: .doc, .docx
│   ├── Excel: .xls, .xlsx
│   ├── PowerPoint: .ppt, .pptx
│   └── OpenOffice: .odt, .ods, .odp
├── Process Flow:
│   1. Upload to S3
│   2. Trigger.dev job: convert-files-to-pdf
│   3. Call LibreOffice API
│   4. Download converted PDF
│   5. Upload PDF to S3
│   6. Trigger: pdf-to-image-route
└── Alternative: Self-hosted LibreOffice (see localization plan)

ConvertAPI (External Service)
├── Configuration:
│   ├── NEXT_PRIVATE_CONVERT_API_URL
│   └── NEXT_PRIVATE_CONVERT_API_KEY
├── Supported Formats:
│   ├── CAD: .dwg, .dxf
│   └── Apple: .key (Keynote)
├── Process Flow:
│   1. Upload to S3
│   2. Trigger.dev job: convert-cad-to-pdf or convert-keynote-to-pdf
│   3. Call ConvertAPI
│   4. Download PDF
│   5. Upload to S3
└── Note: No free self-hosted alternative
```

#### Video Processing

```
FFmpeg (via Trigger.dev)
├── Package: fluent-ffmpeg@2.1.3
├── Extension: @trigger.dev/build/extensions/core (ffmpeg)
├── Job: lib/trigger/optimize-video-files.ts
├── Supported Formats:
│   └── Most video formats → MP4 (H.264)
└── Features:
    ├── Format conversion
    ├── Compression
    ├── Resolution scaling
    └── Bitrate optimization
```

#### Notion Import

```
Notion Integration
├── Packages:
│   ├── notion-client@7.7.1
│   ├── notion-utils@7.7.1
│   └── react-notion-x@7.7.1
├── Files:
│   ├── lib/notion/ (API client)
│   ├── pages/api/file/notion/index.ts (import endpoint)
│   └── components/welcome/notion-form.tsx (UI)
└── Features:
    ├── Import Notion pages as documents
    ├── Render Notion blocks
    └── Preserve formatting
```

---

### 9. INTEGRATIONS

#### Slack Integration

```
Slack OAuth Integration
├── Configuration:
│   ├── SLACK_CLIENT_ID
│   └── SLACK_CLIENT_SECRET
├── Files:
│   ├── lib/integrations/slack/
│   │   ├── client.ts (Slack API client)
│   │   ├── env.ts (config validation)
│   │   ├── events.ts (event handlers)
│   │   ├── install.ts (OAuth flow)
│   │   ├── uninstall.ts
│   │   └── utils.ts
│   ├── pages/api/integrations/slack/oauth/
│   │   └── callback.ts (OAuth callback)
│   ├── pages/api/teams/[teamId]/integrations/slack/
│   │   ├── index.ts (get integration)
│   │   └── channels.ts (list channels)
│   └── app/api/integrations/slack/oauth/callback/route.ts
├── Database:
│   └── InstalledIntegration model (type: SLACK)
├── Features:
│   ├── Workspace installation
│   ├── Channel notifications
│   │   ├── Document views
│   │   ├── Dataroom access
│   │   └── Custom webhooks
│   └── Bot messaging
└── OAuth Scopes:
    ├── channels:read
    ├── chat:write
    └── incoming-webhook
```

#### Cal.com Embed

```
Cal.com Integration
├── Package: @calcom/embed-react@1.5.3
├── Files:
│   └── (Used in components for meeting scheduling)
└── Features:
    ├── Embed meeting scheduler
    └── Calendar integration
```

---

### 10. WEBHOOKS

#### Outgoing Webhooks (User-Configured)

```
Webhook System
├── Database: Webhook model
│   ├── pId (public ID)
│   ├── url (delivery endpoint)
│   ├── secret (HMAC signing key)
│   └── triggers (JSON array of event types)
├── Files:
│   ├── lib/webhook/
│   │   ├── constants.ts (trigger types)
│   │   ├── types.ts (payload schemas)
│   │   └── send-webhooks.ts (delivery logic)
│   └── pages/api/webhooks/callback.ts (QStash callback)
├── Supported Triggers:
│   ├── link.created, link.updated, link.deleted
│   ├── dataroom.created, dataroom.updated, dataroom.deleted
│   ├── document.created, document.updated, document.deleted
│   └── view.created
├── Delivery Flow:
│   1. Event occurs
│   2. prepareWebhookPayload() creates payload
│   3. createWebhookSignature() generates HMAC-SHA256
│   4. Publish to QStash with callback URL
│   5. QStash delivers to customer endpoint
│   6. Callback to /api/webhooks/callback
│   7. Record delivery status in Tinybird (webhook_events__v1)
├── Signature:
│   ├── Header: X-Papermark-Signature
│   ├── Algorithm: HMAC-SHA256
│   └── Payload: JSON.stringify(event)
└── Management:
    └── pages/api/teams/[teamId]/webhooks/ (CRUD)
```

#### Incoming Webhooks (API Webhooks)

```
Incoming Webhook System
├── Database: IncomingWebhook model
│   ├── externalId (customer identifier)
│   ├── secret (verification key)
│   ├── source (allowed source URL)
│   ├── actions (scoped permissions)
│   ├── consecutiveFailures (auto-disable)
│   └── lastFailedAt
├── Files:
│   ├── lib/incoming-webhooks/ (handlers)
│   ├── lib/middleware/incoming-webhooks.ts (auth)
│   └── pages/api/webhooks/services/[...path]/index.ts (endpoint)
├── Configuration:
│   ├── NEXT_PUBLIC_WEBHOOK_BASE_URL
│   └── NEXT_PUBLIC_WEBHOOK_BASE_HOST
├── Features:
│   ├── External integrations calling Papermark
│   ├── Secret-based authentication
│   ├── Action scoping (e.g., documents:write)
│   ├── Source URL filtering
│   └── Failure tracking
└── Actions:
    ├── documents:write (create/update documents)
    ├── documentVersions:write
    └── (Extensible)
```

---

### 11. INFRASTRUCTURE

#### Vercel Platform Integration

```
Vercel-Specific Features
├── Deployment:
│   ├── Platform: Vercel
│   ├── Build Command: npm run vercel-build
│   └── Build Script: prisma migrate deploy && next build
├── Custom Domains:
│   ├── API Access:
│   │   ├── PROJECT_ID_VERCEL
│   │   ├── TEAM_ID_VERCEL
│   │   └── AUTH_BEARER_TOKEN (Vercel API token)
│   ├── Files:
│   │   ├── lib/domains.ts (domain management)
│   │   └── app/api/cron/domains/route.ts (verification cron)
│   └── Database: Domain model (verified flag)
├── Edge Config (Feature Flags):
│   ├── Package: @vercel/edge-config@1.4.3
│   ├── Files:
│   │   ├── lib/edge-config/ (client)
│   │   ├── lib/featureFlags/ (feature checks)
│   │   └── app/api/feature-flags/route.ts
│   └── Usage:
│       ├── Gradual feature rollout
│       ├── A/B testing
│       └── Emergency kill switches
├── Functions:
│   ├── Package: @vercel/functions@3.3.4
│   ├── Edge Functions: Lightweight routing
│   └── Serverless Functions: API routes
└── Analytics:
    └── Built-in: Vercel Analytics (optional)
```

#### Security & Encryption

```
Security Configuration
├── Document Password Encryption:
│   ├── NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY
│   ├── Package: bcryptjs@3.0.3
│   └── Files: lib/utils/ (encryption utilities)
├── JWT Tokens:
│   ├── Package: jsonwebtoken@9.0.3
│   ├── Files: lib/utils/generate-jwt.ts
│   └── Usage: Viewer tokens, API tokens
├── Verification URLs:
│   ├── NEXT_PRIVATE_VERIFICATION_SECRET
│   └── Files: lib/utils/generate-checksum.ts
├── WebAuthn/Passkeys:
│   ├── Package: @github/webauthn-json@2.1.1
│   └── Files: lib/api/auth/passkey.ts
└── Fraud Prevention:
    └── Files: ee/features/security/lib/fraud-prevention.ts
```

---

### 12. CRON JOBS & SCHEDULED TASKS

```
Cron Jobs (via Vercel Cron or QStash)
├── Domain Verification:
│   ├── Endpoint: app/api/cron/domains/route.ts
│   ├── Schedule: Daily
│   └── Purpose: Verify DNS records for custom domains
├── Year in Review:
│   ├── Endpoint: app/api/cron/year-in-review/route.ts
│   ├── Schedule: Annual (December)
│   └── Purpose: Generate analytics summary
├── Export Cleanup:
│   ├── Job: lib/trigger/cleanup-expired-exports.ts
│   ├── Schedule: Daily
│   └── Purpose: Delete old export files (3-day TTL)
└── Billing Reminders:
    ├── Job: lib/trigger/pause-reminder-notification.ts
    ├── Schedule: Based on pause dates
    └── Purpose: Remind users to resume subscription
```

---

## PART 2: LOCALIZATION PLAN - MINIMAL EXTERNAL DEPENDENCIES

### Strategy Overview

**Three Approaches:**

1. **Hybrid (Recommended):** Keep free-tier SaaS for complex services, self-host infrastructure
2. **Fully Self-Hosted:** Replace all external services with open-source alternatives
3. **Dev-Only:** Minimal setup for local development

---

### TIER 1: ABSOLUTELY REQUIRED

**Cannot be eliminated - must have locally or as SaaS**

#### 1.1 PostgreSQL Database

**Current:** Vercel Postgres, Neon, AWS RDS
**Local Alternative:** PostgreSQL in Docker
**Complexity:** ⭐ Easy

**Implementation:**

```bash
# Docker
docker run -d \
  --name papermark-postgres \
  -e POSTGRES_PASSWORD=papermark \
  -e POSTGRES_DB=papermark \
  -e POSTGRES_USER=postgres \
  -p 5432:5432 \
  -v papermark-postgres-data:/var/lib/postgresql/data \
  postgres:16

# Update .env
POSTGRES_PRISMA_URL="postgresql://postgres:papermark@localhost:5432/papermark?schema=public"
POSTGRES_PRISMA_URL_NON_POOLING="postgresql://postgres:papermark@localhost:5432/papermark?schema=public"

# Run migrations
npm run dev:prisma
```

**Docker Compose:**

```yaml
services:
  postgres:
    image: postgres:16
    container_name: papermark-postgres
    environment:
      POSTGRES_PASSWORD: papermark
      POSTGRES_DB: papermark
      POSTGRES_USER: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres-data:
```

**Production Notes:**
- Use connection pooling (PgBouncer)
- Regular backups (pg_dump)
- Monitoring (pg_stat_statements)

---

### TIER 2: CORE FUNCTIONALITY

**High priority to replace for full self-hosting**

#### 2.1 File Storage: S3/Vercel Blob → MinIO

**Current:** AWS S3 or Vercel Blob
**Local Alternative:** MinIO (S3-compatible)
**Complexity:** ⭐⭐ Medium
**Code Changes:** None (S3-compatible API)

**Implementation:**

```bash
# Docker
docker run -d \
  --name papermark-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  -v papermark-minio-data:/data \
  minio/minio server /data --console-address ":9001"

# Create bucket (via Console at http://localhost:9001 or CLI)
mc alias set local http://localhost:9000 minioadmin minioadmin123
mc mb local/papermark-uploads
mc mb local/papermark-uploads-advanced  # For special documents
```

**Docker Compose:**

```yaml
services:
  minio:
    image: minio/minio
    container_name: papermark-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    ports:
      - "9000:9000"  # API
      - "9001:9001"  # Console
    volumes:
      - minio-data:/data
    restart: unless-stopped

volumes:
  minio-data:
```

**Environment Variables:**

```bash
NEXT_PUBLIC_UPLOAD_TRANSPORT="s3"
NEXT_PRIVATE_UPLOAD_ENDPOINT="http://localhost:9000"
NEXT_PRIVATE_UPLOAD_REGION="us-east-1"
NEXT_PRIVATE_UPLOAD_BUCKET="papermark-uploads"
NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID="minioadmin"
NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY="minioadmin123"
NEXT_PRIVATE_UPLOAD_DISTRIBUTION_HOST="localhost:9000"

# For advanced features (if used)
NEXT_PRIVATE_ADVANCED_UPLOAD_BUCKET="papermark-uploads-advanced"
```

**Production Setup:**
- Use nginx/Caddy reverse proxy for HTTPS
- Set up CDN (optional: MinIO with nginx cache)
- Configure bucket policies for public/private access
- Regular backups

**No code changes required!** AWS SDK works seamlessly with MinIO.

---

#### 2.2 Email: Resend → SMTP/Nodemailer

**Current:** Resend + Unsend
**Local Alternative:** Mailhog (dev) or SMTP (prod)
**Complexity:** ⭐⭐⭐ Medium-High
**Code Changes:** Moderate refactoring required

**Development Setup (Mailhog):**

```bash
# Docker
docker run -d \
  --name papermark-mailhog \
  -p 1025:1025 \
  -p 8025:8025 \
  mailhog/mailhog

# Access UI: http://localhost:8025
```

**Docker Compose:**

```yaml
services:
  mailhog:
    image: mailhog/mailhog
    container_name: papermark-mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    restart: unless-stopped
```

**Production Setup (Real SMTP):**

Options:
- **Self-hosted:** Postfix, Sendmail, Exim
- **Third-party SMTP:** SendGrid, Mailgun, Amazon SES, SMTP2GO
- **Transactional services:** Postal (self-hosted alternative to Resend)

**Code Changes Required:**

File: `lib/resend.ts` → `lib/email.ts`

```typescript
// Before (Resend)
import { Resend } from 'resend';
export const resend = new Resend(process.env.RESEND_API_KEY);

// After (Nodemailer)
import nodemailer from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';

export const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  } : undefined,
});

// Wrapper function to match Resend API
export async function sendEmail(options: {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  text?: string;
}) {
  return emailTransporter.sendMail(options);
}
```

**Update all email sending functions:**

Files in `lib/emails/`:
- `send-document-notification.ts`
- `send-team-invitation.ts`
- `send-dataroom-notification.ts`
- ... (20+ email functions)

Example change:

```typescript
// Before
import { resend } from "@/lib/resend";

await resend.emails.send({
  from: "Papermark <notifications@papermark.io>",
  to: viewer.email,
  subject: "Document shared with you",
  react: DocumentNotificationEmail({ ... }),
});

// After
import { sendEmail } from "@/lib/email";
import { render } from "@react-email/render";
import DocumentNotificationEmail from "@/components/emails/document-notification";

await sendEmail({
  from: process.env.SMTP_FROM || "Papermark <notifications@localhost>",
  to: viewer.email,
  subject: "Document shared with you",
  html: render(DocumentNotificationEmail({ ... })),
  text: render(DocumentNotificationEmail({ ... }), { plainText: true }),
});
```

**Remove Unsend (optional):**

The Unsend integration is only for contact management. For self-hosting:
- Remove `lib/unsend.ts`
- Remove unsubscribe handling (or implement locally)
- Store unsubscribed emails in PostgreSQL

**Environment Variables:**

```bash
# Development (Mailhog)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM="Papermark <dev@localhost>"

# Production (Example: Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM="Papermark <notifications@yourdomain.com>"

# Production (Example: Amazon SES)
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
```

**Rate Limiting:**

Resend uses Bottleneck for rate limiting. Keep this:

File: `lib/email.ts` (add rate limiting)

```typescript
import Bottleneck from 'bottleneck';

// Rate limiter: 10 emails per second (adjust based on your SMTP limits)
const emailLimiter = new Bottleneck({
  reservoir: 10,
  reservoirRefreshAmount: 10,
  reservoirRefreshInterval: 1000,
  maxConcurrent: 5,
});

export async function sendEmail(options: SendMailOptions) {
  return emailLimiter.schedule(() => emailTransporter.sendMail(options));
}
```

**Testing:**

```bash
# Install nodemailer
npm install nodemailer
npm install -D @types/node

# Test email sending
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 1025,
  secure: false,
});
transporter.sendMail({
  from: 'test@localhost',
  to: 'user@localhost',
  subject: 'Test Email',
  text: 'This is a test email',
}).then(() => console.log('Email sent!')).catch(console.error);
"

# Check Mailhog UI: http://localhost:8025
```

**Deliverability Considerations:**

For production:
1. Set up SPF, DKIM, DMARC records
2. Use dedicated IP address
3. Warm up IP gradually
4. Monitor sender reputation
5. Consider using transactional email service for better deliverability

---

#### 2.3 Background Jobs: Trigger.dev → BullMQ

**Current:** Trigger.dev v3 (11 jobs)
**Local Alternative:** BullMQ + Redis
**Complexity:** ⭐⭐⭐⭐ High
**Code Changes:** Significant refactoring

**Setup:**

```bash
# Install BullMQ
npm install bullmq ioredis
npm install -D @types/ioredis
```

**Docker Compose (Redis):**

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: papermark-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped

volumes:
  redis-data:
```

**Create Queue System:**

File: `lib/queues/connection.ts`

```typescript
import Redis from 'ioredis';

export const redisConnection = new Redis(
  process.env.REDIS_URL || 'redis://localhost:6379',
  {
    maxRetriesPerRequest: null, // Required for BullMQ
  }
);
```

File: `lib/queues/index.ts`

```typescript
import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from './connection';

// Define queues
export const pdfConversionQueue = new Queue('pdf-conversion', {
  connection: redisConnection,
});

export const videoOptimizationQueue = new Queue('video-optimization', {
  connection: redisConnection,
});

export const emailQueue = new Queue('emails', {
  connection: redisConnection,
});

export const exportQueue = new Queue('exports', {
  connection: redisConnection,
});

// Queue for each Trigger.dev job:
export const cadConversionQueue = new Queue('cad-conversion', { connection: redisConnection });
export const keynoteConversionQueue = new Queue('keynote-conversion', { connection: redisConnection });
export const dataroomNotificationQueue = new Queue('dataroom-notifications', { connection: redisConnection });
// ... etc
```

**Migrate Jobs:**

Example: `convert-files-to-pdf` job

File: `lib/queues/workers/pdf-conversion.worker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../connection';
import { prisma } from '@/lib/prisma';
// Import conversion logic from Trigger.dev job

async function processPdfConversion(job: Job) {
  const { documentVersionId, teamId } = job.data;

  console.log(`Processing PDF conversion for version ${documentVersionId}`);

  try {
    // Your conversion logic here (from lib/trigger/convert-files.ts)
    // 1. Fetch document version from DB
    const version = await prisma.documentVersion.findUnique({
      where: { id: documentVersionId },
      include: { document: true },
    });

    // 2. Download file from S3
    // 3. Call LibreOffice API
    // 4. Upload converted PDF
    // 5. Update database
    // 6. Trigger next job (pdf-to-image)

    return { success: true };
  } catch (error) {
    console.error('PDF conversion failed:', error);
    throw error; // Will trigger retry
  }
}

// Create worker
export const pdfConversionWorker = new Worker(
  'pdf-conversion',
  processPdfConversion,
  {
    connection: redisConnection,
    concurrency: 10, // Same as Trigger.dev queue concurrency
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

pdfConversionWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

pdfConversionWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});
```

**Job Invocation:**

Replace Trigger.dev invocations throughout codebase:

```typescript
// Before (Trigger.dev)
import { tasks } from "@trigger.dev/sdk/v3";
await tasks.trigger("convert-files-to-pdf", {
  documentVersionId: version.id,
  teamId: team.id,
});

// After (BullMQ)
import { pdfConversionQueue } from "@/lib/queues";
await pdfConversionQueue.add('convert-pdf', {
  documentVersionId: version.id,
  teamId: team.id,
}, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
});
```

**Worker Process:**

Create separate worker process (doesn't run in Next.js):

File: `workers/index.ts`

```typescript
import { pdfConversionWorker } from '@/lib/queues/workers/pdf-conversion.worker';
import { videoOptimizationWorker } from '@/lib/queues/workers/video-optimization.worker';
// Import all workers

console.log('Starting Papermark Workers...');
console.log('Workers:', [
  pdfConversionWorker.name,
  videoOptimizationWorker.name,
  // ... list all
]);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing workers...');
  await Promise.all([
    pdfConversionWorker.close(),
    videoOptimizationWorker.close(),
  ]);
  process.exit(0);
});
```

**Update package.json:**

```json
{
  "scripts": {
    "dev": "next dev",
    "workers": "tsx workers/index.ts",
    "dev:full": "concurrently \"npm run dev\" \"npm run workers\""
  }
}
```

**Install dependencies:**

```bash
npm install tsx concurrently
```

**Jobs to Migrate:**

1. ✅ `convert-files-to-pdf` → `lib/queues/workers/pdf-conversion.worker.ts`
2. ✅ `convert-cad-to-pdf` → `lib/queues/workers/cad-conversion.worker.ts`
3. ✅ `convert-keynote-to-pdf` → `lib/queues/workers/keynote-conversion.worker.ts`
4. ✅ `pdf-to-image-route` → `lib/queues/workers/pdf-to-image.worker.ts`
5. ✅ `optimize-video-files` → `lib/queues/workers/video-optimization.worker.ts`
6. ✅ `export-visits` → `lib/queues/workers/export.worker.ts`
7. ✅ `cleanup-expired-exports` → Cron job or scheduled BullMQ job
8. ✅ `send-scheduled-email` → `lib/queues/workers/scheduled-email.worker.ts`
9. ✅ `dataroom-change-notification` → `lib/queues/workers/dataroom-notification.worker.ts`
10. ✅ `conversation-message-notification` → `lib/queues/workers/conversation-notification.worker.ts`
11. ✅ `pause-reminder-notification` → Scheduled BullMQ job

**Scheduled Jobs (Cron Replacement):**

File: `lib/queues/schedulers.ts`

```typescript
import { pdfConversionQueue, exportQueue } from './index';

// Cleanup expired exports (daily at 2 AM)
exportQueue.add(
  'cleanup-expired-exports',
  {},
  {
    repeat: {
      pattern: '0 2 * * *', // Cron syntax
    },
  }
);
```

**Dashboard (Optional):**

Use Bull Board for monitoring:

```bash
npm install @bull-board/api @bull-board/express
```

File: `pages/api/admin/queues/index.ts`

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { pdfConversionQueue, videoOptimizationQueue } from '@/lib/queues';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/api/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(pdfConversionQueue),
    new BullMQAdapter(videoOptimizationQueue),
    // ... add all queues
  ],
  serverAdapter,
});

// Access at: http://localhost:3000/api/admin/queues
```

**Production Deployment:**

- Run workers as separate process/container
- Use PM2 or systemd for process management
- Monitor with Bull Board or custom dashboard
- Set up alerts for failed jobs

**Effort Estimate:** 1-2 weeks for full migration

---

#### 2.4 Message Queue: Upstash QStash → BullMQ

**Current:** QStash for webhooks & cron
**Local Alternative:** BullMQ (same as 2.3)
**Complexity:** ⭐⭐⭐ Medium-High
**Code Changes:** Moderate

**Webhook Delivery:**

File: `lib/webhook/send-webhooks.ts`

Replace QStash calls with direct HTTP:

```typescript
// Before (QStash)
import { Client } from "@upstash/qstash";
const qstashClient = new Client({ token: process.env.QSTASH_TOKEN });

await qstashClient.publishJSON({
  url: webhook.url,
  body: payload,
  headers: {
    "X-Papermark-Signature": signature,
  },
});

// After (Direct HTTP with retry via BullMQ)
import { webhookDeliveryQueue } from "@/lib/queues";

await webhookDeliveryQueue.add('deliver-webhook', {
  webhookId: webhook.id,
  url: webhook.url,
  payload: payload,
  signature: signature,
}, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
});
```

Worker: `lib/queues/workers/webhook-delivery.worker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import fetch from 'node-fetch';

async function deliverWebhook(job: Job) {
  const { url, payload, signature } = job.data;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Papermark-Signature': signature,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed: ${response.status}`);
  }

  // Record delivery in Tinybird or PostgreSQL

  return { status: response.status };
}

export const webhookDeliveryWorker = new Worker(
  'webhook-delivery',
  deliverWebhook,
  { connection: redisConnection }
);
```

**Cron Jobs:**

Replace with BullMQ repeatable jobs (see 2.3 schedulers example).

---

#### 2.5 Rate Limiting & Cache: Upstash Redis → Local Redis

**Current:** Upstash Redis REST API
**Local Alternative:** Redis (same instance as BullMQ)
**Complexity:** ⭐⭐ Medium
**Code Changes:** Client library replacement

**Setup:**

Already done in 2.3 (same Redis instance).

**Code Changes:**

File: `lib/redis.ts`

```typescript
// Before (Upstash)
import { Redis } from "@upstash/redis";
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// After (ioredis)
import Redis from 'ioredis';
export const redis = new Redis(
  process.env.REDIS_URL || 'redis://localhost:6379'
);
```

**Rate Limiting:**

File: `lib/middleware/rate-limit.ts`

```typescript
// Before (Upstash Ratelimit)
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis";

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

// After (rate-limiter-flexible)
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '@/lib/redis';

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ratelimit',
  points: 10, // Number of requests
  duration: 10, // Per 10 seconds
});

// Usage
try {
  await rateLimiter.consume(userId);
  // Allow request
} catch {
  // Rate limit exceeded
  return res.status(429).json({ error: 'Too many requests' });
}
```

**Install:**

```bash
npm install rate-limiter-flexible
```

**Update all rate limiting middleware:**
- `lib/middleware/api-rate-limit.ts`
- `lib/middleware/link-rate-limit.ts`
- etc.

**Job Store:**

File: `lib/redis-job-store.ts`

Already uses basic Redis commands (set, get, zadd, etc.), so just replace client:

```typescript
// Before
import { redis } from "@upstash/redis";

// After
import { redis } from "./redis"; // ioredis client
```

Minor adjustments needed for command syntax (ioredis uses callbacks/promises slightly differently, but mostly compatible).

---

### TIER 3: AUTHENTICATION

**Selective localization - keep what works**

#### 3.1 OAuth Providers (Google, LinkedIn)

**Options:**

1. **Keep OAuth (Recommended):** Free, easy to set up
2. **Disable OAuth:** Use only email magic links
3. **Self-host OAuth:** Very complex, not recommended

**Recommendation:** Keep Google OAuth at minimum (widely used).

**To Disable:**

File: `pages/api/auth/[...nextauth].ts`

```typescript
// Comment out providers
providers: [
  // GoogleProvider({
  //   clientId: process.env.GOOGLE_CLIENT_ID!,
  //   clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  // }),
  // LinkedInProvider({
  //   clientId: process.env.LINKEDIN_CLIENT_ID!,
  //   clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
  // }),
  EmailProvider({
    // Keep this
    server: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    },
    from: process.env.SMTP_FROM,
  }),
],
```

#### 3.2 Passkeys (Hanko)

**Current:** Hanko Passkey API
**Options:**

1. **Keep Hanko:** Free tier available
2. **Disable Passkeys:** Remove feature
3. **Self-host WebAuthn:** Very complex

**Recommendation:** Keep Hanko free tier or disable.

**To Disable:**

- Remove `@teamhanko/passkeys-next-auth-provider` from providers
- Hide passkey UI in login page
- Remove `lib/hanko.ts` and `lib/api/auth/passkey.ts`

---

### TIER 4: ANALYTICS

**Can be disabled or replaced**

#### 4.1 Tinybird → ClickHouse or Disable

**Current:** Tinybird (real-time analytics)
**Local Alternative:** ClickHouse
**Complexity:** ⭐⭐⭐⭐⭐ Very High
**Recommended:** Disable for local dev

**Option A: Disable Analytics**

Simplest approach:

```typescript
// lib/tinybird/publish.ts
export async function publishEvent(data: any) {
  if (!process.env.TINYBIRD_TOKEN) {
    console.log('Tinybird disabled, skipping event:', data);
    return;
  }
  // ... existing code
}
```

Views are still tracked in PostgreSQL `View` table, so basic analytics remain.

**Option B: ClickHouse (Full Replacement)**

Docker Compose:

```yaml
services:
  clickhouse:
    image: clickhouse/clickhouse-server
    container_name: papermark-clickhouse
    ports:
      - "8123:8123"  # HTTP
      - "9000:9000"  # Native
    volumes:
      - clickhouse-data:/var/lib/clickhouse
    ulimits:
      nofile:
        soft: 262144
        hard: 262144
    restart: unless-stopped

volumes:
  clickhouse-data:
```

**Migration Steps:**

1. Install ClickHouse client: `npm install @clickhouse/client`
2. Create tables matching Tinybird datasources
3. Migrate schemas from `lib/tinybird/datasources/*.datasource`
4. Rewrite queries from `lib/tinybird/endpoints/get_*.pipe`
5. Update `lib/tinybird/publish.ts` to use ClickHouse client
6. Update `lib/tinybird/pipes.ts` for queries

**Effort:** 2-3 weeks (20+ queries to migrate)

---

#### 4.2 PostHog & Jitsu → Disable

**Easy:** Just remove env vars

```bash
# .env
NEXT_PUBLIC_POSTHOG_KEY=
JITSU_HOST=
JITSU_WRITE_KEY=
```

Code will gracefully skip tracking when these are missing.

---

### TIER 5: PAYMENTS

#### 5.1 Stripe → Test Mode or Mock

**Options:**

1. **Stripe Test Mode (Recommended):** Free, full functionality
2. **Mock Stripe:** Fake checkout flows
3. **Disable Billing:** Remove plan restrictions

**Test Mode Setup:**

```bash
# .env
STRIPE_SECRET_KEY=sk_test_...  # Get from Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_...

# Test webhook locally
npm run stripe:webhook
```

**To Disable Billing:**

Remove plan checks throughout codebase:

```typescript
// Before
if (team.plan === 'FREE' && documents.length >= 5) {
  return res.status(403).json({ error: 'Upgrade to add more documents' });
}

// After
// Remove or comment out
```

---

### TIER 6: AI (OPTIONAL)

#### 6.1 OpenAI → Local LLM or Disable

**Current:** OpenAI GPT-4 + Vector Stores
**Local Alternative:** Ollama + Chroma/Qdrant
**Complexity:** ⭐⭐⭐⭐ High
**Recommended:** Disable for local dev

**Option A: Disable AI**

```bash
# .env
OPENAI_API_KEY=
```

Hide AI features in UI:

```typescript
// components/... (various AI components)
if (!process.env.OPENAI_API_KEY) {
  return null; // Don't render AI features
}
```

**Option B: Ollama (Local LLM)**

Docker:

```bash
docker run -d \
  --name papermark-ollama \
  -p 11434:11434 \
  -v papermark-ollama-data:/root/.ollama \
  ollama/ollama

# Pull model
docker exec papermark-ollama ollama pull llama2
```

Replace OpenAI calls:

```typescript
// Before
import { OpenAI } from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// After
const response = await fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama2',
    prompt: userMessage,
  }),
});
```

For vector search, use Chroma or Qdrant instead of OpenAI Vector Stores.

**Effort:** 1-2 weeks

---

### TIER 7: DOCUMENT PROCESSING

#### 7.1 LibreOffice API → Local LibreOffice

**Current:** External LibreOffice API
**Local Alternative:** Self-hosted LibreOffice
**Complexity:** ⭐⭐ Medium

**Docker Setup:**

```yaml
services:
  libreoffice:
    image: xcgd/libreoffice-online
    container_name: papermark-libreoffice
    ports:
      - "9980:9980"
    environment:
      - domain=localhost
    restart: unless-stopped
```

Or use CLI directly:

```typescript
// lib/documents/convert-with-libreoffice.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function convertToPDF(inputPath: string, outputPath: string) {
  await execAsync(
    `libreoffice --headless --convert-to pdf --outdir ${outputPath} ${inputPath}`
  );
}
```

**Update Trigger.dev job:**

File: `lib/trigger/convert-files.ts`

Replace LibreOffice API calls with local conversion.

---

#### 7.2 ConvertAPI → Disable

**Current:** ConvertAPI (CAD, Keynote)
**Local:** No good free alternative
**Recommendation:** Disable these file types

Update upload validation to reject .dwg, .dxf, .key files.

---

### TIER 8: INTEGRATIONS (OPTIONAL)

**All can be disabled for local dev**

- **Slack:** Remove OAuth, hide integration UI
- **Notion:** Disable import feature
- **Cal.com:** Hide scheduling embeds
- **Dub.co:** Remove discount lookup

---

## MINIMAL VIABLE LOCAL SETUP

**Quickest path to running Papermark locally**

### Complete Docker Compose

File: `docker-compose.yml`

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16
    container_name: papermark-postgres
    environment:
      POSTGRES_PASSWORD: papermark
      POSTGRES_DB: papermark
      POSTGRES_USER: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio
    container_name: papermark-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    ports:
      - "9000:9000"  # API
      - "9001:9001"  # Console
    volumes:
      - minio-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 3

  # Redis (Cache, Rate Limiting, Job Queue)
  redis:
    image: redis:7-alpine
    container_name: papermark-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # Mailhog (Email testing)
  mailhog:
    image: mailhog/mailhog
    container_name: papermark-mailhog
    ports:
      - "1025:1025"  # SMTP server
      - "8025:8025"  # Web UI
    restart: unless-stopped

  # ClickHouse (Optional - Analytics)
  clickhouse:
    image: clickhouse/clickhouse-server
    container_name: papermark-clickhouse
    ports:
      - "8123:8123"  # HTTP
      - "9000:9000"  # Native
    volumes:
      - clickhouse-data:/var/lib/clickhouse
    ulimits:
      nofile:
        soft: 262144
        hard: 262144
    restart: unless-stopped
    profiles:
      - analytics  # Only start with: docker-compose --profile analytics up

volumes:
  postgres-data:
  minio-data:
  redis-data:
  clickhouse-data:

networks:
  default:
    name: papermark-network
```

### Environment Configuration

File: `.env.local`

```bash
# ============================================
# PAPERMARK LOCAL DEVELOPMENT CONFIGURATION
# ============================================

# Next.js
NODE_ENV=development
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_MARKETING_URL=http://localhost:3000
NEXT_PUBLIC_APP_BASE_HOST=localhost

# NextAuth
NEXTAUTH_SECRET=local-development-secret-change-in-production
NEXTAUTH_URL=http://localhost:3000

# ============================================
# DATABASE
# ============================================
POSTGRES_PRISMA_URL="postgresql://postgres:papermark@localhost:5432/papermark?schema=public"
POSTGRES_PRISMA_URL_NON_POOLING="postgresql://postgres:papermark@localhost:5432/papermark?schema=public"

# ============================================
# FILE STORAGE (MinIO)
# ============================================
NEXT_PUBLIC_UPLOAD_TRANSPORT="s3"
NEXT_PRIVATE_UPLOAD_ENDPOINT="http://localhost:9000"
NEXT_PRIVATE_UPLOAD_REGION="us-east-1"
NEXT_PRIVATE_UPLOAD_BUCKET="papermark-uploads"
NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID="minioadmin"
NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY="minioadmin123"
NEXT_PRIVATE_UPLOAD_DISTRIBUTION_HOST="localhost:9000"

# Advanced storage (optional, for special documents)
NEXT_PRIVATE_ADVANCED_UPLOAD_BUCKET="papermark-uploads-advanced"

# ============================================
# EMAIL (Mailhog for testing)
# ============================================
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM="Papermark <dev@localhost>"

# Disable Resend & Unsend
RESEND_API_KEY=
UNSEND_API_KEY=

# ============================================
# REDIS (Cache & Queue)
# ============================================
REDIS_URL=redis://localhost:6379
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Redis locker for TUS uploads
UPSTASH_REDIS_REST_LOCKER_URL=
UPSTASH_REDIS_REST_LOCKER_TOKEN=

# ============================================
# AUTHENTICATION (Disable OAuth for local)
# ============================================
# Google OAuth (optional - keep if you want Google login)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# LinkedIn OAuth (optional)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# Hanko Passkeys (optional)
HANKO_API_KEY=
NEXT_PUBLIC_HANKO_TENANT_ID=

# ============================================
# ANALYTICS (Disabled for local)
# ============================================
TINYBIRD_TOKEN=
NEXT_PUBLIC_POSTHOG_KEY=
JITSU_HOST=
JITSU_WRITE_KEY=
DUB_API_KEY=

# ============================================
# PAYMENTS (Use Stripe test mode or disable)
# ============================================
STRIPE_SECRET_KEY=  # Leave empty to disable billing
STRIPE_WEBHOOK_SECRET=

# ============================================
# BACKGROUND JOBS (Disabled - use BullMQ locally)
# ============================================
TRIGGER_SECRET_KEY=
TRIGGER_API_URL=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# ============================================
# AI (Disabled for local)
# ============================================
OPENAI_API_KEY=

# ============================================
# DOCUMENT PROCESSING
# ============================================
# LibreOffice API (disable - will use local conversion)
NEXT_PRIVATE_CONVERSION_BASE_URL=
NEXT_PRIVATE_INTERNAL_AUTH_TOKEN=

# ConvertAPI (disable - CAD/Keynote not supported locally)
NEXT_PRIVATE_CONVERT_API_URL=
NEXT_PRIVATE_CONVERT_API_KEY=

# ============================================
# SECURITY
# ============================================
NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY=local-document-encryption-key
NEXT_PRIVATE_VERIFICATION_SECRET=local-verification-secret

# ============================================
# INTEGRATIONS (Disabled for local)
# ============================================
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# ============================================
# VERCEL (Not needed locally)
# ============================================
PROJECT_ID_VERCEL=
TEAM_ID_VERCEL=
AUTH_BEARER_TOKEN=

# Webhooks
NEXT_PUBLIC_WEBHOOK_BASE_URL=
NEXT_PUBLIC_WEBHOOK_BASE_HOST=
```

### Setup Script

File: `scripts/setup-local.sh`

```bash
#!/bin/bash

echo "🚀 Setting up Papermark for local development..."

# Start Docker services
echo "📦 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Install dependencies
echo "📚 Installing npm dependencies..."
npm install

# Setup MinIO buckets
echo "🪣 Creating MinIO buckets..."
docker exec papermark-minio sh -c "
  mc alias set local http://localhost:9000 minioadmin minioadmin123
  mc mb local/papermark-uploads --ignore-existing
  mc mb local/papermark-uploads-advanced --ignore-existing
  mc anonymous set download local/papermark-uploads
  mc anonymous set download local/papermark-uploads-advanced
"

# Setup database
echo "🗄️  Setting up database..."
npx prisma generate
npx prisma migrate deploy

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Copy .env.example to .env and configure"
echo "  2. Run 'npm run dev' to start the app"
echo "  3. Visit http://localhost:3000"
echo ""
echo "📧 Mailhog UI: http://localhost:8025"
echo "🪣 MinIO Console: http://localhost:9001"
echo ""
```

Make executable:

```bash
chmod +x scripts/setup-local.sh
```

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/mfts/papermark.git
cd papermark

# 2. Run setup script
./scripts/setup-local.sh

# 3. Copy environment file
cp .env.example .env.local
# Edit .env.local with above configuration

# 4. Start development
npm run dev

# 5. Access application
# App: http://localhost:3000
# Mailhog: http://localhost:8025
# MinIO: http://localhost:9001
```

### Limitations of Minimal Setup

**What Works:**
- ✅ User authentication (email magic links)
- ✅ Document uploads (to MinIO)
- ✅ Link sharing
- ✅ View tracking (PostgreSQL only, no real-time analytics)
- ✅ Datarooms
- ✅ Basic document viewer (PDF)
- ✅ Email notifications (to Mailhog)
- ✅ Team management

**What Doesn't Work:**
- ❌ Background jobs (file conversion, video optimization, exports)
- ❌ Real-time analytics (Tinybird)
- ❌ AI chat/Q&A
- ❌ OAuth login (unless configured)
- ❌ Stripe billing (unless test mode configured)
- ❌ Integrations (Slack, Notion, etc.)
- ❌ CAD/Keynote file conversion
- ❌ Webhook delivery (unless BullMQ implemented)

**To Enable Background Jobs:**

Implement BullMQ workers (see Tier 2.3) and run:

```bash
npm run workers  # Separate terminal
```

---

## COST ANALYSIS

### Current Production (SaaS)

| Service | Free Tier | Paid Tier | Estimated Cost |
|---------|-----------|-----------|----------------|
| **Database** | |||
| Vercel Postgres | 256 MB | 1 GB: $25/mo | $25-50/mo |
| Neon | 512 MB | 1 GB: $19/mo | $19-40/mo |
| **Storage** ||||
| Vercel Blob | 500 MB | 100 GB: $25/mo | $25-100/mo |
| AWS S3 | 5 GB | 100 GB: $2.30/mo | $5-50/mo |
| CloudFront | 1 TB transfer | $0.085/GB | $10-50/mo |
| **Email** ||||
| Resend | 100/day (3k/mo) | Pro: $20/mo (50k/mo) | $0-20/mo |
| **Background Jobs** ||||
| Trigger.dev | 1M steps/mo | Pro: $20/mo | $0-100/mo |
| Upstash QStash | 500 msg/day | Pay-as-go: $0.40/100k | $0-20/mo |
| **Cache** ||||
| Upstash Redis | 10k commands/day | Pay-as-go: $0.20/100k | $0-10/mo |
| **Analytics** ||||
| Tinybird | 1k events/day | Build: $49/mo | $0-100/mo |
| PostHog | 1M events/mo | $0.00031/event | $0-50/mo |
| **AI** ||||
| OpenAI | Pay-as-go | GPT-4: $10/1M tokens | $50-500/mo |
| **Payments** ||||
| Stripe | Free | 2.9% + $0.30/txn | Variable |
| **TOTAL** || **SaaS Setup** | **$50-1000/mo** |

### Self-Hosted Setup

| Component | Option | Cost |
|-----------|--------|------|
| **Server** |||
| Hetzner VPS | CPX31 (4 vCPU, 8GB RAM) | €13/mo (~$14) |
| DigitalOcean | Basic (2 vCPU, 4GB RAM) | $24/mo |
| AWS EC2 | t3.medium (2 vCPU, 4GB) | ~$30/mo |
| **Storage** |||
| Hetzner Volume | 100 GB | €5/mo (~$5) |
| DigitalOcean Spaces | 250 GB | $5/mo |
| **Bandwidth** |||
| Included | 20 TB (Hetzner) | Free |
| **Email (Optional)** |||
| Amazon SES | 62k emails/mo free (AWS) | Free |
| SendGrid | 100 emails/day | Free |
| SMTP2GO | 1k emails/mo | Free |
| **Domain** |||
| .com | Annual | $12/yr (~$1/mo) |
| **SSL** |||
| Let's Encrypt | Free | Free |
| **TOTAL** | **Self-Hosted** | **$20-80/mo** |

**Savings:** $30-920/mo (60-92% cost reduction)

**Trade-offs:**
- ⏱️ Setup time: 1-4 weeks
- 🔧 Maintenance: Ongoing
- 📈 Scalability: Manual
- 🛡️ Security: Your responsibility
- 📊 Monitoring: Self-managed

---

## IMPLEMENTATION ROADMAP

### Phase 1: Core Infrastructure (Week 1)

**Goal:** Get app running locally with basic functionality

**Tasks:**
- [ ] Set up Docker Compose (PostgreSQL, MinIO, Redis, Mailhog)
- [ ] Configure environment variables
- [ ] Initialize database (migrations)
- [ ] Create MinIO buckets
- [ ] Test file upload/download
- [ ] Verify email sending (Mailhog)

**Deliverables:**
- Working local development environment
- Basic CRUD operations functional
- Email notifications working

**Complexity:** ⭐⭐ Medium
**Time:** 2-3 days

---

### Phase 2: Email System (Week 1-2)

**Goal:** Replace Resend with SMTP/Nodemailer

**Tasks:**
- [ ] Refactor `lib/resend.ts` → `lib/email.ts`
- [ ] Update all email sending functions (20+ files)
- [ ] Implement rate limiting (Bottleneck)
- [ ] Test all email flows
- [ ] Configure production SMTP (if applicable)

**Deliverables:**
- Email system fully migrated
- All email templates working
- Rate limiting operational

**Complexity:** ⭐⭐⭐ Medium-High
**Time:** 3-5 days

---

### Phase 3: Background Jobs (Week 2-3)

**Goal:** Replace Trigger.dev with BullMQ

**Tasks:**
- [ ] Install BullMQ + ioredis
- [ ] Create queue system (`lib/queues/`)
- [ ] Migrate 11 Trigger.dev jobs to workers
  - [ ] PDF conversion
  - [ ] CAD conversion
  - [ ] Keynote conversion
  - [ ] PDF to image
  - [ ] Video optimization
  - [ ] Export visits
  - [ ] Cleanup exports
  - [ ] Scheduled email
  - [ ] Dataroom notifications
  - [ ] Conversation notifications
  - [ ] Billing reminders
- [ ] Update job invocations throughout codebase
- [ ] Create worker process (`workers/index.ts`)
- [ ] Set up job monitoring (Bull Board)
- [ ] Test all job flows

**Deliverables:**
- All background jobs migrated
- Worker process operational
- Job monitoring dashboard

**Complexity:** ⭐⭐⭐⭐ High
**Time:** 7-10 days

---

### Phase 4: Webhook & Queue System (Week 3-4)

**Goal:** Replace QStash with BullMQ

**Tasks:**
- [ ] Migrate webhook delivery to BullMQ
- [ ] Implement retry logic
- [ ] Migrate cron jobs to BullMQ schedulers
- [ ] Replace Upstash Redis with ioredis
- [ ] Update rate limiting (`rate-limiter-flexible`)
- [ ] Test webhook delivery
- [ ] Test scheduled jobs

**Deliverables:**
- Webhook system fully functional
- Cron jobs operational
- Rate limiting working

**Complexity:** ⭐⭐⭐ Medium-High
**Time:** 3-5 days

---

### Phase 5: Analytics (Week 4-6) - OPTIONAL

**Goal:** Replace Tinybird with ClickHouse OR disable

**Option A: Disable (Recommended for MVP)**
- [ ] Comment out Tinybird publish calls
- [ ] Rely on PostgreSQL View table
- [ ] Hide real-time analytics UI

**Time:** 1 day

**Option B: ClickHouse Migration (Advanced)**
- [ ] Set up ClickHouse
- [ ] Migrate datasource schemas (5 schemas)
- [ ] Rewrite analytical queries (20+ endpoints)
- [ ] Update publish functions
- [ ] Update analytics UI
- [ ] Test all analytics flows

**Time:** 2-3 weeks

---

### Phase 6: Document Processing (Week 5)

**Goal:** Self-host document conversion

**Tasks:**
- [ ] Set up local LibreOffice (Docker or CLI)
- [ ] Update PDF conversion job
- [ ] Disable CAD/Keynote conversion (or find alternatives)
- [ ] Test Office → PDF conversion
- [ ] Test PDF → image conversion

**Deliverables:**
- Office document conversion working
- PDF processing functional

**Complexity:** ⭐⭐ Medium
**Time:** 2-3 days

---

### Phase 7: Testing & Bug Fixes (Week 6)

**Goal:** Ensure all features work end-to-end

**Tasks:**
- [ ] End-to-end testing (all user flows)
- [ ] Performance testing
- [ ] Load testing (queues, workers)
- [ ] Fix bugs
- [ ] Documentation

**Deliverables:**
- Stable self-hosted version
- Documentation

**Complexity:** ⭐⭐⭐ Medium
**Time:** 5-7 days

---

### Phase 8: Production Deployment (Week 7)

**Goal:** Deploy to production server

**Tasks:**
- [ ] Provision server (VPS)
- [ ] Set up Docker in production
- [ ] Configure domain & SSL
- [ ] Set up monitoring (logs, metrics)
- [ ] Set up backups (database, files)
- [ ] Configure firewall
- [ ] Deploy application
- [ ] Smoke testing

**Deliverables:**
- Production-ready deployment
- Monitoring & backups operational

**Complexity:** ⭐⭐⭐ Medium
**Time:** 3-5 days

---

### Total Time Estimates

| Approach | Complexity | Time |
|----------|------------|------|
| **Minimal Dev Setup** | ⭐⭐ | 2-3 days |
| **Hybrid (Keep Some SaaS)** | ⭐⭐⭐ | 1-2 weeks |
| **Full Self-Hosted (No Analytics)** | ⭐⭐⭐⭐ | 4-5 weeks |
| **Full Self-Hosted (With Analytics)** | ⭐⭐⭐⭐⭐ | 6-8 weeks |

---

## RECOMMENDED NEXT STEPS

### For Local Development (Quick Start)

1. **Use Docker Compose setup** (provided above)
2. **Keep free-tier SaaS:**
   - Trigger.dev (1M steps/mo free)
   - Upstash (10k commands/day free)
   - Resend (100 emails/day free)
   - Tinybird (1k events/day free)
3. **Self-host only:**
   - PostgreSQL
   - MinIO
   - Local Redis (cache only)
   - Mailhog (dev emails)

**Result:** Fully functional local dev in 1-2 days, $0 cost.

---

### For Production Self-Hosting (Recommended)

**Phase 1 (Week 1-2):** Infrastructure + Email
- PostgreSQL, MinIO, Redis
- SMTP migration

**Phase 2 (Week 3-4):** Background Jobs
- BullMQ migration (critical for file processing)

**Phase 3 (Week 5-6):** Polish
- Document processing
- Testing
- Deployment

**Keep as SaaS (optional):**
- Tinybird (analytics) - $0-49/mo
- OpenAI (AI) - pay-as-go
- Stripe (payments) - per-transaction

**Total Cost:** $20-80/mo + optional SaaS

---

## QUESTIONS TO ANSWER

Before proceeding, decide:

1. **Use case:** Local dev only or production self-hosting?
2. **Timeline:** How quickly do you need this?
3. **Analytics:** Keep Tinybird, migrate to ClickHouse, or disable?
4. **Background jobs:** Can you invest 1-2 weeks for BullMQ migration?
5. **Email:** Can you set up SMTP or keep Resend?
6. **AI features:** Keep, disable, or self-host (Ollama)?
7. **Billing:** Keep Stripe test mode or remove entirely?

**Next Step:** Let me know your answers and I can provide:
- Detailed implementation code for specific components
- Step-by-step migration guides
- Docker files and scripts
- Testing procedures

---

**End of Documentation**

*This analysis was generated by examining the complete Papermark codebase. All file paths, environment variables, and integration details are accurate as of December 13, 2024.*
