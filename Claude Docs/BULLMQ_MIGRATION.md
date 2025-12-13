# BullMQ Migration Plan: Replacing Trigger.dev

**Purpose:** Replace Trigger.dev with BullMQ for complete self-hosting capability.
**Goal:** Drop-in replacement - all existing functionality must work identically.

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [Complete Trigger.dev Inventory](#2-complete-triggerdev-inventory)
3. [BullMQ Architecture](#3-bullmq-architecture)
4. [Implementation Guide](#4-implementation-guide)
5. [Code Changes Required](#5-code-changes-required)
6. [Feature Parity Mappings](#6-feature-parity-mappings)
7. [Testing Checklist](#7-testing-checklist)

---

## 1. Current Architecture

### How It Works Today

```
User Action → API Endpoint → Trigger.dev Cloud → Workers → Done
                                    ↑
                            (EXTERNAL DEPENDENCY)
```

### Components

| Component | Technology | Location |
|-----------|------------|----------|
| Job Queue | Trigger.dev v3 (Cloud) | External SaaS |
| Job Definitions | Trigger.dev SDK | `lib/trigger/*.ts` + `ee/*/trigger/*.ts` |
| Realtime Progress | Trigger.dev React Hooks | `lib/utils/use-progress-status.ts` |
| Job Management | Trigger.dev SDK (`runs.list`, `runs.cancel`) | Various API files |
| Scheduled Jobs | Trigger.dev `schedules.task` | `lib/trigger/cleanup-expired-exports.ts` |

---

## 2. Complete Trigger.dev Inventory

### 2.1 All Trigger Job Files (11 total)

| File | Task ID | Type | Priority |
|------|---------|------|----------|
| `lib/trigger/pdf-to-image-route.ts` | `convert-pdf-to-image-route` | task | **P0** |
| `lib/trigger/convert-files.ts` | `convert-files-to-pdf`, `convert-cad-to-pdf`, `convert-keynote-to-pdf` | task | **P0** |
| `lib/trigger/optimize-video-files.ts` | `process-video` | task | P1 |
| `lib/trigger/export-visits.ts` | `export-visits` | task | P1 |
| `lib/trigger/send-scheduled-email.ts` | 4 tasks (trial info, 24h reminder, expired, upgrade checkin) | task | P1 |
| `lib/trigger/dataroom-change-notification.ts` | `send-dataroom-change-notification` | task | P2 |
| `lib/trigger/cleanup-expired-exports.ts` | `cleanup-expired-exports` | **schedules.task** | P2 |
| `ee/features/conversations/lib/trigger/conversation-message-notification.ts` | 2 tasks (viewer + team member notifications) | task | P2 |
| `ee/features/billing/cancellation/lib/trigger/pause-resume-notification.ts` | `send-pause-resume-notification` | task | P2 |
| `ee/features/billing/cancellation/lib/trigger/unpause-task.ts` | `automatic-unpause-subscription` | task | P2 |

### 2.2 All Files That Call `.trigger()` (12 files)

| File | What it triggers |
|------|------------------|
| `lib/api/documents/process-document.ts` | PDF, Office, CAD, Keynote, Video conversions |
| `lib/trigger/convert-files.ts` | Chains to `convertPdfToImageRoute` |
| `pages/api/teams/[teamId]/documents/agreement.ts` | PDF conversion |
| `pages/api/teams/[teamId]/documents/[id]/versions/index.ts` | PDF/Office conversions |
| `pages/api/teams/[teamId]/export-jobs.ts` | `exportVisitsTask` |
| `pages/api/teams/[teamId]/datarooms/trial.ts` | 3 scheduled email tasks |
| `pages/api/teams/[teamId]/datarooms/[id]/documents/index.ts` | Dataroom notifications |
| `ee/features/conversations/api/conversations-route.ts` | Conversation notifications |
| `ee/features/conversations/api/team-conversations-route.ts` | Conversation notifications |
| `ee/features/billing/cancellation/api/pause-route.ts` | Pause/unpause tasks |
| `ee/stripe/webhooks/checkout-session-completed.ts` | Upgrade checkin email |

### 2.3 Files Using Trigger.dev SDK APIs

| File | SDK Usage | Replacement Needed |
|------|-----------|-------------------|
| `lib/utils/use-progress-status.ts` | `useRealtimeRunsWithTag` | Custom progress polling/SSE |
| `lib/utils/generate-trigger-status.ts` | `metadata.set/get` | `job.updateProgress()` |
| `lib/utils/generate-trigger-auth-token.ts` | `auth.createPublicToken` | Custom JWT/session tokens |
| `lib/utils/trigger-utils.ts` | Queue config helper | Remove or adapt |
| `pages/api/teams/[teamId]/export-jobs/[exportId].ts` | `runs.cancel` | `job.remove()` |
| `pages/api/teams/[teamId]/datarooms/[id]/documents/index.ts` | `runs.list`, `runs.cancel` | Queue job helpers |
| `ee/features/conversations/api/conversations-route.ts` | `runs.list`, `runs.cancel` | Queue job helpers |

### 2.4 Configuration Files

| File | Purpose |
|------|---------|
| `trigger.config.ts` | Trigger.dev configuration - will be removed |

---

## 3. BullMQ Architecture

### 3.1 New Architecture

```
User Action → API Endpoint → Redis Queue → Local Workers → Done
                                  ↑
                            (SELF-HOSTED)
```

### 3.2 File Structure

```
lib/
├── queues/
│   ├── connection.ts              # Redis connection singleton
│   ├── index.ts                   # Queue definitions & exports
│   ├── types.ts                   # Shared payload types
│   ├── helpers.ts                 # Job management helpers (list, cancel, etc.)
│   └── workers/
│       ├── index.ts               # Worker registry
│       ├── pdf-to-image.worker.ts
│       ├── file-conversion.worker.ts
│       ├── video-optimization.worker.ts
│       ├── export-visits.worker.ts
│       ├── scheduled-email.worker.ts
│       ├── notification.worker.ts
│       ├── billing.worker.ts
│       └── cleanup.worker.ts
│
├── progress/
│   ├── index.ts                   # Progress API helpers
│   └── use-job-progress.ts        # React hook for job progress
│
workers/
└── index.ts                       # Worker process entry point
```

### 3.3 Dependencies

```bash
npm install bullmq ioredis
npm install -D tsx concurrently
```

### 3.4 Environment Variables

```bash
# Add to .env
REDIS_URL=redis://localhost:6379

# Already exists - used for worker -> API calls
INTERNAL_API_KEY=your-secure-internal-api-key-here
```

---

## 4. Implementation Guide

### Step 1: Redis Connection

**File: `lib/queues/connection.ts`**

```typescript
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create a new connection for each use case (required for BullMQ workers)
export function createRedisConnection() {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  });
}

// Shared connection for queue operations (adding jobs)
let sharedConnection: Redis | null = null;

export function getRedisConnection() {
  if (!sharedConnection) {
    sharedConnection = createRedisConnection();

    sharedConnection.on("connect", () => {
      console.log("[Redis] Connected to", REDIS_URL);
    });

    sharedConnection.on("error", (err) => {
      console.error("[Redis] Connection error:", err);
    });
  }
  return sharedConnection;
}

// Graceful shutdown
export async function closeRedisConnection() {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
  }
}
```

---

### Step 2: Shared Types

**File: `lib/queues/types.ts`**

```typescript
// ============================================
// PDF TO IMAGE
// ============================================
export type PdfToImagePayload = {
  documentId: string;
  documentVersionId: string;
  teamId: string;
  versionNumber?: number;
};

// ============================================
// FILE CONVERSION (Office, CAD, Keynote)
// ============================================
export type FileConversionPayload = {
  documentId: string;
  documentVersionId: string;
  teamId: string;
  conversionType: "office" | "cad" | "keynote";
};

// ============================================
// VIDEO OPTIMIZATION
// ============================================
export type VideoOptimizationPayload = {
  videoUrl: string;
  teamId: string;
  docId: string;
  documentVersionId: string;
  fileSize: number;
};

// ============================================
// EXPORT VISITS
// ============================================
export type ExportVisitsPayload = {
  type: "document" | "dataroom" | "dataroom-group";
  teamId: string;
  resourceId: string;
  groupId?: string;
  userId: string;
  exportId: string;
};

// ============================================
// SCHEDULED EMAILS
// ============================================
export type ScheduledEmailPayload = {
  emailType: "dataroom-trial-info" | "dataroom-trial-24h" | "dataroom-trial-expired" | "upgrade-checkin";
  to: string;
  name?: string;
  teamId?: string;
  useCase?: string;
};

// ============================================
// NOTIFICATIONS
// ============================================
export type DataroomNotificationPayload = {
  dataroomId: string;
  dataroomDocumentId: string;
  senderUserId: string;
  teamId: string;
};

export type ConversationNotificationPayload = {
  dataroomId: string;
  messageId: string;
  conversationId: string;
  teamId: string;
  senderUserId: string;
  notificationType: "viewer" | "team-member";
};

// ============================================
// BILLING
// ============================================
export type PauseResumeNotificationPayload = {
  teamId: string;
};

export type AutomaticUnpausePayload = {
  teamId: string;
};

// ============================================
// COMMON
// ============================================
export type JobTags = string[];

export type DelayedJobOptions = {
  delay?: number; // milliseconds
  jobId?: string;
  tags?: JobTags;
};
```

---

### Step 3: Queue Definitions

**File: `lib/queues/index.ts`**

```typescript
import { Queue, QueueEvents } from "bullmq";
import { getRedisConnection } from "./connection";
import type {
  PdfToImagePayload,
  FileConversionPayload,
  VideoOptimizationPayload,
  ExportVisitsPayload,
  ScheduledEmailPayload,
  DataroomNotificationPayload,
  ConversationNotificationPayload,
  PauseResumeNotificationPayload,
  AutomaticUnpausePayload,
  DelayedJobOptions,
} from "./types";

const connection = getRedisConnection();

// ============================================
// QUEUE DEFINITIONS
// ============================================

// PDF to Image conversion (most critical)
export const pdfToImageQueue = new Queue<PdfToImagePayload>("pdf-to-image", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// Office/CAD/Keynote to PDF conversion
export const fileConversionQueue = new Queue<FileConversionPayload>("file-conversion", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// Video optimization
export const videoOptimizationQueue = new Queue<VideoOptimizationPayload>("video-optimization", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 20 },
  },
});

// Export visits to CSV
export const exportQueue = new Queue<ExportVisitsPayload>("export-visits", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// Scheduled/delayed emails
export const emailQueue = new Queue<ScheduledEmailPayload>("scheduled-email", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 50 },
  },
});

// Dataroom change notifications
export const dataroomNotificationQueue = new Queue<DataroomNotificationPayload>("dataroom-notification", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// Conversation notifications
export const conversationNotificationQueue = new Queue<ConversationNotificationPayload>("conversation-notification", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// Billing - pause resume notifications
export const pauseResumeQueue = new Queue<PauseResumeNotificationPayload>("pause-resume-notification", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 20 },
  },
});

// Billing - automatic unpause
export const automaticUnpauseQueue = new Queue<AutomaticUnpausePayload>("automatic-unpause", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 20 },
  },
});

// Cleanup jobs (scheduled/cron)
export const cleanupQueue = new Queue("cleanup", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { count: 10 },
  },
});

// ============================================
// QUEUE EVENTS (for monitoring)
// ============================================

export const pdfToImageEvents = new QueueEvents("pdf-to-image", { connection });
export const fileConversionEvents = new QueueEvents("file-conversion", { connection });
export const exportEvents = new QueueEvents("export-visits", { connection });

// ============================================
// HELPER: ADD JOB WITH TAGS SUPPORT
// ============================================

// Store tags in job data for later filtering (BullMQ doesn't have native tags)
export async function addJobWithTags<T extends object>(
  queue: Queue<T>,
  name: string,
  data: T,
  options: DelayedJobOptions = {}
) {
  const { delay, jobId, tags } = options;

  // Embed tags in the data for later retrieval
  const dataWithTags = { ...data, _tags: tags || [] };

  return queue.add(name, dataWithTags as T, {
    delay,
    jobId,
  });
}

// ============================================
// RE-EXPORT TYPES
// ============================================

export * from "./types";
```

---

### Step 4: Job Management Helpers (Replaces `runs.list`, `runs.cancel`)

**File: `lib/queues/helpers.ts`**

```typescript
import { Queue, Job } from "bullmq";
import {
  dataroomNotificationQueue,
  conversationNotificationQueue,
  exportQueue,
} from "./index";

type JobStatus = "completed" | "failed" | "delayed" | "active" | "waiting" | "paused";

// ============================================
// GET JOBS BY TAG
// Replaces: runs.list({ tag: [...], status: [...] })
// ============================================

export async function getJobsByTag(
  queue: Queue,
  tag: string,
  statuses: JobStatus[] = ["delayed", "waiting"]
): Promise<Job[]> {
  const jobs = await queue.getJobs(statuses);

  return jobs.filter((job) => {
    const tags = (job.data as any)?._tags || [];
    return tags.includes(tag);
  });
}

// ============================================
// CANCEL JOBS BY TAG
// Replaces: runs.cancel() for multiple jobs
// ============================================

export async function cancelJobsByTag(
  queue: Queue,
  tag: string,
  statuses: JobStatus[] = ["delayed", "waiting"]
): Promise<number> {
  const jobs = await getJobsByTag(queue, tag, statuses);

  let cancelledCount = 0;
  for (const job of jobs) {
    try {
      await job.remove();
      cancelledCount++;
    } catch (error) {
      // Job may have already been processed
      console.warn(`Failed to cancel job ${job.id}:`, error);
    }
  }

  return cancelledCount;
}

// ============================================
// CANCEL SINGLE JOB BY ID
// Replaces: runs.cancel(runId)
// ============================================

export async function cancelJobById(queue: Queue, jobId: string): Promise<boolean> {
  try {
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to cancel job ${jobId}:`, error);
    return false;
  }
}

// ============================================
// GET JOB STATUS
// ============================================

export async function getJobStatus(queue: Queue, jobId: string) {
  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    failedReason: job.failedReason,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

// ============================================
// SPECIALIZED HELPERS
// ============================================

// For dataroom notifications - cancel pending notifications
export async function cancelPendingDataroomNotifications(dataroomId: string) {
  return cancelJobsByTag(dataroomNotificationQueue, `dataroom_${dataroomId}`);
}

// For conversation notifications - cancel pending notifications
export async function cancelPendingConversationNotifications(conversationId: string) {
  return cancelJobsByTag(conversationNotificationQueue, `conversation_${conversationId}`);
}

// For export jobs - cancel by export ID
export async function cancelExportJob(exportId: string) {
  return cancelJobById(exportQueue, exportId);
}

// ============================================
// QUEUE STATS
// ============================================

export async function getQueueStats(queue: Queue) {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}
```

---

### Step 5: Progress Tracking (Replaces Trigger.dev Realtime Hooks)

**File: `lib/progress/index.ts`**

```typescript
import { Job, Queue } from "bullmq";

export type ProgressStatus = {
  state: "QUEUED" | "EXECUTING" | "COMPLETED" | "FAILED";
  progress: number;
  text: string;
};

// Convert BullMQ job state to our status format
export function jobStateToStatus(state: string): ProgressStatus["state"] {
  switch (state) {
    case "waiting":
    case "delayed":
      return "QUEUED";
    case "active":
      return "EXECUTING";
    case "completed":
      return "COMPLETED";
    case "failed":
      return "FAILED";
    default:
      return "QUEUED";
  }
}

// Get progress for a specific job
export async function getJobProgress(
  queue: Queue,
  jobId: string
): Promise<ProgressStatus | null> {
  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = typeof job.progress === "number" ? job.progress : 0;
  const progressData = typeof job.progress === "object" ? job.progress : null;

  return {
    state: jobStateToStatus(state),
    progress: progressData?.progress ?? progress,
    text: progressData?.text ?? getDefaultText(state, progress),
  };
}

function getDefaultText(state: string, progress: number): string {
  switch (state) {
    case "waiting":
    case "delayed":
      return "Waiting in queue...";
    case "active":
      return `Processing... ${progress}%`;
    case "completed":
      return "Processing complete";
    case "failed":
      return "Processing failed";
    default:
      return "Initializing...";
  }
}

// Update progress from within a worker
export async function updateJobProgress(
  job: Job,
  progress: number,
  text: string
) {
  await job.updateProgress({ progress, text });
}
```

**File: `lib/progress/use-job-progress.ts`** (Replaces `@trigger.dev/react-hooks`)

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";

interface JobProgressStatus {
  state: "QUEUED" | "EXECUTING" | "COMPLETED" | "FAILED";
  progress: number;
  text: string;
}

interface UseJobProgressOptions {
  enabled?: boolean;
  pollingInterval?: number;
}

export function useJobProgress(
  queueName: string,
  jobId: string | undefined,
  options: UseJobProgressOptions = {}
) {
  const { enabled = true, pollingInterval = 2000 } = options;

  const [status, setStatus] = useState<JobProgressStatus>({
    state: "QUEUED",
    progress: 0,
    text: "Initializing...",
  });
  const [error, setError] = useState<Error | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!jobId || !enabled) return;

    try {
      const response = await fetch(
        `/api/jobs/progress?queue=${queueName}&jobId=${jobId}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch job progress");
      }

      const data = await response.json();
      setStatus(data);
      setError(null);

      // Stop polling if job is complete or failed
      return data.state === "COMPLETED" || data.state === "FAILED";
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      return false;
    }
  }, [queueName, jobId, enabled]);

  useEffect(() => {
    if (!enabled || !jobId) return;

    let timeoutId: NodeJS.Timeout;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;

      const shouldStop = await fetchProgress();

      if (!stopped && !shouldStop) {
        timeoutId = setTimeout(poll, pollingInterval);
      }
    };

    poll();

    return () => {
      stopped = true;
      clearTimeout(timeoutId);
    };
  }, [fetchProgress, enabled, jobId, pollingInterval]);

  return { status, error };
}

