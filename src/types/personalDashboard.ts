import type { RoutineMetricSummary } from "./rotina";

export interface PersonalNotification {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  referenciaId: string | null;
  dataCriacao: string;
}
export interface TrainingSession {
  id: string;
  rotinaTreinoId: string;
  semana: number;
  dataPlanejada: string;
  dataReal: string | null;
  duracao: number | null;
  atividades: string;
  status: "PLANEJADA" | "CONCLUIDA" | "CANCELADA";
  concluidaAluno: boolean;
  validadaPersonal: boolean;
  metricasIds?: string[];
  metricas?: RoutineMetricSummary[];
  temPendenciasPersonal?: boolean;
  quantidadePendenciasPersonal?: number;
  desempenho: {
    id: string;
    dataRegistro: string;
    nivelCansaco: number | null;
    registradoPor: string;
    alunoId: string | null;
    nomeAluno: string | null;
    metricas: { id: string; metricaId: string; tituloMetrica: string; tipoMetrica: string; valor: string }[];
  } | null;
}
export interface StudentHistory { alunoId: string; sessions: TrainingSession[] }
