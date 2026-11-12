# Checkbox

## Overview
Accessible custom checkbox component forwarding a native `<input type="checkbox">` reference with an associated visual indicator and label.

## Interface
- `[Checkbox.tsx:Checkbox]` — default export `forwardRef<HTMLInputElement, Props>` component accepting `Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }`.

## Invariants
- `[Checkbox.tsx:type]` — The underlying `<input>` element always enforces `type="checkbox"` and omits `"type"` from `Props`.
- `[Checkbox.tsx:inputId]` — Defaults input `id` to React `useId()` (`generatedId`) when `id` prop is not provided or falsy.

## Side Effects
- `[Checkbox.tsx:import]` — Imports stylesheet `./Checkbox.css`.

## Verification
- Run: `npm run build && npm run lint && node --test tests/*.test.mjs`