// Hook specifically for document version progress (drop-in replacement)
export function useDocumentProgressStatus(
  documentVersionId: string,
  _publicAccessToken: string | undefined // Kept for API compatibility, not used
) {
  const { status, error } = useJobProgress(
    "pdf-to-image",
    documentVersionId ? `pdf-${documentVersionId}` : undefined,
    { enabled: !!documentVersionId }
  );

  return {
    status,
    error,
    run: status.state !== "QUEUED" ? { id: `pdf-${documentVersionId}` } : undefined,
  };
}
```

**File: `pages/api/jobs/progress.ts`** (New API endpoint for progress polling)

```typescript
import { NextApiRequest, NextApiResponse } from "next";
import {
  pdfToImageQueue,
  fileConversionQueue,
  videoOptimizationQueue,
  exportQueue,
} from "@/lib/queues";
import { getJobProgress } from "@/lib/progress";
import { Queue } from "bullmq";

const queueMap: Record<string, Queue> = {
  "pdf-to-image": pdfToImageQueue,
  "file-conversion": fileConversionQueue,
  "video-optimization": videoOptimizationQueue,
  "export-visits": exportQueue,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { queue: queueName, jobId } = req.query as {
    queue: string;
    jobId: string;
  };

  if (!queueName || !jobId) {
    return res.status(400).json({ error: "Missing queue or jobId" });
  }

  const queue = queueMap[queueName];
  if (!queue) {
    return res.status(400).json({ error: "Invalid queue name" });
  }

  const progress = await getJobProgress(queue, jobId);

  if (!progress) {
    return res.status(404).json({ error: "Job not found" });
  }

  return res.status(200).json(progress);
}
```

---

### Step 6: Worker Entry Point

**File: `workers/index.ts`**

```typescript
import "dotenv/config";

