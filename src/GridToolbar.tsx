import React from 'react';
import { listWidgets } from './registry';
import type { WidgetRegistration } from './types';

export interface GridToolbarProps {
  /** Called when a widget type is selected from the toolbar */
  onAddWidget?: (type: string) => void;
  /** Additional class name */
  className?: string;
}

/**
 * Widget picker / toolbar that shows all registered widget types.
 * Clicking a widget type triggers the onAddWidget callback.
 */
export function GridToolbar({ onAddWidget, className }: GridToolbarProps) {
  const widgets = listWidgets();

  if (widgets.length === 0) {
    return null;
  }

  return (
    <div className={['redgrid-toolbar', className].filter(Boolean).join(' ')}>
      <span className="redgrid-toolbar__label">Add Widget</span>
      <div className="redgrid-toolbar__items">
        {widgets.map((reg: WidgetRegistration) => (
          <button
            key={reg.type}
            className="redgrid-toolbar__item"
            onClick={() => onAddWidget?.(reg.type)}
            title={reg.label}
          >
            {reg.icon && <span className="redgrid-toolbar__icon">{reg.icon}</span>}
            <span className="redgrid-toolbar__item-label">{reg.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
