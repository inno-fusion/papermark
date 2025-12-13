# BullMQ Migration Plan: Replacing Trigger.dev

**Purpose:** Replace Trigger.dev with BullMQ for complete self-hosting capability.

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [Document Conversion Flow](#2-document-conversion-flow)
3. [Trigger.dev Jobs Inventory](#3-triggerdev-jobs-inventory)
4. [BullMQ Migration Plan](#4-bullmq-migration-plan)
5. [Implementation Guide](#5-implementation-guide)
6. [Code Changes Required](#6-code-changes-required)
7. [Testing Checklist](#7-testing-checklist)

---

## 1. Current Architecture

### How Document Processing Works Today

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CURRENT FLOW (Trigger.dev)                         │
└──────────────────────────────────────────────────────────────────────────┘

User Upload → S3 → API creates DB records → Trigger.dev Cloud → Workers → Done
                                                    ↑
                                            (EXTERNAL DEPENDENCY)
```

### Components

| Component | Technology | Location |
|-----------|------------|----------|
| Job Queue | Trigger.dev v3 (Cloud) | External SaaS |
| Job Definitions | Trigger.dev SDK | `lib/trigger/*.ts` |
| PDF Rendering | MuPDF WASM | `pages/api/mupdf/*.ts` (LOCAL) |
| File Storage | AWS S3 | Your bucket |
| Database | PostgreSQL | Your Docker |

---

## 2. Document Conversion Flow

### 2.1 PDF Upload Flow (Most Common)

```
1. USER UPLOADS PDF
   │
   ▼
2. Frontend (lib/files/put-file.ts)
   - Uploads file directly to S3
   - Returns S3 key (e.g., "teamId/doc_xxx/filename.pdf")
   │
   ▼
3. API Endpoint (pages/api/teams/[teamId]/documents/index.ts)
   - Receives upload confirmation
   - Calls processDocument()
   │
   ▼
4. processDocument() (lib/api/documents/process-document.ts)
   │
   ├── Creates Document record in PostgreSQL
   │   └── { name, file, type: "pdf", teamId, ... }
   │
   ├── Creates DocumentVersion record
   │   └── { file, isPrimary: true, hasPages: false, ... }
   │
   └── Triggers Trigger.dev job (LINE 232):
       │
       │   await convertPdfToImageRoute.trigger({
       │     documentId: document.id,
       │     documentVersionId: document.versions[0].id,
       │     teamId,
       │   });
       │
       ▼
5. Trigger.dev Cloud (EXTERNAL - THIS IS THE PROBLEM)
   - Receives job
   - Queues it
   - Executes when worker available
   │
   ▼
6. convertPdfToImageRoute Task (lib/trigger/pdf-to-image-route.ts)
   │
   ├── Gets signed URL from S3 for the PDF
   │
   ├── Calls /api/mupdf/get-pages
   │   └── Returns: { numPages: N }
   │
   ├── FOR EACH PAGE (1 to N):
   │   │
   │   └── Calls /api/mupdf/convert-page
   │       │
   │       ├── Fetches PDF from S3
   │       ├── Uses MuPDF WASM to render page
   │       ├── Converts to PNG or JPEG (smaller wins)
   │       ├── Uploads image to S3
   │       └── Creates DocumentPage record
   │
   ├── Updates DocumentVersion:
   │   └── { hasPages: true, isPrimary: true, numPages: N }
   │
   └── Calls /api/revalidate to clear cache
       │
       ▼
7. DONE - Document is viewable
   - DocumentVersion.hasPages = true
   - DocumentPage records exist for each page
   - Preview API returns images instead of "still processing"
```

### 2.2 Office Document Flow (DOCX, PPTX, XLSX)

```
1. Upload Office file to S3
   │
   ▼
2. processDocument() triggers convertFilesToPdfTask
   │
   ▼
3. convertFilesToPdfTask (lib/trigger/convert-files.ts)
   │
   ├── Gets signed URL from S3
   │
   ├── Calls EXTERNAL LibreOffice API:
   │   POST ${NEXT_PRIVATE_CONVERSION_BASE_URL}/forms/libreoffice/convert
   │   └── Returns: PDF buffer
   │
   ├── Uploads converted PDF to S3
   │
   ├── Updates DocumentVersion with new PDF path
   │
   └── Triggers convertPdfToImageRoute (same as PDF flow)
       │
       ▼
4. PDF → Images (same as above)
```

### 2.3 CAD/Keynote Flow

```
Same as Office, but uses ConvertAPI instead of LibreOffice:
POST ${NEXT_PRIVATE_CONVERT_API_URL}
```

---

## 3. Trigger.dev Jobs Inventory

### Jobs That Need Migration

| Job ID | File | Purpose | Priority |
|--------|------|---------|----------|
| `convert-pdf-to-image-route` | `lib/trigger/pdf-to-image-route.ts` | PDF → page images | **P0 - Critical** |
| `convert-files-to-pdf` | `lib/trigger/convert-files.ts` | Office → PDF | P1 |
| `convert-cad-to-pdf` | `lib/trigger/convert-files.ts` | CAD → PDF | P2 (can disable) |
| `convert-keynote-to-pdf` | `lib/trigger/convert-files.ts` | Keynote → PDF | P2 (can disable) |
| `optimize-video-files` | `lib/trigger/optimize-video-files.ts` | Video transcoding | P1 |
| `export-visits` | `lib/trigger/export-visits.ts` | Export analytics | P2 |
| `send-scheduled-email` | `lib/trigger/send-scheduled-email.ts` | Delayed emails | P2 |
| `dataroom-change-notification` | `lib/trigger/dataroom-change-notification.ts` | Notifications | P2 |
| `cleanup-expired-exports` | `lib/trigger/cleanup-expired-exports.ts` | Cleanup cron | P3 |
| `conversation-message-notification` | `ee/features/conversations/lib/trigger/` | Chat notifications | P3 |
| `pause-reminder-notification` | `ee/features/billing/cancellation/lib/trigger/` | Billing reminders | P3 |

### Files That Import Trigger.dev

```bash
# Find all Trigger.dev imports
grep -r "@trigger.dev" --include="*.ts" --include="*.tsx" -l

# Results:
lib/trigger/pdf-to-image-route.ts
lib/trigger/convert-files.ts
lib/trigger/optimize-video-files.ts
lib/trigger/export-visits.ts
lib/trigger/send-scheduled-email.ts
lib/trigger/dataroom-change-notification.ts
lib/trigger/cleanup-expired-exports.ts
lib/api/documents/process-document.ts
lib/utils/trigger-utils.ts
pages/api/teams/[teamId]/documents/agreement.ts
pages/api/teams/[teamId]/documents/[id]/versions/index.ts
trigger.config.ts
ee/features/conversations/lib/trigger/conversation-message-notification.ts
ee/features/billing/cancellation/lib/trigger/pause-reminder-notification.ts
```

### Files That Call .trigger()

```bash
# Find all job triggers
grep -r "\.trigger(" --include="*.ts" -l

# Key files:
lib/api/documents/process-document.ts          # Main document processing
lib/trigger/convert-files.ts                   # Chains to pdf-to-image
pages/api/teams/[teamId]/documents/agreement.ts
pages/api/teams/[teamId]/documents/[id]/versions/index.ts
```

---

## 4. BullMQ Migration Plan

### 4.1 Architecture After Migration

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        NEW FLOW (BullMQ)                                  │
└──────────────────────────────────────────────────────────────────────────┘

User Upload → S3 → API creates DB records → Local Redis Queue → Local Workers → Done
                                                    ↑
                                              (SELF-HOSTED)

Components:
- Redis: Docker container (localhost:6379)
- BullMQ: npm package for queue management
- Workers: Separate Node.js process
```

### 4.2 New File Structure

```
lib/
├── queues/
│   ├── connection.ts           # Redis connection
│   ├── index.ts                # Queue definitions
│   └── workers/
│       ├── pdf-to-image.worker.ts
│       ├── file-conversion.worker.ts
│       ├── video-optimization.worker.ts
│       ├── export.worker.ts
│       ├── email.worker.ts
│       ├── notification.worker.ts
│       └── index.ts            # Worker registry
│
workers/
└── index.ts                    # Worker process entry point
```

### 4.3 Dependencies to Install

```bash
npm install bullmq ioredis
npm install -D tsx concurrently @types/ioredis
```

### 4.4 Docker Compose Addition

```yaml
# docker-compose.local.yml
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
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  redis-data:
```

### 4.5 Environment Variables

```bash
# Add to .env
REDIS_URL=redis://localhost:6379

# For worker -> app API calls
INTERNAL_API_KEY=your-secure-internal-api-key-here
```

---

## 5. Implementation Guide

### Step 1: Create Redis Connection

**File: `lib/queues/connection.ts`**

```typescript
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create a new connection for each use case
export function createRedisConnection() {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  });
}

// Shared connection for queue operations
export const redisConnection = createRedisConnection();

// Test connection
redisConnection.on("connect", () => {
  console.log("[Redis] Connected to", REDIS_URL);
});

redisConnection.on("error", (err) => {
  console.error("[Redis] Connection error:", err);
});
```

---

### Step 2: Define Queues

**File: `lib/queues/index.ts`**

```typescript
import { Queue, QueueEvents } from "bullmq";
import { redisConnection } from "./connection";

// ============================================
// QUEUE DEFINITIONS
// ============================================

// PDF to Image conversion (most critical)
export const pdfToImageQueue = new Queue("pdf-to-image", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      count: 100,  // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50,   // Keep last 50 failed jobs
    },
  },
});

// Office/CAD/Keynote to PDF conversion
export const fileConversionQueue = new Queue("file-conversion", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

// Video optimization
export const videoOptimizationQueue = new Queue("video-optimization", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
  },
});

// Export visits to Excel/CSV
export const exportQueue = new Queue("export-visits", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
  },
});

// Scheduled emails
export const emailQueue = new Queue("scheduled-email", {
  connection: redisConnection,
});

// Notifications (dataroom changes, conversations, etc.)
export const notificationQueue = new Queue("notifications", {
  connection: redisConnection,
});

// Webhook delivery
export const webhookQueue = new Queue("webhook-delivery", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

// Cleanup jobs (scheduled)
export const cleanupQueue = new Queue("cleanup", {
  connection: redisConnection,
});

// ============================================
// QUEUE EVENTS (for monitoring)
// ============================================

export const pdfToImageEvents = new QueueEvents("pdf-to-image", {
  connection: redisConnection,
});

export const fileConversionEvents = new QueueEvents("file-conversion", {
  connection: redisConnection,
});

// ============================================
// HELPER FUNCTIONS
// ============================================

export async function getQueueStats() {
  const [pdfWaiting, pdfActive, pdfCompleted, pdfFailed] = await Promise.all([
    pdfToImageQueue.getWaitingCount(),
    pdfToImageQueue.getActiveCount(),
    pdfToImageQueue.getCompletedCount(),
    pdfToImageQueue.getFailedCount(),
  ]);

  return {
    pdfToImage: {
      waiting: pdfWaiting,
      active: pdfActive,
      completed: pdfCompleted,
      failed: pdfFailed,
    },
  };
}
```

---

### Step 3: Create PDF-to-Image Worker (Critical)

**File: `lib/queues/workers/pdf-to-image.worker.ts`**

```typescript
import { Job, Worker } from "bullmq";
import { createRedisConnection } from "../connection";
import prisma from "@/lib/prisma";
import { getFile } from "@/lib/files/get-file";

// ============================================
// TYPE DEFINITIONS
// ============================================

export type PdfToImagePayload = {
  documentId: string;
  documentVersionId: string;
  teamId: string;
  versionNumber?: number;
};

type PdfToImageResult = {
  success: boolean;
  totalPages?: number;
  error?: string;
};

// ============================================
// WORKER PROCESSOR
// ============================================

async function processPdfToImage(
  job: Job<PdfToImagePayload>
): Promise<PdfToImageResult> {
  const { documentVersionId, teamId, documentId, versionNumber } = job.data;

  console.log(`[PDF Worker] Starting job ${job.id} for version: ${documentVersionId}`);

  try {
    // ----------------------------------------
    // 1. Get document version from database
    // ----------------------------------------
    const documentVersion = await prisma.documentVersion.findUnique({
      where: { id: documentVersionId },
      select: {
        file: true,
        storageType: true,
        numPages: true,
      },
    });

    if (!documentVersion) {
      throw new Error(`Document version not found: ${documentVersionId}`);
    }

    await job.updateProgress(10);
    console.log(`[PDF Worker] Found document version, getting signed URL...`);

    // ----------------------------------------
    // 2. Get signed URL from S3
    // ----------------------------------------
    const signedUrl = await getFile({
      type: documentVersion.storageType,
      data: documentVersion.file,
    });

    if (!signedUrl) {
      throw new Error("Failed to get signed URL for document");
    }

    await job.updateProgress(20);

    // ----------------------------------------
    // 3. Get page count if not already set
    // ----------------------------------------
    let numPages = documentVersion.numPages;

    if (!numPages || numPages === 1) {
      console.log(`[PDF Worker] Getting page count...`);

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
        const errorText = await response.text();
        throw new Error(`Failed to get page count: ${response.status} - ${errorText}`);
      }

      const { numPages: pageCount } = (await response.json()) as { numPages: number };

      if (pageCount < 1) {
        throw new Error("Invalid page count returned");
      }

      numPages = pageCount;
      console.log(`[PDF Worker] Document has ${numPages} pages`);
    }

    await job.updateProgress(30);

    // ----------------------------------------
    // 4. Convert each page to image
    // ----------------------------------------
    let conversionSuccess = true;
    let lastError: string | undefined;

    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      console.log(`[PDF Worker] Converting page ${pageNumber}/${numPages}...`);

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/mupdf/convert-page`,
          {
            method: "POST",
            body: JSON.stringify({
              documentVersionId,
              pageNumber,
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
          const errorData = await response.json().catch(() => ({}));

          // Check if document was blocked (e.g., contains prohibited content)
          if (response.status === 400 && errorData.error?.includes("blocked")) {
            console.error(`[PDF Worker] Document blocked at page ${pageNumber}`);
            conversionSuccess = false;
            lastError = "Document processing blocked";
            break;
          }

          throw new Error(`Failed to convert page ${pageNumber}: ${response.status}`);
        }

        const { documentPageId } = (await response.json()) as { documentPageId: string };
        console.log(`[PDF Worker] Page ${pageNumber} converted: ${documentPageId}`);

      } catch (error) {
        conversionSuccess = false;
        lastError = error instanceof Error ? error.message : "Unknown error";
        console.error(`[PDF Worker] Error on page ${pageNumber}:`, lastError);
        break;
      }

      // Update progress (30% to 90% for page conversion)
      const progress = 30 + Math.floor((pageNumber / numPages) * 60);
      await job.updateProgress(progress);
    }

    if (!conversionSuccess) {
      throw new Error(lastError || "Page conversion failed");
    }

    await job.updateProgress(90);

    // ----------------------------------------
    // 5. Update document version in database
    // ----------------------------------------
    console.log(`[PDF Worker] Updating document version...`);

    await prisma.documentVersion.update({
      where: { id: documentVersionId },
      data: {
        numPages,
        hasPages: true,
        isPrimary: true,
      },
    });

    // ----------------------------------------
    // 6. Update other versions to not primary
    // ----------------------------------------
    if (versionNumber) {
      await prisma.documentVersion.updateMany({
        where: {
          documentId,
          versionNumber: { not: versionNumber },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    await job.updateProgress(95);

    // ----------------------------------------
    // 7. Revalidate link cache
    // ----------------------------------------
    console.log(`[PDF Worker] Revalidating cache...`);

    try {
      await fetch(
        `${process.env.NEXTAUTH_URL}/api/revalidate?secret=${process.env.REVALIDATE_TOKEN}&documentId=${documentId}`
      );
    } catch (revalidateError) {
      // Non-fatal error, just log it
      console.warn(`[PDF Worker] Revalidation failed:`, revalidateError);
    }

    await job.updateProgress(100);

    console.log(`[PDF Worker] Job ${job.id} completed successfully`);

    return {
      success: true,
      totalPages: numPages,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[PDF Worker] Job ${job.id} failed:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================
// WORKER INSTANCE
// ============================================

export function createPdfToImageWorker() {
  const worker = new Worker<PdfToImagePayload, PdfToImageResult>(
    "pdf-to-image",
    processPdfToImage,
    {
      connection: createRedisConnection(),
      concurrency: 5, // Process 5 jobs simultaneously
      limiter: {
        max: 10,      // Max 10 jobs
        duration: 1000, // Per second
      },
    }
  );

  // Event handlers
  worker.on("completed", (job, result) => {
    console.log(`[PDF Worker] Job ${job.id} completed:`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(`[PDF Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("progress", (job, progress) => {
    console.log(`[PDF Worker] Job ${job.id} progress: ${progress}%`);
  });

  worker.on("error", (err) => {
    console.error("[PDF Worker] Worker error:", err);
  });

  return worker;
}

// Export singleton for direct import
export const pdfToImageWorker = createPdfToImageWorker();
```

---

### Step 4: Create File Conversion Worker

**File: `lib/queues/workers/file-conversion.worker.ts`**

```typescript
import { Job, Worker } from "bullmq";
import { createRedisConnection } from "../connection";
import prisma from "@/lib/prisma";
import { getFile } from "@/lib/files/get-file";
import { putFileServer } from "@/lib/files/put-file-server";
import { pdfToImageQueue } from "../index";
import { getExtensionFromContentType } from "@/lib/utils/get-content-type";

// ============================================
// TYPE DEFINITIONS
// ============================================

export type FileConversionPayload = {
  documentId: string;
  documentVersionId: string;
  teamId: string;
  conversionType: "office" | "cad" | "keynote";
};

type FileConversionResult = {
  success: boolean;
  convertedFile?: string;
  error?: string;
};

// ============================================
// WORKER PROCESSOR
// ============================================

async function processFileConversion(
  job: Job<FileConversionPayload>
): Promise<FileConversionResult> {
  const { documentId, documentVersionId, teamId, conversionType } = job.data;

  console.log(`[Conversion Worker] Starting ${conversionType} conversion for: ${documentVersionId}`);

  try {
    // ----------------------------------------
    // 1. Get document info
    // ----------------------------------------
    const document = await prisma.document.findUnique({
      where: { id: documentId, teamId },
      select: {
        name: true,
        versions: {
          where: { id: documentVersionId },
          select: {
            file: true,
            originalFile: true,
            contentType: true,
            storageType: true,
            versionNumber: true,
          },
        },
      },
    });

    if (!document || !document.versions[0]) {
      throw new Error("Document or version not found");
    }

    const version = document.versions[0];
    await job.updateProgress(10);

    // ----------------------------------------
    // 2. Get signed URL
    // ----------------------------------------
    const fileUrl = await getFile({
      data: version.originalFile!,
      type: version.storageType,
    });

    if (!fileUrl) {
      throw new Error("Failed to get file URL");
    }

    await job.updateProgress(20);

    // ----------------------------------------
    // 3. Convert based on type
    // ----------------------------------------
    let conversionBuffer: Buffer;

    if (conversionType === "office") {
      // LibreOffice conversion
      const formData = new FormData();
      formData.append(
        "downloadFrom",
        JSON.stringify([{ url: fileUrl }])
      );
      formData.append("quality", "75");

      const response = await fetch(
        `${process.env.NEXT_PRIVATE_CONVERSION_BASE_URL}/forms/libreoffice/convert`,
        {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Basic ${process.env.NEXT_PRIVATE_INTERNAL_AUTH_TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`LibreOffice conversion failed: ${response.status} - ${errorBody}`);
      }

      conversionBuffer = Buffer.from(await response.arrayBuffer());

    } else if (conversionType === "cad" || conversionType === "keynote") {
      // ConvertAPI conversion
      const engine = conversionType === "cad" ? "cadconverter" : "iwork";
      const inputFormat = getExtensionFromContentType(version.contentType!);

      const tasksPayload = {
        tasks: {
          "import-file-v1": {
            operation: "import/url",
            url: fileUrl,
            filename: document.name,
          },
          "convert-file-v1": {
            operation: "convert",
            input: ["import-file-v1"],
            input_format: inputFormat,
            output_format: "pdf",
            engine,
            ...(conversionType === "cad" && {
              all_layouts: true,
              auto_zoom: false,
            }),
          },
          "export-file-v1": {
            operation: "export/url",
            input: ["convert-file-v1"],
            inline: false,
            archive_multiple_files: false,
          },
        },
        redirect: true,
      };

      const response = await fetch(process.env.NEXT_PRIVATE_CONVERT_API_URL!, {
        method: "POST",
        body: JSON.stringify(tasksPayload),
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PRIVATE_CONVERT_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`ConvertAPI conversion failed: ${response.status} - ${errorBody}`);
      }

      conversionBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new Error(`Unknown conversion type: ${conversionType}`);
    }

    await job.updateProgress(60);

    // ----------------------------------------
    // 4. Save converted PDF to S3
    // ----------------------------------------
    const match = version.originalFile!.match(/(doc_[^\/]+)\//);
    const docId = match ? match[1] : undefined;

    const { type: storageType, data } = await putFileServer({
      file: {
        name: `${document.name}.pdf`,
        type: "application/pdf",
        buffer: conversionBuffer,
      },
      teamId,
      docId,
    });

    if (!data || !storageType) {
      throw new Error("Failed to save converted file");
    }

    await job.updateProgress(80);

    // ----------------------------------------
    // 5. Update document version
    // ----------------------------------------
    await prisma.documentVersion.update({
      where: { id: documentVersionId },
      data: {
        file: data,
        type: "pdf",
        storageType,
      },
    });

    await job.updateProgress(90);

    // ----------------------------------------
    // 6. Queue PDF to image conversion
    // ----------------------------------------
    await pdfToImageQueue.add(
      "convert-pdf-to-image",
      {
        documentId,
        documentVersionId,
        teamId,
        versionNumber: version.versionNumber,
      },
      {
        jobId: `pdf-${documentVersionId}`,
      }
    );

    await job.updateProgress(100);

    console.log(`[Conversion Worker] Successfully converted ${conversionType} document`);

    return {
      success: true,
      convertedFile: data,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Conversion Worker] Job ${job.id} failed:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================
// WORKER INSTANCE
// ============================================

export function createFileConversionWorker() {
  const worker = new Worker<FileConversionPayload, FileConversionResult>(
    "file-conversion",
    processFileConversion,
    {
      connection: createRedisConnection(),
      concurrency: 3,
    }
  );

  worker.on("completed", (job, result) => {
    console.log(`[Conversion Worker] Job ${job.id} completed:`, result.success);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Conversion Worker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

export const fileConversionWorker = createFileConversionWorker();
```

---

### Step 5: Create Worker Entry Point

**File: `workers/index.ts`**

```typescript
/**
 * Papermark Background Workers
 *
 * This file starts all BullMQ workers for background job processing.
 * Run with: npm run workers
 */

import "dotenv/config";

// Import workers (they self-register on import)
import { pdfToImageWorker } from "../lib/queues/workers/pdf-to-image.worker";
import { fileConversionWorker } from "../lib/queues/workers/file-conversion.worker";

// ============================================
// STARTUP
// ============================================

console.log("=".repeat(50));
console.log("  PAPERMARK BACKGROUND WORKERS");
console.log("=".repeat(50));
console.log("");
console.log("  Active Workers:");
console.log(`    - pdf-to-image (concurrency: 5)`);
console.log(`    - file-conversion (concurrency: 3)`);
console.log("");
console.log(`  Redis: ${process.env.REDIS_URL || "redis://localhost:6379"}`);
console.log(`  App URL: ${process.env.NEXT_PUBLIC_BASE_URL}`);
console.log("");
console.log("=".repeat(50));
console.log("  Waiting for jobs...");
console.log("=".repeat(50));

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const workers = [pdfToImageWorker, fileConversionWorker];

async function shutdown(signal: string) {
  console.log(`\n[Workers] ${signal} received, shutting down gracefully...`);

  try {
    await Promise.all(workers.map((w) => w.close()));
    console.log("[Workers] All workers closed successfully");
    process.exit(0);
  } catch (error) {
    console.error("[Workers] Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Keep process alive
process.stdin.resume();
```

---

### Step 6: Update package.json

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "workers": "tsx workers/index.ts",
    "workers:watch": "tsx --watch workers/index.ts",
    "dev:full": "concurrently \"npm run dev\" \"npm run workers:watch\"",
    "dev:workers": "npm run workers:watch"
  }
}
```

---

## 6. Code Changes Required

### 6.1 Update process-document.ts

**File: `lib/api/documents/process-document.ts`**

Replace Trigger.dev imports and calls with BullMQ:

```typescript
// BEFORE (lines 8-16):
import {
  convertCadToPdfTask,
  convertFilesToPdfTask,
  convertKeynoteToPdfTask,
} from "@/lib/trigger/convert-files";
import { processVideo } from "@/lib/trigger/optimize-video-files";
import { convertPdfToImageRoute } from "@/lib/trigger/pdf-to-image-route";
import { conversionQueue } from "@/lib/utils/trigger-utils";

// AFTER:
import { pdfToImageQueue, fileConversionQueue, videoOptimizationQueue } from "@/lib/queues";
```

```typescript
// BEFORE (lines 142-163) - Keynote:
if (type === "slides" && (contentType === "application/vnd.apple.keynote" || ...)) {
  await convertKeynoteToPdfTask.trigger(
    { documentId: document.id, documentVersionId: document.versions[0].id, teamId },
    { idempotencyKey: `${teamId}-${document.versions[0].id}-keynote`, ... }
  );
}

// AFTER:
if (type === "slides" && (contentType === "application/vnd.apple.keynote" || ...)) {
  await fileConversionQueue.add(
    "convert-keynote",
    {
      documentId: document.id,
      documentVersionId: document.versions[0].id,
      teamId,
      conversionType: "keynote",
    },
    { jobId: `keynote-${document.versions[0].id}` }
  );
}
```

```typescript
// BEFORE (lines 164-182) - Office docs:
else if (type === "docs" || type === "slides") {
  await convertFilesToPdfTask.trigger(
    { documentId: document.id, documentVersionId: document.versions[0].id, teamId },
    { idempotencyKey: `${teamId}-${document.versions[0].id}-docs`, ... }
  );
}

// AFTER:
else if (type === "docs" || type === "slides") {
  await fileConversionQueue.add(
    "convert-office",
    {
      documentId: document.id,
      documentVersionId: document.versions[0].id,
      teamId,
      conversionType: "office",
    },
    { jobId: `office-${document.versions[0].id}` }
  );
}
```

```typescript
// BEFORE (lines 184-202) - CAD:
if (type === "cad") {
  await convertCadToPdfTask.trigger(...);
}

// AFTER:
if (type === "cad") {
  await fileConversionQueue.add(
    "convert-cad",
    {
      documentId: document.id,
      documentVersionId: document.versions[0].id,
      teamId,
      conversionType: "cad",
    },
    { jobId: `cad-${document.versions[0].id}` }
  );
}
```

```typescript
// BEFORE (lines 231-249) - PDF:
if (type === "pdf") {
  await convertPdfToImageRoute.trigger(
    { documentId: document.id, documentVersionId: document.versions[0].id, teamId },
    { idempotencyKey: `${teamId}-${document.versions[0].id}`, ... }
  );
}

// AFTER:
if (type === "pdf") {
  await pdfToImageQueue.add(
    "convert-pdf-to-image",
    {
      documentId: document.id,
      documentVersionId: document.versions[0].id,
      teamId,
    },
    { jobId: `pdf-${document.versions[0].id}` }
  );
}
```

### 6.2 Update versions/index.ts

**File: `pages/api/teams/[teamId]/documents/[id]/versions/index.ts`**

Same pattern - replace Trigger.dev with BullMQ queue.

### 6.3 Update agreement.ts

**File: `pages/api/teams/[teamId]/documents/agreement.ts`**

Same pattern - replace Trigger.dev with BullMQ queue.

---

## 7. Testing Checklist

### Pre-Migration

- [ ] Backup database
- [ ] Note current document states

### Infrastructure

- [ ] Redis container running: `docker-compose up -d redis`
- [ ] Redis accessible: `redis-cli ping` returns `PONG`
- [ ] Environment variables set in `.env`

### Code Changes

- [ ] `lib/queues/connection.ts` created
- [ ] `lib/queues/index.ts` created
- [ ] `lib/queues/workers/pdf-to-image.worker.ts` created
- [ ] `lib/queues/workers/file-conversion.worker.ts` created
- [ ] `workers/index.ts` created
- [ ] `package.json` scripts updated
- [ ] `process-document.ts` updated
- [ ] `versions/index.ts` updated
- [ ] `agreement.ts` updated

### Runtime Tests

- [ ] Workers start: `npm run workers`
- [ ] No connection errors in logs
- [ ] Upload a new PDF document
- [ ] Job appears in worker logs
- [ ] Pages convert successfully
- [ ] DocumentVersion.hasPages = true
- [ ] Preview works in UI

### Edge Cases

- [ ] Large PDF (100+ pages)
- [ ] Multi-page progress updates work
- [ ] Failed conversion retries
- [ ] Worker restart recovers pending jobs

---

## Quick Reference Commands

```bash
# Start Redis
docker-compose -f docker-compose.local.yml up -d redis

# Start workers (development)
npm run workers:watch

# Start everything (app + workers)
npm run dev:full

# Check Redis
redis-cli ping
redis-cli keys "bull:*"

# Monitor queues
redis-cli monitor
```

---

## Migration Timeline

| Step | Task | Time |
|------|------|------|
| 1 | Install dependencies | 5 min |
| 2 | Create queue infrastructure | 30 min |
| 3 | Create PDF worker | 1 hour |
| 4 | Create file conversion worker | 1 hour |
| 5 | Update process-document.ts | 30 min |
| 6 | Update other trigger points | 30 min |
| 7 | Testing | 1-2 hours |
| **Total** | | **~5-6 hours** |

---

## Rollback Plan

If issues occur:

1. Stop workers: `Ctrl+C`
2. Revert code changes: `git checkout -- lib/api/documents/process-document.ts`
3. Restart with Trigger.dev: `npx trigger.dev@latest dev`

The Trigger.dev code remains in `lib/trigger/` and can be reactivated.