// Import all worker creators
import { createPdfToImageWorker } from "../lib/queues/workers/pdf-to-image.worker";
import { createFileConversionWorker } from "../lib/queues/workers/file-conversion.worker";
import { createVideoOptimizationWorker } from "../lib/queues/workers/video-optimization.worker";
import { createExportVisitsWorker } from "../lib/queues/workers/export-visits.worker";
import { createScheduledEmailWorker } from "../lib/queues/workers/scheduled-email.worker";
import { createDataroomNotificationWorker, createConversationNotificationWorker } from "../lib/queues/workers/notification.worker";
import { createPauseResumeWorker, createAutomaticUnpauseWorker } from "../lib/queues/workers/billing.worker";
import { createCleanupWorker, scheduleCleanupJob } from "../lib/queues/workers/cleanup.worker";

console.log("=".repeat(60));
console.log("  PAPERMARK BACKGROUND WORKERS");
console.log("=".repeat(60));
console.log("");

// Create all workers
const workers = [
  createPdfToImageWorker(),
  createFileConversionWorker(),
  createVideoOptimizationWorker(),
  createExportVisitsWorker(),
  createScheduledEmailWorker(),
  createDataroomNotificationWorker(),
  createConversationNotificationWorker(),
  createPauseResumeWorker(),
  createAutomaticUnpauseWorker(),
  createCleanupWorker(),
];

