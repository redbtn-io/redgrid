import type { ComponentType } from 'react';
import type { WidgetComponentProps, WidgetRegistration } from './types';

const widgetRegistry = new Map<string, WidgetRegistration>();

/**
 * Register a widget type that can be rendered in the grid.
 *
 * @param type - Unique string identifier for this widget type
 * @param component - React component to render
 * @param options - Optional label, icon, and default size
 */
export function registerWidget(
  type: string,
  component: ComponentType<WidgetComponentProps>,
  options?: { label?: string; icon?: string; defaultSize?: { w: number; h: number } }
): void {
  widgetRegistry.set(type, {
    type,
    component,
    label: options?.label ?? type,
    icon: options?.icon,
    defaultSize: options?.defaultSize ?? { w: 3, h: 2 },
  });
}

/**
 * Retrieve a registered widget by type.
 * Returns undefined if the type is not registered.
 */
export function getWidget(type: string): WidgetRegistration | undefined {
  return widgetRegistry.get(type);
}

/**
 * List all registered widget types.
 */
export function listWidgets(): WidgetRegistration[] {
  return Array.from(widgetRegistry.values());
}

/**
 * Unregister a widget type.
 */
export function unregisterWidget(type: string): boolean {
  return widgetRegistry.delete(type);
}

/**
 * Clear all registered widgets.
 */
export function clearRegistry(): void {
  widgetRegistry.clear();
}
