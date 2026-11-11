import type { TrainingSession } from "../../types/personalDashboard";
import type { PlanejamentoRotinaResponseDTO, RotinaResponse } from "../../types/rotina";
import type { TipoMetrica } from "../../types/metric";
import type { StudentTracking } from "../../types/studentProfile";
import { localDateKey } from "../personal/dashboardModel";

export type RoutineMetric = RotinaResponse["metricas"][number];
export type MetricSeries = { id: string; title: string; type: TipoMetrica | "RPE"; points: { date: string; value: number }[] };
export const metricLabels: Record<TipoMetrica, string> = {
  TEMPO: "Tempo",
  TEMPO_CRONOMETRO: "Tempo",
  NUMERICO: "Numérico",
  FREQUENCIA_CARDIACA: "Freq. cardíaca",
  TEXTO: "Texto",
  TEXTO_OBSERVACAO: "Texto",
};
export const metricIcons: Record<TipoMetrica, string> = {
  TEMPO: "imgIconClock",
  TEMPO_CRONOMETRO: "imgIconClock",
  NUMERICO: "imgIconHash",
  FREQUENCIA_CARDIACA: "imgIconHeart",
  TEXTO: "imgIconText",
  TEXTO_OBSERVACAO: "imgIconText",
};

export function metricError(type: TipoMetrica, value: string): string | undefined {
  const text = value.trim();
  if (!text) return;
  if (text.length > 255) return "Use até 255 caracteres.";
  if (type === "TEMPO" && !/^\d+:[0-5]\d$/.test(text)) return "Use minutos e segundos, por exemplo 01:42.";
  if (type === "NUMERICO" && (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text) || !Number.isFinite(Number(text.replace(",", "."))))) return "Informe um valor numérico.";
  if (type === "FREQUENCIA_CARDIACA" && (!/^\d+$/.test(text) || Number(text) < 30 || Number(text) > 250)) return "Informe um número inteiro entre 30 e 250 bpm.";
}
export function serializeMetric(metric: RoutineMetric, value: string) {
  const text = value.trim();
  if (metric.tipo === "TEMPO") { const [minutes, seconds] = text.split(":"); return minutes.padStart(2, "0") + ":" + seconds; }
  return metric.tipo === "NUMERICO" ? text.replace(",", ".") : text;
}
export function sessionCandidates(tracking: StudentTracking | null, studentId: string) {
  return (tracking?.sessoes || []).filter(item => item.status === "PLANEJADA" && (!item.desempenho?.alunoId || item.desempenho.alunoId === studentId));
}
export function ownHistory(sessions: TrainingSession[], studentId: string) {
  return [
    ...new Map(
      sessions
        .filter(
          (item) =>
            item.status === "CONCLUIDA" &&
            item.dataReal &&
            (!item.desempenho?.alunoId || item.desempenho.alunoId === studentId)
        )
        .map((item) => [item.id, item])
    ).values(),
  ].sort((a, b) => (b.dataReal || b.dataPlanejada).localeCompare(a.dataReal || a.dataPlanejada));
}

/**
 * Retorna exclusivamente as sessões pertencentes à rotina ativa do aluno (planejadas e concluídas).
 * Nunca mistura sessões de rotinas anteriores/encerradas.
 */
