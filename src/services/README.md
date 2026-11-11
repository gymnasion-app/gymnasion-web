# Services

## Overview
HTTP client layer, JWT session state management, and domain API service modules communicating with the Gymnasion Spring Boot backend.

## Interface
- `[api.ts:api]` — Shared Axios instance configured for `/api` backend requests.
- `[api.ts:isSessionError]` — `function isSessionError(error: unknown): boolean`.
- `[session.ts:SESSION_EXPIRED_EVENT]` — Global window event name `'gymnasion:session-expired'`.
- `[session.ts:PRIVATE_HOME]` — Default Personal Trainer home path `'/home'`.
- `[session.ts:homeForRole]` — `function homeForRole(role?: UserRole): string`.
- `[session.ts:SessionUser]` — Interface representing persisted authenticated user metadata.
- `[session.ts:session]` — Session storage manager exposing `save`, `clear`, `getRememberedEmail`, `clearRememberedEmail`, `getToken`, and `getUser`.
- `[authService.ts:authService]` — Authentication API wrapper exposing `login`, `logout`, `registroPersonal`, and `registroAlunoConvite`.
- `[accountService.ts:accountService]` — Account settings wrapper exposing `obterPerfil`, `atualizarPerfil`, `obterPreferencias`, `atualizarPreferencias`, and `alterarSenha`.
- `[alunoService.ts:alunoService]` — Student portal API wrapper exposing `obterMeuPerfil`, `listarRotinas`, `consultarPlanejamento`, `obterFormularioExecucao`, `registrarExecucao`, `consultarHistoricoRotina`, `listarNotificacoes`, `lerNotificacao`, `lerTodasNotificacoes`, `contagemNaoLidas`, `listarFeedbacks`, `registrarObservacao`, and `consultarEvolucao`.
- `[metricaService.ts:metricaService]` — Custom metrics API wrapper exposing `listarTodas`, `listarPorModalidade`, `criarMetrica`, `atualizarMetrica`, and `excluirMetrica`.
- `[modalidadeService.ts:modalidadeService]` — Sport modalities catalog wrapper exposing `listarTodas`.
- `[personalDashboardService.ts:personalDashboardService]` — Personal Trainer dashboard wrapper exposing `notifications`, `readNotification`, `readAllNotifications`, `history`, and `histories`.
- `[personalTrainerService.ts:personalTrainerService]` — Student portfolio management wrapper exposing `gerarConvite`, `listarPendentes`, `listarTodos`, `listarInativos`, `aprovarAtleta`, `recusarAtleta`, `desativarAtleta`, and `reativarAtleta`.
- `[relatorioService.ts:ReportFile]` — Interface `{ blob: Blob, filename?: string }`.
- `[relatorioService.ts:relatorioService]` — PDF report service exposing `gerarPeloPersonal`, `gerarPeloAluno`, `disponibilidadePeloPersonal`, and `disponibilidadePeloAluno`.
- `[rotinaService.ts:rotinaService]` — Training routines service exposing `listar`, `buscarPorId`, `listarPorAluno`, `criar`, `atualizar`, `excluir`, `encerrar`, `vincularAlunos`, `vincularTurma`, `desvincularAluno`, `reutilizar`, `consultarPlanejamento`, and `adicionarSessao`.
- `[sessionDetailService.ts:sessionDetailService]` — Training session detail/audit service exposing `obterSessao`, `obterDesempenho`, `validarExecucao`, `corrigirDesempenho`, `consultarAuditoria`, `editarSessaoFutura`, `enviarFeedback`, and `consultarFeedbacks`.
- `[stravaService.ts:stravaService]` — Strava OAuth & activity sync service exposing `obterAuthUrl`, `conectar`, `obterStatus`, `desconectar`, `listarAtividades`, `obterStatusAluno`, and `listarAtividadesAluno`.
- `[studentProfileService.ts:studentProfileService]` — Student tracking service exposing `tracking`, `routines`, `history`, and `execute`.
- `[turmaService.ts:turmaService]` — Training groups service exposing `listar`, `buscarPorId`, `criar`, `atualizar`, `adicionarAluno`, and `removerAluno`.

