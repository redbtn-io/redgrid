/* @vitest-environment jsdom */

import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
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
});
