import React, { useCallback, useRef, useState } from 'react';
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
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startW: number; startH: number } | null>(null);

  const registration = getWidget(widget.type);
  const WidgetComponent = registration?.component;

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startX: widget.x,
        startY: widget.y,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragStartRef.current) return;
        const dx = ev.clientX - dragStartRef.current.mouseX;
        const dy = ev.clientY - dragStartRef.current.mouseY;
        const cellW = columnWidth + gap;
        const cellH = rowHeight + gap;
        const newX = dragStartRef.current.startX + Math.round(dx / cellW);
        const newY = dragStartRef.current.startY + Math.round(dy / cellH);
        if (newX !== widget.x || newY !== widget.y) {
          onMove?.(widget.id, Math.max(0, newX), Math.max(0, newY));
        }
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        dragStartRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [editable, widget.x, widget.y, widget.id, columnWidth, rowHeight, gap, onMove]
  );

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (!editable) return;
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      resizeStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        startW: widget.w,
        startH: widget.h,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!resizeStartRef.current) return;
        const dx = ev.clientX - resizeStartRef.current.mouseX;
        const dy = ev.clientY - resizeStartRef.current.mouseY;
        const cellW = columnWidth + gap;
        const cellH = rowHeight + gap;
        const newW = resizeStartRef.current.startW + Math.round(dx / cellW);
        const newH = resizeStartRef.current.startH + Math.round(dy / cellH);
        if (newW !== widget.w || newH !== widget.h) {
          onResize?.(widget.id, Math.max(1, newW), Math.max(1, newH));
        }
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        resizeStartRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
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
        <div className="redgrid-item__header" onMouseDown={handleDragStart}>
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
        <div className="redgrid-item__resize" onMouseDown={handleResizeStart}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      )}
    </div>
  );
}
