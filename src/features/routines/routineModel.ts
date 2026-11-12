import type { AlunoResponse } from "../../types/student";
import type { CriarRotinaPayload, ReutilizarRotinaPayload, RotinaResponse } from "../../types/rotina";
import type { MetricaResponseDTO, TipoMetrica } from "../../types/metric";

export type RoutineFilter = "all" | "active" | "ended";
export type RoutineWorkspaceTab = "active" | "templates" | "ended";

export interface BusyStudentForRoutine {
  student: AlunoResponse;
  activeRoutineId: string;
  activeRoutineTitle: string;
}

export interface ClassifiedStudentsForRoutine {
  eligible: AlunoResponse[];
  busy: BusyStudentForRoutine[];
}

export interface RoutineTemplateItem {
  key: string;
  displayTitle: string;
  baseRoutine: RotinaResponse;
  instances: RotinaResponse[];
  cyclesCount: number;
  activeCyclesCount: number;
  students: { id: string; nome: string | null }[];
  totalStudentsCount: number;
}

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isRoutineActive(routine: RotinaResponse): boolean {
  if (routine.status === "ENCERRADA") return false;
  if (routine.ativo === false) return false;
  return true;
}

export function routineCounts(routines: RotinaResponse[]): { all: number; active: number; ended: number } {
  let active = 0;
  let ended = 0;
  for (const item of routines) {
    if (isRoutineActive(item)) active++;
    else ended++;
  }
  return { all: routines.length, active, ended };
}