console.log(`  Started ${workers.length} workers`);
console.log(`  Redis: ${process.env.REDIS_URL || "redis://localhost:6379"}`);
console.log("");
console.log("=".repeat(60));

// Schedule cron jobs
scheduleCleanupJob().catch(console.error);

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n[Workers] ${signal} received, shutting down...`);

  try {
    await Promise.all(workers.map((w) => w.close()));
    console.log("[Workers] All workers closed");
    process.exit(0);
  } catch (error) {
    console.error("[Workers] Shutdown error:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.stdin.resume();
```

---

## 5. Code Changes Required

### 5.1 Update `lib/api/documents/process-document.ts`

```typescript
// REMOVE these imports:
import {
  convertCadToPdfTask,
  convertFilesToPdfTask,
  convertKeynoteToPdfTask,
} from "@/lib/trigger/convert-files";
import { processVideo } from "@/lib/trigger/optimize-video-files";
import { convertPdfToImageRoute } from "@/lib/trigger/pdf-to-image-route";
import { conversionQueue } from "@/lib/utils/trigger-utils";

// ADD these imports:
import {
  pdfToImageQueue,
  fileConversionQueue,
  videoOptimizationQueue,
  addJobWithTags,
} from "@/lib/queues";
```

**Replace all `.trigger()` calls:**

