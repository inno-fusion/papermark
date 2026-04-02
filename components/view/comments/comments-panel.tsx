import { useMemo } from "react";

import { MessageCircle, Trash2 } from "lucide-react";

import { type Comment, type CommentReply } from "@/lib/swr/use-comments";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import CommentInput from "./comment-input";

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

function CommentThread({
  comment,
  onReply,
  onDelete,
  onSelect,
}: {
  comment: Comment;
  onReply: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onSelect: (commentId: string) => void;
}) {
  const displayName =
    comment.viewerName || comment.viewerEmail?.split("@")[0] || "Anonymous";

  return (
    <div
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 transition-colors hover:border-blue-300"
      onClick={() => onSelect(comment.id)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {comment.commentNumber ? (
            <span className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
              comment.isResolved ? "bg-green-500" : "bg-blue-500",
            )}>
              {comment.commentNumber}
            </span>
          ) : (
            <MessageCircle className={cn("h-3 w-3", comment.isResolved ? "text-green-500" : "text-blue-500")} />
          )}
          <span className="text-xs font-medium text-gray-700">
            {displayName}
          </span>
          {comment.isAdmin && (
            <Badge
              variant="secondary"
              className="px-1 py-0 text-[10px]"
            >
              Admin
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400">
            {formatTime(comment.createdAt)}
          </span>
          {comment.isOwn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(comment.id);
              }}
              className="ml-1"
              title="Delete"
            >
              <Trash2 className="h-3 w-3 text-gray-300 hover:text-red-500" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="mt-1 text-sm text-gray-600 line-clamp-2 whitespace-pre-wrap">
        {comment.content}
      </p>

      {/* Reply count */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-1.5 text-[11px] text-blue-500">
          {comment.replies.length}{" "}
          {comment.replies.length === 1 ? "reply" : "replies"}
        </div>
      )}

      {/* Resolved badge */}
      {comment.isResolved && (
        <div className="mt-1 text-[10px] text-green-600">Resolved</div>
      )}
    </div>
  );
}

interface CommentsPanelProps {
  comments: Comment[] | undefined;
  currentPage: number;
  onReply: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onSelect: (commentId: string) => void;
  markersVisible?: boolean;
  onToggleMarkers?: (visible: boolean) => void;
}

export function CommentsPanel({
  comments,
  currentPage,
  onReply,
  onDelete,
  onSelect,
  markersVisible = true,
  onToggleMarkers,
}: CommentsPanelProps) {
  const currentPageComments = useMemo(() => {
    if (!comments) return [];
    return comments.filter((c) => c.pageNumber === currentPage);
  }, [comments, currentPage]);

  const totalComments = comments?.length ?? 0;

  return (
    <div className="flex h-full w-full flex-col bg-gray-50/80">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            Comments
          </h3>
          {onToggleMarkers && (
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
          )}
        </div>
        <p className="text-xs text-gray-400">
          {currentPageComments.length > 0
            ? `${currentPageComments.length} on this page`
            : "No comments on this page"}
          {totalComments > 0 && ` · ${totalComments} total`}
        </p>
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {currentPageComments.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">
              No comments on this page yet
            </p>
          ) : (
            currentPageComments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                onReply={onReply}
                onDelete={onDelete}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
