import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import type { GridWidget } from './types';
import type { OnMoveCallback, OnResizeCallback, OnRemoveCallback, OnSelectCallback } from './types';
import { GridItem } from './GridItem';
import { computeRows } from './utils';

export interface GridLayoutProps {
  /** Array of widget configurations to render */
  layout: GridWidget[];
  /** Number of columns (default: 12) */
  columns?: number;
  /** Row height in pixels (default: 60) */
  rowHeight?: number;
  /** Gap between items in pixels (default: 8) */
  gap?: number;
  /** Enable edit mode (drag, resize, remove) */
  editable?: boolean;
  /** Currently selected widget id */
  selectedId?: string | null;
  /** Called when a widget is moved */
  onMove?: OnMoveCallback;
  /** Called when a widget is resized */
  onResize?: OnResizeCallback;
  /** Called when a widget is removed */
  onRemove?: OnRemoveCallback;
  /** Called when a widget is selected/deselected */
  onSelect?: OnSelectCallback;
  /** Additional class name */
  className?: string;
  /** Minimum number of rows to display */
  minRows?: number;
}

/**
 * Main grid container. Renders a CSS Grid with the specified number of columns
 * and places GridItem components at their configured positions.
 */
export function GridLayout({
  layout,
  columns = 12,
  rowHeight = 60,
  gap = 8,
  editable = false,
  selectedId = null,
  onMove,
  onResize,
  onRemove,
  onSelect,
  className,
  minRows = 4,
}: GridLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width for computing column pixel sizes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const totalRows = Math.max(minRows, computeRows(layout));

  // Compute pixel width of a single column (accounting for gaps)
  const columnWidth = useMemo(() => {
    if (containerWidth === 0) return 0;
    return (containerWidth - gap * (columns - 1)) / columns;
  }, [containerWidth, columns, gap]);

  const handleBackgroundClick = useCallback(() => {
    onSelect?.(null);
  }, [onSelect]);

  return (
    <div
      ref={containerRef}
      className={['redgrid-layout', editable && 'redgrid-layout--editable', className]
        .filter(Boolean)
        .join(' ')}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${totalRows}, ${rowHeight}px)`,
        gap: `${gap}px`,
        position: 'relative',
        minHeight: `${totalRows * rowHeight + (totalRows - 1) * gap}px`,
      }}
      onClick={handleBackgroundClick}
    >
      {layout.map((widget) => (
        <GridItem
          key={widget.id}
          widget={widget}
          rowHeight={rowHeight}
          gap={gap}
          columnWidth={columnWidth}
          editable={editable}
          selected={selectedId === widget.id}
          onMove={onMove}
          onResize={onResize}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