```typescript
// Keynote (lines ~147-163)
// BEFORE:
await convertKeynoteToPdfTask.trigger({ ... }, { idempotencyKey: ..., tags: ..., queue: ... });

// AFTER:
await addJobWithTags(
  fileConversionQueue,
  "convert-keynote",
  { documentId: document.id, documentVersionId: document.versions[0].id, teamId, conversionType: "keynote" },
  { jobId: `keynote-${document.versions[0].id}`, tags: [`team_${teamId}`, `document_${document.id}`] }
);

// Office docs (lines ~164-182)
// AFTER:
await addJobWithTags(
  fileConversionQueue,
  "convert-office",
  { documentId: document.id, documentVersionId: document.versions[0].id, teamId, conversionType: "office" },
  { jobId: `office-${document.versions[0].id}`, tags: [`team_${teamId}`, `document_${document.id}`] }
);

// CAD (lines ~184-202)
// AFTER:
await addJobWithTags(
  fileConversionQueue,
  "convert-cad",
  { documentId: document.id, documentVersionId: document.versions[0].id, teamId, conversionType: "cad" },
  { jobId: `cad-${document.versions[0].id}`, tags: [`team_${teamId}`, `document_${document.id}`] }
);

// Video (lines ~204-228)
// AFTER:
await addJobWithTags(
  videoOptimizationQueue,
  "process-video",
  {
    videoUrl: key,
    teamId,
    docId: key.split("/")[1],
    documentVersionId: document.versions[0].id,
    fileSize: fileSize || 0,
  },
  { jobId: `video-${document.versions[0].id}`, tags: [`team_${teamId}`, `document_${document.id}`] }
);

// PDF (lines ~231-249)
// AFTER:
await addJobWithTags(
  pdfToImageQueue,
  "convert-pdf-to-image",
  { documentId: document.id, documentVersionId: document.versions[0].id, teamId },
  { jobId: `pdf-${document.versions[0].id}`, tags: [`team_${teamId}`, `document_${document.id}`] }
);
```

