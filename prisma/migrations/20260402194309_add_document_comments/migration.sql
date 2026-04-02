-- AlterTable
ALTER TABLE "Link" ADD COLUMN     "enableComments" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE "DocumentComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "pinX" DOUBLE PRECISION NOT NULL,
    "pinY" DOUBLE PRECISION NOT NULL,
    "regionX" DOUBLE PRECISION,
    "regionY" DOUBLE PRECISION,
    "regionWidth" DOUBLE PRECISION,
    "regionHeight" DOUBLE PRECISION,
    "documentId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "viewId" TEXT NOT NULL,
    "viewerId" TEXT,
    "viewerEmail" TEXT,
    "viewerName" TEXT,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "parentId" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentComment_documentId_idx" ON "DocumentComment"("documentId");

-- CreateIndex
CREATE INDEX "DocumentComment_linkId_idx" ON "DocumentComment"("linkId");

-- CreateIndex
CREATE INDEX "DocumentComment_viewId_idx" ON "DocumentComment"("viewId");

-- CreateIndex
CREATE INDEX "DocumentComment_teamId_idx" ON "DocumentComment"("teamId");

-- CreateIndex
CREATE INDEX "DocumentComment_parentId_idx" ON "DocumentComment"("parentId");

-- CreateIndex
CREATE INDEX "DocumentComment_documentId_linkId_idx" ON "DocumentComment"("documentId", "linkId");

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DocumentComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
