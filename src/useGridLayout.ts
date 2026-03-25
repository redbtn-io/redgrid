import { useState, useCallback, useMemo } from 'react';
import type { GridLayoutConfig, GridWidget, GridItemConfig, SerializedLayout } from './types';
import { clampSize, hasCollisions, isWithinBounds, computeRows, generateId } from './utils';

export interface UseGridLayoutReturn {
  /** Current widget layout state */
  layout: GridWidget[];
  /** Number of grid columns */
  columns: number;
  /** Row height in pixels */
  rowHeight: number;
  /** Gap between items in pixels */
  gap: number;
  /** Computed total rows */
  rows: number;
  /** Currently selected widget id */
  selectedId: string | null;
  /** Move a widget to a new grid position */
  moveWidget: (id: string, x: number, y: number) => void;
  /** Resize a widget */
  resizeWidget: (id: string, w: number, h: number) => void;
  /** Add a new widget to the layout */
  addWidget: (config: Omit<GridItemConfig, 'id'> & { id?: string }) => string;
  /** Remove a widget from the layout */
  removeWidget: (id: string) => void;
  /** Update widget props */
  updateWidgetProps: (id: string, props: Record<string, unknown>) => void;
  /** Select a widget (or null to deselect) */
  selectWidget: (id: string | null) => void;
  /** Serialize layout to JSON-compatible object */
  serialize: () => SerializedLayout;
  /** Deserialize and restore a layout */
  deserialize: (data: SerializedLayout) => void;
  /** Replace entire layout */
  setLayout: (widgets: GridItemConfig[]) => void;
}

/**
 * Hook for managing grid layout state.
 * Handles widget positions, sizes, add/remove/move/resize operations,
 * and serialization for persistence.
 */
export function useGridLayout(config: GridLayoutConfig = {}): UseGridLayoutReturn {
  const columns = config.columns ?? 12;
  const rowHeight = config.rowHeight ?? 60;
  const gap = config.gap ?? 8;

  const [widgets, setWidgets] = useState<GridWidget[]>(
    () => (config.widgets ?? []).map((w) => ({ ...w }))
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => computeRows(widgets), [widgets]);

  const moveWidget = useCallback(
    (id: string, x: number, y: number) => {
      setWidgets((prev) => {
        const idx = prev.findIndex((w) => w.id === id);
        if (idx === -1) return prev;

        const widget = prev[idx];
        const moved: GridWidget = { ...widget, x, y };

        // Validate bounds
        if (!isWithinBounds(moved, columns)) return prev;

        // Check collisions with other widgets
        const others = prev.filter((w) => w.id !== id);
        if (hasCollisions(moved, others)) return prev;

        const next = [...prev];
        next[idx] = moved;
        return next;
      });
    },
    [columns]
  );

  const resizeWidget = useCallback(
    (id: string, w: number, h: number) => {
      setWidgets((prev) => {
        const idx = prev.findIndex((widget) => widget.id === id);
        if (idx === -1) return prev;

        const widget = prev[idx];
        const { w: clampedW, h: clampedH } = clampSize(
          w,
          h,
          widget.minW,
          widget.minH,
          widget.maxW,
          widget.maxH
        );
        const resized: GridWidget = { ...widget, w: clampedW, h: clampedH };

        if (!isWithinBounds(resized, columns)) return prev;

        const others = prev.filter((other) => other.id !== id);
        if (hasCollisions(resized, others)) return prev;

        const next = [...prev];
        next[idx] = resized;
        return next;
      });
    },
    [columns]
  );

  const addWidget = useCallback(
    (config: Omit<GridItemConfig, 'id'> & { id?: string }): string => {
      const id = config.id ?? generateId();
      const newWidget: GridWidget = { ...config, id };

      setWidgets((prev) => {
        if (!isWithinBounds(newWidget, columns)) return prev;
        if (hasCollisions(newWidget, prev)) return prev;
        return [...prev, newWidget];
      });

      return id;
    },
    [columns]
  );

  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }, []);

  const updateWidgetProps = useCallback(
    (id: string, props: Record<string, unknown>) => {
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, props: { ...w.props, ...props } } : w
        )
      );
    },
    []
  );

  const selectWidget = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const serialize = useCallback((): SerializedLayout => {
    return {
      columns,
      rowHeight,
      gap,
      widgets: widgets.map(({ selected, ...rest }) => rest),
    };
  }, [columns, rowHeight, gap, widgets]);

  const deserialize = useCallback((data: SerializedLayout) => {
    setWidgets(data.widgets.map((w) => ({ ...w })));
  }, []);

  const setLayout = useCallback((newWidgets: GridItemConfig[]) => {
    setWidgets(newWidgets.map((w) => ({ ...w })));
  }, []);

  return {
    layout: widgets,
    columns,
    rowHeight,
    gap,
    rows,
    selectedId,
    moveWidget,
    resizeWidget,
    addWidget,
    removeWidget,
    updateWidgetProps,
    selectWidget,
    serialize,
    deserialize,
    setLayout,
  };
}