### 5.2 Update `pages/api/teams/[teamId]/export-jobs.ts`

```typescript
// REMOVE:
import { exportVisitsTask } from "@/lib/trigger/export-visits";

// ADD:
import { exportQueue, addJobWithTags } from "@/lib/queues";

// REPLACE trigger call (line ~70):
// BEFORE:
const handle = await exportVisitsTask.trigger({ ... }, { idempotencyKey: ..., tags: ... });

// AFTER:
const job = await addJobWithTags(
  exportQueue,
  "export-visits",
  { type, teamId, resourceId, groupId, userId, exportId: exportJob.id },
  { jobId: exportJob.id, tags: [`team_${teamId}`, `user_${userId}`, `export_${exportJob.id}`] }
);

// Update job with BullMQ job ID instead of trigger run ID
const updatedJob = await jobStore.updateJob(exportJob.id, {
  triggerRunId: job.id, // Still works, just different ID format
});
```

### 5.3 Update `pages/api/teams/[teamId]/export-jobs/[exportId].ts`

```typescript
// REMOVE:
import { runs } from "@trigger.dev/sdk/v3";

// ADD:
import { cancelExportJob } from "@/lib/queues/helpers";

// REPLACE runs.cancel (line ~94):
// BEFORE:
await runs.cancel(exportJob.triggerRunId);

// AFTER:
await cancelExportJob(exportJob.id);
```

### 5.4 Update `pages/api/teams/[teamId]/datarooms/trial.ts`

```typescript
// REMOVE:
import {
  sendDataroomTrial24hReminderEmailTask,
  sendDataroomTrialExpiredEmailTask,
  sendDataroomTrialInfoEmailTask,
} from "@/lib/trigger/send-scheduled-email";

// ADD:
import { emailQueue, addJobWithTags } from "@/lib/queues";

// Helper to convert delay strings to milliseconds
function parseDelay(delay: string): number {
  const match = delay.match(/^(\d+)([dhms])$/);
  if (!match) return 0;
  const [, num, unit] = match;
  const multipliers: Record<string, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000,
  };
  return parseInt(num) * (multipliers[unit] || 0);
}

// REPLACE trigger calls (lines ~115-132):
// BEFORE:
waitUntil(sendDataroomTrialInfoEmailTask.trigger({ to: email!, useCase }, { delay: "1d" }));

// AFTER:
waitUntil(
  addJobWithTags(
    emailQueue,
    "dataroom-trial-info",
    { emailType: "dataroom-trial-info", to: email!, useCase },
    { delay: parseDelay("1d") }
  )
);
waitUntil(
  addJobWithTags(
    emailQueue,
    "dataroom-trial-24h",
    { emailType: "dataroom-trial-24h", to: email!, name: fullName.split(" ")[0], teamId },
    { delay: parseDelay("6d") }
  )
);
waitUntil(
  addJobWithTags(
    emailQueue,
    "dataroom-trial-expired",
    { emailType: "dataroom-trial-expired", to: email!, name: fullName.split(" ")[0], teamId },
    { delay: parseDelay("7d") }
  )
);
```

