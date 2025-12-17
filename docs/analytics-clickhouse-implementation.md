# ClickHouse Analytics Implementation Plan

## Overview

ClickHouse is a column-oriented OLAP database that powers Tinybird. This is the most direct replacement with identical query performance characteristics.

**Recommended for**: Heavy analytics workloads, large data volumes, complex aggregations

## Docker Setup

Add to `docker-compose-prod.yml`:

```yaml
clickhouse:
  image: clickhouse/clickhouse-server:24.3
  container_name: docroom-clickhouse
  ports:
    - "8123:8123"  # HTTP interface
    - "9000:9000"  # Native TCP interface
  volumes:
    - clickhouse_data:/var/lib/clickhouse
    - ./clickhouse/init:/docker-entrypoint-initdb.d
  environment:
    CLICKHOUSE_USER: ${CLICKHOUSE_USER:-default}
    CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD:-}
    CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1
  ulimits:
    nofile:
      soft: 262144
      hard: 262144
  restart: unless-stopped

volumes:
  clickhouse_data:
```

## Environment Variables

Add to `.env`:

```bash
# ClickHouse Configuration
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your_password
CLICKHOUSE_DATABASE=default
```

## Dependencies

```bash
npm install @clickhouse/client
```

## Table Schemas

Create file: `clickhouse/init/001_create_tables.sql`

```sql
-- Page Views Table (replaces page_views__v3)
CREATE TABLE IF NOT EXISTS page_views (
    id String,
    link_id String,
    document_id String,
    view_id String,
    dataroom_id Nullable(String),
    version_number UInt16 DEFAULT 1,
    time Int64,
    duration UInt32,
    page_number LowCardinality(String),
    country String DEFAULT 'Unknown',
    city String DEFAULT 'Unknown',
    region String DEFAULT 'Unknown',
    latitude String DEFAULT 'Unknown',
    longitude String DEFAULT 'Unknown',
    ua String DEFAULT 'Unknown',
    browser String DEFAULT 'Unknown',
    browser_version String DEFAULT 'Unknown',
    engine String DEFAULT 'Unknown',
    engine_version String DEFAULT 'Unknown',
    os String DEFAULT 'Unknown',
    os_version String DEFAULT 'Unknown',
    device String DEFAULT 'Desktop',
    device_vendor String DEFAULT 'Unknown',
    device_model String DEFAULT 'Unknown',
    cpu_architecture String DEFAULT 'Unknown',
    bot UInt8 DEFAULT 0,
    referer String DEFAULT '(direct)',
    referer_url String DEFAULT '(direct)'
) ENGINE = MergeTree()
ORDER BY (link_id, document_id, view_id, version_number, page_number, time, id);

-- Webhook Events Table (replaces webhook_events__v1)
CREATE TABLE IF NOT EXISTS webhook_events (
    timestamp DateTime64(3) DEFAULT now(),
    event_id String,
    webhook_id String,
    url String,
    event LowCardinality(String),
    http_status UInt16,
    request_body String,
    response_body String,
    message_id String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, webhook_id, event_id);

-- Video Views Table (replaces video_views__v1)
CREATE TABLE IF NOT EXISTS video_views (
    timestamp DateTime64(3),
    id String,
    link_id String,
    document_id String,
    view_id String,
    dataroom_id Nullable(String),
    version_number UInt16,
    event_type LowCardinality(String),
    start_time UInt32,
    end_time UInt32 DEFAULT 0,
    playback_rate UInt16,
    volume UInt8,
    is_muted UInt8,
    is_focused UInt8,
    is_fullscreen UInt8,
    country LowCardinality(String) DEFAULT 'Unknown',
    city String DEFAULT 'Unknown',
    region String DEFAULT 'Unknown',
    latitude String DEFAULT 'Unknown',
    longitude String DEFAULT 'Unknown',
    ua String DEFAULT 'Unknown',
    browser LowCardinality(String) DEFAULT 'Unknown',
    browser_version String DEFAULT 'Unknown',
    engine LowCardinality(String) DEFAULT 'Unknown',
    engine_version String DEFAULT 'Unknown',
    os LowCardinality(String) DEFAULT 'Unknown',
    os_version String DEFAULT 'Unknown',
    device LowCardinality(String) DEFAULT 'Desktop',
    device_vendor LowCardinality(String) DEFAULT 'Unknown',
    device_model LowCardinality(String) DEFAULT 'Unknown',
    cpu_architecture LowCardinality(String) DEFAULT 'Unknown',
    bot UInt8 DEFAULT 0,
    referer String DEFAULT '(direct)',
    referer_url String DEFAULT '(direct)',
    ip_address Nullable(String)
) ENGINE = MergeTree()
ORDER BY (timestamp, link_id, document_id, view_id, version_number, event_type);

-- Click Events Table (replaces click_events__v1)
CREATE TABLE IF NOT EXISTS click_events (
    timestamp DateTime64(3),
    event_id String,
    session_id String,
    link_id String,
    document_id String,
    dataroom_id Nullable(String),
    view_id String,
    page_number LowCardinality(String),
    version_number UInt16,
    href String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (document_id, view_id, link_id, timestamp);

-- Link Click Events Table (replaces pm_click_events__v1)
CREATE TABLE IF NOT EXISTS link_click_events (
    timestamp DateTime64(3),
    click_id String,
    view_id String,
    link_id String,
    document_id Nullable(String),
    dataroom_id Nullable(String),
    continent LowCardinality(String) DEFAULT 'Unknown',
    country LowCardinality(String) DEFAULT 'Unknown',
    city String DEFAULT 'Unknown',
    region String DEFAULT 'Unknown',
    latitude String DEFAULT 'Unknown',
    longitude String DEFAULT 'Unknown',
    device LowCardinality(String) DEFAULT 'Desktop',
    device_model LowCardinality(String) DEFAULT 'Unknown',
    device_vendor LowCardinality(String) DEFAULT 'Unknown',
    browser LowCardinality(String) DEFAULT 'Unknown',
    browser_version String DEFAULT 'Unknown',
    os LowCardinality(String) DEFAULT 'Unknown',
    os_version String DEFAULT 'Unknown',
    engine LowCardinality(String) DEFAULT 'Unknown',
    engine_version String DEFAULT 'Unknown',
    cpu_architecture LowCardinality(String) DEFAULT 'Unknown',
    ua String DEFAULT 'Unknown',
    bot UInt8 DEFAULT 0,
    referer String DEFAULT '(direct)',
    referer_url String DEFAULT '(direct)',
    ip_address Nullable(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (timestamp, view_id, link_id, click_id);
```

