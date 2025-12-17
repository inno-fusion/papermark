# PostgreSQL Analytics Implementation Plan

## Overview

Uses your existing PostgreSQL database with optimized schemas and indexes. Simpler to maintain as it uses the same database as your main application.

**Recommended for**: Small to medium workloads, internal org use, simpler deployment

## No Additional Infrastructure

This approach uses your existing PostgreSQL database - no new containers or services needed.

---

## Prisma Schema Additions

Add to `prisma/schema.prisma`:

```prisma
// ============================================
// ANALYTICS TABLES
// ============================================

model PageView {
  id              String   @id @default(cuid())
  linkId          String
  documentId      String
  viewId          String
  dataroomId      String?
  versionNumber   Int      @default(1) @db.SmallInt
  time            BigInt
  duration        Int
  pageNumber      String
  country         String   @default("Unknown")
  city            String   @default("Unknown")
  region          String   @default("Unknown")
  latitude        String   @default("Unknown")
  longitude       String   @default("Unknown")
  ua              String   @default("Unknown")
  browser         String   @default("Unknown")
  browserVersion  String   @default("Unknown") @map("browser_version")
  engine          String   @default("Unknown")
  engineVersion   String   @default("Unknown") @map("engine_version")
  os              String   @default("Unknown")
  osVersion       String   @default("Unknown") @map("os_version")
  device          String   @default("Desktop")
  deviceVendor    String   @default("Unknown") @map("device_vendor")
  deviceModel     String   @default("Unknown") @map("device_model")
  cpuArchitecture String   @default("Unknown") @map("cpu_architecture")
  bot             Boolean  @default(false)
  referer         String   @default("(direct)")
  refererUrl      String   @default("(direct)") @map("referer_url")

  // Relations
  link     Link     @relation(fields: [linkId], references: [id], onDelete: Cascade)
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  view     View     @relation(fields: [viewId], references: [id], onDelete: Cascade)

  @@index([linkId, documentId, viewId, time])
  @@index([documentId, time])
  @@index([viewId])
  @@index([dataroomId, time])
  @@map("page_views")
}

model WebhookEvent {
  id           String   @id @default(cuid())
  timestamp    DateTime @default(now())
  eventId      String   @map("event_id")
  webhookId    String   @map("webhook_id")
  url          String
  event        String
  httpStatus   Int      @map("http_status") @db.SmallInt
  requestBody  String   @map("request_body") @db.Text
  responseBody String   @map("response_body") @db.Text
  messageId    String   @map("message_id")

  // Relations
  webhook Webhook @relation(fields: [webhookId], references: [id], onDelete: Cascade)

  @@index([webhookId, timestamp(sort: Desc)])
  @@map("webhook_events")
}

model VideoView {
  id            String   @id @default(cuid())
  timestamp     DateTime
  linkId        String   @map("link_id")
  documentId    String   @map("document_id")
  viewId        String   @map("view_id")
  dataroomId    String?  @map("dataroom_id")
  versionNumber Int      @default(1) @map("version_number") @db.SmallInt
  eventType     String   @map("event_type")
  startTime     Int      @map("start_time")
  endTime       Int      @default(0) @map("end_time")
  playbackRate  Int      @map("playback_rate") @db.SmallInt
  volume        Int      @db.SmallInt
  isMuted       Boolean  @default(false) @map("is_muted")
  isFocused     Boolean  @default(false) @map("is_focused")
  isFullscreen  Boolean  @default(false) @map("is_fullscreen")
  country       String   @default("Unknown")
  city          String   @default("Unknown")
  region        String   @default("Unknown")
  latitude      String   @default("Unknown")
  longitude     String   @default("Unknown")
  ua            String   @default("Unknown")
  browser       String   @default("Unknown")
  browserVersion String  @default("Unknown") @map("browser_version")
  engine        String   @default("Unknown")
  engineVersion String   @default("Unknown") @map("engine_version")
  os            String   @default("Unknown")
  osVersion     String   @default("Unknown") @map("os_version")
  device        String   @default("Desktop")
  deviceVendor  String   @default("Unknown") @map("device_vendor")
  deviceModel   String   @default("Unknown") @map("device_model")
  cpuArchitecture String @default("Unknown") @map("cpu_architecture")
  bot           Boolean  @default(false)
  referer       String   @default("(direct)")
  refererUrl    String   @default("(direct)") @map("referer_url")
  ipAddress     String?  @map("ip_address")

  // Relations
  link     Link     @relation(fields: [linkId], references: [id], onDelete: Cascade)
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  view     View     @relation(fields: [viewId], references: [id], onDelete: Cascade)

  @@index([documentId, timestamp])
  @@index([documentId, viewId, timestamp])
  @@map("video_views")
}

model ClickEvent {
  id            String   @id @default(cuid())
  timestamp     DateTime
  eventId       String   @map("event_id")
  sessionId     String   @map("session_id")
  linkId        String   @map("link_id")
  documentId    String   @map("document_id")
  dataroomId    String?  @map("dataroom_id")
  viewId        String   @map("view_id")
  pageNumber    String   @map("page_number")
  versionNumber Int      @map("version_number") @db.SmallInt
  href          String

  // Relations
  link     Link     @relation(fields: [linkId], references: [id], onDelete: Cascade)
  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  view     View     @relation(fields: [viewId], references: [id], onDelete: Cascade)

  @@index([documentId, viewId, timestamp])
  @@map("click_events")
}

model LinkClickEvent {
  id              String   @id @default(cuid())
  timestamp       DateTime
  clickId         String   @map("click_id")
  viewId          String   @map("view_id")
  linkId          String   @map("link_id")
  documentId      String?  @map("document_id")
  dataroomId      String?  @map("dataroom_id")
  continent       String   @default("Unknown")
  country         String   @default("Unknown")
  city            String   @default("Unknown")
  region          String   @default("Unknown")
  latitude        String   @default("Unknown")
  longitude       String   @default("Unknown")
  device          String   @default("Desktop")
  deviceModel     String   @default("Unknown") @map("device_model")
  deviceVendor    String   @default("Unknown") @map("device_vendor")
  browser         String   @default("Unknown")
  browserVersion  String   @default("Unknown") @map("browser_version")
  os              String   @default("Unknown")
  osVersion       String   @default("Unknown") @map("os_version")
  engine          String   @default("Unknown")
  engineVersion   String   @default("Unknown") @map("engine_version")
  cpuArchitecture String   @default("Unknown") @map("cpu_architecture")
  ua              String   @default("Unknown")
  bot             Boolean  @default(false)
  referer         String   @default("(direct)")
  refererUrl      String   @default("(direct)") @map("referer_url")
  ipAddress       String?  @map("ip_address")

  // Relations
  link Link  @relation(fields: [linkId], references: [id], onDelete: Cascade)
  view View  @relation(fields: [viewId], references: [id], onDelete: Cascade)

  @@index([viewId])
  @@index([timestamp, viewId, linkId])
  @@map("link_click_events")
}
```