### 5.5 Update `pages/api/teams/[teamId]/datarooms/[id]/documents/index.ts`

```typescript
// REMOVE:
import { runs } from "@trigger.dev/sdk/v3";
import { sendDataroomChangeNotificationTask } from "@/lib/trigger/dataroom-change-notification";

// ADD:
import { dataroomNotificationQueue, addJobWithTags } from "@/lib/queues";
import { cancelPendingDataroomNotifications } from "@/lib/queues/helpers";

// REPLACE runs.list + runs.cancel + trigger (lines ~179-208):
// BEFORE:
const allRuns = await runs.list({ taskIdentifier: [...], tag: [...], status: [...] });
await Promise.all(allRuns.data.map((run) => runs.cancel(run.id)));
waitUntil(sendDataroomChangeNotificationTask.trigger({ ... }, { delay: new Date(...) }));

// AFTER:
await cancelPendingDataroomNotifications(dataroomId);
waitUntil(
  addJobWithTags(
    dataroomNotificationQueue,
    "dataroom-change",
    { dataroomId, dataroomDocumentId: document.id, senderUserId: userId, teamId },
    {
      jobId: `dataroom-notif-${dataroomId}-${document.id}`,
      delay: 10 * 60 * 1000, // 10 minutes
      tags: [`team_${teamId}`, `dataroom_${dataroomId}`],
    }
  )
);
```

### 5.6 Update `ee/features/conversations/api/conversations-route.ts`

```typescript
// REMOVE:
import { runs } from "@trigger.dev/sdk/v3";
import { sendConversationTeamMemberNotificationTask } from "../lib/trigger/conversation-message-notification";

// ADD:
import { conversationNotificationQueue, addJobWithTags } from "@/lib/queues";
import { cancelPendingConversationNotifications } from "@/lib/queues/helpers";

// REPLACE all instances of runs.list + runs.cancel + trigger:
// BEFORE:
const allRuns = await runs.list({ ... });
await Promise.all(allRuns.data.map((run) => runs.cancel(run.id)));
waitUntil(sendConversationTeamMemberNotificationTask.trigger({ ... }));

// AFTER:
await cancelPendingConversationNotifications(conversation.id);
waitUntil(
  addJobWithTags(
    conversationNotificationQueue,
    "conversation-team-member",
    {
      dataroomId,
      messageId: conversation.messages[0].id,
      conversationId: conversation.id,
      senderUserId: viewerId,
      teamId: team.id,
      notificationType: "team-member",
    },
    {
      delay: 5 * 60 * 1000, // 5 minutes
      tags: [`team_${team.id}`, `conversation_${conversation.id}`],
    }
  )
);
```

### 5.7 Update `ee/features/billing/cancellation/api/pause-route.ts`

```typescript
// REMOVE:
import { sendPauseResumeNotificationTask } from "../lib/trigger/pause-resume-notification";
import { automaticUnpauseTask } from "../lib/trigger/unpause-task";

// ADD:
import { pauseResumeQueue, automaticUnpauseQueue, addJobWithTags } from "@/lib/queues";

// REPLACE trigger calls (lines ~104-130):
// BEFORE:
waitUntil(Promise.all([
  sendPauseResumeNotificationTask.trigger({ teamId }, { delay: reminderAt, ... }),
  automaticUnpauseTask.trigger({ teamId }, { delay: pauseEndsAt, ... }),
]));

// AFTER:
const reminderDelay = reminderAt.getTime() - Date.now();
const unpauseDelay = pauseEndsAt.getTime() - Date.now();

waitUntil(Promise.all([
  addJobWithTags(
    pauseResumeQueue,
    "pause-resume-reminder",
    { teamId },
    { delay: reminderDelay, jobId: `pause-resume-${teamId}`, tags: [`team_${teamId}`] }
  ),
  addJobWithTags(
    automaticUnpauseQueue,
    "automatic-unpause",
    { teamId },
    { delay: unpauseDelay, jobId: `auto-unpause-${teamId}`, tags: [`team_${teamId}`] }
  ),
]));
```

### 5.8 Update `ee/stripe/webhooks/checkout-session-completed.ts`

```typescript
// REMOVE:
import { sendUpgradeOneMonthCheckinEmailTask } from "@/lib/trigger/send-scheduled-email";

// ADD:
import { emailQueue, addJobWithTags } from "@/lib/queues";

// REPLACE trigger call (lines ~140-151):
// BEFORE:
waitUntil(sendUpgradeOneMonthCheckinEmailTask.trigger({ ... }, { delay: "40d" }));

// AFTER:
waitUntil(
  addJobWithTags(
    emailQueue,
    "upgrade-checkin",
    { emailType: "upgrade-checkin", to: team.users[0].user.email!, name: team.users[0].user.name!, teamId },
    { delay: 40 * 24 * 60 * 60 * 1000 } // 40 days in ms
  )
);
```

