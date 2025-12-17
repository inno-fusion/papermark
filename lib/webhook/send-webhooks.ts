import { Webhook } from "@prisma/client";

import { webhookDeliveryQueue } from "@/lib/queues";

import { prepareWebhookPayload } from "./transform";
import { EventDataProps, WebhookTrigger } from "./types";

// Send webhooks to multiple webhooks
export const sendWebhooks = async ({
  webhooks,
  trigger,
  data,
}: {
  webhooks: Pick<Webhook, "pId" | "url" | "secret">[];
  trigger: WebhookTrigger;
  data: EventDataProps;
}) => {
  if (webhooks.length === 0) {
    return;
  }

  const payload = prepareWebhookPayload(trigger, data);

  return await Promise.all(
    webhooks.map((webhook) => queueWebhookDelivery({ webhook, payload })),
  );
};

// Queue webhook for delivery via BullMQ
const queueWebhookDelivery = async ({
  webhook,
  payload,
}: {
  webhook: Pick<Webhook, "pId" | "url" | "secret">;
  payload: { id: string; event: string; createdAt: string; data: unknown };
}) => {
  const job = await webhookDeliveryQueue.add(
    `webhook-${payload.event}-${payload.id}`,
    {
      webhookId: webhook.pId,
      webhookUrl: webhook.url,
      webhookSecret: webhook.secret,
      eventId: payload.id,
      event: payload.event,
      payload: payload as Record<string, unknown>,
    },
    {
      // Use eventId + webhookId as unique job id to prevent duplicates
      jobId: `${payload.id}-${webhook.pId}`,
    },
  );

  console.log(
    `[Webhook] Queued delivery for ${payload.event} to ${webhook.url} (job: ${job.id})`,
  );

  return { messageId: job.id };
};
