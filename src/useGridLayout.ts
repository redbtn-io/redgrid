import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
  addWidget: (config: Omit<GridItemConfig, 'id'> & { id?: string }) => string | null;
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

  // Authoritative mirror of the committed layout. `addWidget` needs to decide
  // its return value synchronously, but React batches state updates so the
  // `setWidgets` updater may not have run yet by the time we return. This ref
  // is resynced to committed state after every render and is also advanced
  // synchronously by `addWidget`, so a batch of adds in the same tick validate
  // against each other rather than only against the last committed render.
  const widgetsRef = useRef<GridWidget[]>(widgets);
  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

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
    (config: Omit<GridItemConfig, 'id'> & { id?: string }): string | null => {
      const id = config.id ?? generateId();
      const newWidget: GridWidget = { ...config, id };

      // Decide the result synchronously against the authoritative layout. We
      // must not rely on a flag mutated inside the `setWidgets` updater: React
      // may run that updater later (updates are batched), which previously made
      // successful adds report `null`. Validating here against `widgetsRef`
      // guarantees a rejected insert (out of bounds / collision) returns `null`
      // and an accepted insert returns its id, even for adds batched together.
      const current = widgetsRef.current;
      if (!isWithinBounds(newWidget, columns)) return null;
      if (hasCollisions(newWidget, current)) return null;

      const next = [...current, newWidget];
      // Advance the mirror before scheduling state so a later add in the same
      // tick sees this insertion and can reject a colliding one.
      widgetsRef.current = next;
      setWidgets((prev) =>
        isWithinBounds(newWidget, columns) && !hasCollisions(newWidget, prev)
          ? [...prev, newWidget]
          : prev
      );

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
