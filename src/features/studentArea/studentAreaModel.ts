import type {
  EvolutionPeriodKey,
  StudentEvolutionPeriodData,
  StudentFeedbackItem,
  StudentHistoricalRoutine,
  StudentRoutineWeek,
  StudentWeekDaySummary,
  StudentWorkoutSession,
} from "../../types/studentArea";
import type { PlanejamentoSemanaDTO, RotinaResponse } from "../../types/rotina";
import type { StudentActiveRoutineInfo } from "./StudentContext";
import { parseAtividades } from "../../utils/activityParser";

export interface BorgLevelInfo {
  level: number;
  tone: "green" | "amber" | "orange" | "red";
  title: string;
  description: string;
}

export const BORG_SCALE: Record<number, BorgLevelInfo> = {
  1: {
    level: 1,
    tone: "green",
    title: "Muito, muito leve",
    description: "Esforço quase imperceptível, respiração totalmente livre.",
  },
  2: {
    level: 2,
    tone: "green",
    title: "Muito leve",
    description: "Sensação confortável, conversa fácil durante toda a atividade.",
  },
  3: {
    level: 3,
    tone: "green",
    title: "Leve",
    description: "Aquecimento confortável, mantém conversa completa sem dificuldade.",
  },
  4: {
    level: 4,
    tone: "green",
    title: "Moderado leve",
    description: "Respiração mais profunda, mas ainda confortável e sustentável.",
  },
  5: {
    level: 5,
    tone: "amber",
    title: "Moderado",
    description: "Ritmo constante de trabalho, exige concentração para manter.",
  },
  6: {
    level: 6,
    tone: "amber",
    title: "Moderado a intenso",
    description: "Respiração ofegante, fala apenas frases curtas.",
  },
  7: {
    level: 7,
    tone: "orange",
    title: "Muito intenso",
    description: "Difícil manter uma conversa durante o esforço.",
  },
  8: {
    level: 8,
    tone: "orange",
    title: "Muito, muito intenso",
    description: "Esforço vigoroso no limite aeróbico, fala apenas poucas palavras.",
  },
  9: {
    level: 9,
    tone: "red",
    title: "Quase máximo",
    description: "Esforço extremo, sustentável apenas por curtos intervalos.",
  },
  10: {
    level: 10,
    tone: "red",
    title: "Esforço máximo",
    description: "Capacidade máxima absoluta, impossível manter por muito tempo.",
  },
};

