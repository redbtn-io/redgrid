import { describe, expect, it } from 'vitest';
import type { GridWidget } from './types';
import {
  checkCollision,
  clampSize,
  computeRows,
  hasCollisions,
  isWithinBounds,
  pixelToGrid,
  snapToGrid,
  validateLayout,
} from './utils';

function widget(overrides: Partial<GridWidget> & Pick<GridWidget, 'id'>): GridWidget {
  return { type: 'test', x: 0, y: 0, w: 1, h: 1, ...overrides };
}

describe('snapToGrid', () => {
  it('rounds to the nearest multiple of gridSize', () => {
    expect(snapToGrid(23, 10)).toBe(20);
    expect(snapToGrid(26, 10)).toBe(30);
  });

  it('rounds halfway values up', () => {
    expect(snapToGrid(25, 10)).toBe(30);
  });

  it('returns 0 for a value of 0', () => {
    expect(snapToGrid(0, 10)).toBe(0);
  });
});

describe('pixelToGrid', () => {
  it('converts pixel coordinates to column/row indices', () => {
    expect(pixelToGrid(120, 65, 60, 60)).toEqual({ col: 2, row: 1 });
  });

  it('clamps negative pixel coordinates to 0', () => {
    expect(pixelToGrid(-50, -50, 60, 60)).toEqual({ col: 0, row: 0 });
  });
});

describe('checkCollision', () => {
  it('detects overlapping widgets', () => {
    const a = widget({ id: 'a', x: 0, y: 0, w: 2, h: 2 });
    const b = widget({ id: 'b', x: 1, y: 1, w: 2, h: 2 });
    expect(checkCollision(a, b)).toBe(true);
  });

  it('returns false for widgets that only touch edges (no overlap)', () => {
    const a = widget({ id: 'a', x: 0, y: 0, w: 2, h: 2 });
    const b = widget({ id: 'b', x: 2, y: 0, w: 2, h: 2 });
    expect(checkCollision(a, b)).toBe(false);
  });

  it('returns false for a widget compared with itself (same id)', () => {
    const a = widget({ id: 'a', x: 0, y: 0, w: 2, h: 2 });
    const aClone = widget({ id: 'a', x: 0, y: 0, w: 2, h: 2 });
    expect(checkCollision(a, aClone)).toBe(false);
  });

  it('returns false for widgets that are far apart', () => {
    const a = widget({ id: 'a', x: 0, y: 0, w: 1, h: 1 });
    const b = widget({ id: 'b', x: 5, y: 5, w: 1, h: 1 });
    expect(checkCollision(a, b)).toBe(false);
  });
});

describe('hasCollisions', () => {
  it('returns true when the widget overlaps any widget in the list', () => {
    const target = widget({ id: 'target', x: 0, y: 0, w: 2, h: 2 });
    const others = [
      widget({ id: 'other-1', x: 5, y: 5, w: 1, h: 1 }),
      widget({ id: 'other-2', x: 1, y: 1, w: 2, h: 2 }),
    ];
    expect(hasCollisions(target, others)).toBe(true);
  });

  it('returns false when there are no overlaps', () => {
    const target = widget({ id: 'target', x: 0, y: 0, w: 2, h: 2 });
    const others = [
      widget({ id: 'other-1', x: 5, y: 5, w: 1, h: 1 }),
      widget({ id: 'other-2', x: 2, y: 0, w: 2, h: 2 }),
    ];
    expect(hasCollisions(target, others)).toBe(false);
  });

  it('returns false for an empty widget list', () => {
    const target = widget({ id: 'target', x: 0, y: 0, w: 2, h: 2 });
    expect(hasCollisions(target, [])).toBe(false);
  });
});

describe('isWithinBounds', () => {
  it('returns true for a widget fully inside the grid', () => {
    expect(isWithinBounds(widget({ id: 'a', x: 0, y: 0, w: 12, h: 1 }), 12)).toBe(true);
  });

  it('returns false when the widget extends past the right edge', () => {
    expect(isWithinBounds(widget({ id: 'a', x: 10, y: 0, w: 3, h: 1 }), 12)).toBe(false);
  });

  it('returns false for negative x/y', () => {
    expect(isWithinBounds(widget({ id: 'a', x: -1, y: 0, w: 1, h: 1 }), 12)).toBe(false);
    expect(isWithinBounds(widget({ id: 'a', x: 0, y: -1, w: 1, h: 1 }), 12)).toBe(false);
  });

  it('returns false for non-positive width or height', () => {
    expect(isWithinBounds(widget({ id: 'a', x: 0, y: 0, w: 0, h: 1 }), 12)).toBe(false);
    expect(isWithinBounds(widget({ id: 'a', x: 0, y: 0, w: 1, h: 0 }), 12)).toBe(false);
  });
});

describe('clampSize', () => {
  it('clamps below the minimum', () => {
    expect(clampSize(0, 0, 2, 3)).toEqual({ w: 2, h: 3 });
  });

  it('clamps above the maximum', () => {
    expect(clampSize(10, 10, 1, 1, 4, 5)).toEqual({ w: 4, h: 5 });
  });

  it('leaves in-range sizes untouched', () => {
    expect(clampSize(3, 4, 1, 1, 10, 10)).toEqual({ w: 3, h: 4 });
  });

  it('defaults min to 1 and max to Infinity when omitted', () => {
    expect(clampSize(0, 0)).toEqual({ w: 1, h: 1 });
    expect(clampSize(1000, 1000)).toEqual({ w: 1000, h: 1000 });
  });
});

describe('validateLayout', () => {
  it('returns no errors for a valid, non-overlapping layout', () => {
    const widgets = [
      widget({ id: 'a', x: 0, y: 0, w: 2, h: 2 }),
      widget({ id: 'b', x: 2, y: 0, w: 2, h: 2 }),
    ];
    expect(validateLayout(widgets, 12)).toEqual([]);
  });

  it('reports an out-of-bounds widget', () => {
    const widgets = [widget({ id: 'a', x: 10, y: 0, w: 5, h: 1 })];
    const errors = validateLayout(widgets, 12);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('out of bounds');
  });

  it('reports overlapping widgets', () => {
    const widgets = [
      widget({ id: 'a', x: 0, y: 0, w: 2, h: 2 }),
      widget({ id: 'b', x: 1, y: 1, w: 2, h: 2 }),
    ];
    const errors = validateLayout(widgets, 12);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('overlap');
  });

  it('reports duplicate widget ids', () => {
    const widgets = [
      widget({ id: 'dupe', x: 0, y: 0, w: 1, h: 1 }),
      widget({ id: 'dupe', x: 5, y: 5, w: 1, h: 1 }),
    ];
    const errors = validateLayout(widgets, 12);
    expect(errors.some((e) => e.includes('Duplicate widget id'))).toBe(true);
  });
});

describe('computeRows', () => {
  it('returns 1 for an empty layout', () => {
    expect(computeRows([])).toBe(1);
  });

  it('returns the max bottom edge (y + h) across all widgets', () => {
    const widgets = [
      widget({ id: 'a', x: 0, y: 0, w: 1, h: 2 }),
      widget({ id: 'b', x: 1, y: 3, w: 1, h: 4 }),
    ];
    expect(computeRows(widgets)).toBe(7);
  });
});
