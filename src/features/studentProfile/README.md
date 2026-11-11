# studentProfile Feature Model

## Overview
Pure domain model and data transformation helpers for the Student Profile feature, synthesizing active routine tracking from planning and execution history, validating metric inputs, and computing weekly schedule grids and evolution series.

## Interface
- `[profileModel.ts:RoutineMetric]` — Type alias `RotinaResponse["metricas"][number]`.
- `[profileModel.ts:MetricSeries]` — Type `{ id: string; title: string; type: TipoMetrica | "RPE"; points: { date: string; value: number }[] }`.
- `[profileModel.ts:metricLabels]` — `Record<TipoMetrica, string>` mapping metric types to human-readable labels.
- `[profileModel.ts:metricIcons]` — `Record<TipoMetrica, string>` mapping metric types to icon identifiers.
- `[profileModel.ts:metricError]` — `function metricError(type: TipoMetrica, value: string): string | undefined` validating raw user metric input.
- `[profileModel.ts:serializeMetric]` — `function serializeMetric(metric: RoutineMetric, value: string): string` normalizing metric values for persistence.
- `[profileModel.ts:sessionCandidates]` — `function sessionCandidates(tracking: StudentTracking | null, studentId: string)` returning planned sessions for the student.
- `[profileModel.ts:ownHistory]` — `function ownHistory(sessions: TrainingSession[], studentId: string): TrainingSession[]`.
- `[profileModel.ts:buildActiveRoutineSessions]` — `function buildActiveRoutineSessions(activeRoutine: RotinaResponse | null | undefined, tracking: StudentTracking | null, historySessions: TrainingSession[], studentId: string): TrainingSession[]`.
- `[profileModel.ts:buildTrackingFromPlanning]` — `function buildTrackingFromPlanning(studentId: string, routine: RotinaResponse, planning: PlanejamentoRotinaResponseDTO, historySessions: TrainingSession[]): StudentTracking`.
- `[profileModel.ts:metricNumber]` — `function metricNumber(type: string, value: string): number | null`.
- `[profileModel.ts:formatMetric]` — `function formatMetric(value: number, type: string): string`.
- `[profileModel.ts:evolutionSeries]` — `function evolutionSeries(sessions: TrainingSession[], metrics: RoutineMetric[], from: string, to: string): MetricSeries[]`.
- `[profileModel.ts:weekDays]` — `function weekDays(tracking: StudentTracking | null, studentId: string, now?: Date)` returning the 7-day reference week array.

## Invariants
- `[profileModel.ts:metricError]` — Non-empty metric values must be `<= 255` characters; `'TEMPO'` must match `/^\d+:[0-5]\d$/`; `'NUMERICO'` must match `/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/` and be finite; `'FREQUENCIA_CARDIACA'` must be an integer between `30` and `250` bpm.
- `[profileModel.ts:sessionCandidates]` — Filters sessions to `status === 'PLANEJADA'` and owned by or unassigned to `studentId` (`!item.desempenho?.alunoId || item.desempenho.alunoId === studentId`).
- `[profileModel.ts:ownHistory]` — Filters sessions to `status === 'CONCLUIDA'` with truthy `dataReal`, scoped to `studentId`, deduplicated by session `id`, and sorted descending by `dataReal || dataPlanejada`.
- `[profileModel.ts:buildActiveRoutineSessions]` — Returns empty array if `activeRoutine` is falsy or `activeRoutine.ativo === false`; excludes `'CANCELADA'` sessions and sessions belonging to other students or routines.
- `[profileModel.ts:buildTrackingFromPlanning]` — Excludes `'CANCELADA'` planned sessions, matches history in two passes without reusing history IDs (exact ID first, then `semana + dataPlanejada`), and counts missing required metrics where `quemPreenche` is `'PERSONAL'` or `'AMBOS'` and `obrigatoria !== false`.
- `[profileModel.ts:metricNumber]` — Returns `null` for `'TEXTO'` or empty values, converts `'TEMPO'` (`MM:SS`) to total seconds, and parses comma/dot decimal numbers if finite.
- `[profileModel.ts:evolutionSeries]` — Excludes `'TEXTO'` metrics, always appends an `'rpe'` series (type `'RPE'`), filters sessions by `dataReal` within `[from, to]`, and sorts points ascending by date.
- `[profileModel.ts:weekDays]` — Excludes `'CANCELADA'` and other students' sessions; returns 7 days starting Monday for the current week if it has planned sessions or no valid sessions exist, otherwise falls back to the Monday of the first `'PLANEJADA'` session's week (or the last session's week).

## Side Effects
- None

## Verification
- Run: `npm run build && npm run lint && node --test tests/*.test.mjs`