## Client Library

Create file: `lib/analytics/clickhouse-client.ts`

```typescript
import { createClient, ClickHouseClient } from '@clickhouse/client';

let client: ClickHouseClient | null = null;

export function getClickHouseClient(): ClickHouseClient | null {
  if (!process.env.CLICKHOUSE_URL) {
    return null;
  }

  if (!client) {
    client = createClient({
      url: process.env.CLICKHOUSE_URL,
      username: process.env.CLICKHOUSE_USER || 'default',
      password: process.env.CLICKHOUSE_PASSWORD || '',
      database: process.env.CLICKHOUSE_DATABASE || 'default',
    });
  }

  return client;
}

export function isAnalyticsConfigured(): boolean {
  return !!process.env.CLICKHOUSE_URL;
}
```

## Data Ingestion

Create file: `lib/analytics/publish.ts`

```typescript
import { getClickHouseClient, isAnalyticsConfigured } from './clickhouse-client';
import { z } from 'zod';

// Schema definitions
const pageViewSchema = z.object({
  id: z.string(),
  link_id: z.string(),
  document_id: z.string(),
  view_id: z.string(),
  dataroom_id: z.string().nullable().optional(),
  version_number: z.number().int().min(1).max(65535).optional().default(1),
  time: z.number().int(),
  duration: z.number().int(),
  page_number: z.string(),
  country: z.string().optional().default('Unknown'),
  city: z.string().optional().default('Unknown'),
  region: z.string().optional().default('Unknown'),
  latitude: z.string().optional().default('Unknown'),
  longitude: z.string().optional().default('Unknown'),
  ua: z.string().optional().default('Unknown'),
  browser: z.string().optional().default('Unknown'),
  browser_version: z.string().optional().default('Unknown'),
  engine: z.string().optional().default('Unknown'),
  engine_version: z.string().optional().default('Unknown'),
  os: z.string().optional().default('Unknown'),
  os_version: z.string().optional().default('Unknown'),
  device: z.string().optional().default('Desktop'),
  device_vendor: z.string().optional().default('Unknown'),
  device_model: z.string().optional().default('Unknown'),
  cpu_architecture: z.string().optional().default('Unknown'),
  bot: z.boolean().optional(),
  referer: z.string().optional().default('(direct)'),
  referer_url: z.string().optional().default('(direct)'),
});

type PageView = z.infer<typeof pageViewSchema>;

async function safeInsert<T>(
  table: string,
  data: T | T[],
  name: string
): Promise<{ success: boolean }> {
  const client = getClickHouseClient();
  if (!client) {
    return { success: true };
  }

  try {
    const rows = Array.isArray(data) ? data : [data];
    await client.insert({
      table,
      values: rows,
      format: 'JSONEachRow',
    });
    return { success: true };
  } catch (error) {
    console.warn(`[Analytics] Failed to ingest ${name}:`, error);
    return { success: false };
  }
}

export async function publishPageView(data: PageView | PageView[]) {
  return safeInsert('page_views', data, 'page_views');
}

export async function recordWebhookEvent(data: any | any[]) {
  return safeInsert('webhook_events', data, 'webhook_events');
}

export async function recordVideoView(data: any | any[]) {
  return safeInsert('video_views', data, 'video_views');
}

export async function recordClickEvent(data: any | any[]) {
  return safeInsert('click_events', data, 'click_events');
}

export async function recordLinkViewTB(data: any | any[]) {
  return safeInsert('link_click_events', data, 'link_click_events');
}

export { isAnalyticsConfigured as isTinybirdConfigured };
```