## Invariants
- `[api.ts:api]` — Axios client configured with `timeout: 20000`, `baseURL: import.meta.env.VITE_API_URL || ''`, and `Content-Type: 'application/json'`.
- `[api.ts:api.interceptors.request]` — Injects `'Bearer <token>'` header only when `session.getToken()` is truthy and `config.url` does not start with `'/api/auth/'`.
- `[api.ts:isSessionError]` — Only treats HTTP `401` as a session error if the request originally included an `Authorization` header.
- `[session.ts:homeForRole]` — Returns `'/home'` (`PRIVATE_HOME`) when `role === 'PERSONAL_TRAINER'`, otherwise `'/conta'`.
- `[session.ts:isTokenExpired]` — Decodes JWT payload base64url segment and treats token as expired if `exp * 1000 <= Date.now()` or if decoding/parsing throws.
- `[session.ts:session.getUser]` — Returns `SessionUser` only if a valid, non-expired token and user JSON exist in matching storage (`sessionStorage` prioritized if `TOKEN_KEY` is in `sessionStorage`, else `localStorage`).
- `[metricaService.ts:sanitizeBackendTipo]` — Normalizes metric `tipo` to `'TEMPO'` (from `'TEMPO_CRONOMETRO'` or `'TEMPO'`), `'TEXTO'` (from `'TEXTO_OBSERVACAO'` or `'TEXTO'`), `'FREQUENCIA_CARDIACA'`, or defaults to `'NUMERICO'`.
- `[metricaService.ts:metricaService.listarTodas]` — Deduplicates metrics across modalities by `metric.id` using a `Map`.
- `[modalidadeService.ts:modalidadeService.listarTodas]` — Defaults query params to `{ size: 100, apenasAtivas: true }` unless overridden.
- `[personalDashboardService.ts:personalDashboardService.histories]` — Limits concurrent `personalDashboardService.history` requests to at most `4` parallel workers.
- `[personalDashboardService.ts:personalDashboardService.readAllNotifications]` — Falls back to `PATCH '/api/personal-trainers/notificacoes/ler-todas'` if `PATCH '/api/personal-trainers/notificacoes/marcar-como-lidas'` fails.
- `[relatorioService.ts:download]` — Serializes array query params with `indexes: null` (e.g., `metricaIds=a&metricaIds=b`), `responseType: 'blob'`, and `timeout: REPORT_TIMEOUT_MS`.
- `[alunoService.ts:alunoService.contagemNaoLidas]` — Coerces non-number response data to `0`.

## Side Effects
- `[api.ts:api.interceptors.request]` — Mutates outgoing Axios request `config.headers.Authorization` with Bearer token from storage.
- `[api.ts:api.interceptors.response]` — On `401` session error, calls `session.clear()` and dispatches `CustomEvent(SESSION_EXPIRED_EVENT)` on `window`.
- `[session.ts:session.save]` — Clears existing session storage keys and writes `'@Gymnasion:token'`, `'@Gymnasion:user'`, and optionally `'@Gymnasion:remembered_email'` to `localStorage` or `sessionStorage`.
- `[session.ts:session.clear]` — Removes `'@Gymnasion:token'` and `'@Gymnasion:user'` from both `localStorage` and `sessionStorage`.
- `[session.ts:session.clearRememberedEmail]` — Removes `'@Gymnasion:remembered_email'` from `localStorage`.
- `[session.ts:session.getToken]` — Reads from `sessionStorage`/`localStorage` and calls `session.clear()` as a side effect if the stored token is expired.
- `[authService.ts:authService.login]` — Performs `POST '/api/auth/login'` and persists session state via `session.save()`.
- `[authService.ts:authService.logout]` — Clears persisted session state via `session.clear()`.
- `[accountService.ts:accountService]`, `[alunoService.ts:alunoService]`, `[metricaService.ts:metricaService]`, `[modalidadeService.ts:modalidadeService]`, `[personalDashboardService.ts:personalDashboardService]`, `[personalTrainerService.ts:personalTrainerService]`, `[relatorioService.ts:relatorioService]`, `[rotinaService.ts:rotinaService]`, `[sessionDetailService.ts:sessionDetailService]`, `[stravaService.ts:stravaService]`, `[studentProfileService.ts:studentProfileService]`, `[turmaService.ts:turmaService]` — Perform HTTP requests (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) against the `/api/*` backend endpoints.

## Verification
- Run: `npm run build && npm run lint && node --test tests/*.test.mjs`