export function getBorgInfo(level: number | null): {
  levelLabel: string;
  title: string;
  description: string;
  tone: "green" | "amber" | "orange" | "red" | "neutral";
} {
  if (level === null || !BORG_SCALE[level]) {
    return {
      levelLabel: "—",
      title: "Esforço não informado",
      description: "Você pode selecionar um valor de 1 a 10 ou pular esta etapa.",
      tone: "neutral",
    };
  }
  const info = BORG_SCALE[level];
  return {
    levelLabel: String(info.level),
    title: info.title,
    description: info.description,
    tone: info.tone,
  };
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isSuspendedLoginError(message: string): boolean {
  const norm = normalizeText(message || "");
  return (
    norm.includes("suspens") ||
    norm.includes("inativ") ||
    norm.includes("desativad") ||
    norm.includes("rn-014")
  );
}

export function formatLoginToast(message: string): { title: string; message: string } {
  if (isSuspendedLoginError(message)) {
    return {
      title: "Seu acesso está suspenso",
      message: "Entre em contato com seu personal.",
    };
  }
  return {
    title: message || "E-mail ou senha inválidos.",
    message: "Verifique os dados e tente novamente.",
  };
}

export function sportKeyFromName(name?: string | null): string {
  const raw = (name || "").trim();
  if (!raw) return "natacao";
  const norm = normalizeText(raw);
  if (norm.includes("tenis")) return "tenis";
  if (norm.includes("corr")) return "corrida";
  if (norm.includes("acad") || norm.includes("musc")) return "academia";
  if (norm.includes("cicl")) return "ciclismo";
  if (norm.includes("func")) return "funcional";
  if (norm.includes("natac")) return "natacao";
  return raw;
}

export function filterStudentSessions(
  sessions: StudentWorkoutSession[],
  query: string
): StudentWorkoutSession[] {
  const q = normalizeText(query.trim());
  if (!q) return sessions;
  return sessions.filter((s) => {
    const target = normalizeText(
      `${s.titulo} ${s.descricao} ${s.diaSemana} ${s.dataPlanejada} ${s.status} ${s.modalidadeNome || ""} ${s.rotinaTitulo || ""}`
    );
    return target.includes(q);
  });
}

export function applySessionExecution(
  weeks: StudentRoutineWeek[],
  sessionId: string,
  rpe: number | null,
  realDateLabel = "hoje",
  resultados?: StudentWorkoutSession["resultados"],
  duracaoReal?: number | null
): StudentRoutineWeek[] {
  let nextHighlightAssigned = false;

  const updated = weeks.map((week) => {
    const sessoes = week.sessoes.map((sessao) => {
      if (sessao.id !== sessionId) return sessao;
      return {
        ...sessao,
        status: "CONCLUIDA" as const,
        destaque: false,
        rpe: rpe ?? sessao.rpe ?? null,
        dataReal: realDateLabel,
        duracaoReal: duracaoReal ?? sessao.duracaoReal ?? sessao.duracaoPlanejada,
        resultados: resultados && resultados.length > 0 ? resultados : sessao.resultados,
      };
    });
    return { ...week, sessoes };
  });

  // Marca a próxima sessão planejada da semana atual como destaque
  return updated.map((week) => {
    if (week.estado !== "atual") return week;
    const hasHighlight = week.sessoes.some((s) => s.destaque && s.status === "PLANEJADA");
    if (hasHighlight) return week;
    return {
      ...week,
      sessoes: week.sessoes.map((s) => {
        if (!nextHighlightAssigned && s.status === "PLANEJADA") {
          nextHighlightAssigned = true;
          return { ...s, destaque: true };
        }
        return s;
      }),
    };
  });
}

export function countCompletedSessions(weeks: StudentRoutineWeek[], baseCompleted = 0): number {
  const listedCompleted = weeks.reduce(
    (acc, w) => acc + w.sessoes.filter((s) => s.status !== "PLANEJADA").length,
    0
  );
  return Math.max(baseCompleted, listedCompleted);
}

export function formatDiaSemanaPt(isoDateStr?: string | null): string {
  if (!isoDateStr) return "S/D";
  try {
    const parts = isoDateStr.split("-").map(Number);
    if (parts.length < 3) return "S/D";
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = d.getDay();
    const map = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    return map[day] || "S/D";
  } catch {
    return "S/D";
  }
}

export function formatDataPlanejadaDdMm(isoDateStr?: string | null): string {
  if (!isoDateStr) return "--/--";
  const parts = isoDateStr.split("-");
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return isoDateStr;
}

function parseIsoCalendarUtc(isoDateStr?: string | null): Date | null {
  if (!isoDateStr) return null;
  const parts = isoDateStr.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoCalendarUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getMondayIso(isoDateStr: string): string {
  const utc = parseIsoCalendarUtc(isoDateStr);
  if (!utc) return isoDateStr;
  const dayOffset = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - dayOffset);
  return toIsoCalendarUtc(utc);
}

export function addDaysIso(isoDateStr: string, days: number): string {
  const utc = parseIsoCalendarUtc(isoDateStr);
  if (!utc) return isoDateStr;
  utc.setUTCDate(utc.getUTCDate() + days);
  return toIsoCalendarUtc(utc);
}

export function mapPlanningToWeeks(
  rotina: RotinaResponse,
  semanasBackend: PlanejamentoSemanaDTO[]
): {
  info: StudentActiveRoutineInfo;
  weeks: StudentRoutineWeek[];
  currentWeekNum: number;
} {
  let numSemanaAtual = 1;
  if (semanasBackend.length > 0) {
    const semanaComPendente = semanasBackend.find((sem) =>
      (sem.sessoes || []).some(
        (s) =>
          !s.concluidaAluno &&
          !s.validadaPersonal &&
          s.status !== "CONCLUIDA" &&
          s.status !== "VALIDADA"
      )
    );
    numSemanaAtual = semanaComPendente
      ? semanaComPendente.numeroSemana
      : semanasBackend[semanasBackend.length - 1].numeroSemana;
  }

  const info: StudentActiveRoutineInfo = {
    id: rotina.id,
    titulo: rotina.titulo,
    modalidade: rotina.nomeModalidade || rotina.modalidade?.nome || "Treino",
    modalidadeId: rotina.modalidadeId ?? rotina.modalidade?.id,
    frequenciaSemanal: rotina.frequenciaSemanal || 3,
    objetivos: rotina.objetivos || "Desenvolver resistência e capacidade física.",
    totalSemanas: Math.max(semanasBackend.length, numSemanaAtual),
    semanaAtual: numSemanaAtual,
    metricas: (rotina.metricas || []).map((m) => ({
      id: m.id,
      titulo: m.titulo,
      tipo: m.tipo,
      obrigatoria: Boolean(m.obrigatoria),
      quemPreenche: m.quemPreenche || "ALUNO",
    })),
  };

  let highlightAssigned = false;
  const weeks: StudentRoutineWeek[] = semanasBackend.map((sem) => {
    const isAtual = sem.numeroSemana === numSemanaAtual;
    const isAnterior = sem.numeroSemana < numSemanaAtual;
    const estado: "anterior" | "atual" | "bloqueada" = isAtual
      ? "atual"
      : isAnterior
      ? "anterior"
      : "bloqueada";

    const sessoes: StudentWorkoutSession[] = (sem.sessoes || []).map((s, idx) => {
      const status = (s.validadaPersonal || s.status === "VALIDADA"
        ? "VALIDADA"
        : s.concluidaAluno || s.status === "CONCLUIDA"
        ? "CONCLUIDA"
        : "PLANEJADA") as "PLANEJADA" | "CONCLUIDA" | "VALIDADA";

      let destaque = false;
      if (isAtual && status === "PLANEJADA" && !highlightAssigned) {
        destaque = true;
        highlightAssigned = true;
      }

      const diaSemana = formatDiaSemanaPt(s.dataPlanejada);
      const dataDdMm = formatDataPlanejadaDdMm(s.dataPlanejada);
      const rpe = s.desempenho?.nivelCansaco ?? null;
      const parsed = parseAtividades(s.atividades);
      const headline = parsed.sessionName || parsed.activities[0]?.title || "";

      return {
        id: s.id,
        numero: idx + 1,
        semana: sem.numeroSemana,
        diaSemana,
        dataPlanejada: dataDdMm,
        dataPlanejadaIso: s.dataPlanejada,
        titulo: headline ? `Sessão ${idx + 1} · ${headline}` : `Sessão ${idx + 1}`,
        descricao: s.atividades || "Sem descrição informada.",
        duracaoPlanejada: s.duracao || 50,
        duracaoReal: s.duracao,
        dataReal: s.dataReal ? formatDataPlanejadaDdMm(s.dataReal) : null,
        status,
        destaque,
        rpe,
        rotinaTreinoId: info.id,
        rotinaTitulo: info.titulo,
        modalidadeId: info.modalidadeId,
        modalidadeNome: info.modalidade,
        metricas: (s.metricas || []).map((m) => ({
          id: m.id,
          titulo: m.titulo,
          tipo: m.tipo,
          obrigatoria: Boolean(m.obrigatoria),
          quemPreenche: (m.quemPreenche || "ALUNO") as "PERSONAL" | "ALUNO" | "AMBOS",
          campoStrava: m.campoStrava,
        })),
        resultados: (s.desempenho?.metricas || []).map((m) => ({
          metricaId: m.metricaId,
          titulo: m.titulo || m.tituloMetrica || "Métrica",
          tipo: m.tipo || m.tipoMetrica || "NUMERICO",
          valor: m.valor,
        })),
      };
    });

    return {
      numero: sem.numeroSemana,
      titulo: `Semana ${sem.numeroSemana}`,
      periodo: isAtual ? "Semana atual" : isAnterior ? "anterior" : "bloqueada",
      estado,
      sessoes,
    };
  });

  return { info, weeks, currentWeekNum: numSemanaAtual };
}

/**
 * Agrupa sessões de múltiplas rotinas ativas por semanas civis reais (segunda a domingo)
 * com numeração sequencial e fallback automático da semana "atual".
 */
export function buildUnifiedCalendarWeeks(
  routinesData: Array<{ routine: StudentActiveRoutineInfo; weeks: StudentRoutineWeek[] }>,
  referenceIsoDate?: string
): StudentRoutineWeek[] {
  const buckets = new Map<string, StudentWorkoutSession[]>();

  for (const entry of routinesData) {
    for (const week of entry.weeks) {
      for (const session of week.sessoes) {
        const key = session.dataPlanejadaIso
          ? getMondayIso(session.dataPlanejadaIso)
          : `sem-${String(week.numero).padStart(4, "0")}`;
        const list = buckets.get(key) || [];
        list.push({
          ...session,
          rotinaTreinoId: session.rotinaTreinoId ?? entry.routine.id,
          rotinaTitulo: session.rotinaTitulo ?? entry.routine.titulo,
          modalidadeId: session.modalidadeId ?? entry.routine.modalidadeId,
          modalidadeNome: session.modalidadeNome ?? entry.routine.modalidade,
        });
        buckets.set(key, list);
      }
    }
  }

  const sortedKeys = [...buckets.keys()].sort((a, b) => a.localeCompare(b));
  if (sortedKeys.length === 0) return [];

  const todayIso =
    referenceIsoDate ||
    new Date().toLocaleDateString("sv-SE");
  const todayMondayIso = getMondayIso(todayIso);

  let currentKey = sortedKeys.find((key) => key === todayMondayIso);
  if (!currentKey) {
    const firstPendingKey = sortedKeys.find((key) => {
      if (key < todayMondayIso) return false;
      return (buckets.get(key) || []).some((s) => s.status === "PLANEJADA");
    });
    const earliestFutureOrCurrent = sortedKeys.find((key) => key >= todayMondayIso);
    const latestPendingPast = [...sortedKeys]
      .reverse()
      .find((key) => (buckets.get(key) || []).some((s) => s.status === "PLANEJADA"));
    currentKey =
      firstPendingKey ??
      earliestFutureOrCurrent ??
      latestPendingPast ??
      sortedKeys[sortedKeys.length - 1];
  }

  let highlightAssigned = false;

  return sortedKeys.map((key, idx) => {
    const isAtual = key === currentKey;
    const isAnterior = key < currentKey;
    const estado: "anterior" | "atual" | "bloqueada" = isAtual
      ? "atual"
      : isAnterior
      ? "anterior"
      : "bloqueada";

    const rawSessions = buckets.get(key) || [];
    const sortedSessions = [...rawSessions].sort((a, b) => {
      const dateCmp = (a.dataPlanejadaIso || "").localeCompare(b.dataPlanejadaIso || "");
      if (dateCmp !== 0) return dateCmp;
      const modCmp = (a.modalidadeNome || "").localeCompare(b.modalidadeNome || "", "pt-BR");
      if (modCmp !== 0) return modCmp;
      return a.numero - b.numero;
    });

    const sessoes = sortedSessions.map((s) => {
      let destaque = false;
      if (isAtual && s.status === "PLANEJADA" && !highlightAssigned) {
        destaque = true;
        highlightAssigned = true;
      }
      return {
        ...s,
        destaque,
      };
    });

    const isIsoWeek = /^\d{4}-\d{2}-\d{2}$/.test(key);
    const dateRange = isIsoWeek
      ? `${formatDataPlanejadaDdMm(key)} – ${formatDataPlanejadaDdMm(addDaysIso(key, 6))}`
      : isAtual
      ? "Semana atual"
      : isAnterior
      ? "anterior"
      : "bloqueada";

    return {
      numero: idx + 1,
      titulo: `Semana ${idx + 1}`,
      periodo: isIsoWeek && isAtual ? `${dateRange} · atual` : dateRange,
      estado,
      sessoes,
    };
  });
}


export function buildWeekDaysSummary(
  currentWeek?: StudentRoutineWeek | null
): StudentWeekDaySummary[] {
  const dayDefs: Array<{ id: string; label: string; code: string; jsDay: number }> = [
    { id: "mon", label: "S", code: "SEG", jsDay: 1 },
    { id: "tue", label: "T", code: "TER", jsDay: 2 },
    { id: "wed", label: "Q", code: "QUA", jsDay: 3 },
    { id: "thu", label: "Q", code: "QUI", jsDay: 4 },
    { id: "fri", label: "S", code: "SEX", jsDay: 5 },
    { id: "sat", label: "S", code: "SÁB", jsDay: 6 },
    { id: "sun", label: "D", code: "DOM", jsDay: 0 },
  ];

  const sessions = currentWeek?.sessoes || [];
  if (sessions.length === 0) {
    return dayDefs.map((d) => ({ id: d.id, label: d.label, status: "rest" }));
  }

  const todayJsDay = new Date().getDay();

  return dayDefs.map((d) => {
    const daySessions = sessions.filter((s) => s.diaSemana.toUpperCase() === d.code);
    if (daySessions.length === 0) {
      return { id: d.id, label: d.label, status: "rest" };
    }
    const allCompleted = daySessions.every(
      (s) => s.status === "CONCLUIDA" || s.status === "VALIDADA"
    );
    if (allCompleted) {
      return { id: d.id, label: d.label, status: "completed" };
    }
    const isHighlightOrToday =
      daySessions.some((s) => s.destaque) || d.jsDay === todayJsDay;
    return {
      id: d.id,
      label: d.label,
      status: isHighlightOrToday ? "today" : "planned",
    };
  });
}

export const INITIAL_WEEK_DAYS: StudentWeekDaySummary[] = [
  { id: "mon", label: "S", status: "completed" },
  { id: "tue", label: "T", status: "completed" },
  { id: "wed", label: "Q", status: "completed" },
  { id: "thu", label: "Q", status: "today" },
  { id: "fri", label: "S", status: "planned" },
  { id: "sat", label: "S", status: "planned" },
  { id: "sun", label: "D", status: "rest" },
];

export const INITIAL_ROUTINE_WEEKS: StudentRoutineWeek[] = [
  {
    numero: 2,
    titulo: "Semana 2",
    periodo: "28/09 – 04/10 · anterior",
    estado: "anterior",
    sessoes: [
      {
        id: "w2-s1",
        numero: 1,
        semana: 2,
        diaSemana: "SEG",
        dataPlanejada: "28/09",
        dataPlanejadaIso: "2026-09-28",
        horario: "07:30",
        titulo: "Sessão 1 · Educativos e respiração bilateral",
        descricao: "Aquecimento 300 m · 6×50 m educativos · 200 m solto · realizada em 28/09",
        local: "Piscina semiolímpica",
        duracaoPlanejada: 50,
        duracaoReal: 48,
        status: "VALIDADA",
        rpe: 6,
        resultados: [
          { metricaId: "m-ritmo", titulo: "Ritmo médio /100m", tipo: "TEMPO", valor: "01:46" },
          { metricaId: "m-fc", titulo: "FC média", tipo: "FREQUENCIA_CARDIACA", valor: "154 bpm" },
        ],
      },
      {
        id: "w2-s2",
        numero: 2,
        semana: 2,
        diaSemana: "QUA",
        dataPlanejada: "30/09",
        dataPlanejadaIso: "2026-09-30",
        horario: "07:30",
        titulo: "Sessão 2 · Série pirâmide aeróbica",
        descricao: "100m - 200m - 300m - 200m - 100m crawl · intervalo 25 s · realizada em 30/09",
        local: "Piscina semiolímpica",
        duracaoPlanejada: 55,
        duracaoReal: 54,
        status: "VALIDADA",
        rpe: 7,
        resultados: [
          { metricaId: "m-ritmo", titulo: "Ritmo médio /100m", tipo: "TEMPO", valor: "01:45" },
          { metricaId: "m-fc", titulo: "FC média", tipo: "FREQUENCIA_CARDIACA", valor: "155 bpm" },
        ],
      },
      {
        id: "w2-s3",
        numero: 3,
        semana: 2,
        diaSemana: "SEX",
        dataPlanejada: "02/10",
        dataPlanejadaIso: "2026-10-02",
        horario: "07:30",
        titulo: "Sessão 3 · Ritmo contínuo 1.200 m",
        descricao: "1.200 m contínuos · controle de viradas · realizada em 02/10",
        local: "Piscina semiolímpica",
        duracaoPlanejada: 60,
        duracaoReal: 58,
        status: "VALIDADA",
        rpe: 7,
        resultados: [
          { metricaId: "m-ritmo", titulo: "Ritmo médio /100m", tipo: "TEMPO", valor: "01:44" },
          { metricaId: "m-fc", titulo: "FC média", tipo: "FREQUENCIA_CARDIACA", valor: "153 bpm" },
        ],
      },
      {
        id: "w2-s4",
        numero: 4,
        semana: 2,
        diaSemana: "SÁB",
        dataPlanejada: "03/10",
        dataPlanejadaIso: "2026-10-03",
        horario: "08:30",
        titulo: "Sessão 4 · Soltura e mobilidade",
        descricao: "600 m técnica variada · alongamento escapular · realizada em 03/10",
        local: "Piscina semiolímpica",
        duracaoPlanejada: 45,
        duracaoReal: 45,
        status: "VALIDADA",
        rpe: 5,
        resultados: [
          { metricaId: "m-ritmo", titulo: "Ritmo médio /100m", tipo: "TEMPO", valor: "01:48" },
          { metricaId: "m-fc", titulo: "FC média", tipo: "FREQUENCIA_CARDIACA", valor: "142 bpm" },
        ],
      },
    ],
  },
  {
    numero: 3,
    titulo: "Semana 3",
    periodo: "05/10 – 11/10 · atual",
    estado: "atual",
    sessoes: [
      {
        id: "w3-s1",
        numero: 1,
        semana: 3,
        diaSemana: "SEG",
        dataPlanejada: "05/10",
        dataPlanejadaIso: "2026-10-05",
        horario: "07:30",
        titulo: "Sessão 1 · Técnica de crawl",
        descricao: "Aquecimento 400 m · 8×50 m educativos · 200 m solto",
        local: "Piscina semiolímpica",
        duracaoPlanejada: 50,
        duracaoReal: 50,
        status: "CONCLUIDA",
        rpe: 6,
        resultados: [
          { metricaId: "m-ritmo", titulo: "Ritmo médio /100m", tipo: "TEMPO", valor: "01:43" },
          { metricaId: "m-dist", titulo: "Distância total", tipo: "NUMERICO", valor: "1,0 km" },
          { metricaId: "m-fc", titulo: "FC média", tipo: "FREQUENCIA_CARDIACA", valor: "150 bpm" },
        ],
      },
      {
        id: "w3-s2",
        numero: 2,
        semana: 3,
        diaSemana: "QUA",
        dataPlanejada: "07/10",
        dataPlanejadaIso: "2026-10-07",
        horario: "07:30",
        titulo: "Sessão 2 · Ritmo 100 m",
        descricao: "10×100 m em 1:45 · intervalo 30 s · realizada em 08/10",
        local: "Piscina semiolímpica",
        duracaoPlanejada: 55,
        duracaoReal: 52,
        status: "CONCLUIDA",
        rpe: 7,
        resultados: [
          { metricaId: "m-ritmo", titulo: "Ritmo médio /100m", tipo: "TEMPO", valor: "01:42" },
          { metricaId: "m-dist", titulo: "Distância total", tipo: "NUMERICO", valor: "1,5 km" },
          { metricaId: "m-fc", titulo: "FC média", tipo: "FREQUENCIA_CARDIACA", valor: "152 bpm" },
        ],
      },
      {
        id: "w3-s3",
        numero: 3,
        semana: 3,
        diaSemana: "SEX",
        dataPlanejada: "09/10",
        dataPlanejadaIso: "2026-10-09",
        horario: "07:30",
        titulo: "Sessão 3 · Resistência aeróbica",
        descricao: "1.500 m contínuos · FC alvo 140–150 bpm",
        local: "Piscina semiolímpica",
        duracaoPlanejada: 60,
        status: "PLANEJADA",
        destaque: true,
      },
      {
        id: "w3-s4",
        numero: 4,
        semana: 3,
        diaSemana: "SÁB",
        dataPlanejada: "10/10",
        dataPlanejadaIso: "2026-10-10",
        horario: "08:30",
        titulo: "Sessão 4 · Recuperação ativa",
        descricao: "800 m técnica · alongamento",
        local: "Piscina semiolímpica",
        duracaoPlanejada: 45,
        status: "PLANEJADA",
        destaque: false,
      },
    ],
  },
  {
    numero: 4,
    titulo: "Semana 4",
    periodo: "disponível em 12/10",
    estado: "bloqueada",
    disponivelEm: "12/10",
    sessoes: [],
  },
];

export const INITIAL_HISTORICAL_ROUTINES: StudentHistoricalRoutine[] = [
  {
    id: "hist-1",
    titulo: "Técnica de crawl",
    periodo: "03/08 – 13/09/2026 · 6 semanas",
    semanas: 6,
    status: "ENCERRADA",
    modalidade: "Natação",
    objetivo: "Aprimorar alinhamento corporal, rolamento de tronco e eficiência de braçada.",
    sessoesConcluidas: 24,
  },
  {
    id: "hist-2",
    titulo: "Adaptação aquática",
    periodo: "01/06 – 26/07/2026 · 8 semanas",
    semanas: 8,
    status: "ENCERRADA",
    modalidade: "Natação",
    objetivo: "Construir base cardiorrespiratória e domínio de respiração bilateral.",
    sessoesConcluidas: 28,
  },
];

export const INITIAL_FEEDBACKS: StudentFeedbackItem[] = [
  {
    id: "fb-1",
    autorNome: "Rafael Souza",
    autorIniciais: "RS",
    tempoRelativo: "há 2 h",
    conteudo: "Ótima evolução nas viradas! Amanhã focamos em ritmo constante.",
    novo: true,
  },
  {
    id: "fb-2",
    autorNome: "Rafael Souza",
    autorIniciais: "RS",
    tempoRelativo: "ontem",
    conteudo: "A semana 3 da rotina Resistência 1500m já está disponível em Meus treinos.",
    novo: true,
  },
];

export const EVOLUTION_PERIODS: Record<EvolutionPeriodKey, StudentEvolutionPeriodData> = {
  "4w": {
    key: "4w",
    label: "4 semanas",
    bannerTexto: "Você reduziu seu ritmo em 8% nas últimas 4 semanas de Natação. Continue assim!",
    graficos: [
      {
        id: "pace",
        titulo: "Ritmo médio /100m",
        subtitulo: "Tempo · quanto menor, melhor",
        valorPrincipal: "1:42",
        unidade: "min/100m",
        badgeTexto: "▼ 8% melhora",
        badgeTone: "success",
        cor: "blue",
        eixoX: ["S1", "S2", "S3", "S4"],
        valores: [22, 38, 64, 86],
      },
      {
        id: "distance",
        titulo: "Distância semanal",
        subtitulo: "Numérico",
        valorPrincipal: "6,0",
        unidade: "km",
        badgeTexto: "▲ 15%",
        badgeTone: "success",
        cor: "orange",
        eixoX: ["S1", "S2", "S3", "S4"],
        valores: [35, 48, 68, 88],
      },
      {
        id: "hr",
        titulo: "Frequência cardíaca média",
        subtitulo: "Freq. cardíaca",
        valorPrincipal: "152",
        unidade: "bpm",
        badgeTexto: "▼ 3 bpm",
        badgeTone: "success",
        cor: "red",
        eixoX: ["S1", "S2", "S3", "S4"],
        valores: [78, 62, 42, 24],
      },
      {
        id: "rpe",
        titulo: "Nível de esforço (RPE)",
        subtitulo: "Escala de Borg CR-10",
        valorPrincipal: "6,1",
        unidade: "média",
        badgeTexto: "Estável",
        badgeTone: "neutral",
        cor: "purple",
        eixoX: ["S1", "S2", "S3", "S4"],
        valores: [30, 68, 45, 56],
      },
    ],
  },
  "3m": {
    key: "3m",
    label: "3 meses",
    bannerTexto: "Você reduziu seu ritmo em 6% nos últimos 3 meses de Natação. Continue assim!",
    graficos: [
      {
        id: "pace",
        titulo: "Ritmo médio /100m",
        subtitulo: "Tempo · quanto menor, melhor",
        valorPrincipal: "1:42",
        unidade: "min/100m",
        badgeTexto: "▼ 6% melhora",
        badgeTone: "success",
        cor: "blue",
        eixoX: ["Jul", "Ago", "Set", "Out"],
        valores: [14, 24, 38, 46, 58, 68, 84, 92],
      },
      {
        id: "distance",
        titulo: "Distância semanal",
        subtitulo: "Numérico",
        valorPrincipal: "6,0",
        unidade: "km",
        badgeTexto: "▲ 20%",
        badgeTone: "success",
        cor: "orange",
        eixoX: ["Jul", "Ago", "Set", "Out"],
        valores: [14, 24, 28, 30, 44, 62, 74, 90],
      },
      {
        id: "hr",
        titulo: "Frequência cardíaca média",
        subtitulo: "Freq. cardíaca",
        valorPrincipal: "152",
        unidade: "bpm",
        badgeTexto: "▼ 4 bpm",
        badgeTone: "success",
        cor: "red",
        eixoX: ["Jul", "Ago", "Set", "Out"],
        valores: [88, 76, 66, 58, 46, 36, 26, 14],
      },
      {
        id: "rpe",
        titulo: "Nível de esforço (RPE)",
        subtitulo: "Escala de Borg CR-10",
        valorPrincipal: "5,8",
        unidade: "média",
        badgeTexto: "Estável",
        badgeTone: "neutral",
        cor: "purple",
        eixoX: ["Jul", "Ago", "Set", "Out"],
        valores: [14, 86, 62, 48, 28, 86, 44, 58],
      },
    ],
  },
  "6m": {
    key: "6m",
    label: "6 meses",
    bannerTexto: "Você reduziu seu ritmo em 11% nos últimos 6 meses de Natação. Continue assim!",
    graficos: [
      {
        id: "pace",
        titulo: "Ritmo médio /100m",
        subtitulo: "Tempo · quanto menor, melhor",
        valorPrincipal: "1:42",
        unidade: "min/100m",
        badgeTexto: "▼ 11% melhora",
        badgeTone: "success",
        cor: "blue",
        eixoX: ["Mai", "Jun", "Jul", "Ago", "Set", "Out"],
        valores: [10, 22, 36, 52, 72, 92],
      },
      {
        id: "distance",
        titulo: "Distância semanal",
        subtitulo: "Numérico",
        valorPrincipal: "6,0",
        unidade: "km",
        badgeTexto: "▲ 32%",
        badgeTone: "success",
        cor: "orange",
        eixoX: ["Mai", "Jun", "Jul", "Ago", "Set", "Out"],
        valores: [12, 26, 38, 54, 72, 90],
      },
      {
        id: "hr",
        titulo: "Frequência cardíaca média",
        subtitulo: "Freq. cardíaca",
        valorPrincipal: "152",
        unidade: "bpm",
        badgeTexto: "▼ 7 bpm",
        badgeTone: "success",
        cor: "red",
        eixoX: ["Mai", "Jun", "Jul", "Ago", "Set", "Out"],
        valores: [92, 80, 68, 54, 34, 16],
      },
      {
        id: "rpe",
        titulo: "Nível de esforço (RPE)",
        subtitulo: "Escala de Borg CR-10",
        valorPrincipal: "5,9",
        unidade: "média",
        badgeTexto: "Estável",
        badgeTone: "neutral",
        cor: "purple",
        eixoX: ["Mai", "Jun", "Jul", "Ago", "Set", "Out"],
        valores: [22, 68, 48, 76, 44, 58],
      },
    ],
  },
};
