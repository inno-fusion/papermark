import { Job, Worker } from "bullmq";

import { getFile } from "@/lib/files/get-file";
import prisma from "@/lib/prisma";
import { updateJobProgress } from "@/lib/progress";

import { createRedisConnection } from "../connection";
import type { PdfToImagePayload } from "../types";

type PdfToImageResult = {
  success: boolean;
  totalPages?: number;
  error?: string;
};

async function processPdfToImage(
  job: Job<PdfToImagePayload>,
): Promise<PdfToImageResult> {
  const { documentVersionId, teamId, documentId, versionNumber } = job.data;

  console.log(
    `[PDF Worker] Starting job ${job.id} for version: ${documentVersionId}`,
  );

  try {
    await updateJobProgress(job, 0, "Initializing...");

    // 1. Get document version from database
    const documentVersion = await prisma.documentVersion.findUnique({
      where: { id: documentVersionId },
      select: {
        file: true,
        storageType: true,
        numPages: true,
      },
    });

    if (!documentVersion) {
      console.error(`[PDF Worker] Document version not found: ${documentVersionId}`);
      await updateJobProgress(job, 0, "Document not found");
      throw new Error(`Document version not found: ${documentVersionId}`);
    }

    console.log(`[PDF Worker] Found document version, getting signed URL...`);
    await updateJobProgress(job, 10, "Retrieving file...");

    // 2. Get signed URL from S3
    const signedUrl = await getFile({
      type: documentVersion.storageType,
      data: documentVersion.file,
    });

    if (!signedUrl) {
      console.error(`[PDF Worker] Failed to get signed URL`);
      await updateJobProgress(job, 0, "Failed to retrieve document");
      throw new Error("Failed to get signed URL for document");
    }

    console.log(`[PDF Worker] Retrieved signed URL`);

    let numPages = documentVersion.numPages;

    // 3. Get page count if not already set
    if (!numPages || numPages === 1) {
      console.log(`[PDF Worker] Getting page count...`);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/mupdf/get-pages`,
        {
          method: "POST",
          body: JSON.stringify({ url: signedUrl }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
          },
        },
      );

      if (!response.ok) {
        console.error(
          `[PDF Worker] Failed to get page count: ${response.status}`,
        );
        throw new Error(`Failed to get page count: ${response.status}`);
      }

      const { numPages: pageCount } = (await response.json()) as {
        numPages: number;
      };

      if (pageCount < 1) {
        console.error(`[PDF Worker] Invalid page count: ${pageCount}`);
        await updateJobProgress(job, 0, "Failed to get number of pages");
        throw new Error("Invalid page count returned");
      }

      numPages = pageCount;
      console.log(`[PDF Worker] Document has ${numPages} pages`);
    }

    await updateJobProgress(job, 20, "Converting document...");

    // 4. Convert each page to image
    let currentPage = 0;
    let conversionWithoutError = true;

    for (let i = 0; i < numPages; ++i) {
      if (!conversionWithoutError) {
        break;
      }

      currentPage = i + 1;
      console.log(`[PDF Worker] Converting page ${currentPage}/${numPages}...`);

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/mupdf/convert-page`,
          {
            method: "POST",
            body: JSON.stringify({
              documentVersionId,
              pageNumber: currentPage,
              url: signedUrl,
              teamId,
            }),
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
            },
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          // If document was blocked, stop processing entirely
          if (
            response.status === 400 &&
            errorData.error?.includes("blocked")
          ) {
            console.error(`[PDF Worker] Document blocked at page ${currentPage}`);
            await updateJobProgress(job, 0, "Document couldn't be processed");
            throw new Error("Document processing blocked");
          }

          throw new Error(`Failed to convert page ${currentPage}`);
        }

        const { documentPageId } = (await response.json()) as {
          documentPageId: string;
        };

        console.log(
          `[PDF Worker] Page ${currentPage} converted: ${documentPageId}`,
        );
      } catch (error) {
        conversionWithoutError = false;
        if (error instanceof Error) {
          console.error(
            `[PDF Worker] Error on page ${currentPage}:`,
            error.message,
          );
        }
        throw error;
      }

      // Update progress (20% to 90% for page conversion)
      const progress = 20 + Math.floor((currentPage / numPages) * 70);
      await updateJobProgress(
        job,
        progress,
        `${currentPage} / ${numPages} pages processed`,
      );
    }

    if (!conversionWithoutError) {
      const errorText = `Error processing page ${currentPage} of ${numPages}`;
      await updateJobProgress(
        job,
        (currentPage / numPages) * 100,
        errorText,
      );
      throw new Error(errorText);
    }

    // 5. Update document version in database
    console.log(`[PDF Worker] Updating document version...`);
    await updateJobProgress(job, 90, "Enabling pages...");

    await prisma.documentVersion.update({
      where: { id: documentVersionId },
      data: {
        numPages,
        hasPages: true,
        isPrimary: true,
      },
    });

    // 6. Update other versions to not primary
    if (versionNumber) {
      await prisma.documentVersion.updateMany({
        where: {
          documentId,
          versionNumber: { not: versionNumber },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    // 7. Revalidate link cache
    console.log(`[PDF Worker] Revalidating cache...`);
    await updateJobProgress(job, 95, "Revalidating link...");

    try {
      await fetch(
        `${process.env.NEXTAUTH_URL}/api/revalidate?secret=${process.env.REVALIDATE_TOKEN}&documentId=${documentId}`,
      );
    } catch (revalidateError) {
      // Non-fatal error, just log it
      console.warn(`[PDF Worker] Revalidation failed:`, revalidateError);
    }

    await updateJobProgress(job, 100, "Processing complete");

    console.log(`[PDF Worker] Job ${job.id} completed successfully`);

    return {
      success: true,
      totalPages: numPages,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[PDF Worker] Job ${job.id} failed:`, errorMessage);
    throw error;
  }
}

export function createPdfToImageWorker() {
  const worker = new Worker<PdfToImagePayload, PdfToImageResult>(
    "pdf-to-image",
    processPdfToImage,
    {
      connection: createRedisConnection(),
      concurrency: 5, // Process 5 jobs simultaneously
      limiter: {
        max: 10, // Max 10 jobs
        duration: 1000, // Per second
      },
    },
  );

  // Event handlers
  worker.on("completed", (job, result) => {
    console.log(`[PDF Worker] Job ${job.id} completed:`, result);
  });

  worker.on("failed", (job, err) => {
    console.error(`[PDF Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("progress", (job, progress) => {
    console.log(`[PDF Worker] Job ${job.id} progress:`, progress);
  });

  worker.on("error", (err) => {
    console.error("[PDF Worker] Worker error:", err);
  });

  return worker;
}
