import "dotenv/config";

import {
  createAutomaticUnpauseWorker,
  createCleanupWorker,
  createConversationNotificationWorker,
  createDataroomNotificationWorker,
  createExportVisitsWorker,
  createFileConversionWorker,
  createPauseResumeWorker,
  createPdfToImageWorker,
  createScheduledEmailWorker,
  createVideoOptimizationWorker,
  createWebhookDeliveryWorker,
  scheduleCleanupJob,
} from "../lib/queues/workers";

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
  createWebhookDeliveryWorker(),
];

console.log(`  Started ${workers.length} workers:`);
console.log("    - pdf-to-image");
console.log("    - file-conversion");
console.log("    - video-optimization");
console.log("    - export-visits");
console.log("    - scheduled-email");
console.log("    - dataroom-notification");
console.log("    - conversation-notification");
console.log("    - pause-resume-notification");
console.log("    - automatic-unpause");
console.log("    - cleanup");
console.log("    - webhook-delivery");
console.log("");
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