export function visibleRoutines(
  routines: RotinaResponse[],
  filter: RoutineFilter,
  search: string,
  modalityId?: number | string | null
): RotinaResponse[] {
  const query = normalize(search.trim());
  const modId = modalityId ? Number(modalityId) : null;

  return routines
    .filter((routine) => {
      // Filtro de status
      if (filter === "active" && !isRoutineActive(routine)) return false;
      if (filter === "ended" && isRoutineActive(routine)) return false;

      // Filtro de modalidade
      if (modId !== null) {
        const itemModId = routine.modalidadeId ?? routine.modalidade?.id;
        if (itemModId !== modId) return false;
      }

      // Filtro de busca (título da rotina, objetivos, alunos, modalidade ou métricas)
      if (query) {
        const titleMatch = normalize(routine.titulo).includes(query);
        const goalMatch = routine.objetivos ? normalize(routine.objetivos).includes(query) : false;
        const studentMatch = routine.alunos.some((aluno) => aluno.nome && normalize(aluno.nome).includes(query));
        const modalityMatch = normalize(routine.nomeModalidade || routine.modalidade?.nome || "").includes(query);
        const metricMatch = (routine.metricas || []).some(
          (m) => m.titulo && normalize(m.titulo).includes(query)
        );
        if (!titleMatch && !goalMatch && !studentMatch && !modalityMatch && !metricMatch) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Ativas primeiro, depois ordem alfabética por título
      const aActive = isRoutineActive(a);
      const bActive = isRoutineActive(b);
      if (aActive !== bActive) return aActive ? -1 : 1;
      return a.titulo.localeCompare(b.titulo, "pt-BR");
    });
}

/**
 * Alunos elegíveis para receber ou vincular a uma rotina:
 * - Devem ter status ATIVO.
 * - Não podem possuir outra rotina ATIVA simultaneamente (RN-012 / US-11).
 *   (Se currentRoutineId for fornecido, a presença do aluno na própria rotina não o desqualifica).
 */
export function classifyStudentsForRoutine(
  students: AlunoResponse[],
  routines: RotinaResponse[],
  currentRoutineId?: string,
  modalityId?: number | string | null
): ClassifiedStudentsForRoutine {
  const modId = modalityId ? Number(modalityId) : null;
  const activeRoutineByStudentId = new Map<
    string,
    { activeRoutineId: string; activeRoutineTitle: string }
  >();

  for (const routine of routines) {
    if (routine.id === currentRoutineId) continue;
    const routineModId = routine.modalidadeId ?? routine.modalidade?.id;
    // Se a modalidade foi informada, rotina ativa de outra modalidade não bloqueia o aluno
    if (modId !== null && routineModId && Number(routineModId) !== modId) {
      continue;
    }
    if (isRoutineActive(routine)) {
      for (const aluno of routine.alunos || []) {
        if (aluno.id && !activeRoutineByStudentId.has(aluno.id)) {
          activeRoutineByStudentId.set(aluno.id, {
            activeRoutineId: routine.id,
            activeRoutineTitle: routine.titulo || "Rotina ativa",
          });
        }
      }
    }
  }

  const busy: BusyStudentForRoutine[] = [];

  const eligible = students.filter((student) => {
    if (student.status !== "ATIVO") return false;
    if (modId !== null && Array.isArray(student.modalidades)) {
      const enrolled = student.modalidades.some((m) => m.id === modId);
      if (!enrolled) return false;
    }
    const busyInfo = activeRoutineByStudentId.get(student.id);
    if (busyInfo) {
      busy.push({
        student,
        activeRoutineId: busyInfo.activeRoutineId,
        activeRoutineTitle: busyInfo.activeRoutineTitle,
      });
      return false;
    }
    return true;
  });

  return { eligible, busy };
}

export function eligibleStudentsForRoutine(
  students: AlunoResponse[],
  routines: RotinaResponse[],
  currentRoutineId?: string,
  modalityId?: number | string | null
): AlunoResponse[] {
  return classifyStudentsForRoutine(students, routines, currentRoutineId, modalityId).eligible;
}

export function validateCreateRoutinePayload(payload: Partial<CriarRotinaPayload>): Record<string, string> {
  const errors: Record<string, string> = {};

  const title = (payload.titulo || "").trim();
  if (!title) {
    errors.titulo = "Campo obrigatório.";
  } else if (title.length < 3) {
    errors.titulo = "O título deve ter no mínimo 3 caracteres.";
  } else if (title.length > 150) {
    errors.titulo = "O título deve ter no máximo 150 caracteres.";
  }

  if (!payload.modalidadeId) {
    errors.modalidadeId = "Selecione uma modalidade.";
  }

  const freq = payload.frequenciaSemanal;
  if (typeof freq !== "number" || freq < 1 || freq > 7) {
    errors.frequenciaSemanal = "A frequência semanal deve estar entre 1 e 7 dias.";
  }

  const objetivos = (payload.objetivos || "").trim();
  if (!objetivos) {
    errors.objetivos = "Campo obrigatório.";
  } else if (objetivos.length < 10) {
    errors.objetivos = "O objetivo deve ter no mínimo 10 caracteres.";
  }

  if (!payload.alunosIds || payload.alunosIds.length === 0) {
    errors.alunosIds = "É necessário selecionar ao menos um aluno.";
  }

  return errors;
}

export function validateReuseRoutinePayload(payload: Partial<ReutilizarRotinaPayload>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!payload.alunoId) {
    errors.alunoId = "Selecione o aluno que receberá a rotina.";
  }

  const date = (payload.dataInicio || "").trim();
  if (!date) {
    errors.dataInicio = "Informe a data de início da nova rotina.";
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.dataInicio = "Data de início inválida. Use o formato AAAA-MM-DD.";
  }

  const title = (payload.titulo || "").trim();
  if (!title) {
    errors.titulo = "Informe o título da nova rotina.";
  } else if (title.length > 150) {
    errors.titulo = "O título deve ter no máximo 150 caracteres.";
  }

  const goal = (payload.objetivos || "").trim();
  if (!goal) {
    errors.objetivos = "Informe os objetivos do treinamento.";
  }

  return errors;
}

export const metricLabels: Record<TipoMetrica, string> = {
  NUMERICO: "Numérico / Repetições",
  TEMPO: "Tempo / Cronômetro",
  TEMPO_CRONOMETRO: "Tempo / Cronômetro",
  FREQUENCIA_CARDIACA: "Frequência cardíaca",
  TEXTO: "Texto / Observação",
  TEXTO_OBSERVACAO: "Texto / Observação",
};

export const metricIcons: Record<TipoMetrica, string> = {
  NUMERICO: "imgIconHash",
  TEMPO: "imgIconClock",
  TEMPO_CRONOMETRO: "imgIconClock",
  FREQUENCIA_CARDIACA: "imgIconHeart",
  TEXTO: "imgIconText",
  TEXTO_OBSERVACAO: "imgIconText",
};

export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function getStudentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const AVATAR_COLORS = [
  { bg: "#d1e9ff", text: "#175cd3" }, // Blue
  { bg: "#ece9fe", text: "#5925dc" }, // Purple
  { bg: "#d1fadf", text: "#027a48" }, // Green
  { bg: "#ffeed4", text: "#c2410c" }, // Orange
  { bg: "#cffafe", text: "#0e7490" }, // Cyan
];

