# Components

## Overview
UI components, workspace navigation bars, modals, and design system primitives for Gymnasion Web. Each component directory colocates its `.tsx` implementation and `.css` stylesheet consuming tokens from `src/styles/tokens.css`.

Referência: [Componentes no Figma](https://www.figma.com/design/Kw1G5FRZa0zVp2UBwC3kXK/Prototipo---Projeto-de-Software?node-id=396-45).

Abra `/design-system` no servidor de desenvolvimento (`import.meta.env.DEV`) para validar as variantes e interações. Os SVGs oficiais residem em `public/design-system`.

| Componente | API principal |
| --- | --- |
| Button | `variant`: primary, secondary, ghost, danger; `icon`, `loading` e atributos nativos |
| FormField | `id`, `label`, `error`, `hint`; `options` para select; `type="password"` para mostrar/ocultar senha |
| Logo | `variant`: default, white, symbol |
| Avatar | `name`, `initials`, `src`, `tone`; fallback para iniciais quando a imagem falha |
| Badge | `tone`: success, warning, danger, neutral, info, primary; texto em children |
| SportTag | `sport`: natacao, tenis, academia, corrida, ciclismo, funcional |
| Checkbox | `label` e atributos nativos; aceita checked/onChange ou defaultChecked |
| Toast | `tone`: success, error, info; `title`, `message`, `onClose` |
| AppSidebar | `role`, `user`, `menu`, `general`, `footer`, `onLogout` |
| SidebarCallout | `variant="strava"` ou `variant="personal"`, com `onAction` |
| AppTopbar | `title`, `subtitle`, `userName`, `userInitials`, `onSearch` e `onNotifications` |

## Subdirectories & Boundaries
- AppTopbar: [./AppTopbar/README.md](./AppTopbar/README.md) — Topbar do workspace autenticado com busca global (`Ctrl+K`/`Meta+K`), gatilho de notificações e avatar do usuário.
- Checkbox: [./Checkbox/README.md](./Checkbox/README.md) — Primitiva de seleção (`forwardRef<HTMLInputElement>`) com geração automática de `id` via `useId()`.
- NotificationPopover: [./NotificationPopover/README.md](./NotificationPopover/README.md) — Popover acessível de notificações com abas (`Todas`, `Não lidas`, `Pendências`) e marcação de leitura individual ou em lote.
- ProfileRoutineCard: [./ProfileRoutineCard/README.md](./ProfileRoutineCard/README.md) — Card de resumo de rotina de treino no perfil do aluno com chips simplificados de métricas e grade semanal de referência.
- ProfileSessions: [./ProfileSessions/README.md](./ProfileSessions/README.md) — Tabela paginada e filtros de sessões de treino do aluno nos modos Visão Geral (`recent`) e Histórico completo.
- Sports: [./Sports/README.md](./Sports/README.md) — Seção institucional de modalidades suportadas com imagens responsivas `<picture>`.
- Additional component directories (`About`, `AccountSidebar`, `AppSidebar`, `AuthCaptcha`, `AuthLayout`, `Avatar`, `Badge`, `Benefits`, `Button`, `DashboardEvolution`, `DashboardNotifications`, `DashboardPanel`, `DashboardStats`, `Footer`, `FormField`, `GroupAddStudentModal`, `GroupCard`, `GroupConfirmModal`, `GroupDataForm`, `GroupFormModal`, `GroupRoutineModal`, `GroupToolbar`, `GroupsEmptyState`, `Hero`, `Highlights`, `HomeNavigation`, `HomeOverview`, `HowItWorks`, `InstitutionalNavbar`, `InviteEmail`, `InviteLink`, `InviteResult`, `Logo`, `MetricCard`, `MetricCreateModal`, `MetricDialog`, `MetricForm`, `MetricModal`, `MissedWorkoutRow`, `MissedWorkouts`, `Navbar`, `NotificationItem`, `Notifications`, `PasswordRules`, `PendingStudent`, `PersonalLayout`, `PlatformHeader`, `ProtectedRoute`, `PublicOnlyRoute`, `RecentStudentRow`, `RecentStudents`, `ReportDialog`, `RoutineAssignModal`, `RoutineCard`, `RoutineDeleteModal`, `RoutineFormModal`, `RoutineReuseModal`, `RoutineStatusDialog`, `RoutinesEmptyState`, `SessionAuditModal`, `SessionCorrectionModal`, `SessionRegisterDialog`, `SettingsSection`, `SidebarCallout`, `SportTag`, `StravaModal`, `StudentActionModal`, `StudentCard`, `StudentEvolution`, `StudentIdentity`, `StudentInviteModal`, `StudentLayout`, `StudentRoutineDialog`, `StudentRpeModal`, `StudentSmoothChart`, `StudentStatusDialog`, `StudentToast`, `StudentToolbar`, `StudentsEmptyState`, `Subscription`, `TermsModal`, `Toast`, `UnavailableAction`, `ValidateSessionModal`, `WorkspaceDialog`).
