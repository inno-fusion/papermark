import { Job, Worker } from "bullmq";

import { createRedisConnection } from "../connection";
import type {
  AutomaticUnpausePayload,
  PauseResumeNotificationPayload,
} from "../types";

type BillingResult = {
  success: boolean;
};

async function processPauseResumeNotification(
  job: Job<PauseResumeNotificationPayload>,
): Promise<BillingResult> {
  const { teamId } = job.data;

  console.log(`[Billing Worker] Pause resume notification for: ${teamId}`);

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/jobs/send-pause-resume-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({ teamId }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Billing Worker] Failed to send notification: ${error}`);
      throw new Error(`Failed: ${error}`);
    }

    console.log(`[Billing Worker] Pause resume notification sent`);
    return { success: true };
  } catch (error) {
    console.error(`[Billing Worker] Job ${job.id} failed:`, error);
    throw error;
  }
}

async function processAutomaticUnpause(
  job: Job<AutomaticUnpausePayload>,
): Promise<BillingResult> {
  const { teamId } = job.data;

  console.log(`[Billing Worker] Automatic unpause for: ${teamId}`);

  try {
    const response = await fetch(
      `${process.env.NEXTAUTH_URL}/api/internal/billing/automatic-unpause`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({ teamId }),
      },
    );

    if (!response.ok && response.status >= 500) {
      const error = await response.text();
      console.error(`[Billing Worker] Server error: ${error}`);
      throw new Error(`Server error: ${response.status}`);
    }

    console.log(`[Billing Worker] Automatic unpause completed`);
    return { success: true };
  } catch (error) {
    console.error(`[Billing Worker] Job ${job.id} failed:`, error);
    throw error;
  }
}

export function createPauseResumeWorker() {
  const worker = new Worker<PauseResumeNotificationPayload, BillingResult>(
    "pause-resume-notification",
    processPauseResumeNotification,
    {
      connection: createRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on("completed", (job) =>
    console.log(`[Pause Resume] Job ${job.id} completed`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[Pause Resume] Job ${job?.id} failed:`, err.message),
  );

  return worker;
}

export function createAutomaticUnpauseWorker() {
  const worker = new Worker<AutomaticUnpausePayload, BillingResult>(
    "automatic-unpause",
    processAutomaticUnpause,
    {
      connection: createRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on("completed", (job) =>
    console.log(`[Auto Unpause] Job ${job.id} completed`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[Auto Unpause] Job ${job?.id} failed:`, err.message),
  );

  return worker;
}
