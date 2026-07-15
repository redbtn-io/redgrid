/* @vitest-environment jsdom */

// React's `act` requires this global to be set in a testing environment.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGridLayout } from './useGridLayout';
import { describe, expect, it } from 'vitest';

/**
 * Render a lightweight hook harness so we can exercise `useGridLayout` in tests
 * without introducing additional test libraries.
 */
function mountUseGridLayout() {
  const mountPoint = document.createElement('div');
  document.body.appendChild(mountPoint);

  const apiRef: {
    current: ReturnType<typeof useGridLayout> | null;
  } = {
    current: null,
  };

  const HookHarness = () => {
    const api = useGridLayout({
      columns: 2,
    });
    apiRef.current = api;
    return null;
  };

  const root: Root = createRoot(mountPoint);
  act(() => {
    root.render(<HookHarness />);
  });

  return {
    apiRef,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      mountPoint.remove();
    },
  };
}

describe('useGridLayout', () => {
  it('returns the widget id when addWidget succeeds', () => {
    const { apiRef, unmount } = mountUseGridLayout();
    let addedId: string | null = null;

    act(() => {
      addedId = apiRef.current!.addWidget({
        type: 'chart',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
      });
    });

    expect(addedId).toBeTypeOf('string');
    expect(apiRef.current?.layout).toHaveLength(1);
    expect(apiRef.current?.layout[0]?.id).toBe(addedId);

    unmount();
  });

  it('returns null when addWidget would place a widget out of bounds', () => {
    const { apiRef, unmount } = mountUseGridLayout();
    let addedId: string | null = 'fallback';

    act(() => {
      addedId = apiRef.current!.addWidget({
        type: 'chart',
        x: 1,
        y: 0,
        w: 2,
        h: 1,
      });
    });

    expect(addedId).toBeNull();
    expect(apiRef.current?.layout).toHaveLength(0);

    unmount();
  });

  it('returns null when addWidget would collide with an existing widget', () => {
    const { apiRef, unmount } = mountUseGridLayout();
    let secondId: string | null = null;

    act(() => {
      const first = apiRef.current!.addWidget({
        type: 'chart',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
      });
      secondId = apiRef.current!.addWidget({
        type: 'chart',
        x: 0,
        y: 0,
        w: 1,
        h: 1,
      });
      expect(first).toBeTypeOf('string');
    });

    expect(secondId).toBeNull();
    expect(apiRef.current?.layout).toHaveLength(1);

    unmount();
  });

  // Regression: a second *successful* add batched in the same tick used to
  // return `null` because the code read a flag mutated inside the (deferred)
  // state updater. Both valid adds must report their ids and both must land.
  it('returns a non-null id for every valid add batched in the same tick', () => {
    const { apiRef, unmount } = mountUseGridLayout();
    let firstId: string | null = null;
    let secondId: string | null = null;

    act(() => {
      firstId = apiRef.current!.addWidget({ type: 'chart', x: 0, y: 0, w: 1, h: 1 });
      secondId = apiRef.current!.addWidget({ type: 'chart', x: 1, y: 0, w: 1, h: 1 });
    });

    expect(firstId).toBeTypeOf('string');
    expect(secondId).toBeTypeOf('string');
    expect(firstId).not.toBe(secondId);
    expect(apiRef.current?.layout).toHaveLength(2);
    const ids = apiRef.current?.layout.map((w) => w.id);
    expect(ids).toContain(firstId);
    expect(ids).toContain(secondId);

    unmount();
  });

  // Regression: the reviewer-flagged remaining path — a rejected add batched
  // *after* an accepted add must still return `null` (validated against the
  // just-inserted widget, not only the last committed render).
  it('rejects a colliding add batched after an accepted add without a false-positive id', () => {
    const { apiRef, unmount } = mountUseGridLayout();
    let acceptedId: string | null = null;
    let collidingId: string | null = 'fallback';
    let outOfBoundsId: string | null = 'fallback';

    act(() => {
      acceptedId = apiRef.current!.addWidget({ type: 'chart', x: 0, y: 0, w: 1, h: 1 });
      // Collides with the widget just added above.
      collidingId = apiRef.current!.addWidget({ type: 'chart', x: 0, y: 0, w: 1, h: 1 });
      // Extends past the 2-column grid.
      outOfBoundsId = apiRef.current!.addWidget({ type: 'chart', x: 1, y: 1, w: 2, h: 1 });
    });

    expect(acceptedId).toBeTypeOf('string');
    expect(collidingId).toBeNull();
    expect(outOfBoundsId).toBeNull();
    expect(apiRef.current?.layout).toHaveLength(1);
    expect(apiRef.current?.layout[0]?.id).toBe(acceptedId);

    unmount();
  });

  // A rejected add must not consume the slot for a later valid add in the same
  // tick, and the valid one must report its id.
  it('still accepts a valid add batched after a rejected add', () => {
    const { apiRef, unmount } = mountUseGridLayout();
    let rejectedId: string | null = 'fallback';
    let acceptedId: string | null = null;

    act(() => {
      // Out of bounds -> rejected.
      rejectedId = apiRef.current!.addWidget({ type: 'chart', x: 1, y: 0, w: 2, h: 1 });
      // Valid, non-colliding -> accepted.
      acceptedId = apiRef.current!.addWidget({ type: 'chart', x: 0, y: 0, w: 1, h: 1 });
    });

    expect(rejectedId).toBeNull();
    expect(acceptedId).toBeTypeOf('string');
    expect(apiRef.current?.layout).toHaveLength(1);
    expect(apiRef.current?.layout[0]?.id).toBe(acceptedId);

    unmount();
  });
});
