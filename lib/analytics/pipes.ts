import prisma from "@/lib/prisma";

type SafeQueryFn<TParams, TResult> = (params: TParams) => Promise<{ data: TResult[] }>;

function createSafeQuery<TParams, TResult>(
  queryFn: (params: TParams) => Promise<TResult[]>,
  name: string
): SafeQueryFn<TParams, TResult> {
  return async (params: TParams) => {
    try {
      const data = await queryFn(params);
      return { data };
    } catch (error) {
      console.warn(`[Analytics] Failed to query ${name}:`, error);
      return { data: [] };
    }
  };
}

// Query: get_total_average_page_duration
export const getTotalAvgPageDuration = createSafeQuery(
  async (params: { documentId: string; excludedLinkIds: string; excludedViewIds: string; since: number }) => {
    const excludedLinks = params.excludedLinkIds.split(',').filter(Boolean);
    const excludedViews = params.excludedViewIds.split(',').filter(Boolean);

    // Using raw query for complex CTE
    const result = await prisma.$queryRawUnsafe<Array<{ versionNumber: number; pageNumber: string; avg_duration: number }>>(
      `
      WITH DistinctDurations AS (
        SELECT "versionNumber", "pageNumber", "viewId", SUM(duration) AS distinct_duration
        FROM page_views
        WHERE "documentId" = $1
          AND time >= $2
          ${excludedLinks.length > 0 ? `AND "linkId" NOT IN (${excludedLinks.map((_, i) => `$${i + 3}`).join(',')})` : ''}
          ${excludedViews.length > 0 ? `AND "viewId" NOT IN (${excludedViews.map((_, i) => `$${i + 3 + excludedLinks.length}`).join(',')})` : ''}
        GROUP BY "versionNumber", "pageNumber", "viewId"
      )
      SELECT "versionNumber", "pageNumber", AVG(distinct_duration)::float AS avg_duration
      FROM DistinctDurations
      GROUP BY "versionNumber", "pageNumber"
      ORDER BY "versionNumber" ASC, "pageNumber" ASC
      `,
      params.documentId,
      BigInt(params.since),
      ...excludedLinks,
      ...excludedViews
    );
    return result;
  },
  'get_total_average_page_duration'
);

// Query: get_page_duration_per_view
export const getViewPageDuration = createSafeQuery(
  async (params: { documentId: string; viewId: string; since: number; until?: number }) => {
    const timeFilter: { gte: bigint; lte?: bigint } = { gte: BigInt(params.since) };
    if (params.until) {
      timeFilter.lte = BigInt(params.until);
    }

    const result = await prisma.pageView.groupBy({
      by: ['pageNumber'],
      where: {
        documentId: params.documentId,
        viewId: params.viewId,
        time: timeFilter,
      },
      _sum: { duration: true },
      orderBy: { pageNumber: 'asc' },
    });

    return result.map(r => ({
      pageNumber: r.pageNumber,
      sum_duration: r._sum.duration ?? 0,
    }));
  },
  'get_page_duration_per_view'
);

// Query: get_total_document_duration
export const getTotalDocumentDuration = createSafeQuery(
  async (params: { documentId: string; excludedLinkIds: string; excludedViewIds: string; since: number; until?: number }) => {
    const excludedLinks = params.excludedLinkIds.split(',').filter(Boolean);
    const excludedViews = params.excludedViewIds.split(',').filter(Boolean);

    const timeFilter: { gte: bigint; lte?: bigint } = { gte: BigInt(params.since) };
    if (params.until) {
      timeFilter.lte = BigInt(params.until);
    }

    const result = await prisma.pageView.aggregate({
      where: {
        documentId: params.documentId,
        time: timeFilter,
        ...(excludedLinks.length > 0 && { linkId: { notIn: excludedLinks } }),
        ...(excludedViews.length > 0 && { viewId: { notIn: excludedViews } }),
      },
      _sum: { duration: true },
    });

    return [{ sum_duration: result._sum.duration ?? 0 }];
  },
  'get_total_document_duration'
);

