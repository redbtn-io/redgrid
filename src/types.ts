import type { ComponentType } from 'react';

/** Position and size constraints for a grid item */
export interface GridItemConfig {
  /** Unique identifier */
  id: string;
  /** Widget type (must be registered in the widget registry) */
  type: string;
  /** Column position (0-based) */
  x: number;
  /** Row position (0-based) */
  y: number;
  /** Width in grid columns */
  w: number;
  /** Height in grid rows */
  h: number;
  /** Minimum width in columns */
  minW?: number;
  /** Minimum height in rows */
  minH?: number;
  /** Maximum width in columns */
  maxW?: number;
  /** Maximum height in rows */
  maxH?: number;
  /** Arbitrary props passed to the widget component */
  props?: Record<string, unknown>;
}

/** A widget instance in the grid (runtime state) */
export interface GridWidget extends GridItemConfig {
  /** Whether this widget is currently selected */
  selected?: boolean;
}

/** Configuration for the grid layout */
export interface GridLayoutConfig {
  /** Number of columns (default: 12) */
  columns?: number;
  /** Height of each row in pixels (default: 60) */
  rowHeight?: number;
  /** Gap between grid items in pixels (default: 8) */
  gap?: number;
  /** Initial widget configurations */
  widgets?: GridItemConfig[];
}

/** Props for a registered widget component */
export interface WidgetComponentProps {
  /** The widget configuration */
  widget: GridWidget;
  /** Whether the grid is in edit mode */
  editable?: boolean;
}

/** A registered widget type in the registry */
export interface WidgetRegistration {
  type: string;
  component: ComponentType<WidgetComponentProps>;
  label?: string;
  icon?: string;
  defaultSize?: { w: number; h: number };
}

/** Serialized layout (for saving/restoring) */
export interface SerializedLayout {
  columns: number;
  rowHeight: number;
  gap: number;
  widgets: GridItemConfig[];
}

/** Callback types */
export type OnMoveCallback = (id: string, x: number, y: number) => void;
export type OnResizeCallback = (id: string, w: number, h: number) => void;
export type OnRemoveCallback = (id: string) => void;
export type OnSelectCallback = (id: string | null) => void;