## Add Relations to Existing Models

Update existing models to include analytics relations:

```prisma
model Link {
  // ... existing fields ...

  // Analytics relations
  pageViews       PageView[]
  videoViews      VideoView[]
  clickEvents     ClickEvent[]
  linkClickEvents LinkClickEvent[]
}

model Document {
  // ... existing fields ...

  // Analytics relations
  pageViews    PageView[]
  videoViews   VideoView[]
  clickEvents  ClickEvent[]
}

model View {
  // ... existing fields ...

  // Analytics relations
  pageViews       PageView[]
  videoViews      VideoView[]
  clickEvents     ClickEvent[]
  linkClickEvents LinkClickEvent[]
}

model Webhook {
  // ... existing fields ...

  // Analytics relations
  events WebhookEvent[]
}
```

---

## Data Ingestion

Create file: `lib/analytics/publish.ts`

```typescript
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
```

---

## Query Functions

Create file: `lib/analytics/pipes.ts`

```typescript
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
  async (params: { documentId: string; viewId: string; since: number }) => {
    const result = await prisma.pageView.groupBy({
      by: ['pageNumber'],
      where: {
        documentId: params.documentId,
        viewId: params.viewId,
        time: { gte: BigInt(params.since) },
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
  async (params: { documentId: string; excludedLinkIds: string; excludedViewIds: string; since: number }) => {
    const excludedLinks = params.excludedLinkIds.split(',').filter(Boolean);
    const excludedViews = params.excludedViewIds.split(',').filter(Boolean);

    const result = await prisma.pageView.aggregate({
      where: {
        documentId: params.documentId,
        time: { gte: BigInt(params.since) },
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
  async (params: { linkId: string; documentId: string; excludedViewIds: string; since: number }) => {
    const excludedViews = params.excludedViewIds.split(',').filter(Boolean);

    const [sumResult, countResult] = await Promise.all([
      prisma.pageView.aggregate({
        where: {
          linkId: params.linkId,
          documentId: params.documentId,
          time: { gte: BigInt(params.since) },
          ...(excludedViews.length > 0 && { viewId: { notIn: excludedViews } }),
        },
        _sum: { duration: true },
      }),
      prisma.pageView.findMany({
        where: {
          linkId: params.linkId,
          documentId: params.documentId,
          time: { gte: BigInt(params.since) },
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
  async (params: { viewIds: string; since: number }) => {
    const viewIds = params.viewIds.split(',').filter(Boolean);

    const result = await prisma.pageView.aggregate({
      where: {
        viewId: { in: viewIds },
        time: { gte: BigInt(params.since) },
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
      return [{ total_duration: 0, unique_countries: [] }];
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
```

