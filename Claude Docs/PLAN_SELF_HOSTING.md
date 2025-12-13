# Papermark Self-Hosting Plan: Replace External Dependencies

**Goal:** Make Papermark truly self-hostable by replacing cloud dependencies with local alternatives.

**Current Status:**
- PostgreSQL - **DONE** (Docker)
- S3 Storage - **DONE** (AWS S3)
- Redis - Upstash (needs local replacement)
- Background Jobs - Trigger.dev (needs BullMQ replacement) **<-- BLOCKING ISSUE**
- Email - Resend (needs SMTP replacement)

---

## Priority 1: Replace Trigger.dev with BullMQ (CRITICAL)

**Why:** Document processing is completely broken without this. PDFs never get converted to images.

### 1.1 Install Dependencies

```bash
npm install bullmq ioredis
npm install -D @types/ioredis tsx concurrently
```

### 1.2 Set Up Local Redis

Add to `docker-compose.local.yml`:

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

### 1.3 Create Queue Infrastructure

**File: `lib/queues/connection.ts`**

```typescript
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const createRedisConnection = () => {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
  });
};

export const redisConnection = createRedisConnection();
```

**File: `lib/queues/index.ts`**

```typescript
import { Queue } from "bullmq";
import { redisConnection } from "./connection";

// Document Processing Queues
export const pdfToImageQueue = new Queue("pdf-to-image", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const fileConversionQueue = new Queue("file-conversion", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});

export const videoOptimizationQueue = new Queue("video-optimization", {
  connection: redisConnection,
});

export const exportQueue = new Queue("export-visits", {
  connection: redisConnection,
});

export const emailQueue = new Queue("scheduled-email", {
  connection: redisConnection,
});

export const notificationQueue = new Queue("notifications", {
  connection: redisConnection,
});

export const webhookQueue = new Queue("webhook-delivery", {
  connection: redisConnection,
});
```

### 1.4 Create Workers

**File: `lib/queues/workers/pdf-to-image.worker.ts`**

