"use client";

import { useState } from "react";

import {
  CheckCircle,
  Circle,
  MessageCircle,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useDocumentComments } from "@/lib/swr/use-comments";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import CommentPagePreview from "./comment-page-preview";
import CommentReplyForm from "./comment-reply-form";

interface CommentsSheetProps {
  documentId: string;
  teamId: string;
  trigger?: React.ReactNode;
}

export function CommentsSheet({
  documentId,
  teamId,
  trigger,
}: CommentsSheetProps) {
  const { comments, mutate } = useDocumentComments(teamId, documentId);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleDelete = async (commentId: string) => {
    try {
      const response = await fetch(
        `/api/teams/${teamId}/documents/${documentId}/comments/${commentId}`,
        { method: "DELETE" },
      );

      if (!response.ok) throw new Error("Failed to delete comment");
      toast.success("Comment deleted");
      mutate();
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  const handleResolve = async (commentId: string, isResolved: boolean) => {
    try {
      const response = await fetch(
        `/api/teams/${teamId}/documents/${documentId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isResolved }),
        },
      );

      if (!response.ok) throw new Error("Failed to update comment");
      toast.success(isResolved ? "Comment resolved" : "Comment reopened");
      mutate();
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("Failed to update comment");
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    try {
      const response = await fetch(
        `/api/teams/${teamId}/documents/${documentId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, parentId }),
        },
      );

      if (!response.ok) throw new Error("Failed to reply");
      toast.success("Reply sent");
      mutate();
    } catch (error) {
      console.error("Error replying:", error);
      toast.error("Failed to send reply");
    }
  };

  const commentCount = comments?.length ?? 0;
  const unresolvedCount =
    comments?.filter((c: any) => !c.isResolved).length ?? 0;

  // Assign sequential numbers to comments sorted by creation time
  const numberedComments = [...(comments ?? [])]
    .sort(
      (a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map((c: any, i: number) => ({ ...c, commentNumber: i + 1 }));

  // Group comments by page
  const commentsByPage = numberedComments.reduce(
    (acc: Record<number, any[]>, comment: any) => {
      const page = comment.pageNumber;
      if (!acc[page]) acc[page] = [];
      acc[page].push(comment);
      return acc;
    },
    {},
  );

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 whitespace-nowrap text-xs lg:h-9 lg:text-sm"
          >
            <MessageSquare className="h-4 w-4" />
            Comments
            {unresolvedCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                {unresolvedCount}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-hidden sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Viewer Comments</SheetTitle>
          <SheetDescription>
            {commentCount === 0
              ? "No viewer comments yet."
              : `${commentCount} comment${commentCount !== 1 ? "s" : ""} (${unresolvedCount} unresolved)`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-4 h-[calc(100vh-140px)]">
          <div className="space-y-6 pr-4">
            {Object.entries(commentsByPage)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([page, pageComments]) => (
                <div key={page}>
                  <h3 className="mb-2 text-sm font-medium text-gray-500">
                    Page {page}
                  </h3>
                  <div className="space-y-3">
                    {(pageComments as any[]).map((comment: any) => (
                      <div
                        key={comment.id}
                        className={`rounded-lg border p-3 ${
                          comment.isResolved
                            ? "border-gray-200 bg-gray-50"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {/* Comment header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${comment.isResolved ? "bg-green-500" : "bg-blue-500"}`}>
                              {comment.commentNumber}
                            </span>
                            <span className="text-sm font-medium">
                              {comment.viewerName ||
                                comment.viewerEmail ||
                                "Viewer"}
                            </span>
                            {comment.link && (
                              <span className="text-xs text-gray-400">
                                via {comment.link.name || "link"}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                handleResolve(
                                  comment.id,
                                  !comment.isResolved,
                                )
                              }
                              title={
                                comment.isResolved ? "Reopen" : "Resolve"
                              }
                            >
                              {comment.isResolved ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <Circle className="h-4 w-4 text-gray-300 hover:text-green-500" />
                              )}
                            </button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button title="Delete comment">
                                  <Trash2 className="h-4 w-4 text-gray-300 hover:text-red-500" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete comment?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this comment
                                    and all its replies.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(comment.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        {/* Comment content */}
                        <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                        <span className="mt-1 block text-xs text-gray-400">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>

                        {/* Page preview with pin location */}
                        <div className="mt-2">
                          <CommentPagePreview
                            documentId={documentId}
                            pageNumber={comment.pageNumber}
                            pinX={comment.pinX}
                            pinY={comment.pinY}
                            commentNumber={comment.commentNumber}
                            isResolved={comment.isResolved}
                            regionX={comment.regionX}
                            regionY={comment.regionY}
                            regionWidth={comment.regionWidth}
                            regionHeight={comment.regionHeight}
                          />
                        </div>

                        {/* Replies */}
                        {comment.replies?.length > 0 && (
                          <div className="mt-2 space-y-2 border-l-2 border-gray-200 pl-3">
                            {comment.replies.map((reply: any) => (
                              <div key={reply.id}>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-gray-600">
                                    {reply.user?.name ||
                                      reply.viewerName ||
                                      reply.viewerEmail ||
                                      "User"}
                                  </span>
                                  {reply.userId && (
                                    <Badge
                                      variant="secondary"
                                      className="px-1 py-0 text-[10px]"
                                    >
                                      Admin
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 whitespace-pre-wrap">
                                  {reply.content}
                                </p>
                                <span className="text-xs text-gray-400">
                                  {new Date(reply.createdAt).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply form */}
                        <CommentReplyForm
                          onSubmit={(content) =>
                            handleReply(comment.id, content)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
