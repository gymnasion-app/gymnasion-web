# NotificationPopover

## Overview
Accessible dialog popover component for displaying, filtering (`Todas`, `Não lidas`, `Pendências`), and marking workspace notifications as read.

## Interface
- `[NotificationPopover.tsx:NotificationPopoverProps]` — exported interface defining props (`notifications`, `loading`, `error`, `busy`, `onClose`, `onRead`, `onRetry`, `triggerRef`, `isClosing`).
- `[NotificationPopover.tsx:NotificationPopover]` — default exported React component rendering the notification dialog popover.

## Invariants
- `[NotificationPopover.tsx:NotificationPopover]` — Clicking a notification entry only invokes `onRead(item.id)` when `!item.lida` (`isUnread`) and `busy` is falsy.
- `[NotificationPopover.tsx:NotificationPopover]` — The `'Marcar todas como lidas'` button is disabled when `busy` is truthy or `unreadCount === 0`.
- `[NotificationPopover.tsx:NotificationPopover]` — Filter tabs are only rendered when `!loading && !error && sorted.length > 0`.
- `[NotificationPopover.tsx:NotificationPopover]` — The `'Pendências'` filter tab is only rendered when `pendenciaCount > 0`.

## Side Effects
- `[NotificationPopover.tsx:NotificationPopover]` — `useEffect` registers `keydown` (`'Escape'` closes popover and focuses `triggerRef.current`) and deferred (`setTimeout(..., 0)`) `mousedown` outside-click listeners on `document`, cleaning both up and clearing the timer on unmount or dependency change.
- `[NotificationPopover.tsx:NotificationPopover]` — Invokes `onRead(item.id)` callback when an unread notification item is clicked.
- `[NotificationPopover.tsx:NotificationPopover]` — Invokes `onRead()` callback without arguments when `'Marcar todas como lidas'` is clicked.

## Verification
- Run: `npm run build && npm run lint && node --test tests/*.test.mjs`
