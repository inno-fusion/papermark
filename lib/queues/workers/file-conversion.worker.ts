import { Job, Worker } from "bullmq";

import { getFile } from "@/lib/files/get-file";
import { putFileServer } from "@/lib/files/put-file-server";
import prisma from "@/lib/prisma";
import { updateJobProgress } from "@/lib/progress";
import { getExtensionFromContentType } from "@/lib/utils/get-content-type";

import { createRedisConnection } from "../connection";
import { addJobWithTags, pdfToImageQueue } from "../index";
import type { FileConversionPayload } from "../types";

type FileConversionResult = {
  success: boolean;
  convertedFile?: string;
  error?: string;
};

async function processFileConversion(
  job: Job<FileConversionPayload>,
): Promise<FileConversionResult> {
  const { documentId, documentVersionId, teamId, conversionType } = job.data;

  console.log(
    `[Conversion Worker] Starting ${conversionType} conversion for: ${documentVersionId}`,
  );

  try {
    await updateJobProgress(job, 0, "Initializing...");

    // 1. Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      console.error(`[Conversion Worker] Team not found: ${teamId}`);
      throw new Error("Team not found");
    }

    // 2. Get document info
    const document = await prisma.document.findUnique({
      where: { id: documentId, teamId },
      select: {
        name: true,
        versions: {
          where: { id: documentVersionId },
          select: {
            file: true,
            originalFile: true,
            contentType: true,
            storageType: true,
            versionNumber: true,
          },
        },
      },
    });

    if (
      !document ||
      !document.versions[0] ||
      !document.versions[0].originalFile ||
      !document.versions[0].contentType
    ) {
      console.error(`[Conversion Worker] Document not found: ${documentId}`);
      await updateJobProgress(job, 0, "Document not found");
      throw new Error("Document or version not found");
    }

    const version = document.versions[0];
    await updateJobProgress(job, 10, "Retrieving file...");

    // 3. Validate required fields
    if (!version.originalFile) {
      console.error(`[Conversion Worker] No original file for version`);
      throw new Error("No original file available for conversion");
    }

    if (!version.contentType) {
      console.error(`[Conversion Worker] No content type for version`);
      throw new Error("No content type available for conversion");
    }

    const fileUrl = await getFile({
      data: version.originalFile,
      type: version.storageType,
    });

    if (!fileUrl) {
      console.error(`[Conversion Worker] Failed to get file URL`);
      throw new Error("Failed to get file URL");
    }

    await updateJobProgress(job, 20, "Converting document...");

    // 4. Convert based on type
    let conversionBuffer: Buffer;

    if (conversionType === "office") {
      // LibreOffice conversion
      const formData = new FormData();
      formData.append("downloadFrom", JSON.stringify([{ url: fileUrl }]));
      formData.append("quality", "75");

      // Build headers with optional Basic Auth for Gotenberg
      const headers: Record<string, string> = {};
      if (process.env.GOTENBERG_USERNAME && process.env.GOTENBERG_PASSWORD) {
        const credentials = Buffer.from(
          `${process.env.GOTENBERG_USERNAME}:${process.env.GOTENBERG_PASSWORD}`,
        ).toString("base64");
        headers.Authorization = `Basic ${credentials}`;
      }

      const response = await fetch(
        `${process.env.NEXT_PRIVATE_CONVERSION_BASE_URL}/forms/libreoffice/convert`,
        {
          method: "POST",
          body: formData,
          headers,
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(
          `[Conversion Worker] LibreOffice conversion failed: ${response.status}`,
        );
        await updateJobProgress(job, 0, "Conversion failed");
        throw new Error(
          `LibreOffice conversion failed: ${response.status} - ${errorBody}`,
        );
      }

      conversionBuffer = Buffer.from(await response.arrayBuffer());
    } else if (conversionType === "cad" || conversionType === "keynote") {
      // ConvertAPI conversion
      const engine = conversionType === "cad" ? "cadconverter" : "iwork";
      const inputFormat = getExtensionFromContentType(version.contentType);

      const tasksPayload = {
        tasks: {
          "import-file-v1": {
            operation: "import/url",
            url: fileUrl,
            filename: document.name,
          },
          "convert-file-v1": {
            operation: "convert",
            input: ["import-file-v1"],
            input_format: inputFormat,
            output_format: "pdf",
            engine,
            ...(conversionType === "cad" && {
              all_layouts: true,
              auto_zoom: false,
            }),
          },
          "export-file-v1": {
            operation: "export/url",
            input: ["convert-file-v1"],
            inline: false,
            archive_multiple_files: false,
          },
        },
        redirect: true,
      };

      const response = await fetch(process.env.NEXT_PRIVATE_CONVERT_API_URL!, {
        method: "POST",
        body: JSON.stringify(tasksPayload),
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PRIVATE_CONVERT_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(
          `[Conversion Worker] ConvertAPI conversion failed: ${response.status}`,
        );
        throw new Error(
          `ConvertAPI conversion failed: ${response.status} - ${errorBody}`,
        );
      }

      conversionBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new Error(`Unknown conversion type: ${conversionType}`);
    }

    console.log(
      `[Conversion Worker] Conversion complete, buffer size: ${conversionBuffer.length}`,
    );
    await updateJobProgress(job, 30, "Saving converted file...");

    // 5. Save converted PDF to S3
    const match = version.originalFile.match(/(doc_[^\/]+)\//);
    const docId = match ? match[1] : undefined;

    const { type: storageType, data } = await putFileServer({
      file: {
        name: `${document.name}.pdf`,
        type: "application/pdf",
        buffer: conversionBuffer,
      },
      teamId,
      docId,
    });

    if (!data || !storageType) {
      console.error(`[Conversion Worker] Failed to save converted file`);
      await updateJobProgress(job, 0, "Failed to save converted file");
      throw new Error("Failed to save converted file");
    }

    console.log(`[Conversion Worker] Saved converted file: ${data}`);
    await updateJobProgress(job, 40, "Initiating document processing...");

    // 6. Update document version
    const { versionNumber } = await prisma.documentVersion.update({
      where: { id: documentVersionId },
      data: {
        file: data,
        type: "pdf",
        storageType,
      },
      select: {
        versionNumber: true,
      },
    });

    // 7. Queue PDF to image conversion
    await addJobWithTags(
      pdfToImageQueue,
      "convert-pdf-to-image",
      {
        documentId,
        documentVersionId,
        teamId,
        versionNumber,
      },
      {
        jobId: `pdf-${documentVersionId}`,
        tags: [
          `team_${teamId}`,
          `document_${documentId}`,
          `version:${documentVersionId}`,
        ],
      },
    );

    console.log(`[Conversion Worker] Queued PDF to image conversion`);

    return {
      success: true,
      convertedFile: data,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[Conversion Worker] Job ${job.id} failed:`, errorMessage);
    throw error;
  }
}

export function createFileConversionWorker() {
  const worker = new Worker<FileConversionPayload, FileConversionResult>(
    "file-conversion",
    processFileConversion,
    {
      connection: createRedisConnection(),
      concurrency: 3,
    },
  );

  worker.on("completed", (job, result) => {
    console.log(`[Conversion Worker] Job ${job.id} completed:`, result.success);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Conversion Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[Conversion Worker] Worker error:", err);
  });

  return worker;
}
