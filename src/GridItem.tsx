import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GridWidget, WidgetComponentProps } from './types';
import { getWidget } from './registry';

export interface GridItemProps {
  widget: GridWidget;
  rowHeight: number;
  gap: number;
  columnWidth: number;
  editable?: boolean;
  selected?: boolean;
  onMove?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, w: number, h: number) => void;
  onSelect?: (id: string | null) => void;
  onRemove?: (id: string) => void;
}

/**
 * Individual widget wrapper with drag-to-move (header grab) and
 * resize handles (corners + edges). Renders the registered widget
 * component inside.
 */
export function GridItem({
  widget,
  rowHeight,
  gap,
  columnWidth,
  editable = false,
  selected = false,
  onMove,
  onResize,
  onSelect,
  onRemove,
}: GridItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  // `lastX/lastY` (drag) and `lastW/lastH` (resize) track the most recently
  // *emitted* target so the per-move guard compares against it — not against
  // `widget.x/widget.w` frozen in this closure at pointerdown. Those props never
  // update mid-gesture (the document listener is registered once), so guarding
  // on them stuck the guard on the START value: after moving away, returning to
  // the origin cell/size was silently swallowed and the widget never followed
  // the pointer home.
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const resizeStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startW: number;
    startH: number;
    lastW: number;
    lastH: number;
  } | null>(null);
  const dragListenersRef = useRef<{
    move: (ev: PointerEvent) => void;
    end: () => void;
  } | null>(null);
  const resizeListenersRef = useRef<{
    move: (ev: PointerEvent) => void;
    end: () => void;
  } | null>(null);

  const cleanupDragListeners = useCallback(() => {
    const active = dragListenersRef.current;
    if (!active) return;
    document.removeEventListener('pointermove', active.move);
    document.removeEventListener('pointerup', active.end);
    document.removeEventListener('pointercancel', active.end);
    dragListenersRef.current = null;
  }, []);

  const cleanupResizeListeners = useCallback(() => {
    const active = resizeListenersRef.current;
    if (!active) return;
    document.removeEventListener('pointermove', active.move);
    document.removeEventListener('pointerup', active.end);
    document.removeEventListener('pointercancel', active.end);
    resizeListenersRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupDragListeners();
      cleanupResizeListeners();
    };
  }, [cleanupDragListeners, cleanupResizeListeners]);

  const registration = getWidget(widget.type);
  const WidgetComponent = registration?.component;

  // Drag handlers — pointer events so this works for mouse, touch, AND stylus.
  // Mouse-only events meant the resize/drag handles silently did nothing on
  // phones/tablets; pointer events unify both transports.
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (!editable) return;
      // Don't claim secondary mouse buttons (right-click, middle-click).
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      cleanupDragListeners();
      setIsDragging(true);
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startX: widget.x,
        startY: widget.y,
        lastX: widget.x,
        lastY: widget.y,
      };

      const handlePointerMove = (ev: PointerEvent) => {
        if (!dragStartRef.current) return;
        const dx = ev.clientX - dragStartRef.current.mouseX;
        const dy = ev.clientY - dragStartRef.current.mouseY;
        const cellW = columnWidth + gap;
        const cellH = rowHeight + gap;
        const newX = dragStartRef.current.startX + Math.round(dx / cellW);
        const newY = dragStartRef.current.startY + Math.round(dy / cellH);
        // Compare against the last emitted target (persisted in the ref), not
        // the pointerdown-frozen `widget.x/widget.y`, so a return to any earlier
        // cell — including the origin — still fires.
        if (newX !== dragStartRef.current.lastX || newY !== dragStartRef.current.lastY) {
          dragStartRef.current.lastX = newX;
          dragStartRef.current.lastY = newY;
          onMove?.(widget.id, Math.max(0, newX), Math.max(0, newY));
        }
      };

      const handlePointerUp = () => {
        setIsDragging(false);
        dragStartRef.current = null;
        cleanupDragListeners();
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      // pointercancel fires when the OS takes the pointer (e.g. touch interrupted
      // by a system gesture). Treat the same as pointer-up so we never leak
      // dragging-state across releases.
      document.addEventListener('pointercancel', handlePointerUp);
      dragListenersRef.current = {
        move: handlePointerMove,
        end: handlePointerUp,
      };
    },
    [editable, widget.x, widget.y, widget.id, columnWidth, rowHeight, gap, onMove]
  );

  // Resize handlers — same pointer-events conversion as drag.
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      if (!editable) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      cleanupResizeListeners();
      setIsResizing(true);
      resizeStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startW: widget.w,
        startH: widget.h,
        lastW: widget.w,
        lastH: widget.h,
      };

      const handlePointerMove = (ev: PointerEvent) => {
        if (!resizeStartRef.current) return;
        const dx = ev.clientX - resizeStartRef.current.mouseX;
        const dy = ev.clientY - resizeStartRef.current.mouseY;
        const cellW = columnWidth + gap;
        const cellH = rowHeight + gap;
        const newW = resizeStartRef.current.startW + Math.round(dx / cellW);
        const newH = resizeStartRef.current.startH + Math.round(dy / cellH);
        // Guard against the last emitted size, not the frozen `widget.w/h`, so
        // shrinking back to the original size after growing still fires.
        if (newW !== resizeStartRef.current.lastW || newH !== resizeStartRef.current.lastH) {
          resizeStartRef.current.lastW = newW;
          resizeStartRef.current.lastH = newH;
          onResize?.(widget.id, Math.max(1, newW), Math.max(1, newH));
        }
      };

      const handlePointerUp = () => {
        setIsResizing(false);
        resizeStartRef.current = null;
        cleanupResizeListeners();
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerUp);
      resizeListenersRef.current = {
        move: handlePointerMove,
        end: handlePointerUp,
      };
    },
    [editable, widget.w, widget.h, widget.id, columnWidth, rowHeight, gap, onResize]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect?.(selected ? null : widget.id);
    },
    [onSelect, selected, widget.id]
  );

  const widgetProps: WidgetComponentProps = {
    widget,
    editable,
  };

  return (
    <div
      ref={itemRef}
      className={[
        'redgrid-item',
        editable && 'redgrid-item--editable',
        selected && 'redgrid-item--selected',
        isDragging && 'redgrid-item--dragging',
        isResizing && 'redgrid-item--resizing',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        gridColumn: `${widget.x + 1} / span ${widget.w}`,
        gridRow: `${widget.y + 1} / span ${widget.h}`,
      }}
      onClick={handleClick}
    >
      {/* Drag handle — header bar */}
      {editable && (
        <div className="redgrid-item__header" onPointerDown={handleDragStart}>
          <span className="redgrid-item__grip">&#x2630;</span>
          {selected && onRemove && (
            <button
              className="redgrid-item__remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(widget.id);
              }}
              aria-label="Remove widget"
            >
              &times;
            </button>
          )}
        </div>
      )}

      {/* Widget content */}
      <div className="redgrid-item__content">
        {WidgetComponent ? (
          <WidgetComponent {...widgetProps} />
        ) : (
          <div className="redgrid-item__placeholder">
            Unknown widget: {widget.type}
          </div>
        )}
      </div>

      {/* Resize handle — bottom-right corner */}
      {editable && (
        <div className="redgrid-item__resize" onPointerDown={handleResizeStart}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      )}
    </div>
  );
}
