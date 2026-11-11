# ProfileSessions

## Overview
Table and filter component for viewing a student's planned and executed training sessions in both overview (`recent`) and full history modes.

## Interface
- `[ProfileSessions.tsx:ProfileSessions]` — default export React component accepting `{ sessions: TrainingSession[], recent?: boolean, activeRoutine?: RotinaResponse | null, routines?: RotinaResponse[], studentId?: string, onHistory?: () => void }`.

## Invariants
- `[ProfileSessions.tsx:trackedRoutineId]` — When `activeRoutine?.id` changes, `statusFilter` resets to `'all'`, `weekFilter` resets to `'ALL'`, and `page` resets to `1`.
- `[ProfileSessions.tsx:filteredSessions]` — In recent mode (`recent === true`), includes sessions belonging to `activeRoutine` when one is selected, or sessions across all active routines when `activeRoutine` is `null` and `activeRoutineCount > 1`; sorted with non-completed sessions first, then ascending by `dataPlanejada` and `semana`.
- `[ProfileSessions.tsx:filteredSessions]` — In history mode (`recent === false`), if `historyScope === 'active_only'` and `activeRoutine` is truthy, only sessions with `s.rotinaTreinoId === activeRoutine.id` are included; sorted descending by `(dataReal || dataPlanejada)`.
- `[ProfileSessions.tsx:pageSize]` — Pagination size is `6` when `recent === true` and `10` when `recent === false`, with `pages = Math.max(1, Math.ceil(filteredSessions.length / pageSize))` and `current = Math.min(page, pages)`.
- `[ProfileSessions.tsx:metrics]` — Excludes metrics with `tipo`/`tipoMetrica === 'TEXTO'` and limits displayed metric columns to at most `2` in recent mode or `3` in history mode.

## Side Effects
- `[ProfileSessions.tsx:handleRowClick]` — Navigates via `react-router-dom` `useNavigate` to `/alunos/${studentId}/sessoes/${sessionId}` when a table row is clicked and `studentId` is defined.
- `[ProfileSessions.tsx:onHistory]` — Invokes optional `onHistory` callback prop when the `'Ver histórico completo →'` button is clicked.

## Verification
- Run: `npm run build && npm run lint && node --test tests/*.test.mjs`
