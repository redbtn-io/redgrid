# @redbtn/redgrid — Architecture & Plan

## Overview

A customizable dashboard grid system for the redbtn ecosystem. Provides resizable, moveable, selectable widgets arranged on a CSS Grid with snap-to-grid behavior, collision detection, and layout serialization.

## Architecture

```
@redbtn/redgrid
├── src/
│   ├── types.ts          # Core type definitions
│   ├── registry.ts       # Widget registry (register/get/list)
│   ├── utils.ts          # Snap-to-grid, collision detection, validation
│   ├── useGridLayout.ts  # State management hook
│   ├── GridLayout.tsx     # Main container (CSS Grid)
│   ├── GridItem.tsx       # Widget wrapper (drag + resize)
│   ├── GridToolbar.tsx    # Widget picker UI
│   ├── styles.css         # Styles using redstyle tokens
│   └── index.ts           # Barrel export
├── tsup.config.ts         # Build config (ESM + CJS + DTS)
└── package.json
```

### Component Hierarchy

```
GridToolbar (optional — widget picker)
GridLayout (CSS Grid container)
  └── GridItem (per widget)
        ├── Header (drag handle + remove button)
        ├── Content (renders registered widget component)
        └── Resize handle (bottom-right corner)
```

### State Flow

1. `useGridLayout(config)` initializes widget state from config
2. User interactions (drag/resize) call `moveWidget`/`resizeWidget`
3. These validate bounds + collision before updating state
4. `serialize()` exports layout as JSON for persistence
5. `deserialize()` restores layout from saved JSON

### Widget Registry

Consumers register their widget components before rendering:

```ts
registerWidget('stat-card', StatCardWidget, {
  label: 'Stat Card',
  icon: '📊',
  defaultSize: { w: 3, h: 2 },
});
```

The grid looks up the component by `type` string at render time.

## Component APIs

### GridLayout

```tsx
<GridLayout
  layout={widgets}       // GridWidget[]
  columns={12}           // Grid columns (default: 12)
  rowHeight={60}         // Row height in px (default: 60)
  gap={8}                // Gap in px (default: 8)
  editable={true}        // Enable drag/resize/remove
  selectedId={id}        // Currently selected widget
  onMove={moveWidget}    // (id, x, y) => void
  onResize={resizeWidget} // (id, w, h) => void
  onRemove={removeWidget} // (id) => void
  onSelect={selectWidget} // (id | null) => void
  minRows={4}            // Minimum visible rows
/>
```

### useGridLayout

```ts
const {
  layout,           // GridWidget[] — current state
  columns,          // number
  rowHeight,        // number
  gap,              // number
  rows,             // number — computed total rows
  selectedId,       // string | null
  moveWidget,       // (id, x, y) => void
  resizeWidget,     // (id, w, h) => void
  addWidget,        // (config) => string (returns new id)
  removeWidget,     // (id) => void
  updateWidgetProps, // (id, props) => void
  selectWidget,     // (id | null) => void
  serialize,        // () => SerializedLayout
  deserialize,      // (data) => void
  setLayout,        // (widgets) => void
} = useGridLayout({
  columns: 12,
  rowHeight: 60,
  gap: 8,
  widgets: [...],
});
```

### GridToolbar

```tsx
<GridToolbar onAddWidget={(type) => addWidget({ type, x: 0, y: 0, w: 3, h: 2 })} />
```

## Integration Example

```tsx
import { GridLayout, GridToolbar, useGridLayout, registerWidget } from '@redbtn/redgrid';
import '@redbtn/redgrid/styles';

// Register widget types
registerWidget('stat-card', StatCardWidget);
registerWidget('chart', ChartWidget);

function Dashboard() {
  const {
    layout,
    moveWidget,
    resizeWidget,
    addWidget,
    removeWidget,
    selectWidget,
    selectedId,
    serialize,
  } = useGridLayout({
    columns: 12,
    rowHeight: 60,
    widgets: [
      { id: 'fleet-health', type: 'stat-card', x: 0, y: 0, w: 3, h: 2, props: { label: 'Fleet Health' } },
      { id: 'cpu-chart', type: 'chart', x: 3, y: 0, w: 6, h: 4 },
    ],
  });

  const handleSave = () => {
    const data = serialize();
    localStorage.setItem('dashboard-layout', JSON.stringify(data));
  };

  return (
    <div>
      <GridToolbar onAddWidget={(type) => addWidget({ type, x: 0, y: 0, w: 3, h: 2 })} />
      <GridLayout
        layout={layout}
        editable
        selectedId={selectedId}
        onMove={moveWidget}
        onResize={resizeWidget}
        onRemove={removeWidget}
        onSelect={selectWidget}
      />
      <button onClick={handleSave}>Save Layout</button>
    </div>
  );
}
```

## Theming

All styles use `@redbtn/redstyle` CSS custom properties with fallback values:

| Token | Usage |
|-------|-------|
| `--bg-primary` | Toolbar item background |
| `--bg-secondary` | Grid item background, toolbar background |
| `--bg-tertiary` | Item header (drag handle) |
| `--border` | Item borders, toolbar borders |
| `--border-hover` | Hover states |
| `--accent` | Selected item highlight |
| `--text-primary` | Primary text |
| `--text-secondary` | Toolbar labels |
| `--text-muted` | Placeholders, grip icons |
| `--error` | Remove button hover |
| `--shadow-lg` | Dragging shadow |

Works in both dark and light themes automatically when `@redbtn/redstyle` tokens are loaded.

## Roadmap

- [ ] Keyboard navigation (arrow keys to move selected widget)
- [ ] Drop zones with visual feedback for add-by-drag
- [ ] Undo/redo stack
- [ ] Responsive breakpoint layouts
- [ ] Grid item z-index layering
- [ ] Touch support for mobile
- [ ] Auto-layout / compact algorithm
