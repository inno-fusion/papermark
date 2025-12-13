import { parsePageId } from "notion-utils";

import { DocumentData } from "@/lib/documents/create-document";
import { copyFileToBucketServer } from "@/lib/files/copy-file-to-bucket-server";
import notion from "@/lib/notion";
import { getNotionPageIdFromSlug } from "@/lib/notion/utils";
import prisma from "@/lib/prisma";
import {
  addJobWithTags,
  fileConversionQueue,
  pdfToImageQueue,
  videoOptimizationQueue,
} from "@/lib/queues";
import { getExtension } from "@/lib/utils";
import { sendDocumentCreatedWebhook } from "@/lib/webhook/triggers/document-created";
import { sendLinkCreatedWebhook } from "@/lib/webhook/triggers/link-created";

type ProcessDocumentParams = {
  documentData: DocumentData;
  teamId: string;
  teamPlan: string;
  userId?: string;
  folderPathName?: string;
  createLink?: boolean;
  isExternalUpload?: boolean;
};

export const processDocument = async ({
  documentData,
  teamId,
  teamPlan,
  userId,
  folderPathName,
  createLink = false,
  isExternalUpload = false,
}: ProcessDocumentParams) => {
  const {
    name,
    key,
    storageType,
    contentType,
    supportedFileType,
    fileSize,
    numPages,
    enableExcelAdvancedMode,
  } = documentData;

  // Get passed type property or alternatively, the file extension and save it as the type
  const type = supportedFileType || getExtension(name);

  // Check whether the Notion page is publically accessible or not
  if (type === "notion") {
    try {
      let pageId = parsePageId(key, { uuid: false });

      // If parsePageId fails, try to get page ID from slug
      if (!pageId) {
        try {
          const pageIdFromSlug = await getNotionPageIdFromSlug(key);
          pageId = pageIdFromSlug || undefined;
        } catch (slugError) {
          throw new Error("Unable to extract page ID from Notion URL");
        }
      }

      // if the page isn't accessible then end the process here.
      if (!pageId) {
        throw new Error("Notion page not found");
      }
      await notion.getPage(pageId);
    } catch (error) {
      throw new Error("This Notion page isn't publically available.");
    }
  }

  const folder = await prisma.folder.findUnique({
    where: {
      teamId_path: {
        teamId,
        path: "/" + folderPathName,
      },
    },
    select: {
      id: true,
    },
  });

  // determine if the document is download only
  const isDownloadOnly =
    type === "zip" ||
    type === "map" ||
    type === "email" ||
    contentType === "text/tab-separated-values";

  // Save data to the database
  const document = await prisma.document.create({
    data: {
      name: name,
      numPages: numPages,
      file: key,
      originalFile: key,
      contentType: contentType,
      type: type,
      storageType,
      ownerId: userId,
      teamId: teamId,
      advancedExcelEnabled: enableExcelAdvancedMode,
      downloadOnly: isDownloadOnly,
      ...(createLink && {
        links: {
          create: {
            teamId,
          },
        },
      }),
      versions: {
        create: {
          file: key,
          originalFile: key,
          contentType: contentType,
          type: type,
          storageType,
          numPages: numPages,
          isPrimary: true,
          versionNumber: 1,
          fileSize: fileSize,
        },
      },
      folderId: folder?.id ?? null,
      isExternalUpload,
    },
    include: {
      links: true,
      versions: true,
    },
  });

  // Trigger appropriate conversion tasks based on document type
  // Check if it's a Keynote file (slides type with Keynote content type)
  if (
    type === "slides" &&
    (contentType === "application/vnd.apple.keynote" ||
      contentType === "application/x-iwork-keynote-sffkey")
  ) {
    await addJobWithTags(
      fileConversionQueue,
      "keynote-to-pdf",
      {
        documentId: document.id,
        documentVersionId: document.versions[0].id,
        teamId,
        conversionType: "keynote",
      },
      {
        jobId: `${teamId}-${document.versions[0].id}-keynote`,
        tags: [
          `team_${teamId}`,
          `document_${document.id}`,
          `version:${document.versions[0].id}`,
        ],
      },
    );
  } else if (type === "docs" || type === "slides") {
    await addJobWithTags(
      fileConversionQueue,
      "files-to-pdf",
      {
        documentId: document.id,
        documentVersionId: document.versions[0].id,
        teamId,
        conversionType: "office",
      },
      {
        jobId: `${teamId}-${document.versions[0].id}-docs`,
        tags: [
          `team_${teamId}`,
          `document_${document.id}`,
          `version:${document.versions[0].id}`,
        ],
      },
    );
  }

  if (type === "cad") {
    await addJobWithTags(
      fileConversionQueue,
      "cad-to-pdf",
      {
        documentId: document.id,
        documentVersionId: document.versions[0].id,
        teamId,
        conversionType: "cad",
      },
      {
        jobId: `${teamId}-${document.versions[0].id}-cad`,
        tags: [
          `team_${teamId}`,
          `document_${document.id}`,
          `version:${document.versions[0].id}`,
        ],
      },
    );
  }

  if (
    type === "video" &&
    contentType !== "video/mp4" &&
    contentType?.startsWith("video/")
  ) {
    await addJobWithTags(
      videoOptimizationQueue,
      "optimize-video",
      {
        videoUrl: key,
        teamId,
        docId: key.split("/")[1], // Extract doc_xxxx from teamId/doc_xxxx/filename
        documentVersionId: document.versions[0].id,
        fileSize: fileSize || 0,
      },
      {
        jobId: `${teamId}-${document.versions[0].id}-video`,
        tags: [
          `team_${teamId}`,
          `document_${document.id}`,
          `version:${document.versions[0].id}`,
        ],
      },
    );
  }

  // skip triggering convert-pdf-to-image job for "notion" / "excel" documents
  if (type === "pdf") {
    await addJobWithTags(
      pdfToImageQueue,
      "pdf-to-image",
      {
        documentId: document.id,
        documentVersionId: document.versions[0].id,
        teamId,
      },
      {
        jobId: `${teamId}-${document.versions[0].id}-pdf`,
        tags: [
          `team_${teamId}`,
          `document_${document.id}`,
          `version:${document.versions[0].id}`,
        ],
      },
    );
  }

  if (type === "sheet" && enableExcelAdvancedMode) {
    await copyFileToBucketServer({
      filePath: document.versions[0].file,
      storageType: document.versions[0].storageType,
      teamId,
    });

    await prisma.documentVersion.update({
      where: { id: document.versions[0].id },
      data: { numPages: 1 },
    });

    try {
      await fetch(
        `${process.env.NEXTAUTH_URL}/api/revalidate?secret=${process.env.REVALIDATE_TOKEN}&documentId=${document.id}`,
      );
    } catch (error) {
      console.error("Failed to revalidate document:", error);
      // The document is still updated, so we can continue without throwing
    }
  }

  // Send webhooks
  await Promise.all([
    !isExternalUpload &&
      sendDocumentCreatedWebhook({
        teamId,
        data: {
          document_id: document.id,
        },
      }),
    createLink &&
      sendLinkCreatedWebhook({
        teamId,
        data: {
          document_id: document.id,
          link_id: document.links[0].id,
        },
      }),
  ]);

  return document;
};
