# Gymnasion Web Blueprint

## System Overview
Frontend Web (`React 18 + TypeScript + Vite`) da plataforma SaaS **Gymnasion**, provendo o portal do Personal Trainer (gestão de carteira de alunos, turmas, prescrição de rotinas de treino, métricas customizadas, registro/validação de sessões, evolução e relatórios PDF) e a área do Aluno (`/conta*`), integrando-se à API REST Spring Boot (`/api/*`).

## Local Interface & Invariants
- `[vite.config.ts:default]` — Vite configuration factory (`defineConfig`) configuring `@vitejs/plugin-react` and dev/preview servers (`host: true`, `allowedHosts`, `/api` proxy).
- `[eslint.config.js:default]` — Flat ESLint configuration (`tseslint.config`) for `**/*.{ts,tsx}` ignoring `dist`, extending `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`.
- `[vite.config.ts:backendTarget]` — Proxies `/api` to `env.BACKEND_URL` or defaults to `'http://127.0.0.1:8080'`.
- `[vite.config.ts:apiProxy]` — Strips the `origin` header on proxied `/api` requests (`proxyRequest.removeHeader('origin')`) with `changeOrigin: true` so the backend does not enforce CORS.
- `[vite.config.ts:allowedHosts]` — Parses `env.VITE_ALLOWED_HOSTS` as a comma-separated list with empty entries filtered out for both `server` and `preview`.
- `[vite.config.ts:loadEnv]` — Reads environment variables from `process.cwd()` for the active Vite `mode` at config evaluation time.

## Subdirectories & System Boundaries
- src: [./src/README.md](./src/README.md) — Código-fonte principal da aplicação React (`App.tsx`, `main.tsx`) e subsistemas (`components`, `features`, `pages`, `services`, `styles`, `types`, `utils`).
- docs/designs: [./docs/designs/SITEMAP.md](./docs/designs/SITEMAP.md) — Índice de especificações técnicas e decisões de design (EGM / SDD).
- tests — Suíte de testes automatizados (`node --test tests/*.test.mjs`).

## Global Invariants
- Todas as rotas autenticadas de Personal Trainer (`/home*`, `/alunos*`, `/rotinas*`, `/metricas`, `/grupos*`, `/configuracoes`) exigem `ProtectedRoute` com `roles={["PERSONAL_TRAINER"]}`, enquanto rotas do portal do aluno (`/conta*`) exigem sessão autenticada (`[src/App.tsx:ProtectedRoute]`).
- Requisições HTTP para `/api/*` (exceto `/api/auth/*`) injetam automaticamente `Authorization: Bearer <token>` quando há token válido não expirado em `sessionStorage` ou `localStorage` (`[src/services/api.ts:api.interceptors.request]`, `[src/services/session.ts:session.getToken]`).
- Respostas HTTP `401` em requisições autenticadas limpam a sessão (`session.clear()`) e disparam o evento global `SESSION_EXPIRED_EVENT` (`'gymnasion:session-expired'`), redirecionando o usuário para `/login` (`[src/services/api.ts:api.interceptors.response]`, `[src/App.tsx:onSessionExpired]`).

## Global Side Effects
- Comunicação HTTP/REST com o backend Spring Boot via `/api/*` (`[src/services/api.ts:api]`).
- Persistência de sessão e preferências em `localStorage` e `sessionStorage` sob o namespace `@Gymnasion:*` (`[src/services/session.ts:session]`).
- Integração OAuth e sincronização de atividades com o Strava (`[src/services/stravaService.ts:stravaService]`).

## System Verification
- Run: `npm run build && npm run lint && node --test tests/*.test.mjs`
