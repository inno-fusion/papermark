import { Job, Worker } from "bullmq";

import prisma from "@/lib/prisma";
import { ZViewerNotificationPreferencesSchema } from "@/lib/zod/schemas/notifications";

import { createRedisConnection } from "../connection";
import type {
  ConversationNotificationPayload,
  DataroomNotificationPayload,
} from "../types";

type NotificationResult = {
  success: boolean;
  notifiedCount?: number;
};

// Dataroom notification processor
async function processDataroomNotification(
  job: Job<DataroomNotificationPayload>,
): Promise<NotificationResult> {
  const { dataroomId, dataroomDocumentId, senderUserId, teamId } = job.data;

  console.log(
    `[Notification Worker] Dataroom notification for: ${dataroomId}`,
  );

  try {
    const viewers = await prisma.viewer.findMany({
      where: {
        teamId,
        views: {
          some: {
            dataroomId,
            viewType: "DATAROOM_VIEW",
            verified: true,
          },
        },
      },
      select: {
        id: true,
        notificationPreferences: true,
        views: {
          where: { dataroomId, viewType: "DATAROOM_VIEW", verified: true },
          orderBy: { viewedAt: "desc" },
          take: 1,
          include: {
            link: {
              select: {
                id: true,
                slug: true,
                domainSlug: true,
                domainId: true,
                isArchived: true,
                expiresAt: true,
              },
            },
          },
        },
      },
    });

    if (!viewers || viewers.length === 0) {
      console.log(
        `[Notification Worker] No verified viewers found for dataroom: ${dataroomId}`,
      );
      return { success: true, notifiedCount: 0 };
    }

    const viewersWithLinks = viewers
      .map((viewer) => {
        const view = viewer.views[0];
        const link = view?.link;

        if (
          !link ||
          link.isArchived ||
          (link.expiresAt && new Date(link.expiresAt) < new Date())
        ) {
          return null;
        }

        const parsedPrefs = ZViewerNotificationPreferencesSchema.safeParse(
          viewer.notificationPreferences,
        );
        if (
          parsedPrefs.success &&
          parsedPrefs.data.dataroom[dataroomId]?.enabled === false
        ) {
          return null;
        }

        const linkUrl =
          link.domainId && link.domainSlug && link.slug
            ? `https://${link.domainSlug}/${link.slug}`
            : `${process.env.NEXT_PUBLIC_MARKETING_URL}/view/${link.id}`;

        return { id: viewer.id, linkUrl };
      })
      .filter(Boolean) as { id: string; linkUrl: string }[];

    console.log(
      `[Notification Worker] Sending notifications to ${viewersWithLinks.length} viewers`,
    );

    for (const viewer of viewersWithLinks) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/jobs/send-dataroom-new-document-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
            },
            body: JSON.stringify({
              dataroomId,
              linkUrl: viewer.linkUrl,
              dataroomDocumentId,
              viewerId: viewer.id,
              senderUserId,
              teamId,
            }),
          },
        );
      } catch (error) {
        console.error(
          `[Notification Worker] Failed to notify viewer ${viewer.id}:`,
          error,
        );
      }
    }

    console.log(`[Notification Worker] Dataroom notifications completed`);
    return { success: true, notifiedCount: viewersWithLinks.length };
  } catch (error) {
    console.error(`[Notification Worker] Job ${job.id} failed:`, error);
    throw error;
  }
}

// Conversation notification processor
async function processConversationNotification(
  job: Job<ConversationNotificationPayload>,
): Promise<NotificationResult> {
  const {
    dataroomId,
    messageId,
    conversationId,
    teamId,
    senderUserId,
    notificationType,
  } = job.data;

  console.log(
    `[Notification Worker] Conversation ${notificationType} notification for: ${conversationId}`,
  );

  try {
    const endpoint =
      notificationType === "team-member"
        ? "send-conversation-team-member-notification"
        : "send-conversation-new-message-notification";

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/jobs/${endpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({
          conversationId,
          dataroomId,
          senderUserId,
          teamId,
          messageId,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Notification Worker] Failed to send notification: ${error}`);
    }

    console.log(`[Notification Worker] Conversation notification completed`);
    return { success: true };
  } catch (error) {
    console.error(`[Notification Worker] Job ${job.id} failed:`, error);
    throw error;
  }
}

export function createDataroomNotificationWorker() {
  const worker = new Worker<DataroomNotificationPayload, NotificationResult>(
    "dataroom-notification",
    processDataroomNotification,
    {
      connection: createRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on("completed", (job) =>
    console.log(`[Dataroom Notification] Job ${job.id} completed`),
  );
  worker.on("failed", (job, err) =>
    console.error(
      `[Dataroom Notification] Job ${job?.id} failed:`,
      err.message,
    ),
  );

  return worker;
}

export function createConversationNotificationWorker() {
  const worker = new Worker<
    ConversationNotificationPayload,
    NotificationResult
  >("conversation-notification", processConversationNotification, {
    connection: createRedisConnection(),
    concurrency: 5,
  });

  worker.on("completed", (job) =>
    console.log(`[Conversation Notification] Job ${job.id} completed`),
  );
  worker.on("failed", (job, err) =>
    console.error(
      `[Conversation Notification] Job ${job?.id} failed:`,
      err.message,
    ),
  );

  return worker;
}