## Query Functions

Create file: `lib/analytics/pipes.ts`

```typescript
import { getClickHouseClient } from './clickhouse-client';

type SafeQueryFn<TParams, TResult> = (params: TParams) => Promise<{ data: TResult[] }>;

function createSafeQuery<TParams, TResult>(
  queryFn: (client: any, params: TParams) => Promise<TResult[]>,
  name: string
): SafeQueryFn<TParams, TResult> {
  return async (params: TParams) => {
    const client = getClickHouseClient();
    if (!client) {
      return { data: [] };
    }
    try {
      const data = await queryFn(client, params);
      return { data };
    } catch (error) {
      console.warn(`[Analytics] Failed to query ${name}:`, error);
      return { data: [] };
    }
  };
}

// Query: get_total_average_page_duration
export const getTotalAvgPageDuration = createSafeQuery(
  async (client, params: { documentId: string; excludedLinkIds: string; excludedViewIds: string; since: number }) => {
    const excludedLinks = params.excludedLinkIds.split(',').filter(Boolean);
    const excludedViews = params.excludedViewIds.split(',').filter(Boolean);

    const result = await client.query({
      query: `
        WITH DistinctDurations AS (
          SELECT version_number, page_number, view_id, SUM(duration) AS distinct_duration
          FROM page_views
          WHERE document_id = {documentId:String}
            AND time >= {since:Int64}
            AND link_id NOT IN {excludedLinks:Array(String)}
            AND view_id NOT IN {excludedViews:Array(String)}
          GROUP BY version_number, page_number, view_id
        )
        SELECT version_number as versionNumber, page_number as pageNumber, AVG(distinct_duration) AS avg_duration
        FROM DistinctDurations
        GROUP BY version_number, page_number
        ORDER BY version_number ASC, page_number ASC
      `,
      query_params: {
        documentId: params.documentId,
        since: params.since,
        excludedLinks,
        excludedViews,
      },
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_total_average_page_duration'
);

// Query: get_page_duration_per_view
export const getViewPageDuration = createSafeQuery(
  async (client, params: { documentId: string; viewId: string; since: number }) => {
    const result = await client.query({
      query: `
        SELECT page_number as pageNumber, SUM(duration) AS sum_duration
        FROM page_views
        WHERE document_id = {documentId:String}
          AND view_id = {viewId:String}
          AND time >= {since:Int64}
        GROUP BY page_number
        ORDER BY page_number ASC
      `,
      query_params: params,
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_page_duration_per_view'
);

// Query: get_total_document_duration
export const getTotalDocumentDuration = createSafeQuery(
  async (client, params: { documentId: string; excludedLinkIds: string; excludedViewIds: string; since: number }) => {
    const excludedLinks = params.excludedLinkIds.split(',').filter(Boolean);
    const excludedViews = params.excludedViewIds.split(',').filter(Boolean);

    const result = await client.query({
      query: `
        SELECT SUM(duration) AS sum_duration
        FROM page_views
        WHERE document_id = {documentId:String}
          AND time >= {since:Int64}
          AND link_id NOT IN {excludedLinks:Array(String)}
          AND view_id NOT IN {excludedViews:Array(String)}
      `,
      query_params: { documentId: params.documentId, since: params.since, excludedLinks, excludedViews },
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_total_document_duration'
);

// Query: get_total_link_duration
export const getTotalLinkDuration = createSafeQuery(
  async (client, params: { linkId: string; documentId: string; excludedViewIds: string; since: number }) => {
    const excludedViews = params.excludedViewIds.split(',').filter(Boolean);

    const result = await client.query({
      query: `
        SELECT SUM(duration) AS sum_duration, COUNT(DISTINCT view_id) as view_count
        FROM page_views
        WHERE link_id = {linkId:String}
          AND time >= {since:Int64}
          AND document_id = {documentId:String}
          AND view_id NOT IN {excludedViews:Array(String)}
      `,
      query_params: { linkId: params.linkId, documentId: params.documentId, since: params.since, excludedViews },
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_total_link_duration'
);

// Query: get_total_viewer_duration
export const getTotalViewerDuration = createSafeQuery(
  async (client, params: { viewIds: string; since: number }) => {
    const viewIds = params.viewIds.split(',').filter(Boolean);

    const result = await client.query({
      query: `
        SELECT SUM(duration) AS sum_duration
        FROM page_views
        WHERE view_id IN {viewIds:Array(String)}
          AND time >= {since:Int64}
      `,
      query_params: { viewIds, since: params.since },
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_total_viewer_duration'
);

// Query: get_useragent_per_view (v3)
export const getViewUserAgent = createSafeQuery(
  async (client, params: { viewId: string }) => {
    const result = await client.query({
      query: `
        SELECT country, city, browser, os, device
        FROM link_click_events
        WHERE view_id = {viewId:String}
        LIMIT 1
      `,
      query_params: params,
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_useragent_per_view'
);

// Query: get_useragent_per_view (v2)
export const getViewUserAgent_v2 = createSafeQuery(
  async (client, params: { documentId: string; viewId: string; since: number }) => {
    const result = await client.query({
      query: `
        SELECT country, city, browser, os, device
        FROM page_views
        WHERE document_id = {documentId:String}
          AND view_id = {viewId:String}
          AND time >= {since:Int64}
        LIMIT 1
      `,
      query_params: params,
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_useragent_per_view_v2'
);

// Query: get_total_dataroom_duration
export const getTotalDataroomDuration = createSafeQuery(
  async (client, params: { dataroomId: string; excludedLinkIds: string[]; excludedViewIds: string[]; since: number }) => {
    const result = await client.query({
      query: `
        SELECT view_id as viewId, SUM(duration) AS sum_duration
        FROM page_views
        WHERE dataroom_id = {dataroomId:String}
          AND time >= {since:Int64}
          AND link_id NOT IN {excludedLinkIds:Array(String)}
          AND view_id NOT IN {excludedViewIds:Array(String)}
        GROUP BY view_id
      `,
      query_params: params,
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_total_dataroom_duration'
);

// Query: get_document_duration_per_viewer
export const getDocumentDurationPerViewer = createSafeQuery(
  async (client, params: { documentId: string; viewIds: string }) => {
    const viewIds = params.viewIds.split(',').filter(Boolean);

    const result = await client.query({
      query: `
        SELECT SUM(duration) AS sum_duration
        FROM page_views
        WHERE document_id = {documentId:String}
          AND view_id IN {viewIds:Array(String)}
      `,
      query_params: { documentId: params.documentId, viewIds },
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_document_duration_per_viewer'
);

// Query: get_webhook_events
export const getWebhookEvents = createSafeQuery(
  async (client, params: { webhookId: string }) => {
    const result = await client.query({
      query: `
        SELECT *
        FROM webhook_events
        WHERE webhook_id = {webhookId:String}
        ORDER BY timestamp DESC
        LIMIT 100
      `,
      query_params: params,
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_webhook_events'
);

// Query: get_video_events_by_document
export const getVideoEventsByDocument = createSafeQuery(
  async (client, params: { document_id: string }) => {
    const result = await client.query({
      query: `
        SELECT timestamp, view_id, event_type, start_time, end_time,
               playback_rate, volume, is_muted, is_focused, is_fullscreen
        FROM video_views
        WHERE document_id = {document_id:String}
        ORDER BY timestamp ASC
      `,
      query_params: params,
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_video_events_by_document'
);

// Query: get_video_events_by_view
export const getVideoEventsByView = createSafeQuery(
  async (client, params: { document_id: string; view_id: string }) => {
    const result = await client.query({
      query: `
        SELECT timestamp, event_type, start_time, end_time
        FROM video_views
        WHERE document_id = {document_id:String}
          AND view_id = {view_id:String}
        ORDER BY timestamp ASC
      `,
      query_params: params,
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_video_events_by_view'
);

// Query: get_click_events_by_view
export const getClickEventsByView = createSafeQuery(
  async (client, params: { document_id: string; view_id: string }) => {
    const result = await client.query({
      query: `
        SELECT timestamp, document_id, dataroom_id, view_id,
               page_number, version_number, href
        FROM click_events
        WHERE document_id = {document_id:String}
          AND view_id = {view_id:String}
        ORDER BY timestamp ASC
      `,
      query_params: params,
      format: 'JSONEachRow',
    });
    return result.json();
  },
  'get_click_events_by_view'
);
```

