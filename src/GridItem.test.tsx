/* @vitest-environment jsdom */

// React's `act` requires this global to be set in a testing environment.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GridItem } from './GridItem';
import { clearRegistry, registerWidget } from './registry';
import type { GridWidget, WidgetComponentProps } from './types';

/**
 * Minimal render harness (raw `react-dom/client` + `act`) mirroring the style
 * already used by `useGridLayout.test.tsx`, so the components can be exercised
 * against jsdom without pulling in an extra testing library.
 */
function mount(ui: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    item: () => container.querySelector('.redgrid-item') as HTMLElement,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Dispatch a real DOM event wrapped in `act` so React state updates flush. */
function fire(target: EventTarget, event: Event) {
  act(() => {
    target.dispatchEvent(event);
  });
}

/**
 * Build a real `PointerEvent`. jsdom 29 implements the full constructor, so the
 * handlers see genuine `clientX/clientY/button/pointerType` values — matching
 * how GridItem's pointer-based drag/resize actually reads its input.
 */
function pointer(type: string, init: PointerEventInit = {}): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    pointerType: 'mouse',
    clientX: 0,
    clientY: 0,
    ...init,
  });
}

function click(): MouseEvent {
  return new MouseEvent('click', { bubbles: true, cancelable: true });
}

function keyDown(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
    ...init,
  });
}

const baseWidget: GridWidget = { id: 'w1', type: 'chart', x: 1, y: 1, w: 2, h: 2 };

// The registry is a module-level singleton — reset between tests.
beforeEach(() => {
  clearRegistry();
});
afterEach(() => {
  clearRegistry();
});

describe('GridItem — rendering', () => {
  it('renders the registered widget component inside the content area', () => {
    const Chart = ({ widget }: WidgetComponentProps) => (
      <div data-testid="chart">chart-{widget.id}</div>
    );
    registerWidget('chart', Chart);

    const { container, unmount } = mount(
      <GridItem widget={baseWidget} rowHeight={50} gap={10} columnWidth={100} />
    );

    const content = container.querySelector('.redgrid-item__content');
    const rendered = container.querySelector('[data-testid="chart"]');
    expect(content?.contains(rendered ?? null)).toBe(true);
    expect(rendered?.textContent).toBe('chart-w1');

    unmount();
  });

  it('renders a placeholder for an unregistered widget type', () => {
    const { container, unmount } = mount(
      <GridItem
        widget={{ ...baseWidget, type: 'nope' }}
        rowHeight={50}
        gap={10}
        columnWidth={100}
      />
    );

    const placeholder = container.querySelector('.redgrid-item__placeholder');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent).toContain('Unknown widget: nope');

    unmount();
  });

  it('positions the item with grid-column / grid-row from x/y/w/h', () => {
    const { item, unmount } = mount(
      <GridItem widget={baseWidget} rowHeight={50} gap={10} columnWidth={100} />
    );

    // x:1 -> column 2 spanning 2; y:1 -> row 2 spanning 2 (1-based grid lines).
    expect(item().style.gridColumn).toBe('2 / span 2');
    expect(item().style.gridRow).toBe('2 / span 2');

    unmount();
  });

  it('hides the drag/resize handles when not editable', () => {
    const { container, unmount } = mount(
      <GridItem widget={baseWidget} rowHeight={50} gap={10} columnWidth={100} />
    );

    expect(container.querySelector('.redgrid-item__header')).toBeNull();
    expect(container.querySelector('.redgrid-item__resize')).toBeNull();

    unmount();
  });

  it('shows the drag/resize handles when editable', () => {
    const { container, unmount } = mount(
      <GridItem widget={baseWidget} rowHeight={50} gap={10} columnWidth={100} editable />
    );

    expect(container.querySelector('.redgrid-item__header')).not.toBeNull();
    expect(container.querySelector('.redgrid-item__resize')).not.toBeNull();

    unmount();
  });

  it('reflects editable / selected state in the class list', () => {
    const { item, unmount } = mount(
      <GridItem widget={baseWidget} rowHeight={50} gap={10} columnWidth={100} editable selected />
    );

    expect(item().classList.contains('redgrid-item')).toBe(true);
    expect(item().classList.contains('redgrid-item--editable')).toBe(true);
    expect(item().classList.contains('redgrid-item--selected')).toBe(true);

    unmount();
  });
});

