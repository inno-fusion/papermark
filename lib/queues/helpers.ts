import { Job, Queue } from "bullmq";

import {
  automaticUnpauseQueue,
  conversationNotificationQueue,
  dataroomNotificationQueue,
  exportQueue,
  pauseResumeQueue,
} from "./index";

type JobStatus =
  | "completed"
  | "failed"
  | "delayed"
  | "active"
  | "waiting"
  | "paused";

// ============================================
// GET JOBS BY TAG
// Replaces: runs.list({ tag: [...], status: [...] })
// ============================================

export async function getJobsByTag(
  queue: Queue,
  tag: string,
  statuses: JobStatus[] = ["delayed", "waiting"],
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
  statuses: JobStatus[] = ["delayed", "waiting"],
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

export async function cancelJobById(
  queue: Queue,
  jobId: string,
): Promise<boolean> {
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
export async function cancelPendingConversationNotifications(
  conversationId: string,
) {
  return cancelJobsByTag(
    conversationNotificationQueue,
    `conversation_${conversationId}`,
  );
}

// For export jobs - cancel by export ID
export async function cancelExportJob(exportId: string) {
  return cancelJobById(exportQueue, exportId);
}

// For billing - cancel pending pause/resume and automatic unpause jobs for a team
export async function cancelPendingBillingJobs(teamId: string) {
  const [pauseResumeCount, unpauseCount] = await Promise.all([
    cancelJobsByTag(pauseResumeQueue, `team_${teamId}`),
    cancelJobsByTag(automaticUnpauseQueue, `team_${teamId}`),
  ]);
  return pauseResumeCount + unpauseCount;
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
