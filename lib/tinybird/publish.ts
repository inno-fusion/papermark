import { Tinybird } from "@chronark/zod-bird";
import { z } from "zod";

import { VIDEO_EVENT_TYPES } from "../constants";
import { WEBHOOK_TRIGGERS } from "../webhook/constants";

// ===========================================
// TINYBIRD CONFIGURATION
// ===========================================

/**
 * Check if Tinybird is configured
 * Returns true only if TINYBIRD_TOKEN is set
 */
export function isTinybirdConfigured(): boolean {
  return !!process.env.TINYBIRD_TOKEN;
}

// Only create Tinybird client if token is configured
// Base URL depends on region: api.tinybird.co (EU), api.us-east.tinybird.co (US East), api.us-west-2.tinybird.co (US West)
const tb = process.env.TINYBIRD_TOKEN
  ? new Tinybird({
      token: process.env.TINYBIRD_TOKEN,
      baseUrl: process.env.TINYBIRD_BASE_URL || "https://api.tinybird.co",
    })
  : null;

// ===========================================
// INTERNAL ENDPOINTS (only created if configured)
// ===========================================

const _publishPageView = tb?.buildIngestEndpoint({
  datasource: "page_views__v3",
  event: z.object({
    id: z.string(),
    linkId: z.string(),
    documentId: z.string(),
    viewId: z.string(),
    dataroomId: z.string().nullable().optional(),
    versionNumber: z.number().int().min(1).max(65535).optional().default(1),
    time: z.number().int(),
    duration: z.number().int(),
    pageNumber: z.string(),
    country: z.string().optional().default("Unknown"),
    city: z.string().optional().default("Unknown"),
    region: z.string().optional().default("Unknown"),
    latitude: z.string().optional().default("Unknown"),
    longitude: z.string().optional().default("Unknown"),
    ua: z.string().optional().default("Unknown"),
    browser: z.string().optional().default("Unknown"),
    browser_version: z.string().optional().default("Unknown"),
    engine: z.string().optional().default("Unknown"),
    engine_version: z.string().optional().default("Unknown"),
    os: z.string().optional().default("Unknown"),
    os_version: z.string().optional().default("Unknown"),
    device: z.string().optional().default("Desktop"),
    device_vendor: z.string().optional().default("Unknown"),
    device_model: z.string().optional().default("Unknown"),
    cpu_architecture: z.string().optional().default("Unknown"),
    bot: z.boolean().optional(),
    referer: z.string().optional().default("(direct)"),
    referer_url: z.string().optional().default("(direct)"),
  }),
});

const _recordWebhookEvent = tb?.buildIngestEndpoint({
  datasource: "webhook_events__v1",
  event: z.object({
    event_id: z.string(),
    webhook_id: z.string(),
    message_id: z.string(), // QStash message ID
    event: z.enum(WEBHOOK_TRIGGERS),
    url: z.string(),
    http_status: z.number(),
    request_body: z.string(),
    response_body: z.string(),
  }),
});

const _recordVideoView = tb?.buildIngestEndpoint({
  datasource: "video_views__v1",
  event: z.object({
    timestamp: z.string(),
    id: z.string(),
    link_id: z.string(),
    document_id: z.string(),
    view_id: z.string(),
    dataroom_id: z.string().nullable(),
    version_number: z.number(),
    event_type: z.enum(VIDEO_EVENT_TYPES),
    start_time: z.number(),
    end_time: z.number().optional(),
    playback_rate: z.number(),
    volume: z.number(),
    is_muted: z.number(),
    is_focused: z.number(),
    is_fullscreen: z.number(),
    country: z.string().optional().default("Unknown"),
    city: z.string().optional().default("Unknown"),
    region: z.string().optional().default("Unknown"),
    latitude: z.string().optional().default("Unknown"),
    longitude: z.string().optional().default("Unknown"),
    ua: z.string().optional().default("Unknown"),
    browser: z.string().optional().default("Unknown"),
    browser_version: z.string().optional().default("Unknown"),
    engine: z.string().optional().default("Unknown"),
    engine_version: z.string().optional().default("Unknown"),
    os: z.string().optional().default("Unknown"),
    os_version: z.string().optional().default("Unknown"),
    device: z.string().optional().default("Desktop"),
    device_vendor: z.string().optional().default("Unknown"),
    device_model: z.string().optional().default("Unknown"),
    cpu_architecture: z.string().optional().default("Unknown"),
    bot: z.boolean().optional(),
    referer: z.string().optional().default("(direct)"),
    referer_url: z.string().optional().default("(direct)"),
    ip_address: z.string().nullable(),
  }),
});

