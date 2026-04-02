import { Trash2, CheckCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import { type Comment, type CommentReply } from "@/lib/swr/use-comments";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

function CommentItem({
  content,
  viewerEmail,
  viewerName,
  isOwn,
  isAdmin,
  createdAt,
  onDelete,
}: CommentReply & { onDelete?: () => void }) {
  const displayName =
    viewerName || viewerEmail?.split("@")[0] || "Anonymous";

  return (
    <div className="group relative border-b border-gray-100 px-3 py-2 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-700">
            {displayName}
          </span>
          {isAdmin && (
            <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] font-medium text-blue-700">
              Admin
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400">
            {formatTime(createdAt)}
          </span>
          {isOwn && onDelete && (
            <button
              onClick={onDelete}
              className="ml-1 opacity-0 transition-opacity group-hover:opacity-100"
              title="Delete comment"
            >
              <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-500" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-0.5 text-sm text-gray-600 whitespace-pre-wrap">
        {content}
      </p>
    </div>
  );
}

interface CommentPopoverProps {
  comment: Comment;
  isOpen: boolean;
  onClose: () => void;
  onReply: (content: string) => void;
  onDelete: (commentId: string) => void;
  onResolve?: (commentId: string, resolved: boolean) => void;
  isTeamMember?: boolean;
  children: React.ReactNode;
}

export default function CommentPopover({
  comment,
  isOpen,
  onClose,
  onReply,
  onDelete,
  onResolve,
  isTeamMember,
  children,
}: CommentPopoverProps) {
  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        side="right"
        align="start"
        sideOffset={8}
        onPointerDownOutside={(e) => {
          // Don't close if clicking on another marker
          const target = e.target as HTMLElement;
          if (target.closest("[data-comment-marker]")) {
            e.preventDefault();
          }
        }}
      >
        <div className="max-h-80 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <div className="flex items-center gap-1.5">
              {comment.commentNumber && (
                <span className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
                  comment.isResolved ? "bg-green-500" : "bg-blue-500",
                )}>
                  {comment.commentNumber}
                </span>
              )}
              <span className="text-xs font-medium text-gray-500">
                Page {comment.pageNumber}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {comment.isResolved && (
                <span className="text-[10px] text-green-600">Resolved</span>
              )}
              {isTeamMember && onResolve && (
                <button
                  onClick={() =>
                    onResolve(comment.id, !comment.isResolved)
                  }
                  title={
                    comment.isResolved
                      ? "Unresolve comment"
                      : "Resolve comment"
                  }
                >
                  <CheckCircle
                    className={cn(
                      "h-4 w-4",
                      comment.isResolved
                        ? "text-green-500"
                        : "text-gray-300 hover:text-green-500",
                    )}
                  />
                </button>
              )}
            </div>
          </div>

          {/* Comments thread */}
          <ScrollArea className="max-h-48">
            <CommentItem
              {...comment}
              onDelete={
                comment.isOwn ? () => onDelete(comment.id) : undefined
              }
            />
            {comment.replies?.map((reply) => (
              <CommentItem
                key={reply.id}
                {...reply}
                onDelete={
                  reply.isOwn ? () => onDelete(reply.id) : undefined
                }
              />
            ))}
          </ScrollArea>

          {/* Reply input */}
          <div className="border-t border-gray-100 p-2">
            <CommentInput
              onSubmit={onReply}
              placeholder="Reply..."
              autoFocus={false}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Standalone popover content — use inside CommentMarker's popoverContent prop */
export function CommentPopoverContent({
  comment,
  onReply,
  onDelete,
  onResolve,
  isTeamMember,
}: {
  comment: Comment;
  onReply: (content: string) => void;
  onDelete: (commentId: string) => void;
  onResolve?: (commentId: string, resolved: boolean) => void;
  isTeamMember?: boolean;
}) {
  return (
    <div className="max-h-80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {comment.commentNumber && (
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
                comment.isResolved ? "bg-green-500" : "bg-blue-500",
              )}
            >
              {comment.commentNumber}
            </span>
          )}
          <span className="text-xs font-medium text-gray-500">
            Page {comment.pageNumber}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {comment.isResolved && (
            <span className="text-[10px] text-green-600">Resolved</span>
          )}
          {isTeamMember && onResolve && (
            <button
              onClick={() => onResolve(comment.id, !comment.isResolved)}
              title={
                comment.isResolved ? "Unresolve comment" : "Resolve comment"
              }
            >
              <CheckCircle
                className={cn(
                  "h-4 w-4",
                  comment.isResolved
                    ? "text-green-500"
                    : "text-gray-300 hover:text-green-500",
                )}
              />
            </button>
          )}
        </div>
      </div>

      {/* Comments thread */}
      <ScrollArea className="max-h-48">
        <CommentItem
          {...comment}
          onDelete={comment.isOwn ? () => onDelete(comment.id) : undefined}
        />
        {comment.replies?.map((reply) => (
          <CommentItem
            key={reply.id}
            {...reply}
            onDelete={reply.isOwn ? () => onDelete(reply.id) : undefined}
          />
        ))}
      </ScrollArea>

      {/* Reply input */}
      <div className="border-t border-gray-100 p-2">
        <CommentInput
          onSubmit={onReply}
          placeholder="Reply..."
          autoFocus={false}
        />
      </div>
    </div>
  );
}

interface CreateCommentPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string) => void;
  children: React.ReactNode;
}

export function CreateCommentPopover({
  isOpen,
  onClose,
  onSubmit,
  children,
}: CreateCommentPopoverProps) {
  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-72 p-3"
        side="right"
        align="start"
        sideOffset={8}
      >
        <p className="mb-2 text-xs font-medium text-gray-500">
          Add a comment
        </p>
        <CommentInput
          onSubmit={(content) => {
            onSubmit(content);
            onClose();
          }}
          placeholder="Write a comment..."
          autoFocus={true}
        />
      </PopoverContent>
    </Popover>
  );
}
