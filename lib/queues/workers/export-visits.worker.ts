import { Job, Worker } from "bullmq";

import { updateJobProgress } from "@/lib/progress";
import { jobStore } from "@/lib/redis-job-store";

import { createRedisConnection } from "../connection";
import type { ExportVisitsPayload } from "../types";

type ExportVisitsResult = {
  success: boolean;
  exportId: string;
  error?: string;
};

async function processExportVisits(
  job: Job<ExportVisitsPayload>,
): Promise<ExportVisitsResult> {
  const { type, teamId, resourceId, groupId, userId, exportId } = job.data;

  console.log(`[Export Worker] Starting export for: ${exportId}`);

  try {
    await updateJobProgress(job, 10, "Starting export...");

    // Call internal API that handles the export logic
    // This reuses the existing export logic from lib/trigger/export-visits.ts
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/jobs/process-export`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({
          type,
          teamId,
          resourceId,
          groupId,
          userId,
          exportId,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Export Worker] Export failed: ${error}`);

      // Update job status to failed
      await jobStore.updateJob(exportId, {
        status: "FAILED",
        error: error,
      });

      throw new Error(`Export failed: ${error}`);
    }

    const result = await response.json();
    await updateJobProgress(job, 100, "Export complete");

    console.log(`[Export Worker] Job ${job.id} completed`);
    return {
      success: true,
      exportId,
      ...result,
    };
  } catch (error) {
    console.error(`[Export Worker] Job ${job.id} failed:`, error);
    throw error;
  }
}

export function createExportVisitsWorker() {
  const worker = new Worker<ExportVisitsPayload, ExportVisitsResult>(
    "export-visits",
    processExportVisits,
    {
      connection: createRedisConnection(),
      concurrency: 3,
    },
  );

  worker.on("completed", (job) =>
    console.log(`[Export Worker] Job ${job.id} completed`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[Export Worker] Job ${job?.id} failed:`, err.message),
  );

  return worker;
}
