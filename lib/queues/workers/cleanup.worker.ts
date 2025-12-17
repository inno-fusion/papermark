import { Job, Worker } from "bullmq";
import { del } from "@vercel/blob";

import { jobStore } from "@/lib/redis-job-store";

import { createRedisConnection } from "../connection";
import { cleanupQueue } from "../index";

type CleanupResult = {
  deletedCount: number;
  failureCount?: number;
  totalProcessed?: number;
};

async function processCleanup(job: Job): Promise<CleanupResult> {
  console.log(`[Cleanup Worker] Starting cleanup`);

  try {
    const blobsToCleanup = await jobStore.getBlobsForCleanup();

    if (blobsToCleanup.length === 0) {
      console.log(`[Cleanup Worker] No blobs due for cleanup`);
      return { deletedCount: 0 };
    }

    console.log(
      `[Cleanup Worker] Found ${blobsToCleanup.length} blobs to delete`,
    );

    let successCount = 0;
    let failureCount = 0;

    for (const blob of blobsToCleanup) {
      try {
        await del(blob.blobUrl);
        await jobStore.removeBlobFromCleanupQueue(blob.blobUrl, blob.jobId);
        successCount++;
        console.log(`[Cleanup Worker] Deleted blob: ${blob.blobUrl}`);
      } catch (error) {
        failureCount++;
        console.error(
          `[Cleanup Worker] Failed to delete blob ${blob.blobUrl}:`,
          error,
        );
      }
    }

    console.log(
      `[Cleanup Worker] Cleanup completed: ${successCount} deleted, ${failureCount} failed`,
    );

    return {
      deletedCount: successCount,
      failureCount,
      totalProcessed: blobsToCleanup.length,
    };
  } catch (error) {
    console.error(`[Cleanup Worker] Job failed:`, error);
    throw error;
  }
}

export function createCleanupWorker() {
  const worker = new Worker("cleanup", processCleanup, {
    connection: createRedisConnection(),
    concurrency: 1,
  });

  worker.on("completed", (job, result) =>
    console.log(`[Cleanup] Job completed:`, result),
  );
  worker.on("failed", (job, err) =>
    console.error(`[Cleanup] Job failed:`, err.message),
  );

  return worker;
}

// Schedule daily cleanup (replaces schedules.task cron)
export async function scheduleCleanupJob() {
  // Check if repeatable job already exists
  const existingJobs = await cleanupQueue.getRepeatableJobs();
  const hasCleanupJob = existingJobs.some(
    (job) => job.name === "daily-cleanup",
  );

  if (!hasCleanupJob) {
    // Add a repeatable job that runs daily at 2 AM UTC
    await cleanupQueue.add(
      "daily-cleanup",
      {},
      {
        repeat: {
          pattern: "0 2 * * *", // Cron: daily at 2 AM UTC
        },
        jobId: "daily-cleanup", // Prevent duplicates
      },
    );

    console.log("[Cleanup] Scheduled daily cleanup job at 2 AM UTC");
  } else {
    console.log("[Cleanup] Daily cleanup job already scheduled");
  }
}
