import { Tinybird } from "@chronark/zod-bird";
import { z } from "zod";

import { VIDEO_EVENT_TYPES } from "../constants";
import { WEBHOOK_TRIGGERS } from "../webhook/constants";

// ===========================================
// TINYBIRD CONFIGURATION
// ===========================================

// Only create Tinybird client if token is configured
const tb = process.env.TINYBIRD_TOKEN
  ? new Tinybird({ token: process.env.TINYBIRD_TOKEN })
  : null;

// ===========================================
// INTERNAL PIPES (only created if configured)
// ===========================================

const _getTotalAvgPageDuration = tb?.buildPipe({
  pipe: "get_total_average_page_duration__v5",
  parameters: z.object({
    documentId: z.string(),
    excludedLinkIds: z.string().describe("Comma separated linkIds"),
    excludedViewIds: z.string().describe("Comma separated viewIds"),
    since: z.number(),
  }),
  data: z.object({
    versionNumber: z.number().int(),
    pageNumber: z.string(),
    avg_duration: z.number(),
  }),
});

const _getViewPageDuration = tb?.buildPipe({
  pipe: "get_page_duration_per_view__v5",
  parameters: z.object({
    documentId: z.string(),
    viewId: z.string(),
    since: z.number(),
    until: z.number().optional(),
  }),
  data: z.object({
    pageNumber: z.string(),
    sum_duration: z.number(),
  }),
});

const _getTotalDocumentDuration = tb?.buildPipe({
  pipe: "get_total_document_duration__v1",
  parameters: z.object({
    documentId: z.string(),
    excludedLinkIds: z.string().describe("Comma separated linkIds"),
    excludedViewIds: z.string().describe("Comma separated viewIds"),
    since: z.number(),
    until: z.number().optional(),
  }),
  data: z.object({
    sum_duration: z.number(),
  }),
});

const _getTotalLinkDuration = tb?.buildPipe({
  pipe: "get_total_link_duration__v1",
  parameters: z.object({
    linkId: z.string(),
    documentId: z.string(),
    excludedViewIds: z.string().describe("Comma separated viewIds"),
    since: z.number(),
    until: z.number().optional(),
  }),
  data: z.object({
    sum_duration: z.number(),
    view_count: z.number(),
  }),
});

const _getTotalViewerDuration = tb?.buildPipe({
  pipe: "get_total_viewer_duration__v1",
  parameters: z.object({
    viewIds: z.string().describe("Comma separated viewIds"),
    since: z.number(),
    until: z.number().optional(),
  }),
  data: z.object({
    sum_duration: z.number(),
  }),
});

const _getViewUserAgent_v2 = tb?.buildPipe({
  pipe: "get_useragent_per_view__v2",
  parameters: z.object({
    documentId: z.string(),
    viewId: z.string(),
    since: z.number(),
  }),
  data: z.object({
    country: z.string(),
    city: z.string(),
    browser: z.string(),
    os: z.string(),
    device: z.string(),
  }),
});

const _getViewUserAgent = tb?.buildPipe({
  pipe: "get_useragent_per_view__v3",
  parameters: z.object({
    viewId: z.string(),
  }),
  data: z.object({
    country: z.string(),
    city: z.string(),
    browser: z.string(),
    os: z.string(),
    device: z.string(),
  }),
});

const _getTotalDataroomDuration = tb?.buildPipe({
  pipe: "get_total_dataroom_duration__v1",
  parameters: z.object({
    dataroomId: z.string(),
    excludedLinkIds: z.array(z.string()),
    excludedViewIds: z.array(z.string()),
    since: z.number(),
  }),
  data: z.object({
    viewId: z.string(),
    sum_duration: z.number(),
  }),
});

const _getDocumentDurationPerViewer = tb?.buildPipe({
  pipe: "get_document_duration_per_viewer__v1",
  parameters: z.object({
    documentId: z.string(),
    viewIds: z.string().describe("Comma separated viewIds"),
  }),
  data: z.object({
    sum_duration: z.number(),
  }),
});