---

## Index File

Create file: `lib/analytics/index.ts`

```typescript
export * from "./pipes";
export * from "./publish";
```

---

## Webhook Worker Update

The webhook delivery worker currently uses direct Tinybird API calls. Update it to use the new analytics lib.

**File to update:** `lib/queues/workers/webhook-delivery.worker.ts`

Replace the `recordWebhookEventIfConfigured` function with:

```typescript
import { recordWebhookEvent } from "@/lib/analytics";

// Record webhook event to PostgreSQL
async function recordWebhookEventToAnalytics(data: {
  eventId: string;
  webhookId: string;
  messageId: string;
  event: string;
  url: string;
  httpStatus: number;
  requestBody: string;
  responseBody: string;
}): Promise<void> {
  try {
    await recordWebhookEvent({
      event_id: data.eventId,
      webhook_id: data.webhookId,
      message_id: data.messageId,
      event: data.event,
      url: data.url,
      http_status: data.httpStatus,
      request_body: data.requestBody,
      response_body: data.responseBody,
    });
  } catch (error) {
    console.warn(`[Webhook Worker] Failed to record event:`, error);
  }
}
```

Then replace calls from `recordWebhookEventIfConfigured` to `recordWebhookEventToAnalytics`.

---

## Year-in-Review Update

Update `lib/year-in-review/get-stats.ts` to use the new analytics lib:

```typescript
// Remove these lines:
// import { Tinybird } from "@chronark/zod-bird";
// const tb = process.env.TINYBIRD_TOKEN ? new Tinybird({...}) : null;
// const _getTotalDuration = tb?.buildPipe({...});

// Add this import:
import { getTotalDuration } from "@/lib/analytics";

// The getTotalDuration function call remains the same:
const tinybirdData = await getTotalDuration({
  documentIds: documents.map((doc) => doc.id).join(","),
});
```

---

## Migration Steps

1. **Add Prisma schema** - Copy the analytics models to `prisma/schema.prisma`
2. **Add relations** to existing Link, Document, View, and Webhook models
3. **Run migration**: `npx prisma migrate dev --name add_analytics_tables`
4. **Create analytics directory** with:
   - `lib/analytics/index.ts`
   - `lib/analytics/publish.ts`
   - `lib/analytics/pipes.ts`
5. **Update imports** throughout codebase (see Files to Update section below)
6. **Update webhook worker** to use new analytics lib
7. **Update year-in-review** to use new analytics lib
8. **Remove Tinybird**:
   - Remove `@chronark/zod-bird` dependency
   - Remove `TINYBIRD_TOKEN` and `TINYBIRD_BASE_URL` env vars
   - Delete `lib/tinybird/` directory
9. **Test all analytics functionality**

---

## Files to Update (Complete List)