export function buildActiveRoutineSessions(
  activeRoutine: RotinaResponse | null | undefined,
  tracking: StudentTracking | null,
  historySessions: TrainingSession[],
  studentId: string
): TrainingSession[] {
  if (!activeRoutine || activeRoutine.ativo === false) {
    return [];
  }

  const byId = new Map<string, TrainingSession>();

  // 1. Se o acompanhamento (tracking) corresponde à rotina ativa, inclui todas as sessões (planejadas e concluídas)
  if (tracking && tracking.rotinaAtivaId === activeRoutine.id) {
    for (const s of tracking.sessoes || []) {
      if (s.status === "CANCELADA") continue;
      if (s.desempenho?.alunoId && s.desempenho.alunoId !== studentId) continue;
      byId.set(s.sessaoId, {
        id: s.sessaoId,
        rotinaTreinoId: activeRoutine.id,
        semana: s.semana,
        dataPlanejada: s.dataPlanejada,
        dataReal: s.dataReal,
        duracao: s.duracao,
        atividades: s.atividades,
        status: s.status,
        concluidaAluno: s.concluidaAluno,
        validadaPersonal: s.validadaPersonal,
        temPendenciasPersonal: s.temPendenciasPersonal,
        quantidadePendenciasPersonal: s.quantidadePendenciasPersonal,
        desempenho: s.desempenho,
      });
    }
  }

  // 2. Complementa com sessões do histórico que pertençam estritamente ao ID da rotina ativa
  for (const h of historySessions) {
    if (h.rotinaTreinoId !== activeRoutine.id) continue;
    if (h.desempenho?.alunoId && h.desempenho.alunoId !== studentId) continue;
    const existing = byId.get(h.id);
    byId.set(h.id, existing ? { ...h, ...existing } : h);
  }

  return [...byId.values()];
}

/**
 * Sintetiza um objeto StudentTracking escopado ao aluno a partir do planejamento da rotina
 * e do histórico de sessões do próprio aluno (para rotinas ativas secundárias).
 */
export function buildTrackingFromPlanning(
  studentId: string,
  routine: RotinaResponse,
  planning: PlanejamentoRotinaResponseDTO,
  historySessions: TrainingSession[]
): StudentTracking {
  const routineHistory = historySessions.filter(
    (h) =>
      h.rotinaTreinoId === routine.id &&
      (!h.desempenho?.alunoId || h.desempenho.alunoId === studentId)
  );
  const plannedSessions = (planning.semanas || []).flatMap((w) => w.sessoes || []);
  const usedHistoryIds = new Set<string>();
  const matchedByPlannedId = new Map<string, TrainingSession>();

  // Passada 1: correspondência exata por ID da sessão
  for (const s of plannedSessions) {
    const exact = routineHistory.find((h) => h.id === s.id && !usedHistoryIds.has(h.id));
    if (exact) {
      usedHistoryIds.add(exact.id);
      matchedByPlannedId.set(s.id, exact);
    }
  }

  // Passada 2: fallback por semana + dataPlanejada sem reutilizar sessões já associadas
  for (const s of plannedSessions) {
    if (matchedByPlannedId.has(s.id)) continue;
    const fallback = routineHistory.find(
      (h) =>
        !usedHistoryIds.has(h.id) &&
        h.semana === s.semana &&
        h.dataPlanejada === s.dataPlanejada
    );
    if (fallback) {
      usedHistoryIds.add(fallback.id);
      matchedByPlannedId.set(s.id, fallback);
    }
  }

  const personalRequiredMetrics = (routine.metricas || []).filter(
    (m) =>
      (m.quemPreenche === "PERSONAL" || m.quemPreenche === "AMBOS") &&
      m.obrigatoria !== false
  );

  let quantidadeMetricasPendentes = 0;

  const sessoes: StudentTracking["sessoes"] = plannedSessions
    .filter((s) => s.status !== "CANCELADA")
    .map((s) => {
      const matched = matchedByPlannedId.get(s.id);
      const isCompleted = Boolean(matched);
      const desempenho = matched?.desempenho ?? null;

      const pendingPersonalCount = isCompleted
        ? personalRequiredMetrics.filter((m) => {
            const val = desempenho?.metricas.find((entry) => entry.metricaId === m.id)?.valor;
            return !val || !val.trim();
          }).length
        : 0;

      quantidadeMetricasPendentes += pendingPersonalCount;

      return {
        sessaoId: s.id,
        semana: s.semana,
        dataPlanejada: s.dataPlanejada,
        dataReal: matched?.dataReal ?? null,
        duracao: matched ? matched.duracao : s.duracao ?? null,
        atividades: s.atividades,
        status: isCompleted ? "CONCLUIDA" : "PLANEJADA",
        concluidaAluno: matched?.concluidaAluno ?? isCompleted,
        validadaPersonal: matched?.validadaPersonal ?? false,
        temPendenciasPersonal: pendingPersonalCount > 0,
        quantidadePendenciasPersonal: pendingPersonalCount,
        desempenho,
      };
    });

  return {
    alunoId: studentId,
    rotinaAtivaId: routine.id,
    quantidadeMetricasPendentes,
    sessoes,
  };
}

