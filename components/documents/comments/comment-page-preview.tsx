"use client";

import { useState } from "react";

import { Expand, X } from "lucide-react";

import { useDocumentThumbnail } from "@/lib/swr/use-document";

import { Button } from "@/components/ui/button";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface CommentPagePreviewProps {
  documentId: string;
  pageNumber: number;
  pinX: number;
  pinY: number;
  commentNumber: number;
  isResolved?: boolean;
  regionX?: number | null;
  regionY?: number | null;
  regionWidth?: number | null;
  regionHeight?: number | null;
}

export default function CommentPagePreview({
  documentId,
  pageNumber,
  pinX,
  pinY,
  commentNumber,
  isResolved,
  regionX,
  regionY,
  regionWidth,
  regionHeight,
}: CommentPagePreviewProps) {
  const { data, error } = useDocumentThumbnail(pageNumber, documentId);
  const imageUrl = data && !error ? data.imageUrl : null;
  const [expanded, setExpanded] = useState(false);

  if (!imageUrl) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-md bg-gray-100">
        {error ? (
          <span className="text-xs text-gray-400">Preview unavailable</span>
        ) : (
          <LoadingSpinner className="h-4 w-4" />
        )}
      </div>
    );
  }

  return (
    <>
      {/* Thumbnail preview */}
      <div
        className="group relative cursor-pointer overflow-hidden rounded-md border border-gray-200"
        onClick={() => setExpanded(true)}
      >
        <img
          src={imageUrl}
          alt={`Page ${pageNumber}`}
          className="w-full object-contain"
          style={{ maxHeight: "180px" }}
        />

        {/* Pin indicator on thumbnail */}
        <div
          className={`absolute flex h-5 w-5 items-center justify-center rounded-full shadow-sm ${isResolved ? "bg-green-500" : "bg-blue-500"}`}
          style={{
            left: `${pinX}%`,
            top: `${pinY}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <span className="text-[8px] font-bold text-white">
            {commentNumber}
          </span>
        </div>

        {/* Region highlight */}
        {regionX != null &&
          regionY != null &&
          regionWidth != null &&
          regionHeight != null && (
            <div
              className={`absolute border ${isResolved ? "border-green-400/60 bg-green-400/15" : "border-blue-400/60 bg-blue-400/15"}`}
              style={{
                left: `${regionX}%`,
                top: `${regionY}%`,
                width: `${regionWidth}%`,
                height: `${regionHeight}%`,
              }}
            />
          )}

        {/* Expand hint */}
        <div className="absolute bottom-1 right-1 rounded bg-black/50 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Expand className="h-3 w-3 text-white" />
        </div>
      </div>

      {/* Expanded modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative max-h-[85vh] max-w-[90vw] overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
              className="absolute right-2 top-2 z-10 h-7 w-7 rounded-full bg-black/40 p-0 hover:bg-black/60"
            >
              <X className="h-4 w-4 text-white" />
            </Button>

            <div className="relative">
              <img
                src={imageUrl}
                alt={`Page ${pageNumber}`}
                className="max-h-[85vh] w-auto object-contain"
              />

              {/* Pin indicator */}
              <div
                className={`absolute flex h-8 w-8 items-center justify-center rounded-full shadow-md ring-2 ring-white ${isResolved ? "bg-green-500" : "bg-blue-500"}`}
                style={{
                  left: `${pinX}%`,
                  top: `${pinY}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <span className="text-xs font-bold text-white">
                  {commentNumber}
                </span>
              </div>

              {/* Region highlight */}
              {regionX != null &&
                regionY != null &&
                regionWidth != null &&
                regionHeight != null && (
                  <div
                    className={`absolute border-2 ${isResolved ? "border-green-400 bg-green-400/15" : "border-blue-400 bg-blue-400/15"}`}
                    style={{
                      left: `${regionX}%`,
                      top: `${regionY}%`,
                      width: `${regionWidth}%`,
                      height: `${regionHeight}%`,
                    }}
                  />
                )}
            </div>

            <div className="border-t bg-gray-50 px-4 py-2 text-center text-sm text-gray-500">
              Page {pageNumber} — Comment #{commentNumber}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
