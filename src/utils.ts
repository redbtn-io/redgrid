import type { GridWidget } from './types';

/**
 * Snap a value to the nearest grid unit.
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap pixel coordinates to grid column/row positions.
 */
export function pixelToGrid(
  px: number,
  py: number,
  cellWidth: number,
  cellHeight: number
): { col: number; row: number } {
  return {
    col: Math.max(0, Math.round(px / cellWidth)),
    row: Math.max(0, Math.round(py / cellHeight)),
  };
}

/**
 * Check if two widgets overlap.
 */
export function checkCollision(a: GridWidget, b: GridWidget): boolean {
  if (a.id === b.id) return false;
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

/**
 * Check if a widget collides with any other widget in the layout.
 */
export function hasCollisions(widget: GridWidget, widgets: GridWidget[]): boolean {
  return widgets.some((other) => checkCollision(widget, other));
}

/**
 * Validate that a widget fits within the grid bounds.
 */
export function isWithinBounds(widget: GridWidget, columns: number): boolean {
  return (
    widget.x >= 0 &&
    widget.y >= 0 &&
    widget.x + widget.w <= columns &&
    widget.w > 0 &&
    widget.h > 0
  );
}

/**
 * Clamp a widget's dimensions to its min/max constraints.
 */
export function clampSize(
  w: number,
  h: number,
  minW = 1,
  minH = 1,
  maxW = Infinity,
  maxH = Infinity
): { w: number; h: number } {
  return {
    w: Math.min(Math.max(w, minW), maxW),
    h: Math.min(Math.max(h, minH), maxH),
  };
}

/**
 * Validate an entire layout. Returns an array of error messages (empty if valid).
 */
export function validateLayout(widgets: GridWidget[], columns: number): string[] {
  const errors: string[] = [];

  for (const widget of widgets) {
    if (!isWithinBounds(widget, columns)) {
      errors.push(`Widget "${widget.id}" is out of bounds (x:${widget.x}, y:${widget.y}, w:${widget.w}, h:${widget.h})`);
    }
  }

  for (let i = 0; i < widgets.length; i++) {
    for (let j = i + 1; j < widgets.length; j++) {
      if (checkCollision(widgets[i], widgets[j])) {
        errors.push(`Widgets "${widgets[i].id}" and "${widgets[j].id}" overlap`);
      }
    }
  }

  const ids = widgets.map((w) => w.id);
  const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
  for (const dupe of new Set(dupes)) {
    errors.push(`Duplicate widget id: "${dupe}"`);
  }

  return errors;
}

/**
 * Compute the total number of rows needed to fit all widgets.
 */
export function computeRows(widgets: GridWidget[]): number {
  if (widgets.length === 0) return 1;
  return Math.max(...widgets.map((w) => w.y + w.h));
}

/**
 * Generate a unique ID for a new widget.
 */
export function generateId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
