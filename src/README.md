# Source Root (`src`)

## Overview
Application entry point, root React Router configuration (`App.tsx`), and top-level client subsystems (`components`, `features`, `pages`, `services`, `styles`, `types`, `utils`).

## Interface
- `[App.tsx:default (App)]` — Root React router component configuring public routes (`/`, `/recuperar-senha`, `/cadastro-aluno`, `/strava/callback`), dev-only route (`/design-system` when `import.meta.env.DEV`), `PublicOnlyRoute` routes (`/login`, `/cadastro`), `ProtectedRoute` student routes (`/conta`, `/conta/configuracoes`, `/conta/treinos`, `/conta/evolucao`) and legacy student redirects (`/aluno`, `/aluno/treinos`, `/aluno/evolucao`, `/meus-treinos`, `/minha-evolucao`), `ProtectedRoute` with `roles={["PERSONAL_TRAINER"]}` routes (`/alunos`, `/alunos/:studentId`, `/alunos/:studentId/sessoes/:sessionId`, `/alunos/:studentId/sessoes/:sessionId/editar`, `/home`, `/configuracoes`, `/rotinas`, `/rotinas/nova`, `/rotinas/:routineId/editar`, `/rotinas/:routineId/planejamento`, `/rotinas/:routineId/sessoes/nova`, `/metricas`, `/grupos`, `/grupos/:groupId`) and anchor redirects (`/home/notificacoes`, `/home/ultimos-aceitos`, `/home/sem-treino`), plus catch-all `*` redirect to `/`.
- `[vite-env.d.ts:React.DialogHTMLAttributes.closedby]` — TypeScript module augmentation adding `closedby?: "any" | "closerequest" | "none" | string` to `DialogHTMLAttributes<T>`.
- `[vite-env.d.ts:React.ImgHTMLAttributes.fetchpriority]` — TypeScript module augmentation adding `fetchpriority?: "high" | "low" | "auto"` to `ImgHTMLAttributes<T>`.
- Subdirectories:
  - `components`: [./components/README.md](./components/README.md) — Componentes de UI, barras de navegação, modais e primitivas do Design System.
  - `features`: [./features/README.md](./features/README.md) — Modelos de domínio, contextos e regras de negócio por funcionalidade.
  - `pages`: [./pages/README.md](./pages/README.md) — Componentes de página mapeados nas rotas da aplicação.
  - `services`: [./services/README.md](./services/README.md) — Cliente HTTP Axios (`api.ts`), gerenciamento de sessão JWT (`session.ts`) e serviços de integração com o backend.
  - `styles`: [./styles/README.md](./styles/README.md) — Tokens de design (`tokens.css`) e escala tipográfica (`typography.css`).
  - `types` — Definições TypeScript de contratos de API e domínio (`account.ts`, `api.ts`, `auth.ts`, `metric.ts`, `modalidade.ts`, `personalDashboard.ts`, `rotina.ts`, `sessionDetail.ts`, `strava.ts`, `student.ts`, `studentArea.ts`, `studentProfile.ts`, `turma.ts`).
  - `utils` — Utilitários puros e auxiliares de tratamento de erro/arquivo (`activityParser.ts`, `authError.ts`, `downloadFile.ts`, `handleApiError.ts`).

## Invariants
- `[App.tsx:import.meta.env.DEV]` — `/design-system` route is only registered when `import.meta.env.DEV` is truthy.
- `[App.tsx:PublicOnlyRoute]` — `/login` and `/cadastro` are guarded by `PublicOnlyRoute`.
- `[App.tsx:ProtectedRoute]` — `/conta*` and `/aluno*` / `/meus-treinos` / `/minha-evolucao` routes require authentication via `ProtectedRoute`; `/alunos*`, `/home*`, `/configuracoes`, `/rotinas*`, `/metricas`, and `/grupos*` require role `"PERSONAL_TRAINER"` via `ProtectedRoute roles={["PERSONAL_TRAINER"]}`.
- `[main.tsx:document.getElementById("root")!]` — Expects a non-null DOM element with id `"root"` to mount the React root.

## Side Effects
- `[App.tsx:onSessionExpired]` — Registers a `window` event listener for `SESSION_EXPIRED_EVENT` that triggers `toast.error(..., { id: "session-expired" })` and navigates to `"/login"` with `{ replace: true }`.
- `[main.tsx:ReactDOM.createRoot]` — Imports global CSS (`@fontsource-variable/plus-jakarta-sans`, `./index.css`) and mounts `<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>` into `#root`.

## Verification
- Run: `npm run build && npm run lint && node --test tests/*.test.mjs`