```typescript
import { Worker, Job } from "bullmq";
import { redisConnection } from "../connection";
import prisma from "@/lib/prisma";
import { getFile } from "@/lib/files/get-file";

type PdfToImagePayload = {
  documentId: string;
  documentVersionId: string;
  teamId: string;
  versionNumber?: number;
};

async function processPdfToImage(job: Job<PdfToImagePayload>) {
  const { documentVersionId, teamId, documentId, versionNumber } = job.data;

  console.log(`[PDF Worker] Processing document version: ${documentVersionId}`);

  // 1. Get document version
  const documentVersion = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    select: { file: true, storageType: true, numPages: true },
  });

  if (!documentVersion) {
    throw new Error("Document version not found");
  }

  // 2. Get signed URL
  const signedUrl = await getFile({
    type: documentVersion.storageType,
    data: documentVersion.file,
  });

  if (!signedUrl) {
    throw new Error("Failed to get signed URL");
  }

  let numPages = documentVersion.numPages;

  // 3. Get page count if not set
  if (!numPages || numPages === 1) {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/mupdf/get-pages`,
      {
        method: "POST",
        body: JSON.stringify({ url: signedUrl }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get page count");
    }

    const { numPages: pageCount } = await response.json();
    numPages = pageCount;
  }

  // 4. Convert each page
  for (let i = 1; i <= numPages; i++) {
    console.log(`[PDF Worker] Converting page ${i}/${numPages}`);

    await job.updateProgress((i / numPages) * 100);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/mupdf/convert-page`,
      {
        method: "POST",
        body: JSON.stringify({
          documentVersionId,
          pageNumber: i,
          url: signedUrl,
          teamId,
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 400 && error.error?.includes("blocked")) {
        throw new Error("Document processing blocked");
      }
      throw new Error(`Failed to convert page ${i}`);
    }
  }

  // 5. Update document version
  await prisma.documentVersion.update({
    where: { id: documentVersionId },
    data: {
      numPages,
      hasPages: true,
      isPrimary: true,
    },
  });

  // 6. Update other versions to not primary
  if (versionNumber) {
    await prisma.documentVersion.updateMany({
      where: {
        documentId,
        versionNumber: { not: versionNumber },
      },
      data: { isPrimary: false },
    });
  }

  // 7. Revalidate links
  await fetch(
    `${process.env.NEXTAUTH_URL}/api/revalidate?secret=${process.env.REVALIDATE_TOKEN}&documentId=${documentId}`
  );

  console.log(`[PDF Worker] Completed: ${documentVersionId}`);

  return { success: true, totalPages: numPages };
}

export const pdfToImageWorker = new Worker("pdf-to-image", processPdfToImage, {
  connection: redisConnection,
  concurrency: 5,
});

pdfToImageWorker.on("completed", (job) => {
  console.log(`[PDF Worker] Job ${job.id} completed`);
});

pdfToImageWorker.on("failed", (job, err) => {
  console.error(`[PDF Worker] Job ${job?.id} failed:`, err.message);
});
```

**File: `lib/queues/workers/file-conversion.worker.ts`**

```typescript
import { Worker, Job } from "bullmq";
import { redisConnection } from "../connection";
import prisma from "@/lib/prisma";
import { pdfToImageQueue } from "../index";

// Import the conversion logic from existing Trigger.dev job
// This handles Office docs -> PDF conversion

type FileConversionPayload = {
  documentVersionId: string;
  teamId: string;
  documentId: string;
};

async function processFileConversion(job: Job<FileConversionPayload>) {
  const { documentVersionId, teamId, documentId } = job.data;

  console.log(`[Conversion Worker] Processing: ${documentVersionId}`);

  // Get document version
  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    select: { file: true, type: true, storageType: true },
  });

  if (!version) {
    throw new Error("Document version not found");
  }

  // Check if conversion is needed
  const needsConversion = [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ].includes(version.type || "");

  if (needsConversion) {
    // Call LibreOffice conversion API
    const response = await fetch(
      process.env.NEXT_PRIVATE_CONVERSION_BASE_URL + "/convert",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PRIVATE_INTERNAL_AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentVersionId,
          teamId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Conversion failed");
    }
  }

  // Queue PDF to image conversion
  await pdfToImageQueue.add("convert", {
    documentId,
    documentVersionId,
    teamId,
  });

  return { success: true };
}

export const fileConversionWorker = new Worker(
  "file-conversion",
  processFileConversion,
  {
    connection: redisConnection,
    concurrency: 10,
  }
);
```

### 1.5 Create Worker Entry Point

**File: `workers/index.ts`**

```typescript
import "../lib/queues/workers/pdf-to-image.worker";
import "../lib/queues/workers/file-conversion.worker";
// Add more workers as needed

console.log("=================================");
console.log("Papermark Workers Started");
console.log("=================================");
console.log("Active workers:");
console.log("  - pdf-to-image");
console.log("  - file-conversion");
console.log("=================================");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down workers...");
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down workers...");
  process.exit(0);
});
```

### 1.6 Update Document Upload to Use BullMQ

Find where Trigger.dev is invoked after document upload and replace:

**Before (Trigger.dev):**
```typescript
import { tasks } from "@trigger.dev/sdk/v3";

await tasks.trigger("convert-pdf-to-image-route", {
  documentVersionId: version.id,
  teamId: team.id,
  documentId: document.id,
});
```

**After (BullMQ):**
```typescript
import { pdfToImageQueue, fileConversionQueue } from "@/lib/queues";

// For PDFs
await pdfToImageQueue.add("convert", {
  documentVersionId: version.id,
  teamId: team.id,
  documentId: document.id,
});

// For Office docs
await fileConversionQueue.add("convert", {
  documentVersionId: version.id,
  teamId: team.id,
  documentId: document.id,
});
```

### 1.7 Update package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "workers": "tsx --watch workers/index.ts",
    "dev:full": "concurrently \"npm run dev\" \"npm run workers\"",
    "build": "next build",
    "start": "next start",
    "start:workers": "tsx workers/index.ts"
  }
}
```

### 1.8 Environment Variables

Add to `.env`:

```bash
# Local Redis (for BullMQ)
REDIS_URL=redis://localhost:6379

# Internal API key for worker -> app communication
INTERNAL_API_KEY=your-internal-api-key-here
```

### 1.9 Running Locally

```bash
# Terminal 1: Start Redis
docker-compose -f docker-compose.local.yml up -d redis

