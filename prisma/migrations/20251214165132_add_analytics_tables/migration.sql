-- CreateTable
CREATE TABLE "page_views" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "dataroomId" TEXT,
    "versionNumber" SMALLINT NOT NULL DEFAULT 1,
    "time" BIGINT NOT NULL,
    "duration" INTEGER NOT NULL,
    "pageNumber" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Unknown',
    "city" TEXT NOT NULL DEFAULT 'Unknown',
    "region" TEXT NOT NULL DEFAULT 'Unknown',
    "latitude" TEXT NOT NULL DEFAULT 'Unknown',
    "longitude" TEXT NOT NULL DEFAULT 'Unknown',
    "ua" TEXT NOT NULL DEFAULT 'Unknown',
    "browser" TEXT NOT NULL DEFAULT 'Unknown',
    "browser_version" TEXT NOT NULL DEFAULT 'Unknown',
    "engine" TEXT NOT NULL DEFAULT 'Unknown',
    "engine_version" TEXT NOT NULL DEFAULT 'Unknown',
    "os" TEXT NOT NULL DEFAULT 'Unknown',
    "os_version" TEXT NOT NULL DEFAULT 'Unknown',
    "device" TEXT NOT NULL DEFAULT 'Desktop',
    "device_vendor" TEXT NOT NULL DEFAULT 'Unknown',
    "device_model" TEXT NOT NULL DEFAULT 'Unknown',
    "cpu_architecture" TEXT NOT NULL DEFAULT 'Unknown',
    "bot" BOOLEAN NOT NULL DEFAULT false,
    "referer" TEXT NOT NULL DEFAULT '(direct)',
    "referer_url" TEXT NOT NULL DEFAULT '(direct)',

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "http_status" SMALLINT NOT NULL,
    "request_body" TEXT NOT NULL,
    "response_body" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_views" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "link_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "view_id" TEXT NOT NULL,
    "dataroom_id" TEXT,
    "version_number" SMALLINT NOT NULL DEFAULT 1,
    "event_type" TEXT NOT NULL,
    "start_time" INTEGER NOT NULL,
    "end_time" INTEGER NOT NULL DEFAULT 0,
    "playback_rate" SMALLINT NOT NULL,
    "volume" SMALLINT NOT NULL,
    "is_muted" BOOLEAN NOT NULL DEFAULT false,
    "is_focused" BOOLEAN NOT NULL DEFAULT false,
    "is_fullscreen" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT NOT NULL DEFAULT 'Unknown',
    "city" TEXT NOT NULL DEFAULT 'Unknown',
    "region" TEXT NOT NULL DEFAULT 'Unknown',
    "latitude" TEXT NOT NULL DEFAULT 'Unknown',
    "longitude" TEXT NOT NULL DEFAULT 'Unknown',
    "ua" TEXT NOT NULL DEFAULT 'Unknown',
    "browser" TEXT NOT NULL DEFAULT 'Unknown',
    "browser_version" TEXT NOT NULL DEFAULT 'Unknown',
    "engine" TEXT NOT NULL DEFAULT 'Unknown',
    "engine_version" TEXT NOT NULL DEFAULT 'Unknown',
    "os" TEXT NOT NULL DEFAULT 'Unknown',
    "os_version" TEXT NOT NULL DEFAULT 'Unknown',
    "device" TEXT NOT NULL DEFAULT 'Desktop',
    "device_vendor" TEXT NOT NULL DEFAULT 'Unknown',
    "device_model" TEXT NOT NULL DEFAULT 'Unknown',
    "cpu_architecture" TEXT NOT NULL DEFAULT 'Unknown',
    "bot" BOOLEAN NOT NULL DEFAULT false,
    "referer" TEXT NOT NULL DEFAULT '(direct)',
    "referer_url" TEXT NOT NULL DEFAULT '(direct)',
    "ip_address" TEXT,

    CONSTRAINT "video_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_events" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "event_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "link_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "dataroom_id" TEXT,
    "view_id" TEXT NOT NULL,
    "page_number" TEXT NOT NULL,
    "version_number" SMALLINT NOT NULL,
    "href" TEXT NOT NULL,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_click_events" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "click_id" TEXT NOT NULL,
    "view_id" TEXT NOT NULL,
    "link_id" TEXT NOT NULL,
    "document_id" TEXT,
    "dataroom_id" TEXT,
    "continent" TEXT NOT NULL DEFAULT 'Unknown',
    "country" TEXT NOT NULL DEFAULT 'Unknown',
    "city" TEXT NOT NULL DEFAULT 'Unknown',
    "region" TEXT NOT NULL DEFAULT 'Unknown',
    "latitude" TEXT NOT NULL DEFAULT 'Unknown',
    "longitude" TEXT NOT NULL DEFAULT 'Unknown',
    "device" TEXT NOT NULL DEFAULT 'Desktop',
    "device_model" TEXT NOT NULL DEFAULT 'Unknown',
    "device_vendor" TEXT NOT NULL DEFAULT 'Unknown',
    "browser" TEXT NOT NULL DEFAULT 'Unknown',
    "browser_version" TEXT NOT NULL DEFAULT 'Unknown',
    "os" TEXT NOT NULL DEFAULT 'Unknown',
    "os_version" TEXT NOT NULL DEFAULT 'Unknown',
    "engine" TEXT NOT NULL DEFAULT 'Unknown',
    "engine_version" TEXT NOT NULL DEFAULT 'Unknown',
    "cpu_architecture" TEXT NOT NULL DEFAULT 'Unknown',
    "ua" TEXT NOT NULL DEFAULT 'Unknown',
    "bot" BOOLEAN NOT NULL DEFAULT false,
    "referer" TEXT NOT NULL DEFAULT '(direct)',
    "referer_url" TEXT NOT NULL DEFAULT '(direct)',
    "ip_address" TEXT,

    CONSTRAINT "link_click_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_views_linkId_documentId_viewId_time_idx" ON "page_views"("linkId", "documentId", "viewId", "time");

-- CreateIndex
CREATE INDEX "page_views_documentId_time_idx" ON "page_views"("documentId", "time");

-- CreateIndex
CREATE INDEX "page_views_viewId_idx" ON "page_views"("viewId");

-- CreateIndex
CREATE INDEX "page_views_dataroomId_time_idx" ON "page_views"("dataroomId", "time");

-- CreateIndex
CREATE INDEX "webhook_events_webhook_id_timestamp_idx" ON "webhook_events"("webhook_id", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "video_views_document_id_timestamp_idx" ON "video_views"("document_id", "timestamp");

-- CreateIndex
CREATE INDEX "video_views_document_id_view_id_timestamp_idx" ON "video_views"("document_id", "view_id", "timestamp");

-- CreateIndex
CREATE INDEX "click_events_document_id_view_id_timestamp_idx" ON "click_events"("document_id", "view_id", "timestamp");

-- CreateIndex
CREATE INDEX "link_click_events_view_id_idx" ON "link_click_events"("view_id");

-- CreateIndex
CREATE INDEX "link_click_events_timestamp_view_id_link_id_idx" ON "link_click_events"("timestamp", "view_id", "link_id");

-- AddForeignKey
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_views" ADD CONSTRAINT "video_views_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_views" ADD CONSTRAINT "video_views_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_views" ADD CONSTRAINT "video_views_view_id_fkey" FOREIGN KEY ("view_id") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_view_id_fkey" FOREIGN KEY ("view_id") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_click_events" ADD CONSTRAINT "link_click_events_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_click_events" ADD CONSTRAINT "link_click_events_view_id_fkey" FOREIGN KEY ("view_id") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;
