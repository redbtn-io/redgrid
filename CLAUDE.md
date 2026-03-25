# @redbtn/redgrid

Shared React component library: customizable dashboard grid system with resizable, moveable, selectable widgets.

## Quick Reference

- **Build**: `npm run build` (tsup: ESM + CJS + DTS)
- **Dev**: `npm run dev` (tsup watch mode)
- **Lint**: `npm run lint` (TypeScript type-check)
- **Publish**: `npm publish` (to registry.redbtn.io)

## Architecture

- `src/types.ts` — Core types (GridWidget, GridItemConfig, GridLayoutConfig)
- `src/registry.ts` — Widget registry (registerWidget, getWidget, listWidgets)
- `src/utils.ts` — Snap-to-grid, collision detection, layout validation
- `src/useGridLayout.ts` — Hook managing layout state (positions, sizes, serialize/deserialize)
- `src/GridLayout.tsx` — Main CSS Grid container
- `src/GridItem.tsx` — Widget wrapper with drag-to-move + resize handles
- `src/GridToolbar.tsx` — Widget picker showing registered types
- `src/styles.css` — CSS using @redbtn/redstyle custom properties

## Key Conventions

- Uses `@redbtn/redstyle` CSS custom properties for theming (--bg-secondary, --border, --accent, etc.)
- All CSS classes prefixed with `redgrid-`
- Widget components receive `WidgetComponentProps` ({ widget, editable })
- Layout is a flat array of GridWidget objects with grid coordinates (x, y, w, h)
- 12-column grid default, 60px row height
- Collision detection prevents overlapping widgets
- `serialize()`/`deserialize()` for JSON persistence

## Git Workflow

- Work on `agent/alphaSystem` branch
- PR to `beta`, then `beta` to `main`