export function getAvatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function getModalityBadgeStyle(nome: string): { bg: string; color: string; icon: string } {
  const lower = normalize(nome || "");
  if (lower.includes("natacao") || lower.includes("natação")) {
    return { bg: "#eff8ff", color: "#175cd3", icon: "/design-system/imgIconWaves.svg" };
  }
  if (lower.includes("tenis") || lower.includes("tênis")) {
    return { bg: "#f4fce3", color: "#598b00", icon: "/design-system/imgIconTennis.svg" };
  }
  if (lower.includes("academia") || lower.includes("musculacao") || lower.includes("musculação")) {
    return { bg: "#f4f3ff", color: "#5925dc", icon: "/design-system/imgIconDumbbell.svg" };
  }
  if (lower.includes("corrida") || lower.includes("atletismo")) {
    return { bg: "#fff1f3", color: "#e11d48", icon: "/design-system/imgIconRun.svg" };
  }
  if (lower.includes("ciclismo") || lower.includes("bike")) {
    return { bg: "#f0fdf9", color: "#0e9384", icon: "/design-system/imgIconBike.svg" };
  }
  if (lower.includes("crossfit") || lower.includes("funcional") || lower.includes("calistenia")) {
    return { bg: "#fef6ee", color: "#dc6803", icon: "/design-system/imgIconZap.svg" };
  }
  if (lower.includes("pilates") || lower.includes("yoga") || lower.includes("mobilidade")) {
    return { bg: "#ecfdf3", color: "#027a48", icon: "/design-system/imgIconActivity.svg" };
  }
  return { bg: "#f2f4f7", color: "#344054", icon: "/design-system/imgIconGrid.svg" };
}

export function getRoutineStructureTag(frequenciaSemanal: number, modalidadeNome?: string): string {
  const lower = normalize(modalidadeNome || "");
  const isSplitModality =
    lower.includes("academia") ||
    lower.includes("musculacao") ||
    lower.includes("calistenia") ||
    lower.includes("forca");

  if (isSplitModality) {
    switch (frequenciaSemanal) {
      case 1:
        return "Full Body (A)";
      case 2:
        return "Divisão A/B";
      case 3:
        return "Divisão A/B/C";
      case 4:
        return "Divisão A/B/C/D";
      case 5:
        return "Divisão A–E";
      case 6:
        return "Divisão A–F";
      default:
        return `Ciclo ${frequenciaSemanal} dias`;
    }
  }

  return `Microciclo · ${frequenciaSemanal} ${frequenciaSemanal === 1 ? "sessão" : "sessões"}`;
}

export function routineModalityCounts(
  routines: RotinaResponse[],
  modalities: { id: number; nome: string }[],
  options?: { includeZero?: boolean; activeModalityId?: number | null }
): { id: number | null; nome: string; count: number }[] {
  const result: { id: number | null; nome: string; count: number }[] = [
    { id: null, nome: "Todas", count: routines.length },
  ];

  for (const mod of modalities) {
    const count = routines.filter((r) => {
      const rId = r.modalidadeId ?? r.modalidade?.id;
      return rId === mod.id;
    }).length;

    // Apenas exibe esportes que possuam rotinas cadastradas (count > 0)
    // ou se o esporte for o filtro atualmente selecionado na URL
    if (
      options?.includeZero ||
      count > 0 ||
      (options?.activeModalityId != null && options.activeModalityId === mod.id)
    ) {
      result.push({ id: mod.id, nome: mod.nome, count });
    }
  }

  return result;
}

export function eligibleGroupsForRoutine<T extends { modalidadeId: number; nome?: string }>(
  groups: T[],
  routine: RotinaResponse
): T[] {
  const routineModalityId = routine.modalidadeId ?? routine.modalidade?.id;
  if (routineModalityId == null) return [];
  return groups.filter((group) => group.modalidadeId === routineModalityId);
}

export function extractProblemDetail(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { detail?: string; mensagem?: string; message?: string } } })
    ?.response?.data;
  if (data?.detail && typeof data.detail === "string" && data.detail.trim()) {
    return data.detail;
  }
  if (data?.mensagem && typeof data.mensagem === "string" && data.mensagem.trim()) {
    return data.mensagem;
  }
  if (data?.message && typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }
  return fallback;
}

export function stripCycleSuffix(title: string): string {
  return (title || "")
    .replace(/\s*\((?:ciclo|cópia|copia)\s*\d*\)\s*$/i, "")
    .replace(/\s*-\s*ciclo\s*\d+\s*$/i, "")
    .trim();
}

