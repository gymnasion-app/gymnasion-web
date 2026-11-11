# StudentProfile

## Overview
Personal Trainer's detailed student profile page (`/alunos/:studentId`) providing tabbed views (`overview`, `evolution`, `routines`, `history`), multi-routine selection with secondary planning synthesis, session execution registration, PDF report generation, and student activation/deactivation.

## Interface
- `[StudentProfile.tsx:StudentProfile]` — default exported React component reading route parameter `studentId` via `useParams` and rendering `StudentProfileContent`.

## Invariants
- `[StudentProfile.tsx:tab]` — Active tab derived from search parameter `aba` is restricted to `["overview", "evolution", "routines", "history"]`, defaulting to `"overview"`.
- `[StudentProfile.tsx:authorized]` — Profile API calls (`load`) execute only when `student` exists in `usePersonal().students.data` (`Boolean(student)`).
- `[StudentProfile.tsx:version]` — Request sequence counter `version.current` discards stale async responses if a newer request has started or the component unmounts.
- `[StudentProfile.tsx:activeRoutines]` — Active routines are filtered by `r.ativo !== false`; when `activeRoutines.length > 1`, `selectedRoutineId` defaults to `"ALL"` (unified overview of all active routines and sessions), otherwise resolving to the active routine.
- `[StudentProfile.tsx:blocked]` — Session registration (`+ Registrar sessão`) is blocked unless `student.status === "ATIVO"`, `!loading`, `!errors.tracking && !errors.routines`, and `activeRoutines.length > 0`.
- `[StudentProfile.tsx:StudentProfileContent]` — Report generation (`Gerar relatório`) and status toggle (`Reativar aluno` / `Desativar aluno`) require `["ATIVO", "INATIVO"].includes(student.status)`. Passes both active profile modalities and historical routine modalities to `ReportDialog`, while the `Modalidades` button opens `StudentModalitiesDialog`.
- `[StudentProfile.tsx:month]` — Monthly session stats only count sessions where `s.dataReal?.slice(0, 7) === today.slice(0, 7)` and `s.dataReal <= today`.

## Side Effects
- `[StudentProfile.tsx:load]` — Calls `stravaService.obterStatusAluno(studentId)`, `studentProfileService.tracking(studentId)`, `studentProfileService.routines(studentId)`, `studentProfileService.history(studentId)`, and prefers `fetchedTracking.rotinasAtivas` for secondary active routines (falling back to `rotinaService.consultarPlanejamento(r.id)` only if absent).
- `[StudentProfile.tsx:StudentProfileContent]` — Registers a `window` `focus` listener and a 30000ms `window.setInterval` timer (when `register` dialog is closed and `document.visibilityState === "visible"`) to re-run `load()`.
- `[StudentProfile.tsx:changeTab]` — Mutates URL query string parameter `aba` via `useSearchParams` `setParams`.
- `[StudentProfile.tsx:StudentProfileContent]` — Invokes `relatorioService.gerarPeloPersonal` and `relatorioService.disponibilidadePeloPersonal` via `ReportDialog` callbacks, `usePersonal().refresh()` on retry/save/unlink, and displays toast notifications via `toast.success`.

## Verification
- Run: `npm run build && npm run lint && node --test tests/*.test.mjs`
