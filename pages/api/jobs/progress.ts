import { Queue } from "bullmq";
import { NextApiRequest, NextApiResponse } from "next";

import { getJobProgress } from "@/lib/progress";
import {
  exportQueue,
  fileConversionQueue,
  pdfToImageQueue,
  videoOptimizationQueue,
} from "@/lib/queues";

const queueMap: Record<string, Queue> = {
  "pdf-to-image": pdfToImageQueue,
  "file-conversion": fileConversionQueue,
  "video-optimization": videoOptimizationQueue,
  "export-visits": exportQueue,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
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