// Query: get_total_link_duration
export const getTotalLinkDuration = createSafeQuery(
  async (params: { linkId: string; documentId: string; excludedViewIds: string; since: number; until?: number }) => {
    const excludedViews = params.excludedViewIds.split(',').filter(Boolean);

    const timeFilter: { gte: bigint; lte?: bigint } = { gte: BigInt(params.since) };
    if (params.until) {
      timeFilter.lte = BigInt(params.until);
    }

    const [sumResult, countResult] = await Promise.all([
      prisma.pageView.aggregate({
        where: {
          linkId: params.linkId,
          documentId: params.documentId,
          time: timeFilter,
          ...(excludedViews.length > 0 && { viewId: { notIn: excludedViews } }),
        },
        _sum: { duration: true },
      }),
      prisma.pageView.findMany({
        where: {
          linkId: params.linkId,
          documentId: params.documentId,
          time: timeFilter,
          ...(excludedViews.length > 0 && { viewId: { notIn: excludedViews } }),
        },
        select: { viewId: true },
        distinct: ['viewId'],
      }),
    ]);

    return [{
      sum_duration: sumResult._sum.duration ?? 0,
      view_count: countResult.length,
    }];
  },
  'get_total_link_duration'
);

// Query: get_total_viewer_duration
export const getTotalViewerDuration = createSafeQuery(
  async (params: { viewIds: string; since: number; until?: number }) => {
    const viewIds = params.viewIds.split(',').filter(Boolean);

    const timeFilter: { gte: bigint; lte?: bigint } = { gte: BigInt(params.since) };
    if (params.until) {
      timeFilter.lte = BigInt(params.until);
    }

    const result = await prisma.pageView.aggregate({
      where: {
        viewId: { in: viewIds },
        time: timeFilter,
      },
      _sum: { duration: true },
    });

    return [{ sum_duration: result._sum.duration ?? 0 }];
  },
  'get_total_viewer_duration'
);

// Query: get_useragent_per_view (v3)
export const getViewUserAgent = createSafeQuery(
  async (params: { viewId: string }) => {
    const result = await prisma.linkClickEvent.findFirst({
      where: { viewId: params.viewId },
      select: {
        country: true,
        city: true,
        browser: true,
        os: true,
        device: true,
      },
    });

    if (!result) return [];
    return [result];
  },
  'get_useragent_per_view'
);

// Query: get_useragent_per_view (v2)
export const getViewUserAgent_v2 = createSafeQuery(
  async (params: { documentId: string; viewId: string; since: number }) => {
    const result = await prisma.pageView.findFirst({
      where: {
        documentId: params.documentId,
        viewId: params.viewId,
        time: { gte: BigInt(params.since) },
      },
      select: {
        country: true,
        city: true,
        browser: true,
        os: true,
        device: true,
      },
    });

    if (!result) return [];
    return [result];
  },
  'get_useragent_per_view_v2'
);

// Query: get_total_dataroom_duration
export const getTotalDataroomDuration = createSafeQuery(
  async (params: { dataroomId: string; excludedLinkIds: string[]; excludedViewIds: string[]; since: number }) => {
    const result = await prisma.pageView.groupBy({
      by: ['viewId'],
      where: {
        dataroomId: params.dataroomId,
        time: { gte: BigInt(params.since) },
        ...(params.excludedLinkIds.length > 0 && { linkId: { notIn: params.excludedLinkIds } }),
        ...(params.excludedViewIds.length > 0 && { viewId: { notIn: params.excludedViewIds } }),
      },
      _sum: { duration: true },
    });

    return result.map(r => ({
      viewId: r.viewId,
      sum_duration: r._sum.duration ?? 0,
    }));
  },
  'get_total_dataroom_duration'
);

// Query: get_document_duration_per_viewer
export const getDocumentDurationPerViewer = createSafeQuery(
  async (params: { documentId: string; viewIds: string }) => {
    const viewIds = params.viewIds.split(',').filter(Boolean);

    const result = await prisma.pageView.aggregate({
      where: {
        documentId: params.documentId,
        viewId: { in: viewIds },
      },
      _sum: { duration: true },
    });

    return [{ sum_duration: result._sum.duration ?? 0 }];
  },
  'get_document_duration_per_viewer'
);

