import prisma from "@/lib/prisma";

type SafeIngestFn<T> = (data: T | T[]) => Promise<{ success: boolean }>;

function createSafeIngest<T>(
  ingestFn: (data: T[]) => Promise<void>,
  name: string
): SafeIngestFn<T> {
  return async (data: T | T[]) => {
    try {
      const rows = Array.isArray(data) ? data : [data];
      await ingestFn(rows);
      return { success: true };
    } catch (error) {
      console.warn(`[Analytics] Failed to ingest ${name}:`, error);
      return { success: false };
    }
  };
}

export const publishPageView = createSafeIngest(
  async (data: any[]) => {
    await prisma.pageView.createMany({
      data: data.map(d => ({
        id: d.id,
        linkId: d.linkId,
        documentId: d.documentId,
        viewId: d.viewId,
        dataroomId: d.dataroomId,
        versionNumber: d.versionNumber ?? 1,
        time: BigInt(d.time),
        duration: d.duration,
        pageNumber: d.pageNumber,
        country: d.country ?? 'Unknown',
        city: d.city ?? 'Unknown',
        region: d.region ?? 'Unknown',
        latitude: d.latitude ?? 'Unknown',
        longitude: d.longitude ?? 'Unknown',
        ua: d.ua ?? 'Unknown',
        browser: d.browser ?? 'Unknown',
        browserVersion: d.browser_version ?? 'Unknown',
        engine: d.engine ?? 'Unknown',
        engineVersion: d.engine_version ?? 'Unknown',
        os: d.os ?? 'Unknown',
        osVersion: d.os_version ?? 'Unknown',
        device: d.device ?? 'Desktop',
        deviceVendor: d.device_vendor ?? 'Unknown',
        deviceModel: d.device_model ?? 'Unknown',
        cpuArchitecture: d.cpu_architecture ?? 'Unknown',
        bot: d.bot ?? false,
        referer: d.referer ?? '(direct)',
        refererUrl: d.referer_url ?? '(direct)',
      })),
      skipDuplicates: true,
    });
  },
  'page_views'
);

export const recordWebhookEvent = createSafeIngest(
  async (data: any[]) => {
    await prisma.webhookEvent.createMany({
      data: data.map(d => ({
        eventId: d.event_id,
        webhookId: d.webhook_id,
        messageId: d.message_id,
        event: d.event,
        url: d.url,
        httpStatus: d.http_status,
        requestBody: d.request_body,
        responseBody: d.response_body,
      })),
    });
  },
  'webhook_events'
);

export const recordVideoView = createSafeIngest(
  async (data: any[]) => {
    await prisma.videoView.createMany({
      data: data.map(d => ({
        id: d.id,
        timestamp: new Date(d.timestamp),
        linkId: d.link_id,
        documentId: d.document_id,
        viewId: d.view_id,
        dataroomId: d.dataroom_id,
        versionNumber: d.version_number,
        eventType: d.event_type,
        startTime: d.start_time,
        endTime: d.end_time ?? 0,
        playbackRate: d.playback_rate,
        volume: d.volume,
        isMuted: !!d.is_muted,
        isFocused: !!d.is_focused,
        isFullscreen: !!d.is_fullscreen,
        country: d.country ?? 'Unknown',
        city: d.city ?? 'Unknown',
        region: d.region ?? 'Unknown',
        latitude: d.latitude ?? 'Unknown',
        longitude: d.longitude ?? 'Unknown',
        ua: d.ua ?? 'Unknown',
        browser: d.browser ?? 'Unknown',
        browserVersion: d.browser_version ?? 'Unknown',
        engine: d.engine ?? 'Unknown',
        engineVersion: d.engine_version ?? 'Unknown',
        os: d.os ?? 'Unknown',
        osVersion: d.os_version ?? 'Unknown',
        device: d.device ?? 'Desktop',
        deviceVendor: d.device_vendor ?? 'Unknown',
        deviceModel: d.device_model ?? 'Unknown',
        cpuArchitecture: d.cpu_architecture ?? 'Unknown',
        bot: d.bot ?? false,
        referer: d.referer ?? '(direct)',
        refererUrl: d.referer_url ?? '(direct)',
        ipAddress: d.ip_address,
      })),
    });
  },
  'video_views'
);

export const recordClickEvent = createSafeIngest(
  async (data: any[]) => {
    await prisma.clickEvent.createMany({
      data: data.map(d => ({
        timestamp: new Date(d.timestamp),
        eventId: d.event_id,
        sessionId: d.session_id,
        linkId: d.link_id,
        documentId: d.document_id,
        dataroomId: d.dataroom_id,
        viewId: d.view_id,
        pageNumber: d.page_number,
        versionNumber: d.version_number,
        href: d.href,
      })),
    });
  },
  'click_events'
);

export const recordLinkViewTB = createSafeIngest(
  async (data: any[]) => {
    await prisma.linkClickEvent.createMany({
      data: data.map(d => ({
        timestamp: new Date(d.timestamp),
        clickId: d.click_id,
        viewId: d.view_id,
        linkId: d.link_id,
        documentId: d.document_id,
        dataroomId: d.dataroom_id,
        continent: d.continent ?? 'Unknown',
        country: d.country ?? 'Unknown',
        city: d.city ?? 'Unknown',
        region: d.region ?? 'Unknown',
        latitude: d.latitude ?? 'Unknown',
        longitude: d.longitude ?? 'Unknown',
        device: d.device ?? 'Desktop',
        deviceModel: d.device_model ?? 'Unknown',
        deviceVendor: d.device_vendor ?? 'Unknown',
        browser: d.browser ?? 'Unknown',
        browserVersion: d.browser_version ?? 'Unknown',
        os: d.os ?? 'Unknown',
        osVersion: d.os_version ?? 'Unknown',
        engine: d.engine ?? 'Unknown',
        engineVersion: d.engine_version ?? 'Unknown',
        cpuArchitecture: d.cpu_architecture ?? 'Unknown',
        ua: d.ua ?? 'Unknown',
        bot: d.bot ?? false,
        referer: d.referer ?? '(direct)',
        refererUrl: d.referer_url ?? '(direct)',
        ipAddress: d.ip_address,
      })),
    });
  },
  'link_click_events'
);

export function isTinybirdConfigured(): boolean {
  return true; // Always available with PostgreSQL
}
