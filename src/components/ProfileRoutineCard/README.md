# ProfileRoutineCard

## Overview
Card component displaying a student's training routine summary, simplified metric chips, optional 7-day reference week grid, and navigation to routine session planning.

## Interface
- `[ProfileRoutineCard.tsx:default]` — `ProfileRoutineCard({ routine: RotinaResponse, tracking: StudentTracking | null, studentId: string, showWeek?: boolean, onUnlink?: () => void }): JSX.Element`.

## Invariants
- `[ProfileRoutineCard.tsx:totalSessions]` — Session counts (`totalSessions`, `completedTotal`) are only calculated when `tracking?.rotinaAtivaId === routine.id`, defaulting to `0` otherwise.
- `[ProfileRoutineCard.tsx:completedTotal]` — Completed sessions are filtered strictly by `s.status === "CONCLUIDA"`.
- `[ProfileRoutineCard.tsx:onUnlink]` — The unlink button is only rendered when `onUnlink` is provided and `routine.ativo !== false`.
- `[ProfileRoutineCard.tsx:showWeek]` — The reference week grid is only rendered when `showWeek` is truthy, `tracking.rotinaAtivaId === routine.id`, and `tracking.sessoes.length > 0`.

## Side Effects
- `[ProfileRoutineCard.tsx:navigate]` — Invokes React Router `navigate(\`/rotinas/\${routine.id}/planejamento\`)` when the planning/edit button is clicked.
- `[ProfileRoutineCard.tsx:onUnlink]` — Invokes the `onUnlink` callback prop when the unlink button is clicked.

## Verification
- Run: `npm run build && npm run lint && node --test tests/*.test.mjs`