export function getRoutineScopeLabel(routine: RotinaResponse): string {
  const students = routine.alunos || [];
  if (students.length === 0) return "Sem vínculo";
  if (students.length === 1) {
    const firstName = (students[0].nome || "Aluno").trim().split(/\s+/)[0];
    return `Individual · ${firstName}`;
  }
  return `Turma / Coletivo · ${students.length} alunos`;
}

export function buildRoutineTemplates(routines: RotinaResponse[]): RoutineTemplateItem[] {
  const groups = new Map<string, RotinaResponse[]>();

  for (const r of routines) {
    const cleanTitle = stripCycleSuffix(r.titulo) || r.titulo;
    const modId = r.modalidadeId ?? r.modalidade?.id ?? 0;
    const key = `${normalize(cleanTitle)}::${modId}`;
    const list = groups.get(key) || [];
    list.push(r);
    groups.set(key, list);
  }

  const result: RoutineTemplateItem[] = [];

  for (const [key, instances] of groups.entries()) {
    // Escolhe a rotina base mais completa (ativa primeiro, depois maior número de métricas e alunos)
    const sortedInstances = [...instances].sort((a, b) => {
      const aAct = isRoutineActive(a) ? 1 : 0;
      const bAct = isRoutineActive(b) ? 1 : 0;
      if (aAct !== bAct) return bAct - aAct;
      const metricDiff = (b.metricas?.length || 0) - (a.metricas?.length || 0);
      if (metricDiff !== 0) return metricDiff;
      return (b.alunos?.length || 0) - (a.alunos?.length || 0);
    });

    const baseRoutine = sortedInstances[0];
    const displayTitle = stripCycleSuffix(baseRoutine.titulo) || baseRoutine.titulo;
    const activeCyclesCount = instances.filter(isRoutineActive).length;

    const studentMap = new Map<string, { id: string; nome: string | null }>();
    for (const inst of instances) {
      for (const aluno of inst.alunos || []) {
        if (aluno.id && !studentMap.has(aluno.id)) {
          studentMap.set(aluno.id, aluno);
        }
      }
    }

    const students = Array.from(studentMap.values());

    result.push({
      key,
      displayTitle,
      baseRoutine,
      instances,
      cyclesCount: instances.length,
      activeCyclesCount,
      students,
      totalStudentsCount: students.length,
    });
  }

  return result.sort((a, b) => {
    if (b.activeCyclesCount !== a.activeCyclesCount) {
      return b.activeCyclesCount - a.activeCyclesCount;
    }
    if (b.cyclesCount !== a.cyclesCount) {
      return b.cyclesCount - a.cyclesCount;
    }
    return a.displayTitle.localeCompare(b.displayTitle, "pt-BR");
  });
}

export const NEW_ROUTINE_DRAFT_KEY = "gymnasion_new_routine_draft_v1";

export interface NewRoutineDraft {
  titulo: string;
  modalidadeId: number | null;
  frequenciaSemanal: number;
  objetivos: string;
  selectedStudentIds: string[];
  sendToTurma: boolean;
  selectedTurmaIds: string[];
  updatedAt: number;
}

export function createInitialNewRoutineDraft(): NewRoutineDraft {
  return {
    titulo: "",
    modalidadeId: null,
    frequenciaSemanal: 0,
    objetivos: "",
    selectedStudentIds: [],
    sendToTurma: false,
    selectedTurmaIds: [],
    updatedAt: 0,
  };
}

export function serializeNewRoutineDraft(draft: Partial<NewRoutineDraft>): string {
  const base = createInitialNewRoutineDraft();
  const selectedTurmaIds = Array.isArray(draft.selectedTurmaIds)
    ? Array.from(
        new Set(
          draft.selectedTurmaIds.filter(
            (id): id is string => typeof id === "string" && Boolean(id)
          )
        )
      )
    : [];
  const payload: NewRoutineDraft = {
    titulo: typeof draft.titulo === "string" ? draft.titulo : base.titulo,
    modalidadeId:
      typeof draft.modalidadeId === "number" && Number.isFinite(draft.modalidadeId)
        ? draft.modalidadeId
        : null,
    frequenciaSemanal:
      typeof draft.frequenciaSemanal === "number" &&
      Number.isFinite(draft.frequenciaSemanal)
        ? draft.frequenciaSemanal
        : 0,
    objetivos: typeof draft.objetivos === "string" ? draft.objetivos : base.objetivos,
    selectedStudentIds: Array.isArray(draft.selectedStudentIds)
      ? draft.selectedStudentIds.filter((id): id is string => typeof id === "string" && Boolean(id))
      : [],
    sendToTurma: Boolean(draft.sendToTurma || selectedTurmaIds.length > 0),
    selectedTurmaIds,
    updatedAt: typeof draft.updatedAt === "number" ? draft.updatedAt : Date.now(),
  };
  return JSON.stringify(payload);
}

