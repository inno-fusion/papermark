import { useState } from "react";

import { Brand, DataroomBrand } from "@prisma/client";
import { MessageCircle, StickyNote, X } from "lucide-react";

import { type Comment } from "@/lib/swr/use-comments";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { AnnotationPanel } from "../annotations/annotation-panel";

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

function MobileCommentsList({
  comments,
  currentPage,
  onSelect,
  onDelete,
}: {
  comments: Comment[] | undefined;
  currentPage: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const currentPageComments =
    comments?.filter((c) => c.pageNumber === currentPage) ?? [];
  const otherComments =
    comments?.filter((c) => c.pageNumber !== currentPage) ?? [];

  if (!comments || comments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        No comments yet
      </p>
    );
  }

  return (
    <div>
      {currentPageComments.length > 0 && (
        <>
          <div className="bg-gray-50 px-4 py-1.5 text-[11px] font-medium text-gray-500">
            This page
          </div>
          {currentPageComments.map((c) => (
            <div
              key={c.id}
              className="border-b border-gray-100 px-4 py-3 active:bg-gray-50"
              onClick={() => onSelect(c.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {c.commentNumber ? (
                    <span className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                      c.isResolved ? "bg-green-500" : "bg-blue-500",
                    )}>
                      {c.commentNumber}
                    </span>
                  ) : (
                    <MessageCircle className={cn("h-3 w-3", c.isResolved ? "text-green-500" : "text-blue-500")} />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {c.viewerName || c.viewerEmail?.split("@")[0] || "Anon"}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">
                  {formatTime(c.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                {c.content}
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                {c.isResolved && (
                  <span className="text-[11px] text-green-600">Resolved</span>
                )}
                {c.replies && c.replies.length > 0 && (
                  <span className="text-[11px] text-blue-500">
                    {c.replies.length}{" "}
                    {c.replies.length === 1 ? "reply" : "replies"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </>
      )}
      {otherComments.length > 0 && (
        <>
          <div className="bg-gray-50 px-4 py-1.5 text-[11px] font-medium text-gray-500">
            Other pages
          </div>
          {otherComments.map((c) => (
            <div
              key={c.id}
              className="border-b border-gray-100 px-4 py-3 active:bg-gray-50"
              onClick={() => onSelect(c.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {c.commentNumber ? (
                    <span className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                      c.isResolved ? "bg-green-500" : "bg-blue-500",
                    )}>
                      {c.commentNumber}
                    </span>
                  ) : (
                    <MessageCircle className={cn("h-3 w-3", c.isResolved ? "text-green-500" : "text-blue-500")} />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {c.viewerName || c.viewerEmail?.split("@")[0] || "Anon"}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    p.{c.pageNumber}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400">
                  {formatTime(c.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                {c.content}
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

type Tab = "comments" | "annotations";

interface MobileViewerPanelProps {
  onClose: () => void;
  // Common
  brand?: Partial<Brand> | Partial<DataroomBrand> | null;
  linkId: string;
  documentId?: string;
  viewId?: string;
  currentPage: number;
  // Comments
  commentsEnabled: boolean;
  comments: Comment[] | undefined;
  onReplyToComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onSelectComment: (commentId: string) => void;
  // Annotations
  annotationsEnabled: boolean;
  hasAnnotations: boolean;
  // Markers toggle
  markersVisible?: boolean;
  onToggleMarkers?: (visible: boolean) => void;
}

export default function MobileViewerPanel({
  onClose,
  brand,
  linkId,
  documentId,
  viewId,
  currentPage,
  commentsEnabled,
  comments,
  onReplyToComment,
  onDeleteComment,
  onSelectComment,
  annotationsEnabled,
  hasAnnotations,
  markersVisible = true,
  onToggleMarkers,
}: MobileViewerPanelProps) {
  const showComments = commentsEnabled;
  const showAnnotations = annotationsEnabled && hasAnnotations;
  const hasBothTabs = showComments && showAnnotations;

  const defaultTab: Tab =
    showComments && comments && comments.length > 0
      ? "comments"
      : showAnnotations
        ? "annotations"
        : "comments";

  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const commentCount = comments?.length ?? 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Sheet */}
      <div
        className="relative max-h-[55vh] w-full rounded-t-2xl bg-white shadow-xl animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header with close */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-0">
          {/* Tabs */}
          {hasBothTabs ? (
            <div className="flex gap-0">
              <button
                onClick={() => setActiveTab("comments")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                  activeTab === "comments"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500",
                )}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Comments
                {commentCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="px-1 py-0 text-[10px]"
                  >
                    {commentCount}
                  </Badge>
                )}
              </button>
              <button
                onClick={() => setActiveTab("annotations")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                  activeTab === "annotations"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500",
                )}
              >
                <StickyNote className="h-3.5 w-3.5" />
                Annotations
              </button>
            </div>
          ) : (
            <h3 className="pb-2 text-sm font-medium text-gray-700">
              {showAnnotations ? "Annotations" : "Comments"}
            </h3>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="mb-1 h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Markers toggle — only on comments tab */}
        {activeTab === "comments" && showComments && onToggleMarkers && (
          <div className="flex items-center justify-end border-b border-gray-100 px-4 py-1.5">
            <button
              onClick={() => onToggleMarkers(!markersVisible)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                markersVisible
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-500",
              )}
            >
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  markersVisible ? "bg-blue-500" : "bg-gray-400",
                )}
              />
              {markersVisible ? "Pins on" : "Pins off"}
            </button>
          </div>
        )}

        {/* Content — use overflow-y-auto for native mobile scrolling */}
        <div
          className="overflow-y-auto overscroll-contain"
          style={{ maxHeight: "38vh", WebkitOverflowScrolling: "touch" }}
        >
          {activeTab === "comments" && showComments && (
            <MobileCommentsList
              comments={comments}
              currentPage={currentPage}
              onSelect={onSelectComment}
              onDelete={onDeleteComment}
            />
          )}
          {activeTab === "annotations" && showAnnotations && (
            <AnnotationPanel
              brand={brand}
              linkId={linkId}
              documentId={documentId}
              viewId={viewId}
              currentPage={currentPage}
              isVisible={true}
            />
          )}
          {!hasBothTabs && showAnnotations && activeTab !== "annotations" && (
            <AnnotationPanel
              brand={brand}
              linkId={linkId}
              documentId={documentId}
              viewId={viewId}
              currentPage={currentPage}
              isVisible={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
