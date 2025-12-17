# Tinybird Replacement: Comparison & Recommendation

## Quick Summary

| Feature | ClickHouse | PostgreSQL |
|---------|------------|------------|
| **Setup Complexity** | Medium (new container) | Low (uses existing DB) |
| **Query Performance** | Excellent for aggregations | Good, may slow at scale |
| **Storage Efficiency** | Excellent (columnar compression) | Good |
| **Maintenance** | Separate database | Same as main DB |
| **New Dependencies** | `@clickhouse/client` | None (uses Prisma) |
| **Backup Strategy** | Separate backup needed | Same as main DB |
| **Memory Usage** | ~100-200MB minimum | Shared with main DB |

---

## Recommendation

### For Internal Org Use (Few Users): **PostgreSQL**

**Why:**
- Zero additional infrastructure
- Uses your existing PostgreSQL database
- Same backup/restore process as your main data
- Simpler deployment and maintenance
- Familiar Prisma patterns
- No new dependencies

**When PostgreSQL is enough:**
- Less than 100,000 page views per month
- Less than 10 concurrent users
- Analytics queries are not time-critical
- You want minimal operational complexity

### For Growth/Scale Potential: **ClickHouse**

**Why:**
- Identical query semantics to Tinybird (same underlying database)
- 10-100x faster for complex aggregations at scale
- Better compression (uses less disk space)
- Designed specifically for analytics workloads

**When to choose ClickHouse:**
- Expected growth beyond internal use
- Heavy analytics usage patterns
- Real-time dashboard requirements
- Millions of events per month

---

## Data Volume Guidelines

| Monthly Events | Recommendation |
|----------------|----------------|
| < 100,000 | PostgreSQL |
| 100,000 - 1,000,000 | Either (PostgreSQL with indexes) |
| > 1,000,000 | ClickHouse |

### For 5K Documents & 10K Visitors/Day

| Metric | Daily | Monthly | Yearly |
|--------|-------|---------|--------|
| Visitors | 10,000 | 300,000 | 3.6M |
| Page view events* | 50,000-100,000 | 1.5M-3M | 18M-36M |
| Estimated table size | ~50MB | ~1.5GB | ~18GB |

*Assuming each visitor views ~5-10 pages on average

**Recommendation**: PostgreSQL will handle this comfortably with proper indexes.

---

## Implementation Effort

### PostgreSQL
- **Time**: 2-4 hours
- **Steps**:
  1. Add Prisma schema
  2. Run migration
  3. Create analytics lib files
  4. Update imports
  5. Test

### ClickHouse
- **Time**: 4-8 hours
- **Steps**:
  1. Add ClickHouse to Docker Compose
  2. Create SQL init scripts
  3. Install client library
  4. Create analytics lib files
  5. Update imports
  6. Configure backups
  7. Test

---

## Migration Path

You can start with PostgreSQL and migrate to ClickHouse later if needed:

1. **Start with PostgreSQL** - Simpler, faster to implement
2. **Monitor performance** - Watch query times and table sizes
3. **Migrate to ClickHouse** if:
   - Aggregation queries take > 1 second
   - Analytics tables exceed 10GB
   - You need real-time dashboards

The API surface (publish.ts and pipes.ts) is identical for both implementations, so switching later requires minimal code changes.

---

## Complete Codebase Audit Results

### Functions Coverage

#### Ingest Functions (6 total) - ALL COVERED

| Function | Used In | Status |
|----------|---------|--------|
| `publishPageView` | `pages/api/record_view.ts` | ✅ |
| `recordVideoView` | `pages/api/record_video_view.ts` | ✅ |
| `recordClickEvent` | `pages/api/record_click.ts` | ✅ |
| `recordLinkViewTB` | `lib/tracking/record-link-view.ts` | ✅ |
| `recordWebhookEvent` | `lib/queues/workers/webhook-delivery.worker.ts` | ✅ |
| `isTinybirdConfigured` | Various | ✅ |

#### Query Functions (14 total) - ALL COVERED

| Function | Used In | Status |
|----------|---------|--------|
| `getTotalAvgPageDuration` | Document stats, Dataroom document stats | ✅ |
| `getViewPageDuration` | Analytics, Document stats, Views, Link visits | ✅ |
| `getTotalDocumentDuration` | Analytics, Document stats, Dataroom document stats | ✅ |
| `getTotalLinkDuration` | Analytics | ✅ |
| `getTotalViewerDuration` | Analytics | ✅ |
| `getViewUserAgent` | User agent endpoints | ✅ |
| `getViewUserAgent_v2` | User agent endpoints (fallback) | ✅ |
| `getTotalDataroomDuration` | Dataroom stats | ✅ |
| `getDocumentDurationPerViewer` | Viewer stats | ✅ |
| `getWebhookEvents` | Webhook events | ✅ |
| `getVideoEventsByDocument` | Video analytics | ✅ |
| `getVideoEventsByView` | Video stats | ✅ |
| `getClickEventsByView` | Click events | ✅ |
| `getTotalDuration` | Year-in-review | ✅ |

