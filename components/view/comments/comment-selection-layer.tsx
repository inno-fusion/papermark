import { useCallback, useRef, useState } from "react";

interface SelectionRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CommentPlacement {
  pageNumber: number;
  pinX: number;
  pinY: number;
  region?: {
    regionX: number;
    regionY: number;
    regionWidth: number;
    regionHeight: number;
  };
}

interface CommentSelectionLayerProps {
  enabled: boolean;
  pageNumber: number;
  onCommentPlaced: (data: CommentPlacement) => void;
}

export default function CommentSelectionLayer({
  enabled,
  pageNumber,
  onCommentPlaced,
}: CommentSelectionLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectionRegion, setSelectionRegion] =
    useState<SelectionRegion | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const touchStartTime = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const getPercentageCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!layerRef.current) return { x: 0, y: 0 };
      const rect = layerRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      };
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      const coords = getPercentageCoords(e.clientX, e.clientY);
      startPos.current = coords;
      setIsDragging(true);
      setSelectionRegion(null);
    },
    [enabled, getPercentageCoords],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !startPos.current) return;
      e.preventDefault();
      const coords = getPercentageCoords(e.clientX, e.clientY);
      const x = Math.min(startPos.current.x, coords.x);
      const y = Math.min(startPos.current.y, coords.y);
      const width = Math.abs(coords.x - startPos.current.x);
      const height = Math.abs(coords.y - startPos.current.y);

      if (width > 1 || height > 1) {
        setSelectionRegion({ x, y, width, height });
      }
    },
    [isDragging, getPercentageCoords],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !startPos.current) return;
      e.preventDefault();
      e.stopPropagation();

      const coords = getPercentageCoords(e.clientX, e.clientY);
      const dx = Math.abs(coords.x - startPos.current.x);
      const dy = Math.abs(coords.y - startPos.current.y);

      if (dx < 2 && dy < 2) {
        // Simple click — place pin only
        onCommentPlaced({
          pageNumber,
          pinX: coords.x,
          pinY: coords.y,
        });
      } else {
        // Drag — area selection
        const regionX = Math.min(startPos.current.x, coords.x);
        const regionY = Math.min(startPos.current.y, coords.y);
        const regionWidth = Math.abs(coords.x - startPos.current.x);
        const regionHeight = Math.abs(coords.y - startPos.current.y);

        onCommentPlaced({
          pageNumber,
          pinX: regionX,
          pinY: regionY,
          region: { regionX, regionY, regionWidth, regionHeight },
        });
      }

      setIsDragging(false);
      setSelectionRegion(null);
      startPos.current = null;
    },
    [isDragging, getPercentageCoords, onCommentPlaced, pageNumber],
  );

  // Mobile touch handling — tap only, no drag
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      if (!touch) return;
      touchStartTime.current = Date.now();
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    },
    [enabled],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !touchStartPos.current) return;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const duration = Date.now() - touchStartTime.current;
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);

      // Only register as tap if duration < 300ms and movement < 10px
      if (duration < 300 && dx < 10 && dy < 10) {
        e.preventDefault();
        e.stopPropagation();
        const coords = getPercentageCoords(touch.clientX, touch.clientY);
        onCommentPlaced({
          pageNumber,
          pinX: coords.x,
          pinY: coords.y,
        });
      }

      touchStartPos.current = null;
    },
    [enabled, getPercentageCoords, onCommentPlaced, pageNumber],
  );

  if (!enabled) {
    return null;
  }

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 z-10"
      style={{ cursor: "crosshair" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (isDragging) {
          setIsDragging(false);
          setSelectionRegion(null);
          startPos.current = null;
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Selection rectangle while dragging */}
      {selectionRegion && (
        <div
          className="pointer-events-none absolute border-2 border-blue-500 bg-blue-500/20"
          style={{
            left: `${selectionRegion.x}%`,
            top: `${selectionRegion.y}%`,
            width: `${selectionRegion.width}%`,
            height: `${selectionRegion.height}%`,
          }}
        />
      )}
    </div>
  );
}