// Query: get_webhook_events
export const getWebhookEvents = createSafeQuery(
  async (params: { webhookId: string }) => {
    const result = await prisma.webhookEvent.findMany({
      where: { webhookId: params.webhookId },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    return result.map(r => ({
      event_id: r.eventId,
      webhook_id: r.webhookId,
      message_id: r.messageId,
      event: r.event,
      url: r.url,
      http_status: r.httpStatus,
      request_body: r.requestBody,
      response_body: r.responseBody,
      timestamp: r.timestamp.toISOString(),
    }));
  },
  'get_webhook_events'
);

// Query: get_video_events_by_document
export const getVideoEventsByDocument = createSafeQuery(
  async (params: { document_id: string }) => {
    const result = await prisma.videoView.findMany({
      where: { documentId: params.document_id },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        viewId: true,
        eventType: true,
        startTime: true,
        endTime: true,
        playbackRate: true,
        volume: true,
        isMuted: true,
        isFocused: true,
        isFullscreen: true,
      },
    });

    return result.map(r => ({
      timestamp: r.timestamp.toISOString(),
      view_id: r.viewId,
      event_type: r.eventType,
      start_time: r.startTime,
      end_time: r.endTime,
      playback_rate: r.playbackRate,
      volume: r.volume,
      is_muted: r.isMuted ? 1 : 0,
      is_focused: r.isFocused ? 1 : 0,
      is_fullscreen: r.isFullscreen ? 1 : 0,
    }));
  },
  'get_video_events_by_document'
);

// Query: get_video_events_by_view
export const getVideoEventsByView = createSafeQuery(
  async (params: { document_id: string; view_id: string }) => {
    const result = await prisma.videoView.findMany({
      where: {
        documentId: params.document_id,
        viewId: params.view_id,
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        eventType: true,
        startTime: true,
        endTime: true,
      },
    });

    return result.map(r => ({
      timestamp: r.timestamp.toISOString(),
      event_type: r.eventType,
      start_time: r.startTime,
      end_time: r.endTime,
    }));
  },
  'get_video_events_by_view'
);

// Query: get_click_events_by_view
export const getClickEventsByView = createSafeQuery(
  async (params: { document_id: string; view_id: string }) => {
    const result = await prisma.clickEvent.findMany({
      where: {
        documentId: params.document_id,
        viewId: params.view_id,
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        documentId: true,
        dataroomId: true,
        viewId: true,
        pageNumber: true,
        versionNumber: true,
        href: true,
      },
    });

    return result.map(r => ({
      timestamp: r.timestamp.toISOString(),
      document_id: r.documentId,
      dataroom_id: r.dataroomId,
      view_id: r.viewId,
      page_number: r.pageNumber,
      version_number: r.versionNumber,
      href: r.href,
    }));
  },
  'get_click_events_by_view'
);

// Query: get_total_team_duration (for year-in-review)
// Returns total duration and unique countries for all documents in a team
export const getTotalDuration = createSafeQuery(
  async (params: { documentIds: string }) => {
    const docIds = params.documentIds.split(',').filter(Boolean);

    if (docIds.length === 0) {
      return [{ total_duration: 0, unique_countries: [] as string[] }];
    }

    const [durationResult, countriesResult] = await Promise.all([
      prisma.pageView.aggregate({
        where: {
          documentId: { in: docIds },
        },
        _sum: { duration: true },
      }),
      prisma.pageView.findMany({
        where: {
          documentId: { in: docIds },
          country: { not: 'Unknown' },
        },
        select: { country: true },
        distinct: ['country'],
      }),
    ]);

    return [{
      total_duration: Number(durationResult._sum.duration ?? 0),
      unique_countries: countriesResult.map(c => c.country),
    }];
  },
  'get_total_team_duration'
);