# Terminal 2: Start Next.js
npm run dev

# Terminal 3: Start Workers
npm run workers
```

Or all at once:
```bash
npm run dev:full
```

---

## Priority 2: Replace Upstash Redis with Local Redis

### 2.1 Update `lib/redis.ts`

**Before:**
```typescript
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
```

**After:**
```typescript
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(REDIS_URL);

// Keep the locker redis for TUS uploads if needed
export const lockerRedisClient = new Redis(
  process.env.REDIS_LOCKER_URL || REDIS_URL
);
```

### 2.2 Update Rate Limiting

Replace `@upstash/ratelimit` with `rate-limiter-flexible`:

```bash
npm install rate-limiter-flexible
```

**File: `lib/rate-limit.ts`**

```typescript
import { RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "./redis";

export const createRateLimiter = (
  points: number = 10,
  duration: number = 10
) => {
  return new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "papermark-ratelimit",
    points,
    duration,
  });
};

export const ratelimit = createRateLimiter();
```

---

## Priority 3: Replace Resend with SMTP/Nodemailer

### 3.1 Install Dependencies

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

### 3.2 Create Email Client

**File: `lib/email.ts`**

```typescript
import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import Bottleneck from "bottleneck";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "1025"),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      }
    : undefined,
});

// Rate limiter: 10 emails per second
const limiter = new Bottleneck({
  reservoir: 10,
  reservoirRefreshAmount: 10,
  reservoirRefreshInterval: 1000,
  maxConcurrent: 5,
});

interface SendEmailOptions {
  from?: string;
  to: string | string[];
  subject: string;
  react?: React.ReactElement;
  html?: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions) {
  const html = options.html || (options.react ? render(options.react) : "");
  const text =
    options.text || (options.react ? render(options.react, { plainText: true }) : "");

  return limiter.schedule(() =>
    transporter.sendMail({
      from: options.from || process.env.SMTP_FROM || "Papermark <noreply@localhost>",
      to: options.to,
      subject: options.subject,
      html,
      text,
      replyTo: options.replyTo,
    })
  );
}
```

### 3.3 Add Mailhog for Development

Add to `docker-compose.local.yml`:

```yaml
services:
  mailhog:
    image: mailhog/mailhog
    container_name: papermark-mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
```

### 3.4 Update All Email Functions

Search for `resend.emails.send` and replace with `sendEmail`:

```typescript
// Before
await resend.emails.send({
  from: "Papermark <notifications@papermark.io>",
  to: email,
  subject: "Document shared",
  react: DocumentNotification({ ... }),
});

// After
await sendEmail({
  to: email,
  subject: "Document shared",
  react: DocumentNotification({ ... }),
});
```

---

## Files to Modify

### Trigger.dev Removal

1. `lib/trigger/pdf-to-image-route.ts` -> Extract logic to worker
2. `lib/trigger/convert-files.ts` -> Extract logic to worker
3. `lib/trigger/optimize-video-files.ts` -> Extract logic to worker
4. `lib/trigger/export-visits.ts` -> Extract logic to worker
5. All API routes that call `tasks.trigger()` -> Use queue instead

### Search for Trigger.dev Usage

```bash
# Find all Trigger.dev imports
grep -r "@trigger.dev" --include="*.ts" --include="*.tsx"

# Find all task triggers
grep -r "tasks.trigger" --include="*.ts" --include="*.tsx"
```

---

## Testing Checklist

- [ ] Redis starts successfully
- [ ] Workers start without errors
- [ ] Document upload triggers job
- [ ] PDF conversion works
- [ ] Document preview loads
- [ ] Email sending works (check Mailhog)
- [ ] Rate limiting works

---

## Timeline

| Task | Effort | Priority |
|------|--------|----------|
| BullMQ setup | 2-3 days | **P0 - CRITICAL** |
| PDF worker | 1 day | P0 |
| File conversion worker | 1 day | P1 |
| Redis replacement | 0.5 day | P1 |
| Email replacement | 1 day | P2 |
| Testing & fixes | 2 days | P0 |

**Total: ~1 week for core functionality**

---

## Next Steps

1. Start with PDF-to-image worker (fixes your current issue)
2. Test document upload -> preview flow
3. Add more workers as needed
4. Replace Redis client
5. Replace email system