## Migration Steps

1. **Add ClickHouse container** to `docker-compose-prod.yml`
2. **Create init SQL file** at `clickhouse/init/001_create_tables.sql`
3. **Install dependency**: `npm install @clickhouse/client`
4. **Create analytics directory** with:
   - `lib/analytics/clickhouse-client.ts`
   - `lib/analytics/publish.ts`
   - `lib/analytics/pipes.ts`
5. **Update imports** throughout codebase:
   - Change `from "@/lib/tinybird/publish"` to `from "@/lib/analytics/publish"`
   - Change `from "@/lib/tinybird/pipes"` to `from "@/lib/analytics/pipes"`
6. **Remove Tinybird**:
   - Remove `@chronark/zod-bird` dependency
   - Remove `TINYBIRD_TOKEN` and `TINYBIRD_BASE_URL` env vars
7. **Add ClickHouse env vars** to `.env` and `docker-compose-prod.yml`
8. **Test all analytics functionality**

## Advantages

- Identical query semantics to Tinybird (same underlying database)
- Excellent compression for analytics data
- Fast aggregation queries
- Column-oriented storage optimal for analytics
- Supports real-time data ingestion

## Considerations

- Requires additional Docker container
- Separate backup strategy needed
- ~100-200MB RAM for small workloads
