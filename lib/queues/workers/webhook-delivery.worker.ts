import { Job, Worker } from "bullmq";

import { createRedisConnection } from "../connection";
import type { WebhookDeliveryPayload } from "../types";

type WebhookResult = {
  success: boolean;
  statusCode?: number;
  error?: string;
};

// Create HMAC signature for webhook payload
async function createWebhookSignature(
  secret: string,
  body: Record<string, unknown>,
): Promise<string> {
  const keyData = new TextEncoder().encode(secret);
  const messageData = new TextEncoder().encode(JSON.stringify(body));

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Record webhook event to Tinybird (optional - only if TINYBIRD_TOKEN is set)
async function recordWebhookEventIfConfigured(data: {
  eventId: string;
  webhookId: string;
  messageId: string;
  event: string;
  url: string;
  httpStatus: number;
  requestBody: string;
  responseBody: string;
}): Promise<void> {
  // Skip if Tinybird is not configured
  const tinybirdToken = process.env.TINYBIRD_TOKEN;
  if (!tinybirdToken) {
    return;
  }

  try {
    // Call Tinybird ingest API directly
    const tinybirdBaseUrl = process.env.TINYBIRD_BASE_URL || "https://api.tinybird.co";
    const response = await fetch(
      `${tinybirdBaseUrl}/v0/events?name=webhook_events__v1`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tinybirdToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_id: data.eventId,
          webhook_id: data.webhookId,
          message_id: data.messageId,
          event: data.event,
          url: data.url,
          http_status: data.httpStatus,
          request_body: data.requestBody,
          response_body: data.responseBody,
        }),
      },
    );

    if (!response.ok) {
      console.warn(
        `[Webhook Worker] Failed to record event to Tinybird: ${response.status}`,
      );
    }
  } catch (error) {
    console.warn(`[Webhook Worker] Failed to record event:`, error);
  }
}

// Webhook delivery processor
async function processWebhookDelivery(
  job: Job<WebhookDeliveryPayload>,
): Promise<WebhookResult> {
  const { webhookId, webhookUrl, webhookSecret, eventId, event, payload } =
    job.data;

  console.log(
    `[Webhook Worker] Delivering webhook ${eventId} to ${webhookUrl}`,
  );

  const signature = await createWebhookSignature(webhookSecret, payload);

  let statusCode = -1;
  let responseBody = "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Papermark-Signature": signature,
        "X-Papermark-Event": event,
        "X-Papermark-Delivery": job.id || eventId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    statusCode = response.status;
    responseBody = await response.text().catch(() => "");

    // Record event (optional)
    await recordWebhookEventIfConfigured({
      eventId,
      webhookId,
      messageId: job.id || eventId,
      event,
      url: webhookUrl,
      httpStatus: statusCode,
      requestBody: JSON.stringify(payload),
      responseBody: responseBody.slice(0, 10000), // Limit response body size
    });

    if (response.ok) {
      console.log(
        `[Webhook Worker] Successfully delivered ${eventId} (${statusCode})`,
      );
      return { success: true, statusCode };
    }

    // Non-2xx response - throw to trigger retry
    console.warn(
      `[Webhook Worker] Webhook ${eventId} failed with status ${statusCode}`,
    );
    throw new Error(`Webhook delivery failed with status ${statusCode}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Record failure event (optional)
    await recordWebhookEventIfConfigured({
      eventId,
      webhookId,
      messageId: job.id || eventId,
      event,
      url: webhookUrl,
      httpStatus: statusCode === -1 ? 503 : statusCode,
      requestBody: JSON.stringify(payload),
      responseBody: responseBody || errorMessage,
    });

    console.error(
      `[Webhook Worker] Delivery failed for ${eventId}:`,
      errorMessage,
    );
    throw error;
  }
}

export function createWebhookDeliveryWorker() {
  const worker = new Worker<WebhookDeliveryPayload, WebhookResult>(
    "webhook-delivery",
    processWebhookDelivery,
    {
      connection: createRedisConnection(),
      concurrency: 10,
    },
  );

  worker.on("completed", (job) =>
    console.log(`[Webhook Delivery] Job ${job.id} completed`),
  );

  worker.on("failed", (job, err) =>
    console.error(`[Webhook Delivery] Job ${job?.id} failed:`, err.message),
  );

  return worker;
}
