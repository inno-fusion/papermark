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
  jobId: string,
): Promise<ProgressStatus | null> {
  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = typeof job.progress === "number" ? job.progress : 0;
  const progressData =
    typeof job.progress === "object" ? (job.progress as any) : null;

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
  text: string,
) {
  await job.updateProgress({ progress, text });
}