### Files Requiring Updates (20 total)

| # | File | Change |
|---|------|--------|
| 1 | `pages/api/analytics/index.ts` | Import path |
| 2 | `pages/api/record_view.ts` | Import path |
| 3 | `pages/api/record_video_view.ts` | Import path |
| 4 | `pages/api/record_click.ts` | Import path |
| 5 | `pages/api/links/[id]/visits.ts` | Import path |
| 6 | `pages/api/teams/[teamId]/documents/[id]/stats.ts` | Import path |
| 7 | `pages/api/teams/[teamId]/documents/[id]/views/index.ts` | Import path |
| 8 | `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/stats.ts` | Import path |
| 9 | `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/user-agent.ts` | Import path |
| 10 | `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/video-stats.ts` | Import path |
| 11 | `pages/api/teams/[teamId]/documents/[id]/views/[viewId]/click-events.ts` | Import path |
| 12 | `pages/api/teams/[teamId]/documents/[id]/video-analytics.ts` | Import path |
| 13 | `pages/api/teams/[teamId]/datarooms/[id]/stats.ts` | Import path |
| 14 | `pages/api/teams/[teamId]/datarooms/[id]/views/[viewId]/user-agent.ts` | Import path |
| 15 | `pages/api/teams/[teamId]/datarooms/[id]/documents/[documentId]/stats.ts` | Import path |
| 16 | `pages/api/teams/[teamId]/webhooks/[id]/events.ts` | Import path |
| 17 | `pages/api/teams/[teamId]/viewers/[id]/index.ts` | Import path |
| 18 | `lib/tracking/record-link-view.ts` | Import path |
| 19 | `lib/year-in-review/get-stats.ts` | Full refactor (remove Tinybird client) |
| 20 | `lib/queues/workers/webhook-delivery.worker.ts` | Replace direct API calls |

### Dashboard Features Verification

| Feature | Status |
|---------|--------|
| Analytics Overview | ✅ Will work |
| Analytics Links | ✅ Will work |
| Analytics Documents | ✅ Will work |
| Analytics Visitors | ✅ Will work |
| Analytics Views | ✅ Will work |
| Document Stats | ✅ Will work |
| Document Views | ✅ Will work |
| View Stats | ✅ Will work |
| View User Agent | ✅ Will work |
| Video Stats | ✅ Will work |
| Click Events | ✅ Will work |
| Video Analytics | ✅ Will work |
| Dataroom Stats | ✅ Will work |
| Dataroom View User Agent | ✅ Will work |
| Dataroom Document Stats | ✅ Will work |
| Webhook Events | ✅ Will work |
| Viewer Stats | ✅ Will work |
| Link Visits | ✅ Will work |
| Year-in-Review | ✅ Will work |
| Record Page View | ✅ Will work |
| Record Video View | ✅ Will work |
| Record Click | ✅ Will work |
| Record Link View | ✅ Will work |
| Webhook Events Recording | ✅ Will work |

---

## Special Cases Handled

### 1. Webhook Events Recording

The webhook delivery worker (`lib/queues/workers/webhook-delivery.worker.ts`) currently uses **direct Tinybird API calls** instead of the library.

**Solution**: Update the worker to import and use `recordWebhookEvent` from the new analytics lib. This simplifies the code and ensures consistency.

**Current code** (lines 34-82):
```typescript
// Direct fetch to Tinybird API
const response = await fetch(
  `${tinybirdBaseUrl}/v0/events?name=webhook_events__v1`,
  ...
);
```

**New code**:
```typescript
import { recordWebhookEvent } from "@/lib/analytics";

await recordWebhookEvent({
  event_id: data.eventId,
  webhook_id: data.webhookId,
  // ... rest of fields
});
```

### 2. Year-in-Review Feature

The year-in-review feature (`lib/year-in-review/get-stats.ts`) uses a **custom Tinybird pipe** (`get_total_team_duration__v1`) that wasn't in the main pipes.ts file.

**Solution**: Added `getTotalDuration` function to pipes.ts that returns:
- `total_duration`: Sum of all page view durations for the team's documents
- `unique_countries`: Array of unique country codes from page views

### 3. Optional Parameters

Some functions accept optional `until` parameter that isn't always used. The PostgreSQL implementation handles these gracefully.

---

## Files Created

- [ClickHouse Implementation](./analytics-clickhouse-implementation.md)
- [PostgreSQL Implementation](./analytics-postgresql-implementation.md)

---

## Final Recommendation for DocRoom

Given that DocRoom is:
- A self-hosted internal tool
- Used by a small organization (5K documents, 10K visitors/day potential)
- Not expecting millions of users

**I recommend PostgreSQL.**

Reasons:
1. Simplest deployment (no new containers)
2. Single database to backup/maintain
3. No new dependencies
4. Can always migrate to ClickHouse later if needed
5. Prisma provides type-safe queries
6. 18GB/year of analytics data is trivial for PostgreSQL

The PostgreSQL implementation will handle your expected load comfortably. If you ever outgrow it, the ClickHouse migration path is straightforward since the API is identical.
