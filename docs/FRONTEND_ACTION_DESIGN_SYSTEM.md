# Frontend Action Design System

This document outlines the standardized buttons, action items, and menus across the marketplace dashboards (Customer, Seller, Admin, and Public interfaces).

## 1. Reusable Action Components

### `<Button>`
A unified button component built on top of Tailwind CSS classes, supporting various sizes, states (loading, disabled), and styles.

- **File location**: `frontend-next/src/components/ui/button.tsx`
- **Variants**:
  - `primary`: Default solid indigo button for primary dashboard actions.
  - `secondary`: Slate background button for neutral actions.
  - `outline`: Bordered button for secondary actions.
  - `ghost`: Transparent button showing background on hover (mostly used for icon buttons).
  - `danger`: Solid rose button for destructive actions (e.g. Delete, Cancel, Reject).
  - `success`: Solid emerald button for confirmative actions (e.g. Approve, Mark Paid, Complete).
  - `warning`: Solid amber button for warning/alerting actions.
  - `link`: Borderless text link button that fits inline.
- **Sizes**:
  - `xs`: Micro button for tight spaces like table rows (`px-2.5 py-1 text-[11px]`).
  - `sm`: Small button (`px-3 py-1.5 text-xs`).
  - `md`: Standard button (`px-4 py-2 text-sm`).
  - `lg`: Large button (`px-5 py-2.5 text-base`).
  - `icon`: Circular icon button wrapper (`h-8 w-8`).
- **State Handling**:
  - `loading`: When `loading={true}`, renders a neat animated spinner and disables interaction automatically.
  - `disabled`: Standard HTML disabled state with cursor indications.

---

### `<ActionMenu>`
A portal-safe dropdown menu designed for secondary actions in tables, lists, and detail cards.

- **File location**: `frontend-next/src/components/ui/action-menu.tsx`
- **Features**:
  - Standardized three-dot (`⋯`) trigger button.
  - Automatic outside click detection to close the dropdown.
  - Closes on clicking Escape.
  - Closes on selecting any action item.
  - Stops event propagation (`e.stopPropagation()`) automatically so click events do not bubble up to parent rows (e.g., table row selection).
  - High `z-index` (`z-30`) preventing parent container or table overflow clipping.
- **Props**:
  - `items`: An array of `ActionMenuItem` definitions:
    - `label`: Label text.
    - `icon`: Optional inline icon.
    - `onClick`: Event handler (supports async click handlers).
    - `href`/`target`: Anchor/Link navigation helper.
    - `variant`: Set to `"danger"` for destructive items.
    - `confirm`: Set confirmation message (uses `window.confirm(msg)` as an MVP dialog).
    - `disabled`/`loading`: Standard state control.
    - `data-testid`: Specific test selector matching E2E coverage.

---

## 2. Visual QA Guidelines & Rules

Every developer must verify layout alignment against the following visual standards:
1. **Never crowd table rows**: Do not render multiple large action buttons in a single row. Use a single primary action button (e.g., `Bàn giao vận chuyển`) and place all secondary actions (e.g., `Chi tiết`, `Hủy đơn`) in an `<ActionMenu>`.
2. **Standardize Action Sizes**: Table actions must use `size="sm"` or `size="xs"`. Avoid default `md` button heights inside table cells.
3. **No Horizontal Overflow**: Ensure tables and scroll zones do not overflow horizontally on tablet/mobile screens due to bloated button layouts.
4. **Safety Alerts**: Any destructive button (e.g., Delete, Reject, Cancel) must trigger confirmation.
5. **Remaining Gaps**:
   - **Custom dialogs**: In this phase, `window.confirm()` is used as the safe MVP warning dialog. Future design system iterations will replace it with a custom-styled `<ConfirmDialog>` component for absolute visual consistency.