const _getWebhookEvents = tb?.buildPipe({
  pipe: "get_webhook_events__v1",
  parameters: z.object({
    webhookId: z.string(),
  }),
  data: z.object({
    event_id: z.string(),
    webhook_id: z.string(),
    message_id: z.string(), // QStash message ID
    event: z.enum(WEBHOOK_TRIGGERS),
    url: z.string(),
    http_status: z.number(),
    request_body: z.string(),
    response_body: z.string(),
    timestamp: z.string(),
  }),
});

const _getVideoEventsByDocument = tb?.buildPipe({
  pipe: "get_video_events_by_document__v1",
  parameters: z.object({
    document_id: z.string(),
  }),
  data: z.object({
    timestamp: z.string(),
    view_id: z.string(),
    event_type: z.enum(VIDEO_EVENT_TYPES),
    start_time: z.number(),
    end_time: z.number(),
    playback_rate: z.number(),
    volume: z.number(),
    is_muted: z.number(),
    is_focused: z.number(),
    is_fullscreen: z.number(),
  }),
});

const _getVideoEventsByView = tb?.buildPipe({
  pipe: "get_video_events_by_view__v1",
  parameters: z.object({
    document_id: z.string(),
    view_id: z.string(),
  }),
  data: z.object({
    timestamp: z.string(),
    event_type: z.string(),
    start_time: z.number(),
    end_time: z.number(),
  }),
});

const _getClickEventsByView = tb?.buildPipe({
  pipe: "get_click_events_by_view__v1",
  parameters: z.object({
    document_id: z.string(),
    view_id: z.string(),
  }),
  data: z.object({
    timestamp: z.string(),
    document_id: z.string(),
    dataroom_id: z.string().nullable(),
    view_id: z.string(),
    page_number: z.string(),
    version_number: z.number(),
    href: z.string(),
  }),
});

// ===========================================
// EXPORTED WRAPPER FUNCTIONS
// These return empty data if Tinybird is not configured
// ===========================================

type PipeFn<TParams, TData> = (params: TParams) => Promise<{ data: TData[] }>;

/**
 * Creates a wrapper that returns empty data if Tinybird is not configured
 */
function createSafePipe<TParams, TData>(
  pipeFn: PipeFn<TParams, TData> | undefined,
  name: string,
): PipeFn<TParams, TData> {
  return async (params: TParams) => {
    if (!pipeFn) {
      // Tinybird not configured - return empty data
      return { data: [] };
    }
    try {
      return await pipeFn(params);
    } catch (error) {
      // Log error but don't throw - analytics should never break the app
      console.warn(`[Tinybird] Failed to query ${name}:`, error);
      return { data: [] };
    }
  };
}

export const getTotalAvgPageDuration = createSafePipe(
  _getTotalAvgPageDuration,
  "get_total_average_page_duration",
);

export const getViewPageDuration = createSafePipe(
  _getViewPageDuration,
  "get_page_duration_per_view",
);

export const getTotalDocumentDuration = createSafePipe(
  _getTotalDocumentDuration,
  "get_total_document_duration",
);

export const getTotalLinkDuration = createSafePipe(
  _getTotalLinkDuration,
  "get_total_link_duration",
);

export const getTotalViewerDuration = createSafePipe(
  _getTotalViewerDuration,
  "get_total_viewer_duration",
);

export const getViewUserAgent_v2 = createSafePipe(
  _getViewUserAgent_v2,
  "get_useragent_per_view_v2",
);

export const getViewUserAgent = createSafePipe(
  _getViewUserAgent,
  "get_useragent_per_view",
);

export const getTotalDataroomDuration = createSafePipe(
  _getTotalDataroomDuration,
  "get_total_dataroom_duration",
);

export const getDocumentDurationPerViewer = createSafePipe(
  _getDocumentDurationPerViewer,
  "get_document_duration_per_viewer",
);

export const getWebhookEvents = createSafePipe(
  _getWebhookEvents,
  "get_webhook_events",
);

export const getVideoEventsByDocument = createSafePipe(
  _getVideoEventsByDocument,
  "get_video_events_by_document",
);

export const getVideoEventsByView = createSafePipe(
  _getVideoEventsByView,
  "get_video_events_by_view",
);

export const getClickEventsByView = createSafePipe(
  _getClickEventsByView,
  "get_click_events_by_view",
);
