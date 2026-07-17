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

  // Authoritative *synchronous* mirror of the layout. `addWidget` has to decide
  // its return value synchronously, but React batches state updates so the
  // `setWidgets` updater may not have run yet by the time we return. Reading
  // committed state (or a mirror advanced only by `addWidget`) is not enough:
  // a `removeWidget` / `moveWidget` / `resizeWidget` / `setLayout` /
  // `deserialize` batched in the same tick would leave that snapshot stale, so
  // a valid insert could be wrongly rejected as colliding (or an invalid one
  // wrongly accepted). To avoid that, EVERY mutation flows through `commit`,
  // which computes its next layout from `widgetsRef.current` and writes the ref
  // synchronously before scheduling the React state update. The ref is thus
  // never behind a batched mutation, and `addWidget` always validates against
  // the true current layout.
  const widgetsRef = useRef<GridWidget[]>(widgets);

  // Backstop: keep the mirror consistent with committed state after render (a
  // no-op in normal flow, but guards against any state change we didn't route
  // through `commit`).
  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  // Single write path for the layout: advance the synchronous mirror first,
  // then schedule the React state update from the same value. Because the ref
  // is updated before we return, a subsequent mutation in the same tick reads a
  // layout that already reflects this one.
  const commit = useCallback((next: GridWidget[]) => {
    widgetsRef.current = next;
    setWidgets(next);
  }, []);

  const rows = useMemo(() => computeRows(widgets), [widgets]);

  const moveWidget = useCallback(
    (id: string, x: number, y: number) => {
      const prev = widgetsRef.current;
      const idx = prev.findIndex((w) => w.id === id);
      if (idx === -1) return;

      const widget = prev[idx];
      const moved: GridWidget = { ...widget, x, y };

      // Validate bounds
      if (!isWithinBounds(moved, columns)) return;

      // Check collisions with other widgets
      const others = prev.filter((w) => w.id !== id);
      if (hasCollisions(moved, others)) return;

      const next = [...prev];
      next[idx] = moved;
      commit(next);
    },
    [columns, commit]
  );

  const resizeWidget = useCallback(
    (id: string, w: number, h: number) => {
      const prev = widgetsRef.current;
      const idx = prev.findIndex((widget) => widget.id === id);
      if (idx === -1) return;

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

      if (!isWithinBounds(resized, columns)) return;

      const others = prev.filter((other) => other.id !== id);
      if (hasCollisions(resized, others)) return;

      const next = [...prev];
      next[idx] = resized;
      commit(next);
    },
    [columns, commit]
  );

  const addWidget = useCallback(
    (config: Omit<GridItemConfig, 'id'> & { id?: string }): string | null => {
      const id = config.id ?? generateId();
      const newWidget: GridWidget = { ...config, id };

      // Validate synchronously against the authoritative mirror, which reflects
      // every prior mutation in this tick (adds *and* removes/moves/resizes/
      // setLayout/deserialize) — not just the last committed render. A rejected
      // insert (out of bounds / collision) returns `null`; an accepted insert
      // returns its id and is committed through the shared write path.
      const current = widgetsRef.current;
      if (!isWithinBounds(newWidget, columns)) return null;
      if (hasCollisions(newWidget, current)) return null;

      commit([...current, newWidget]);
      return id;
    },
    [columns, commit]
  );

  const removeWidget = useCallback(
    (id: string) => {
      commit(widgetsRef.current.filter((w) => w.id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
    },
    [commit]
  );

  const updateWidgetProps = useCallback(
    (id: string, props: Record<string, unknown>) => {
      commit(
        widgetsRef.current.map((w) =>
          w.id === id ? { ...w, props: { ...w.props, ...props } } : w
        )
      );
    },
    [commit]
  );

  const selectWidget = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  // Serialize the *current* layout. Like `addWidget`'s return value, this is an
  // imperative read: it must reflect every mutation issued in this tick, so it
  // reads the authoritative synchronous mirror (`widgetsRef.current`) that every
  // mutation advances — not the batched `widgets` closure, which can lag a
  // same-tick add/remove/move/resize/setLayout/deserialize and make an
  // "add-then-serialize-to-persist" flow save a stale snapshot. The mirror is
  // never behind committed state (see `commit` + the backstop effect), so
  // post-render serialization is unchanged.
  const serialize = useCallback((): SerializedLayout => {
    return {
      columns,
      rowHeight,
      gap,
      widgets: widgetsRef.current.map(({ selected, ...rest }) => rest),
    };
  }, [columns, rowHeight, gap]);

  // Drop a dangling selection: if a wholesale layout replacement no longer
  // contains the selected widget, clear it. Mirrors the invariant `removeWidget`
  // already maintains — `selectedId` must reference a live widget or be null, or
  // consumers keyed off it (inspector panels, a toolbar remove wired to
  // `removeWidget(selectedId)`) act on a widget that no longer exists. Uses the
  // functional updater so it reads the latest selection even when batched with
  // other mutations in the same tick.
  const reconcileSelection = useCallback((next: GridWidget[]) => {
    setSelectedId((prev) =>
      prev !== null && !next.some((w) => w.id === prev) ? null : prev
    );
  }, []);

  const deserialize = useCallback(
    (data: SerializedLayout) => {
      const next = data.widgets.map((w) => ({ ...w }));
      commit(next);
      reconcileSelection(next);
    },
    [commit, reconcileSelection]
  );

  const setLayout = useCallback(
    (newWidgets: GridItemConfig[]) => {
      const next = newWidgets.map((w) => ({ ...w }));
      commit(next);
      reconcileSelection(next);
    },
    [commit, reconcileSelection]
  );

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
