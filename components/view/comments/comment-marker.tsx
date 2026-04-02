import { useCallback, useEffect, useRef, useState } from "react";

import { MessageCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import { type Comment } from "@/lib/swr/use-comments";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CommentMarkerProps {
  comment: Comment;
  isActive: boolean;
  onClick: () => void;
  /** Desktop popover content — if provided, renders a Popover anchored to the marker */
  popoverContent?: React.ReactNode;
  /** Whether to use popover mode (desktop) or just click mode (mobile) */
  usePopover?: boolean;
}

export default function CommentMarker({
  comment,
  isActive,
  onClick,
  popoverContent,
  usePopover = false,
}: CommentMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const touchedRef = useRef(false);

  const replyCount = comment.replies?.length ?? 0;

  // Use native event listeners with { passive: false } to truly prevent
  // the scroll container from stealing touch events from the marker
  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      touchedRef.current = true;
      e.stopPropagation();
      e.preventDefault();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchedRef.current) return;
      touchedRef.current = false;
      e.stopPropagation();
      e.preventDefault();
      onClick();
    };

    const onTouchMove = (e: TouchEvent) => {
      touchedRef.current = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [onClick]);

  const markerButton = (
    <button
      ref={buttonRef}
      data-comment-id={comment.id}
      className={cn(
        "absolute z-20 flex items-center justify-center rounded-full transition-all duration-200",
        isActive
          ? comment.isResolved
            ? "scale-110 bg-green-600 opacity-100 shadow-md ring-2 ring-green-300"
            : "scale-110 bg-blue-600 opacity-100 shadow-md ring-2 ring-blue-300"
          : isHovered
            ? comment.isResolved
              ? "scale-110 bg-green-500 opacity-95 shadow-md"
              : "scale-110 bg-blue-500 opacity-95 shadow-md"
            : comment.isResolved
              ? "bg-green-500 opacity-30 hover:opacity-80"
              : "bg-blue-500 opacity-40 hover:opacity-90",
        isActive || isHovered
          ? "h-9 w-9 md:h-7 md:w-7"
          : "h-7 w-7 md:h-5 md:w-5",
      )}
      style={{
        left: `${comment.pinX}%`,
        top: `${comment.pinY}%`,
        transform: "translate(-50%, -50%)",
        touchAction: "none",
      }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {comment.commentNumber ? (
        <span
          className={cn(
            "font-bold text-white",
            isActive || isHovered ? "text-xs" : "text-[9px] md:text-[8px]",
          )}
        >
          {comment.commentNumber}
        </span>
      ) : (
        <MessageCircle
          className={cn(
            "text-white",
            isActive || isHovered
              ? "h-4 w-4 md:h-3.5 md:w-3.5"
              : "h-3 w-3 md:h-2.5 md:w-2.5",
          )}
        />
      )}

      {/* Reply count badge */}
      {replyCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {replyCount}
        </span>
      )}
    </button>
  );

  return (
    <>
      {/* Region highlight on hover */}
      {(isHovered || isActive) &&
        comment.regionX != null &&
        comment.regionY != null &&
        comment.regionWidth != null &&
        comment.regionHeight != null && (
          <div
            className={cn(
              "pointer-events-none absolute",
              comment.isResolved
                ? "border border-green-400/50 bg-green-400/10"
                : "border border-blue-400/50 bg-blue-400/10",
            )}
            style={{
              left: `${comment.regionX}%`,
              top: `${comment.regionY}%`,
              width: `${comment.regionWidth}%`,
              height: `${comment.regionHeight}%`,
              zIndex: 19,
            }}
          />
        )}

      {/* With popover (desktop) — Radix anchors to the marker button */}
      {usePopover && popoverContent ? (
        <Popover
          open={isActive}
          onOpenChange={(open) => !open && onClick()}
        >
          <PopoverTrigger asChild>{markerButton}</PopoverTrigger>
          <PopoverContent
            className="w-72 p-0"
            side="right"
            align="start"
            sideOffset={12}
            collisionPadding={16}
            avoidCollisions={true}
          >
            {popoverContent}
          </PopoverContent>
        </Popover>
      ) : (
        markerButton
      )}
    </>
  );
}
