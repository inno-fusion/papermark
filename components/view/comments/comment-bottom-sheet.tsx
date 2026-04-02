import { useState } from "react";

import { MessageCircle, X } from "lucide-react";

import { type Comment, type CommentReply } from "@/lib/swr/use-comments";

import { Button } from "@/components/ui/button";
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

function MobileCommentItem({
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
    <div className="border-b border-gray-100 px-4 py-3 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-700">
            {displayName}
          </span>
          {isAdmin && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              Admin
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {formatTime(createdAt)}
          </span>
          {isOwn && onDelete && (
            <button
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Delete
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
        {content}
      </p>
    </div>
  );
}

function MobileCommentListItem({
  comment,
  onSelect,
  onDelete,
}: {
  comment: Comment;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const displayName =
    comment.viewerName || comment.viewerEmail?.split("@")[0] || "Anonymous";

  return (
    <div
      className="cursor-pointer border-b border-gray-100 px-4 py-3 active:bg-gray-50"
      onClick={() => onSelect(comment.id)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MessageCircle className="h-3 w-3 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">
            {displayName}
          </span>
          <span className="text-xs text-gray-400">
            p.{comment.pageNumber}
          </span>
        </div>
        <span className="text-[10px] text-gray-400">
          {formatTime(comment.createdAt)}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500 line-clamp-2">
        {comment.content}
      </p>
      <div className="mt-0.5 flex items-center gap-2">
        {comment.isResolved && (
          <span className="text-[11px] text-green-600">Resolved</span>
        )}
        {comment.replies && comment.replies.length > 0 && (
          <span className="text-[11px] text-blue-500">
            {comment.replies.length}{" "}
            {comment.replies.length === 1 ? "reply" : "replies"}
          </span>
        )}
      </div>
    </div>
  );
}

interface CommentBottomSheetProps {
  mode: "create" | "view" | "list";
  comment?: Comment;
  comments?: Comment[];
  currentPage?: number;
  onClose: () => void;
  onSubmit: (content: string) => void;
  onReply?: (content: string) => void;
  onDelete?: (commentId: string) => void;
  onSelect?: (commentId: string) => void;
  onBack?: () => void;
}

export default function CommentBottomSheet({
  mode,
  comment,
  comments,
  currentPage,
  onClose,
  onSubmit,
  onReply,
  onDelete,
  onSelect,
  onBack,
}: CommentBottomSheetProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const title =
    mode === "create"
      ? "Add a comment"
      : mode === "list"
        ? `All comments${currentPage ? ` · Page ${currentPage}` : ""}`
        : `${comment?.commentNumber ? `#${comment.commentNumber} · ` : ""}Page ${comment?.pageNumber}${comment?.isResolved ? " · Resolved" : ""}`;

  // For list mode, show current page comments first, then others
  const sortedComments =
    mode === "list" && comments
      ? [...comments].sort((a, b) => {
          if (currentPage) {
            if (a.pageNumber === currentPage && b.pageNumber !== currentPage)
              return -1;
            if (b.pageNumber === currentPage && a.pageNumber !== currentPage)
              return 1;
          }
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        })
      : [];

  return (
    <div className="fixed inset-0 z-[200] flex items-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Sheet — shrinks when keyboard is open so page content stays visible */}
      <div
        className={`relative w-full rounded-t-2xl bg-white shadow-xl animate-in slide-in-from-bottom duration-200 ${
          keyboardOpen ? "max-h-[30vh]" : "max-h-[50vh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-2">
          <div className="flex items-center gap-2">
            {mode === "view" && onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 active:bg-gray-200"
              >
                <span className="text-sm">‹</span> Back
              </button>
            )}
            <h3 className="text-sm font-medium text-gray-700">{title}</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {mode === "create" ? (
          <div className="p-3">
            <CommentInput
              onSubmit={(content) => {
                onSubmit(content);
                onClose();
              }}
              placeholder="Write a comment..."
              autoFocus={true}
              onFocusChange={setKeyboardOpen}
            />
          </div>
        ) : mode === "list" ? (
          <ScrollArea className="max-h-[40vh]">
            {sortedComments.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No comments yet
              </p>
            ) : (
              sortedComments.map((c) => (
                <MobileCommentListItem
                  key={c.id}
                  comment={c}
                  onSelect={(id) => onSelect?.(id)}
                  onDelete={onDelete}
                />
              ))
            )}
          </ScrollArea>
        ) : comment ? (
          <>
            {!keyboardOpen && (
              <ScrollArea className="max-h-[35vh]">
                <MobileCommentItem
                  {...comment}
                  onDelete={
                    comment.isOwn && onDelete
                      ? () => onDelete(comment.id)
                      : undefined
                  }
                />
                {comment.replies?.map((reply) => (
                  <MobileCommentItem
                    key={reply.id}
                    {...reply}
                    onDelete={
                      reply.isOwn && onDelete
                        ? () => onDelete(reply.id)
                        : undefined
                    }
                  />
                ))}
              </ScrollArea>
            )}
            {keyboardOpen && (
              <div className="px-4 py-1.5">
                <span className="text-xs text-gray-400">
                  Replying to{" "}
                  {comment.viewerName ||
                    comment.viewerEmail?.split("@")[0] ||
                    "comment"}
                </span>
              </div>
            )}
            {onReply && (
              <div className="border-t border-gray-100 p-3">
                <CommentInput
                  onSubmit={(content) => {
                    onReply(content);
                    setKeyboardOpen(false);
                  }}
                  placeholder="Reply..."
                  autoFocus={false}
                  onFocusChange={setKeyboardOpen}
                />
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