export function parseNewRoutineDraft(raw: string | null | undefined): NewRoutineDraft | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<NewRoutineDraft>;
    if (!parsed || typeof parsed !== "object") return null;
    return JSON.parse(serializeNewRoutineDraft(parsed)) as NewRoutineDraft;
  } catch {
    return null;
  }
}

export function filterAndSortRoutineMetrics(
  metrics: MetricaResponseDTO[],
  selectedIds: Iterable<string>,
  searchQuery = ""
): MetricaResponseDTO[] {
  const selectedSet = new Set(selectedIds);
  const query = normalize(searchQuery.trim());

  return metrics
    .filter((m) => {
      if (!query) return true;
      const titleMatch = normalize(m.titulo || "").includes(query);
      const typeLabel = metricLabels[m.tipo] || m.tipo || "";
      const typeMatch = normalize(typeLabel).includes(query);
      const reqLabel = m.obrigatoria !== false ? "obrigatoria" : "opcional";
      const reqMatch = reqLabel.includes(query);
      return titleMatch || typeMatch || reqMatch;
    })
    .sort((a, b) => {
      const aSelected = selectedSet.has(a.id) ? 1 : 0;
      const bSelected = selectedSet.has(b.id) ? 1 : 0;
      if (aSelected !== bSelected) return bSelected - aSelected;

      const aReq = a.obrigatoria !== false ? 1 : 0;
      const bReq = b.obrigatoria !== false ? 1 : 0;
      if (aReq !== bReq) return bReq - aReq;

      return (a.titulo || "").localeCompare(b.titulo || "", "pt-BR");
    });
}

export function getRequiredMetricIds(metrics: MetricaResponseDTO[]): string[] {
  return metrics.filter((m) => m.obrigatoria !== false).map((m) => m.id);
}

export function getModalityGroupsForRoutine<
  T extends { id: string; modalidadeId: number; nome?: string; alunos?: { id: string }[] }
>(groups: T[], modalityId: number | string | null | undefined): T[] {
  if (modalityId == null || modalityId === "") return [];
  const modId = Number(modalityId);
  if (!Number.isFinite(modId) || modId <= 0) return [];
  return (groups || []).filter((g) => Number(g.modalidadeId) === modId);
}

export function toggleTurmaStudentsSelection<
  T extends { id: string; alunos?: { id: string }[] }
>(
  currentStudentIds: string[],
  currentTurmaIds: string[],
  targetTurmaId: string,
  modalityTurmas: T[],
  eligibleStudentIds: Iterable<string>
): { nextStudentIds: string[]; nextTurmaIds: string[] } {
  const eligibleSet = new Set(eligibleStudentIds);
  const targetTurma = modalityTurmas.find((t) => t.id === targetTurmaId);
  if (!targetTurma) {
    return { nextStudentIds: currentStudentIds, nextTurmaIds: currentTurmaIds };
  }

  const isCurrentlySelected = currentTurmaIds.includes(targetTurmaId);
  const targetEligibleIds = (targetTurma.alunos || [])
    .map((a) => a.id)
    .filter((id) => eligibleSet.has(id));

  if (!isCurrentlySelected) {
    const nextTurmaIds = Array.from(new Set([...currentTurmaIds, targetTurmaId]));
    const nextStudentIds = Array.from(
      new Set([...currentStudentIds, ...targetEligibleIds])
    );
    return { nextStudentIds, nextTurmaIds };
  }

  // Ao desmarcar a turma, mantém alunos que pertençam a outra turma que continue marcada
  const nextTurmaIds = currentTurmaIds.filter((id) => id !== targetTurmaId);
  const protectedByOtherSelectedTurmas = new Set<string>();
  for (const turma of modalityTurmas) {
    if (!nextTurmaIds.includes(turma.id)) continue;
    for (const aluno of turma.alunos || []) {
      if (eligibleSet.has(aluno.id)) {
        protectedByOtherSelectedTurmas.add(aluno.id);
      }
    }
  }

  const removeSet = new Set(
    targetEligibleIds.filter((id) => !protectedByOtherSelectedTurmas.has(id))
  );
  const nextStudentIds = currentStudentIds.filter((id) => !removeSet.has(id));

  return { nextStudentIds, nextTurmaIds };
}



