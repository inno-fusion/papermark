import { useState } from "react";

import { Brand, DataroomBrand } from "@prisma/client";
import { MessageCircle, StickyNote } from "lucide-react";

import { type Comment } from "@/lib/swr/use-comments";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";

import { AnnotationPanel } from "./annotations/annotation-panel";
import { CommentsPanel } from "./comments/comments-panel";

type Tab = "comments" | "annotations";

interface ViewerPanelProps {
  brand?: Partial<Brand> | Partial<DataroomBrand> | null;
  linkId: string;
  documentId?: string;
  viewId?: string;
  currentPage: number;
  commentsEnabled: boolean;
  comments: Comment[] | undefined;
  onReplyToComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onSelectComment: (commentId: string) => void;
  annotationsEnabled: boolean;
  hasAnnotations: boolean;
  markersVisible?: boolean;
  onToggleMarkers?: (visible: boolean) => void;
}

export function ViewerPanel({
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
}: ViewerPanelProps) {
  const hasBothTabs = commentsEnabled && annotationsEnabled && hasAnnotations;
  const defaultTab: Tab =
    commentsEnabled && comments && comments.length > 0
      ? "comments"
      : annotationsEnabled && hasAnnotations
        ? "annotations"
        : "comments";

  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const commentCount = comments?.length ?? 0;

  const showComments = commentsEnabled;
  const showAnnotations = annotationsEnabled && hasAnnotations;

  if (!showComments && !showAnnotations) return null;

  return (
    <div className="flex h-full w-full flex-col bg-gray-50/80">
      {/* Tabs - only show if both are available */}
      {hasBothTabs && (
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("comments")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
              activeTab === "comments"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Comments
            {commentCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 px-1.5 py-0 text-[10px]"
              >
                {commentCount}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("annotations")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
              activeTab === "annotations"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            <StickyNote className="h-3.5 w-3.5" />
            Annotations
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {(activeTab === "comments" || !hasBothTabs) && showComments && (
          <CommentsPanel
            comments={comments}
            currentPage={currentPage}
            onReply={onReplyToComment}
            onDelete={onDeleteComment}
            onSelect={onSelectComment}
            markersVisible={markersVisible}
            onToggleMarkers={onToggleMarkers}
          />
        )}
        {(activeTab === "annotations" || (!hasBothTabs && !showComments)) &&
          showAnnotations && (
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
  );
}