export function metricNumber(type: string, value: string): number | null {
  if (type === "TEXTO" || !value.trim()) return null;
  if (type === "TEMPO") { if (!/^\d+:[0-5]\d$/.test(value)) return null; const [m,s] = value.split(":").map(Number); return m*60+s; }
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}
export function formatMetric(value: number, type: string) {
  if (type === "TEMPO") { const total = Math.round(value); return `${Math.floor(total/60)}:${String(total%60).padStart(2,"0")}`; }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}
export function evolutionSeries(sessions: TrainingSession[], metrics: RoutineMetric[], from: string, to: string): MetricSeries[] {
  const definitions = new Map(metrics.filter(m=>m.tipo!=="TEXTO").map(m=>[m.id,{id:m.id,title:m.titulo,type:m.tipo}]));
  sessions.forEach(s=>s.desempenho?.metricas.forEach(m=>{ if(m.tipoMetrica!=="TEXTO" && !definitions.has(m.metricaId)) definitions.set(m.metricaId,{id:m.metricaId,title:m.tituloMetrica,type:m.tipoMetrica as TipoMetrica}); }));
  const all: Omit<MetricSeries,"points">[] = [...definitions.values(),{id:"rpe",title:"Nível de esforço (RPE)",type:"RPE"}];
  return all.map(metric=>({ ...metric, points:sessions.filter(s=>s.dataReal && s.dataReal>=from && s.dataReal<=to).flatMap(session=>{
    const entry = session.desempenho?.metricas.find(m=>m.metricaId===metric.id);
    const value = metric.id==="rpe" ? session.desempenho?.nivelCansaco : entry ? metricNumber(entry.tipoMetrica,entry.valor) : null;
    return typeof value === "number" && Number.isFinite(value) ? [{date:session.dataReal!,value}] : [];
  }).sort((a,b)=>a.date.localeCompare(b.date)) }));
}
export function weekDays(tracking: StudentTracking | null, studentId: string, now = new Date()) {
  const validSessions = (tracking?.sessoes || []).filter(
    (s) => s.status !== "CANCELADA" && (!s.desempenho?.alunoId || s.desempenho.alunoId === studentId)
  );

  const buildForMonday = (mondayDate: Date) =>
    Array.from({ length: 7 }, (_, i) => {
      const day = new Date(mondayDate);
      day.setDate(day.getDate() + i);
      const date = localDateKey(day);
      const sessions = validSessions.filter((s) => (s.dataReal || s.dataPlanejada) === date);
      return {
        date,
        label: ["S", "T", "Q", "Q", "S", "S", "D"][i],
        completed: sessions.filter((s) => s.status === "CONCLUIDA" || s.concluidaAluno).length,
        planned: sessions.length,
        today: date === localDateKey(now),
      };
    });

  const calendarMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  calendarMonday.setDate(calendarMonday.getDate() - ((calendarMonday.getDay() + 6) % 7));
  const calendarDays = buildForMonday(calendarMonday);

  if (calendarDays.some((d) => d.planned > 0) || validSessions.length === 0) {
    return calendarDays;
  }

  // Se a semana calendário atual não possui sessões, usa a semana de referência da rotina ativa (primeira com sessão pendente ou última semana)
  const pendingSession = validSessions.find((s) => s.status === "PLANEJADA");
  const targetWeekNum = pendingSession
    ? pendingSession.semana
    : validSessions[validSessions.length - 1].semana;
  const weekSessions = validSessions.filter((s) => s.semana === targetWeekNum);
  const refDateStr = (weekSessions[0] || validSessions[0]).dataPlanejada;
  const [y, m, d] = refDateStr.split("-").map(Number);
  if (y && m && d) {
    const refMonday = new Date(y, m - 1, d);
    refMonday.setDate(refMonday.getDate() - ((refMonday.getDay() + 6) % 7));
    return buildForMonday(refMonday);
  }

  return calendarDays;
}
