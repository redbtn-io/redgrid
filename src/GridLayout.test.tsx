/* @vitest-environment jsdom */

// React's `act` requires this global to be set in a testing environment.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// jsdom does not implement ResizeObserver, which GridLayout constructs to
// measure its container. A no-op stub is enough: container width stays 0 (so
// columnWidth is 0), which does not affect the rendering/selection behavior
// under test here — drag/resize math is covered against explicit columnWidth in
// GridItem.test.tsx.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
  ResizeObserverStub;

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GridLayout } from './GridLayout';
import { clearRegistry } from './registry';
import type { GridWidget } from './types';

function mount(ui: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    layout: () => container.querySelector('.redgrid-layout') as HTMLElement,
    items: () =>
      Array.from(container.querySelectorAll('.redgrid-item')) as HTMLElement[],
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function fire(target: EventTarget, event: Event) {
  act(() => {
    target.dispatchEvent(event);
  });
}

function click(): MouseEvent {
  return new MouseEvent('click', { bubbles: true, cancelable: true });
}

const layout2: GridWidget[] = [
  { id: 'a', type: 'chart', x: 0, y: 0, w: 2, h: 2 },
  { id: 'b', type: 'chart', x: 2, y: 0, w: 2, h: 2 },
];

beforeEach(() => {
  clearRegistry();
});
afterEach(() => {
  clearRegistry();
});

describe('GridLayout — rendering', () => {
  it('renders one GridItem per widget in the layout', () => {
    const { items, unmount } = mount(<GridLayout layout={layout2} />);
    expect(items()).toHaveLength(2);
    unmount();
  });

  it('renders the container with no items for an empty layout', () => {
    const { layout, items, unmount } = mount(<GridLayout layout={[]} />);
    expect(layout()).not.toBeNull();
    expect(items()).toHaveLength(0);
    unmount();
  });

  it('applies base / editable / custom class names', () => {
    const { layout, unmount } = mount(
      <GridLayout layout={layout2} editable className="custom-grid" />
    );
    expect(layout().classList.contains('redgrid-layout')).toBe(true);
    expect(layout().classList.contains('redgrid-layout--editable')).toBe(true);
    expect(layout().classList.contains('custom-grid')).toBe(true);
    unmount();
  });

  it('is not editable by default (no editable class, no item handles)', () => {
    const { layout, container, unmount } = mount(<GridLayout layout={layout2} />);
    expect(layout().classList.contains('redgrid-layout--editable')).toBe(false);
    expect(container.querySelector('.redgrid-item__header')).toBeNull();
    expect(container.querySelector('.redgrid-item__resize')).toBeNull();
    unmount();
  });

  it('computes the CSS grid template and min-height from columns/rowHeight/gap/rows', () => {
    // columns 6, rowHeight 40, gap 12, minRows 4; single widget spans 2 rows,
    // so totalRows = max(minRows=4, computeRows=2) = 4.
    const single: GridWidget[] = [{ id: 'a', type: 'chart', x: 0, y: 0, w: 2, h: 2 }];
    const { layout, unmount } = mount(
      <GridLayout layout={single} columns={6} rowHeight={40} gap={12} minRows={4} />
    );

    const style = layout().style;
    expect(style.display).toBe('grid');
    expect(style.gridTemplateColumns).toBe('repeat(6, 1fr)');
    expect(style.gridTemplateRows).toBe('repeat(4, 40px)');
    expect(style.gap).toBe('12px');
    // 4 rows * 40px + 3 gaps * 12px = 160 + 36 = 196px.
    expect(style.minHeight).toBe('196px');

    unmount();
  });

  it('grows the row count to fit widgets taller than minRows', () => {
    // Widget bottom edge at y+h = 6 exceeds minRows 4 => totalRows = 6.
    const tall: GridWidget[] = [{ id: 'a', type: 'chart', x: 0, y: 3, w: 2, h: 3 }];
    const { layout, unmount } = mount(
      <GridLayout layout={tall} columns={6} rowHeight={40} gap={12} minRows={4} />
    );
    expect(layout().style.gridTemplateRows).toBe('repeat(6, 40px)');
    // 6 rows * 40 + 5 gaps * 12 = 240 + 60 = 300px.
    expect(layout().style.minHeight).toBe('300px');
    unmount();
  });

  it('marks only the widget matching selectedId as selected', () => {
    const { items, unmount } = mount(
      <GridLayout layout={layout2} selectedId="b" />
    );
    const [a, b] = items();
    expect(a.classList.contains('redgrid-item--selected')).toBe(false);
    expect(b.classList.contains('redgrid-item--selected')).toBe(true);
    unmount();
  });
});

describe('GridLayout — selection wiring', () => {
  it('deselects (selects null) when the grid background is clicked', () => {
    const onSelect = vi.fn();
    const { layout, unmount } = mount(
      <GridLayout layout={layout2} onSelect={onSelect} />
    );

    fire(layout(), click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(null);

    unmount();
  });

  it('selects a clicked item and does not also fire the background deselect', () => {
    const onSelect = vi.fn();
    const { items, unmount } = mount(
      <GridLayout layout={layout2} onSelect={onSelect} />
    );

    fire(items()[0], click());
    // Item stopPropagation prevents the background handler firing null.
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('a');

    unmount();
  });

  it('forwards onRemove to the selected item in edit mode', () => {
    const onRemove = vi.fn();
    const onSelect = vi.fn();
    const { container, unmount } = mount(
      <GridLayout
        layout={layout2}
        editable
        selectedId="a"
        onRemove={onRemove}
        onSelect={onSelect}
      />
    );

    const removeBtn = container.querySelector('.redgrid-item__remove') as HTMLElement;
    expect(removeBtn).not.toBeNull();

    fire(removeBtn, click());
    expect(onRemove).toHaveBeenCalledWith('a');
    expect(onSelect).not.toHaveBeenCalled();

    unmount();
  });
});
