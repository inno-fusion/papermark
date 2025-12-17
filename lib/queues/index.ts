import { Queue, QueueEvents } from "bullmq";

import { getRedisConnection } from "./connection";
import type {
  AutomaticUnpausePayload,
  ConversationNotificationPayload,
  DataroomNotificationPayload,
  DelayedJobOptions,
  ExportVisitsPayload,
  FileConversionPayload,
  PauseResumeNotificationPayload,
  PdfToImagePayload,
  ScheduledEmailPayload,
  VideoOptimizationPayload,
  WebhookDeliveryPayload,
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
export const fileConversionQueue = new Queue<FileConversionPayload>(
  "file-conversion",
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  },
);

// Video optimization
export const videoOptimizationQueue = new Queue<VideoOptimizationPayload>(
  "video-optimization",
  {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    },
  },
);

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
export const dataroomNotificationQueue =
  new Queue<DataroomNotificationPayload>("dataroom-notification", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

// Conversation notifications
export const conversationNotificationQueue =
  new Queue<ConversationNotificationPayload>("conversation-notification", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

// Billing - pause resume notifications
export const pauseResumeQueue = new Queue<PauseResumeNotificationPayload>(
  "pause-resume-notification",
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    },
  },
);

// Billing - automatic unpause
export const automaticUnpauseQueue = new Queue<AutomaticUnpausePayload>(
  "automatic-unpause",
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    },
  },
);

// Cleanup jobs (scheduled/cron)
export const cleanupQueue = new Queue("cleanup", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: { count: 10 },
  },
});

// Webhook delivery (replaces QStash)
export const webhookDeliveryQueue = new Queue<WebhookDeliveryPayload>(
  "webhook-delivery",
  {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 100 },
    },
  },
);

// ============================================
// QUEUE EVENTS (for monitoring)
// ============================================

export const pdfToImageEvents = new QueueEvents("pdf-to-image", { connection });
export const fileConversionEvents = new QueueEvents("file-conversion", {
  connection,
});
export const exportEvents = new QueueEvents("export-visits", { connection });
export const webhookDeliveryEvents = new QueueEvents("webhook-delivery", {
  connection,
});

// ============================================
// HELPER: ADD JOB WITH TAGS SUPPORT
// ============================================

// Store tags in job data for later filtering (BullMQ doesn't have native tags)
export async function addJobWithTags<T extends object>(
  queue: Queue<T>,
  name: string,
  data: T,
  options: DelayedJobOptions = {},
) {
  const { delay, jobId, tags } = options;

  // Embed tags in the data for later retrieval
  const dataWithTags = { ...data, _tags: tags || [] };

  // Use type assertion to handle BullMQ's strict name typing
  return queue.add(name as any, dataWithTags as any, {
    delay,
    jobId,
  });
}

// ============================================
// RE-EXPORT TYPES
// ============================================

export * from "./types";
