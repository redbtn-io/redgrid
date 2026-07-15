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

  // Regression (round 3): the synchronous mirror `addWidget` validates against
  // was only advanced by `addWidget` itself, so a *non-add* mutation
  // (remove/move/resize/setLayout/deserialize) batched in the same tick left it
  // stale. `addWidget` would then treat an already-freed slot as occupied and
  // wrongly reject a valid insert. The mirror must reflect every mutation.
  it('validates a batched add against a slot freed by a remove earlier in the same tick', () => {
    const { apiRef, unmount } = mountUseGridLayout();
    let aId: string | null = null;

    // Seed a widget occupying (0,0) in its own tick so the mirror is synced.
    act(() => {
      aId = apiRef.current!.addWidget({ type: 'chart', x: 0, y: 0, w: 1, h: 1 });
    });
    expect(aId).toBeTypeOf('string');

    // Same tick: remove the widget, then add into the slot it just vacated.
    let readdedId: string | null = 'fallback';
    act(() => {
      apiRef.current!.removeWidget(aId!);
      readdedId = apiRef.current!.addWidget({ type: 'chart', x: 0, y: 0, w: 1, h: 1 });
    });

    // On the stale-mirror code the removed widget still appeared to occupy
    // (0,0), so the add was falsely rejected as a collision and returned null.
    expect(readdedId).toBeTypeOf('string');
    expect(readdedId).not.toBe(aId);
    expect(apiRef.current?.layout).toHaveLength(1);
    expect(apiRef.current?.layout[0]?.id).toBe(readdedId);

    unmount();
  });

  // The headline mixed-mutation case: multiple mutations, including non-add
  // ones (remove + resize), batched in the same tick before an add.
  it('validates a batched add against a mix of non-add mutations (remove + resize) in the same tick', () => {
    const { apiRef, unmount } = mountUseGridLayout();
    let aId: string | null = null;
    let bId: string | null = null;

    // Seed a full 2-column row: A at (0,0), B at (1,0).
    act(() => {
      aId = apiRef.current!.addWidget({ type: 'chart', x: 0, y: 0, w: 1, h: 1 });
      bId = apiRef.current!.addWidget({ type: 'chart', x: 1, y: 0, w: 1, h: 1 });
    });
    expect(aId).toBeTypeOf('string');
    expect(bId).toBeTypeOf('string');

    // Same tick: remove A (frees (0,0)), resize B (a non-add mutation that must
    // also keep the mirror coherent), then add into A's freed slot.
    let addedId: string | null = 'fallback';
    act(() => {
      apiRef.current!.removeWidget(aId!);
      apiRef.current!.resizeWidget(bId!, 1, 2);
      addedId = apiRef.current!.addWidget({ type: 'chart', x: 0, y: 0, w: 1, h: 1 });
    });

    expect(addedId).toBeTypeOf('string');
    expect(apiRef.current?.layout).toHaveLength(2);
    const ids = apiRef.current?.layout.map((w) => w.id);
    expect(ids).toContain(bId);
    expect(ids).toContain(addedId);
    expect(ids).not.toContain(aId);
    // B kept its resize.
    const b = apiRef.current?.layout.find((w) => w.id === bId);
    expect(b?.h).toBe(2);

    unmount();
  });

  // The move path: a widget moved out of a slot in the same tick must free that
  // slot for a subsequent add.
  it('validates a batched add against a move applied earlier in the same tick', () => {
    const { apiRef, unmount } = mountUseGridLayout();
    let aId: string | null = null;

    // Seed A occupying (0,0).
    act(() => {
      aId = apiRef.current!.addWidget({ type: 'chart', x: 0, y: 0, w: 1, h: 1 });
    });
    expect(aId).toBeTypeOf('string');

    // Same tick: move A out of (0,0) to (1,0), then add into (0,0).
    let addedId: string | null = 'fallback';
    act(() => {
      apiRef.current!.moveWidget(aId!, 1, 0);
      addedId = apiRef.current!.addWidget({ type: 'chart', x: 0, y: 0, w: 1, h: 1 });
    });

    expect(addedId).toBeTypeOf('string');
    expect(apiRef.current?.layout).toHaveLength(2);
    const moved = apiRef.current?.layout.find((w) => w.id === aId);
    expect(moved?.x).toBe(1);

    unmount();
  });

  // setLayout replaces the whole layout; a same-tick add must validate against
  // the replacement, not the pre-replacement mirror.
  it('validates a batched add against a setLayout replacement in the same tick', () => {
    const { apiRef, unmount } = mountUseGridLayout();

    // Seed A occupying (0,0).
    act(() => {
      apiRef.current!.addWidget({ type: 'chart', x: 0, y: 0, w: 1, h: 1 });
    });
    expect(apiRef.current?.layout).toHaveLength(1);

    // Same tick: replace the layout with a widget at (1,0), then add at (0,0).
    let addedId: string | null = 'fallback';
    act(() => {
      apiRef.current!.setLayout([{ id: 'seeded', type: 'chart', x: 1, y: 0, w: 1, h: 1 }]);
      addedId = apiRef.current!.addWidget({ type: 'chart', x: 0, y: 0, w: 1, h: 1 });
    });

    expect(addedId).toBeTypeOf('string');
    expect(apiRef.current?.layout).toHaveLength(2);
    const ids = apiRef.current?.layout.map((w) => w.id);
    expect(ids).toContain('seeded');
    expect(ids).toContain(addedId);

    unmount();
  });
});
