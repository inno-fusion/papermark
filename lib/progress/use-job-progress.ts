"use client";

import { useCallback, useEffect, useState } from "react";

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
  options: UseJobProgressOptions = {},
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
        `/api/jobs/progress?queue=${queueName}&jobId=${jobId}`,
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
  _publicAccessToken: string | undefined, // Kept for API compatibility, not used
) {
  const { status, error } = useJobProgress(
    "pdf-to-image",
    documentVersionId ? `pdf-${documentVersionId}` : undefined,
    { enabled: !!documentVersionId },
  );

  return {
    status,
    error,
    run:
      status.state !== "QUEUED"
        ? { id: `pdf-${documentVersionId}` }
        : undefined,
  };
}
