import { beforeEach, describe, expect, it } from 'vitest';
import type { ComponentType } from 'react';
import type { WidgetComponentProps } from './types';
import {
  clearRegistry,
  getWidget,
  listWidgets,
  registerWidget,
  unregisterWidget,
} from './registry';

// The registry is a module-level singleton, so reset it before every test to
// keep cases isolated from one another.
beforeEach(() => {
  clearRegistry();
});

// A minimal component reference — the registry only stores it, never renders it,
// so a no-op function component is enough for these (node-environment) tests.
const Dummy: ComponentType<WidgetComponentProps> = () => null;
const Other: ComponentType<WidgetComponentProps> = () => null;

describe('registerWidget', () => {
  it('stores a registration retrievable by type', () => {
    registerWidget('chart', Dummy);
    const reg = getWidget('chart');
    expect(reg).toBeDefined();
    expect(reg?.type).toBe('chart');
    expect(reg?.component).toBe(Dummy);
  });

  it('defaults the label to the type when no label is given', () => {
    registerWidget('chart', Dummy);
    expect(getWidget('chart')?.label).toBe('chart');
  });

  it('defaults the size to { w: 3, h: 2 } when none is given', () => {
    registerWidget('chart', Dummy);
    expect(getWidget('chart')?.defaultSize).toEqual({ w: 3, h: 2 });
  });

  it('leaves the icon undefined when none is given', () => {
    registerWidget('chart', Dummy);
    expect(getWidget('chart')?.icon).toBeUndefined();
  });

  it('applies label, icon, and defaultSize overrides', () => {
    registerWidget('chart', Dummy, {
      label: 'Chart',
      icon: '📊',
      defaultSize: { w: 6, h: 4 },
    });
    const reg = getWidget('chart');
    expect(reg?.label).toBe('Chart');
    expect(reg?.icon).toBe('📊');
    expect(reg?.defaultSize).toEqual({ w: 6, h: 4 });
  });

  it('overwrites an existing registration for the same type', () => {
    registerWidget('chart', Dummy, { label: 'First' });
    registerWidget('chart', Other, { label: 'Second' });
    const reg = getWidget('chart');
    expect(reg?.component).toBe(Other);
    expect(reg?.label).toBe('Second');
    // Re-registering the same type must not create a duplicate entry.
    expect(listWidgets()).toHaveLength(1);
  });
});

describe('getWidget', () => {
  it('returns undefined for an unregistered type', () => {
    expect(getWidget('missing')).toBeUndefined();
  });
});

describe('listWidgets', () => {
  it('returns an empty array when nothing is registered', () => {
    expect(listWidgets()).toEqual([]);
  });

  it('returns every registered widget', () => {
    registerWidget('chart', Dummy);
    registerWidget('table', Other);
    const types = listWidgets().map((r) => r.type);
    expect(types).toContain('chart');
    expect(types).toContain('table');
    expect(types).toHaveLength(2);
  });

  it('preserves insertion order', () => {
    registerWidget('a', Dummy);
    registerWidget('b', Dummy);
    registerWidget('c', Dummy);
    expect(listWidgets().map((r) => r.type)).toEqual(['a', 'b', 'c']);
  });
});

describe('unregisterWidget', () => {
  it('removes a registered widget and returns true', () => {
    registerWidget('chart', Dummy);
    expect(unregisterWidget('chart')).toBe(true);
    expect(getWidget('chart')).toBeUndefined();
    expect(listWidgets()).toHaveLength(0);
  });

  it('returns false when the type was never registered', () => {
    expect(unregisterWidget('missing')).toBe(false);
  });

  it('only removes the targeted type', () => {
    registerWidget('chart', Dummy);
    registerWidget('table', Other);
    unregisterWidget('chart');
    expect(getWidget('chart')).toBeUndefined();
    expect(getWidget('table')).toBeDefined();
  });
});

describe('clearRegistry', () => {
  it('removes all registrations', () => {
    registerWidget('chart', Dummy);
    registerWidget('table', Other);
    clearRegistry();
    expect(listWidgets()).toEqual([]);
    expect(getWidget('chart')).toBeUndefined();
  });

  it('is safe to call on an already-empty registry', () => {
    expect(() => clearRegistry()).not.toThrow();
    expect(listWidgets()).toEqual([]);
  });
});