describe('GridItem — click-to-select', () => {
  it('selects the widget on click when not selected', () => {
    const onSelect = vi.fn();
    const { item, unmount } = mount(
      <GridItem
        widget={baseWidget}
        rowHeight={50}
        gap={10}
        columnWidth={100}
        onSelect={onSelect}
      />
    );

    fire(item(), click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('w1');

    unmount();
  });

  it('toggles selection off (selects null) when already selected', () => {
    const onSelect = vi.fn();
    const { item, unmount } = mount(
      <GridItem
        widget={baseWidget}
        rowHeight={50}
        gap={10}
        columnWidth={100}
        selected
        onSelect={onSelect}
      />
    );

    fire(item(), click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(null);

    unmount();
  });

  it('removes via the remove button without triggering select (stopPropagation)', () => {
    const onRemove = vi.fn();
    const onSelect = vi.fn();
    const { container, unmount } = mount(
      <GridItem
        widget={baseWidget}
        rowHeight={50}
        gap={10}
        columnWidth={100}
        editable
        selected
        onRemove={onRemove}
        onSelect={onSelect}
      />
    );

    const removeBtn = container.querySelector('.redgrid-item__remove') as HTMLElement;
    expect(removeBtn).not.toBeNull();

    fire(removeBtn, click());
    expect(onRemove).toHaveBeenCalledWith('w1');
    // The click must not bubble up to the item's select handler.
    expect(onSelect).not.toHaveBeenCalled();

    unmount();
  });

  it('does not render the remove button unless editable, selected, and onRemove are all present', () => {
    const onRemove = vi.fn();
    // selected but not editable -> no header, no remove button.
    const { container, unmount } = mount(
      <GridItem
        widget={baseWidget}
        rowHeight={50}
        gap={10}
        columnWidth={100}
        selected
        onRemove={onRemove}
      />
    );
    expect(container.querySelector('.redgrid-item__remove')).toBeNull();
    unmount();
  });
});

describe('GridItem — drag to move', () => {
  // columnWidth 100 + gap 10 => 110px per column-cell; rowHeight 50 + gap 10 => 60px per row-cell.
  const dragProps = { rowHeight: 50, gap: 10, columnWidth: 100, editable: true } as const;

  it('moves by one grid cell per cell-sized pointer delta', () => {
    const onMove = vi.fn();
    const { container, item, unmount } = mount(
      <GridItem widget={baseWidget} {...dragProps} onMove={onMove} />
    );
    const header = container.querySelector('.redgrid-item__header') as HTMLElement;

    fire(header, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(item().classList.contains('redgrid-item--dragging')).toBe(true);

    // +110px x, +60px y => +1 column, +1 row => (1+1, 1+1) = (2, 2).
    fire(document, pointer('pointermove', { clientX: 110, clientY: 60 }));
    expect(onMove).toHaveBeenCalledWith('w1', 2, 2);

    fire(document, pointer('pointerup'));
    expect(item().classList.contains('redgrid-item--dragging')).toBe(false);

    unmount();
  });

  it('clamps the moved position to non-negative coordinates', () => {
    const onMove = vi.fn();
    const widget: GridWidget = { ...baseWidget, x: 0, y: 0 };
    const { container, unmount } = mount(
      <GridItem widget={widget} {...dragProps} onMove={onMove} />
    );
    const header = container.querySelector('.redgrid-item__header') as HTMLElement;

    fire(header, pointer('pointerdown', { clientX: 200, clientY: 200 }));
    // Drag far up-left; the raw target is negative but must clamp to 0.
    fire(document, pointer('pointermove', { clientX: 0, clientY: 0 }));
    expect(onMove).toHaveBeenCalledWith('w1', 0, 0);

    unmount();
  });

  it('does not fire onMove for a sub-cell delta that rounds to the same cell', () => {
    const onMove = vi.fn();
    const { container, unmount } = mount(
      <GridItem widget={baseWidget} {...dragProps} onMove={onMove} />
    );
    const header = container.querySelector('.redgrid-item__header') as HTMLElement;

    fire(header, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    fire(document, pointer('pointermove', { clientX: 20, clientY: 20 }));
    expect(onMove).not.toHaveBeenCalled();

    fire(document, pointer('pointerup'));
    unmount();
  });

  it('moves with keyboard arrows from the move handle', () => {
    const onMove = vi.fn();
    const { container, unmount } = mount(
      <GridItem widget={baseWidget} {...dragProps} onMove={onMove} />
    );
    const header = container.querySelector('.redgrid-item__header') as HTMLElement;

    header.focus();
    fire(header, keyDown('ArrowRight'));
    expect(onMove).toHaveBeenCalledWith('w1', 2, 1);

    fire(header, keyDown('ArrowDown'));
    expect(onMove).toHaveBeenCalledWith('w1', 2, 2);

    unmount();
  });

  it('ignores non-primary mouse buttons', () => {
    const onMove = vi.fn();
    const { container, item, unmount } = mount(
      <GridItem widget={baseWidget} {...dragProps} onMove={onMove} />
    );
    const header = container.querySelector('.redgrid-item__header') as HTMLElement;

    fire(header, pointer('pointerdown', { button: 2, clientX: 0, clientY: 0 }));
    expect(item().classList.contains('redgrid-item--dragging')).toBe(false);

    fire(document, pointer('pointermove', { clientX: 300, clientY: 300 }));
    expect(onMove).not.toHaveBeenCalled();

    unmount();
  });

  it('re-emits the origin cell when dragged away and back within one gesture', () => {
    // Regression: the move guard used to compare each new target against
    // `widget.x/widget.y` captured at pointerdown (frozen for the whole drag,
    // since the document listener is registered once). That froze the guard on
    // the START cell, so returning the pointer to the origin cell — after moving
    // away — never re-emitted onMove. The widget stayed stuck at the last
    // distinct cell instead of following the pointer home. The guard must track
    // the last *emitted* target, not the start position.
    const onMove = vi.fn();
    const { container, unmount } = mount(
      <GridItem widget={baseWidget} {...dragProps} onMove={onMove} />
    );
    const header = container.querySelector('.redgrid-item__header') as HTMLElement;

    // baseWidget starts at (1, 1). cell-cells are 110px (x) / 60px (y).
    fire(header, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    // Drag +2 cols / +2 rows => (3, 3).
    fire(document, pointer('pointermove', { clientX: 220, clientY: 120 }));
    expect(onMove).toHaveBeenLastCalledWith('w1', 3, 3);
    // Return the pointer to the origin => must emit the original (1, 1).
    fire(document, pointer('pointermove', { clientX: 0, clientY: 0 }));
    expect(onMove).toHaveBeenLastCalledWith('w1', 1, 1);

    fire(document, pointer('pointerup'));
    unmount();
  });

  it('detaches the document listeners after pointer-up (no moves leak past release)', () => {
    const onMove = vi.fn();
    const { container, unmount } = mount(
      <GridItem widget={baseWidget} {...dragProps} onMove={onMove} />
    );
    const header = container.querySelector('.redgrid-item__header') as HTMLElement;

    fire(header, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    fire(document, pointer('pointerup'));
    onMove.mockClear();

    fire(document, pointer('pointermove', { clientX: 500, clientY: 500 }));
    expect(onMove).not.toHaveBeenCalled();

    unmount();
  });

  it('cleans up drag listeners when the component unmounts mid-gesture', () => {
    const onMove = vi.fn();
    const { container, unmount } = mount(
      <GridItem widget={baseWidget} {...dragProps} onMove={onMove} />
    );
    const header = container.querySelector('.redgrid-item__header') as HTMLElement;

    fire(header, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(onMove).not.toHaveBeenCalled();

    // Simulate an external rerender that removes the widget before pointer-up.
    // Old listeners from this gesture must be removed so we do not keep stale
    // interactions alive after unmount.
    unmount();
    // Dispatch one more move through the global document listener.
    fire(document, pointer('pointermove', { clientX: 500, clientY: 500 }));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('ends the drag on pointercancel (OS-interrupted gesture)', () => {
    const onMove = vi.fn();
    const { container, item, unmount } = mount(
      <GridItem widget={baseWidget} {...dragProps} onMove={onMove} />
    );
    const header = container.querySelector('.redgrid-item__header') as HTMLElement;

    fire(header, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(item().classList.contains('redgrid-item--dragging')).toBe(true);

    fire(document, pointer('pointercancel'));
    expect(item().classList.contains('redgrid-item--dragging')).toBe(false);

    // After cancel, listeners are gone: further moves must not fire onMove.
    fire(document, pointer('pointermove', { clientX: 500, clientY: 500 }));
    expect(onMove).not.toHaveBeenCalled();

    unmount();
  });
});

describe('GridItem — resize', () => {
  const resizeProps = { rowHeight: 50, gap: 10, columnWidth: 100, editable: true } as const;

  it('resizes by one grid cell per cell-sized pointer delta', () => {
    const onResize = vi.fn();
    const { container, item, unmount } = mount(
      <GridItem widget={baseWidget} {...resizeProps} onResize={onResize} />
    );
    const handle = container.querySelector('.redgrid-item__resize') as HTMLElement;

    fire(handle, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    expect(item().classList.contains('redgrid-item--resizing')).toBe(true);

    // +110px w, +60px h => +1 col, +1 row => (2+1, 2+1) = (3, 3).
    fire(document, pointer('pointermove', { clientX: 110, clientY: 60 }));
    expect(onResize).toHaveBeenCalledWith('w1', 3, 3);

    fire(document, pointer('pointerup'));
    expect(item().classList.contains('redgrid-item--resizing')).toBe(false);

    unmount();
  });

  it('clamps width/height to a minimum of 1 cell', () => {
    const onResize = vi.fn();
    const { container, unmount } = mount(
      <GridItem widget={baseWidget} {...resizeProps} onResize={onResize} />
    );
    const handle = container.querySelector('.redgrid-item__resize') as HTMLElement;

    fire(handle, pointer('pointerdown', { clientX: 330, clientY: 0 }));
    // -330px => -3 columns => 2-3 = -1, clamped to 1. Height unchanged (stays 2).
    fire(document, pointer('pointermove', { clientX: 0, clientY: 0 }));
    expect(onResize).toHaveBeenCalledWith('w1', 1, 2);

    unmount();
  });

  it('re-emits the original size when resized larger and back within one gesture', () => {
    // Same regression class as drag: the resize guard compared against
    // `widget.w/widget.h` frozen at pointerdown, so shrinking back to the
    // starting size (after growing) never re-emitted onResize.
    const onResize = vi.fn();
    const { container, unmount } = mount(
      <GridItem widget={baseWidget} {...resizeProps} onResize={onResize} />
    );
    const handle = container.querySelector('.redgrid-item__resize') as HTMLElement;

    // baseWidget is 2x2.
    fire(handle, pointer('pointerdown', { clientX: 0, clientY: 0 }));
    // Grow +1 col / +1 row => (3, 3).
    fire(document, pointer('pointermove', { clientX: 110, clientY: 60 }));
    expect(onResize).toHaveBeenLastCalledWith('w1', 3, 3);
    // Return to the start => must emit the original (2, 2).
    fire(document, pointer('pointermove', { clientX: 0, clientY: 0 }));
    expect(onResize).toHaveBeenLastCalledWith('w1', 2, 2);

    fire(document, pointer('pointerup'));
    unmount();
  });

  it('resizes with keyboard arrows from the resize handle', () => {
    const onResize = vi.fn();
    const { container, unmount } = mount(
      <GridItem widget={baseWidget} {...resizeProps} onResize={onResize} />
    );
    const handle = container.querySelector('.redgrid-item__resize') as HTMLElement;

    handle.focus();
    fire(handle, keyDown('ArrowRight'));
    expect(onResize).toHaveBeenCalledWith('w1', 3, 2);

    fire(handle, keyDown('ArrowDown'));
    expect(onResize).toHaveBeenCalledWith('w1', 3, 3);

    unmount();
  });

  it('ignores non-primary mouse buttons on the resize handle', () => {
    const onResize = vi.fn();
    const { container, item, unmount } = mount(
      <GridItem widget={baseWidget} {...resizeProps} onResize={onResize} />
    );
    const handle = container.querySelector('.redgrid-item__resize') as HTMLElement;

    fire(handle, pointer('pointerdown', { button: 1, clientX: 0, clientY: 0 }));
    expect(item().classList.contains('redgrid-item--resizing')).toBe(false);

    fire(document, pointer('pointermove', { clientX: 300, clientY: 300 }));
    expect(onResize).not.toHaveBeenCalled();

    unmount();
  });

  it('cleans up resize listeners when the component unmounts mid-gesture', () => {
    const onResize = vi.fn();
    const { container, unmount } = mount(
      <GridItem widget={baseWidget} {...resizeProps} onResize={onResize} />
    );
    const handle = container.querySelector('.redgrid-item__resize') as HTMLElement;

    fire(handle, pointer('pointerdown', { clientX: 0, clientY: 0 }));

    // Simulate unmount without a final pointerup.
    unmount();
    fire(document, pointer('pointermove', { clientX: 110, clientY: 60 }));
    expect(onResize).not.toHaveBeenCalled();
  });
});