| File | Current Import | Change To |
|------|----------------|-----------|
| `pages/api/analytics/index.ts` | `@/lib/tinybird/pipes` | `@/lib/analytics/pipes` |
| `pages/api/record_view.ts` | `@/lib/tinybird` | `@/lib/analytics` |
| `pages/api/record_video_view.ts` | `@/lib/tinybird` | `@/lib/analytics` |
| `pages/api/record_click.ts` | `@/lib/tinybird` | `@/lib/analytics` |
| `pages/api/links/[id]/visits.ts` | `@/lib/tinybird` | `@/lib/analytics` |
| `pages/api/teams/[teamId]/documents/[id]/stats.ts` | `@/lib/tinybird`, `@/lib/tinybird/pipes` | `@/lib/analytics` |
| `pages/api/teams/[teamId]/documents/[id]/views/index.ts` | `@/lib/tinybird`, `@/lib/tinybird/pipes` | `@/lib/analytics` |
| `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/stats.ts` | `@/lib/tinybird` | `@/lib/analytics` |
| `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/user-agent.ts` | `@/lib/tinybird` | `@/lib/analytics` |
| `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/video-stats.ts` | `@/lib/tinybird/pipes` | `@/lib/analytics/pipes` |
| `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/click-events.ts` | `@/lib/tinybird/pipes` | `@/lib/analytics/pipes` |
| `pages/api/teams/[teamId]/documents/[id]/video-analytics.ts` | `@/lib/tinybird/pipes` | `@/lib/analytics/pipes` |
| `pages/api/teams/[teamId]/datarooms/[id]/stats.ts` | `@/lib/tinybird` | `@/lib/analytics` |
| `pages/api/teams/[teamId]/datarooms/[id]/views/[viewId]/user-agent.ts` | `@/lib/tinybird` | `@/lib/analytics` |
| `pages/api/teams/[teamId]/datarooms/[id]/documents/[documentId]/stats.ts` | `@/lib/tinybird` | `@/lib/analytics` |
| `pages/api/teams/[teamId]/webhooks/[id]/events.ts` | `@/lib/tinybird/pipes` | `@/lib/analytics/pipes` |
| `pages/api/teams/[teamId]/viewers/[id]/index.ts` | `@/lib/tinybird` | `@/lib/analytics` |
| `lib/tracking/record-link-view.ts` | `@/lib/tinybird` | `@/lib/analytics` |
| `lib/year-in-review/get-stats.ts` | Direct Tinybird client | `@/lib/analytics` |
| `lib/queues/workers/webhook-delivery.worker.ts` | Direct fetch to Tinybird | `@/lib/analytics` |

**Total: 20 files to update**

---

## Optional: Data Retention

Add a cleanup job to prevent table bloat (optional for small deployments):

```typescript
// lib/analytics/cleanup.ts
import prisma from "@/lib/prisma";

export async function cleanupOldAnalytics(daysToKeep: number = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  const cutoffTime = cutoffDate.getTime();

  await Promise.all([
    prisma.pageView.deleteMany({
      where: { time: { lt: BigInt(cutoffTime) } },
    }),
    prisma.videoView.deleteMany({
      where: { timestamp: { lt: cutoffDate } },
    }),
    prisma.clickEvent.deleteMany({
      where: { timestamp: { lt: cutoffDate } },
    }),
    prisma.linkClickEvent.deleteMany({
      where: { timestamp: { lt: cutoffDate } },
    }),
    prisma.webhookEvent.deleteMany({
      where: { timestamp: { lt: cutoffDate } },
    }),
  ]);
}
```

---

## Advantages

- No additional infrastructure needed
- Uses existing Prisma/PostgreSQL setup
- Same backup strategy as main database
- Familiar Prisma query patterns
- No new dependencies

## Considerations

- PostgreSQL is row-oriented (less efficient for analytics than columnar)
- May slow down with millions of rows
- Aggregation queries more CPU-intensive than ClickHouse
- Consider adding partitioning for large datasets

## Performance Tips for Scale

If you eventually need better performance:

1. **Add table partitioning** by month:
```sql
-- Convert to partitioned table
CREATE TABLE page_views_partitioned (
  LIKE page_views INCLUDING ALL
) PARTITION BY RANGE (time);
```

2. **Add materialized views** for common aggregations:
```sql
CREATE MATERIALIZED VIEW daily_document_stats AS
SELECT
  "documentId",
  DATE_TRUNC('day', to_timestamp(time/1000)) as day,
  SUM(duration) as total_duration,
  COUNT(DISTINCT "viewId") as unique_views
FROM page_views
GROUP BY "documentId", DATE_TRUNC('day', to_timestamp(time/1000));
```

3. **Consider TimescaleDB extension** for time-series optimization
