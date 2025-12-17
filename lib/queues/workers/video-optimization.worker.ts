import { Job, Worker } from "bullmq";
import ffmpeg from "fluent-ffmpeg";
import { createReadStream, createWriteStream } from "fs";
import fs from "fs/promises";
import fetch from "node-fetch";
import os from "os";
import path from "path";
import { pipeline } from "stream/promises";

import { getFile } from "@/lib/files/get-file";
import { streamFileServer } from "@/lib/files/stream-file-server";
import prisma from "@/lib/prisma";
import { updateJobProgress } from "@/lib/progress";

import { createRedisConnection } from "../connection";
import type { VideoOptimizationPayload } from "../types";

type VideoOptimizationResult = {
  success: boolean;
  message?: string;
};

async function processVideoOptimization(
  job: Job<VideoOptimizationPayload>,
): Promise<VideoOptimizationResult> {
  const { videoUrl, teamId, docId, documentVersionId, fileSize } = job.data;

  console.log(
    `[Video Worker] Starting optimization for: ${documentVersionId}`,
  );

  try {
    const fileUrl = await getFile({ data: videoUrl, type: "S3_PATH" });
    await updateJobProgress(job, 5, "Downloading video...");

    // Create temp directory
    const tempDirectory = path.join(os.tmpdir(), `video_${Date.now()}`);
    await fs.mkdir(tempDirectory, { recursive: true });
    const inputPath = path.join(tempDirectory, "input.mp4");
    const outputPath = path.join(tempDirectory, "output.mp4");

    // Download video
    const response = await fetch(fileUrl);
    if (!response.body) throw new Error("Failed to fetch video");
    await pipeline(response.body as any, createWriteStream(inputPath));

    await updateJobProgress(job, 20, "Analyzing video...");

    // Get metadata
    const metadata = await new Promise<{
      width: number;
      height: number;
      fps: number;
      duration: number;
    }>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) return reject(err);
        const videoStream = data.streams.find((s) => s.codec_type === "video");
        if (!videoStream) return reject(new Error("No video stream"));

        const fpsStr = videoStream.r_frame_rate || videoStream.avg_frame_rate;
        const [num, den] = fpsStr?.split("/").map(Number) || [0, 1];

        resolve({
          width: videoStream.width || 1920,
          height: videoStream.height || 1080,
          fps: num / (den || 1),
          duration: Math.round(data.format.duration || 0),
        });
      });
    });

    // Update duration
    await prisma.documentVersion.update({
      where: { id: documentVersionId },
      data: { length: metadata.duration },
    });

    // Skip if too large
    if (fileSize > 500 * 1024 * 1024) {
      console.log(
        `[Video Worker] File size is ${fileSize / 1024 / 1024} MB, skipping optimization`,
      );
      await fs.rm(tempDirectory, { recursive: true });
      return { success: true, message: "File too large, skipped optimization" };
    }

    await updateJobProgress(job, 30, "Optimizing video...");

    // Process video
    const keyframeInterval = Math.round(metadata.fps * 2);
    const scaleFilter = metadata.width > 1920 ? "-vf scale=1920:-2" : null;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .inputOptions(["-y"])
        .outputOptions([
          ...(scaleFilter ? [scaleFilter] : []),
          "-c:v libx264",
          "-profile:v high",
          "-level:v 4.1",
          "-c:a aac",
          "-ar 48000",
          "-b:a 128k",
          "-b:v 6000k",
          "-maxrate 12000k",
          "-bufsize 12000k",
          "-preset medium",
          `-g ${keyframeInterval}`,
          `-keyint_min ${keyframeInterval}`,
          "-sc_threshold 0",
          "-movflags +faststart",
        ])
        .output(outputPath)
        .on("error", reject)
        .on("end", () => resolve())
        .run();
    });

    await updateJobProgress(job, 70, "Uploading optimized video...");

    // Upload
    const fileStream = createReadStream(outputPath);
    const { data } = await streamFileServer({
      file: { name: "optimized.mp4", type: "video/mp4", stream: fileStream },
      teamId,
      docId,
    });

    if (!data) throw new Error("Upload failed");

    await prisma.documentVersion.update({
      where: { id: documentVersionId },
      data: { file: data },
    });

    await fs.rm(tempDirectory, { recursive: true });
    await updateJobProgress(job, 100, "Complete");

    console.log(`[Video Worker] Job ${job.id} completed`);
    return { success: true };
  } catch (error) {
    console.error(`[Video Worker] Job ${job.id} failed:`, error);
    throw error;
  }
}

export function createVideoOptimizationWorker() {
  const worker = new Worker<VideoOptimizationPayload, VideoOptimizationResult>(
    "video-optimization",
    processVideoOptimization,
    {
      connection: createRedisConnection(),
      concurrency: 2,
    },
  );

  worker.on("completed", (job) =>
    console.log(`[Video Worker] Job ${job.id} completed`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[Video Worker] Job ${job?.id} failed:`, err.message),
  );

  return worker;
}
