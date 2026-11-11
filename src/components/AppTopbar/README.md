# AppTopbar

## Overview
Top navigation bar component for authenticated workspace views (`PersonalLayout` and `StudentLayout`), handling global search input, mobile sidebar toggle, notification popover trigger, and user avatar presentation.

## Interface
- `[AppTopbar.tsx:AppTopbar]` — default export `function AppTopbar(props: Props): JSX.Element` accepting `title`, `subtitle`, `userName`, `userInitials`, `avatar`, `avatarTone`, `searchLabel`, `notificationCount`, `notificationDot`, `onSearch`, `onNotifications`, `notifications` (`{ data: PersonalNotification[]; loading?: boolean; error?: string }`), `onReadNotification`, `notificationBusy`, `onRefreshNotifications`, `menuOpen`, `sidebarId`, and `onToggleMenu`.

## Invariants
- `[AppTopbar.tsx:Props]` — Default prop values: `avatarTone = 'primary'`, `searchLabel = 'Buscar alunos e turmas'`, `menuOpen = false`.
- `[AppTopbar.tsx:handleNotificationsClick]` — Invokes `onNotifications()` directly and skips internal popover state toggle only when `onNotifications` is defined and `notifications` is undefined.
- `[AppTopbar.tsx:closePopover]` — No-ops if `isClosing` is `true` or `popoverOpen` is `false`; transitions `popoverOpen` to `false` and `isClosing` to `false` after a 150ms delay.
- `[AppTopbar.tsx:AppTopbar]` — Notification badge/dot rendering and unread count `aria-label` are gated by `settings.showNotificationBadge` from `useAccountSettings()`.
- `[AppTopbar.tsx:AppTopbar]` — Avatar image source prioritizes `settings.photo` over the `avatar` prop (`settings.photo || avatar`).
- `[AppTopbar.tsx:AppTopbar]` — Search form submission trims the query string before passing it to `onSearch(query.trim())`.

## Side Effects
- `[AppTopbar.tsx:useEffect]` — Registers and cleans up a global `window` `'keydown'` event listener that intercepts `Ctrl+K` / `Meta+K` (`event.preventDefault()`) to focus `searchRef`.
- `[AppTopbar.tsx:closePopover]` — Schedules a 150ms `window.setTimeout` stored in `closeTimeoutRef` to complete popover closing transition, cleared on unmount or re-open.
- `[AppTopbar.tsx:useAccountSettings]` — Reads account settings (`settings.showNotificationBadge`, `settings.photo`) via `useAccountSettings` hook.

## Verification
- Run: `npm run build && npm run lint && node --test tests/*.test.mjs`