// Click event tracking when user clicks a link within a document
const _recordClickEvent = tb?.buildIngestEndpoint({
  datasource: "click_events__v1",
  event: z.object({
    timestamp: z.string(),
    event_id: z.string(),
    session_id: z.string(),
    link_id: z.string(),
    document_id: z.string(),
    view_id: z.string(),
    page_number: z.string(),
    href: z.string(),
    version_number: z.number(),
    dataroom_id: z.string().nullable(),
  }),
});

// Event track when a visitor opens a link
const _recordLinkViewTB = tb?.buildIngestEndpoint({
  datasource: "pm_click_events__v1",
  event: z.object({
    timestamp: z.string(),
    click_id: z.string(),
    view_id: z.string(),
    link_id: z.string(),
    document_id: z.string().nullable(),
    dataroom_id: z.string().nullable(),
    continent: z.string().optional().default("Unknown"),
    country: z.string().optional().default("Unknown"),
    city: z.string().optional().default("Unknown"),
    region: z.string().optional().default("Unknown"),
    latitude: z.string().optional().default("Unknown"),
    longitude: z.string().optional().default("Unknown"),
    device: z.string().optional().default("Desktop"),
    device_model: z.string().optional().default("Unknown"),
    device_vendor: z.string().optional().default("Unknown"),
    browser: z.string().optional().default("Unknown"),
    browser_version: z.string().optional().default("Unknown"),
    os: z.string().optional().default("Unknown"),
    os_version: z.string().optional().default("Unknown"),
    engine: z.string().optional().default("Unknown"),
    engine_version: z.string().optional().default("Unknown"),
    cpu_architecture: z.string().optional().default("Unknown"),
    ua: z.string().optional().default("Unknown"),
    bot: z.boolean().optional(),
    referer: z.string().optional().default("(direct)"),
    referer_url: z.string().optional().default("(direct)"),
    ip_address: z.string().nullable(),
  }),
});

// ===========================================
// EXPORTED WRAPPER FUNCTIONS
// These gracefully handle missing Tinybird configuration
// ===========================================

type TinybirdIngestResult = { successful_rows: number; quarantined_rows: number };
type TinybirdIngestFn<T> = (data: T | T[]) => Promise<TinybirdIngestResult>;
type SafeIngestFn<T> = (data: T | T[]) => Promise<{ success: boolean }>;

/**
 * Creates a wrapper that skips ingestion if Tinybird is not configured
 */
function createSafeIngest<T>(
  ingestFn: TinybirdIngestFn<T> | undefined,
  name: string,
): SafeIngestFn<T> {
  return async (data: T | T[]) => {
    if (!ingestFn) {
      // Tinybird not configured - skip silently
      return { success: true };
    }
    try {
      const result = await ingestFn(data);
      // Map Tinybird's result to our success format
      return { success: result.successful_rows > 0 || result.quarantined_rows === 0 };
    } catch (error) {
      // Log error but don't throw - analytics should never break the app
      console.warn(`[Tinybird] Failed to ingest ${name}:`, error);
      return { success: false };
    }
  };
}

export const publishPageView = createSafeIngest(
  _publishPageView,
  "page_views",
);

export const recordWebhookEvent = createSafeIngest(
  _recordWebhookEvent,
  "webhook_events",
);

export const recordVideoView = createSafeIngest(
  _recordVideoView,
  "video_views",
);

export const recordClickEvent = createSafeIngest(
  _recordClickEvent,
  "click_events",
);

export const recordLinkViewTB = createSafeIngest(
  _recordLinkViewTB,
  "pm_click_events",
);