### 5.9 Update `lib/utils/use-progress-status.ts`

Replace entire file content with:

```typescript
// Re-export from new location for backwards compatibility
export { useDocumentProgressStatus } from "@/lib/progress/use-job-progress";
```

### 5.10 Update `package.json`

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

### 5.11 Update `docker-compose.yml`

```yaml
services:
  app:
    build: .
    depends_on:
      - postgres
      - redis
    environment:
      - REDIS_URL=redis://redis:6379

  workers:
    build: .
    command: npm run workers
    depends_on:
      - redis
    environment:
      - REDIS_URL=redis://redis:6379

  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

volumes:
  postgres-data:
  redis-data:
```

---

## 6. Feature Parity Mappings

| Trigger.dev Feature | BullMQ Equivalent |
|---------------------|-------------------|
| `task()` | `Worker` + queue |
| `.trigger()` | `queue.add()` or `addJobWithTags()` |
| `delay: "1d"` | `{ delay: ms }` option |
| `delay: new Date(...)` | `{ delay: date.getTime() - Date.now() }` |
| `idempotencyKey` | `{ jobId: key }` |
| `tags: [...]` | Embed in job data as `_tags` |
| `runs.list({ tag, status })` | `getJobsByTag()` helper |
| `runs.cancel(id)` | `job.remove()` or `cancelJobById()` |
| `metadata.set()` | `job.updateProgress({ progress, text })` |
| `useRealtimeRunsWithTag` | Polling hook `useJobProgress()` |
| `schedules.task({ cron })` | `queue.add(..., { repeat: { pattern } })` |
| `auth.createPublicToken` | Not needed (use session auth for polling) |
| `concurrencyKey` | Worker `concurrency` option |
| `queue: { name, concurrencyLimit }` | Queue-level config |

---

## 7. Testing Checklist

### Infrastructure
- [ ] Redis container running: `docker-compose up -d redis`
- [ ] `redis-cli ping` returns `PONG`
- [ ] Environment variables set in `.env`

### Workers
- [ ] `npm run workers` starts without errors
- [ ] All 10 workers register successfully
- [ ] Cleanup cron job scheduled

### Document Processing
- [ ] Upload PDF → pages convert ✓
- [ ] Upload DOCX → converts to PDF → pages convert ✓
- [ ] Upload PPTX (Keynote) → converts to PDF → pages convert ✓
- [ ] Upload CAD file → converts to PDF → pages convert ✓
- [ ] Upload video → optimizes (or skips if >500MB) ✓
- [ ] Progress updates show in UI ✓

### Export
- [ ] Export document visits → CSV generated
- [ ] Export dataroom visits → CSV generated
- [ ] Cancel export → job removed

### Notifications
- [ ] Add document to dataroom → notification sent after 10min delay
- [ ] Conversation message → team notification sent after 5min delay
- [ ] Cancellation of pending notifications works

### Billing
- [ ] Pause subscription → reminder scheduled
- [ ] Pause subscription → auto-unpause scheduled
- [ ] Delays work correctly (test with short delays)

### Scheduled Emails
- [ ] Trial info email (1 day delay)
- [ ] Trial 24h reminder (6 day delay)
- [ ] Trial expired (7 day delay)
- [ ] Upgrade checkin (40 day delay)

### Cleanup
- [ ] Cron runs at 2 AM UTC
- [ ] Expired blobs deleted

---

## Quick Reference Commands

```bash
# Start Redis
docker-compose up -d redis

# Start workers (development)
npm run workers:watch

# Start everything (app + workers)
npm run dev:full

# Check Redis
redis-cli ping
redis-cli keys "bull:*"

# Monitor specific queue
redis-cli monitor | grep "pdf-to-image"

# Check queue stats
redis-cli hgetall "bull:pdf-to-image:id"
```

---

## Files to Delete After Migration

Once migration is complete and tested:

```
lib/trigger/                              # All trigger job definitions
ee/features/*/lib/trigger/                # EE trigger jobs
lib/utils/trigger-utils.ts
lib/utils/generate-trigger-auth-token.ts
lib/utils/generate-trigger-status.ts      # If not needed
trigger.config.ts
```

---

## Rollback Plan

If issues occur:
1. Stop workers: `Ctrl+C` or `docker-compose stop workers`
2. Revert code: `git checkout -- .`
3. Remove BullMQ: `npm uninstall bullmq ioredis`
4. Restart with Trigger.dev

The Trigger.dev code remains in `lib/trigger/` until final cleanup.
