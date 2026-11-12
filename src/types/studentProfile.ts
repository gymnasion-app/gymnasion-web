import type { TrainingSession } from "./personalDashboard";

export interface RotinaAtivaAcompanhamento {
  rotinaId: string;
  rotinaTitulo: string;
  modalidadeId: number | null;
  modalidadeNome: string;
  frequenciaSemanal?: number;
  quantidadeMetricasPendentes: number;
  totalSessoesPlanejadas?: number;
  totalSessoesConcluidas?: number;
  sessoes: StudentTracking["sessoes"];
}

export interface StudentTracking {
  alunoId: string;
  rotinaAtivaId: string | null;
  quantidadeMetricasPendentes: number;
  sessoes: (Omit<TrainingSession, "id" | "rotinaTreinoId"> & {
    sessaoId: string;
    temPendenciasPersonal: boolean;
    quantidadePendenciasPersonal: number;
  })[];
  rotinasAtivas?: RotinaAtivaAcompanhamento[];
}
export interface SessionExecution {
  alunoId: string;
  dataReal: string;
  duracao: number | null;
  nivelCansaco: number | null;
  resultados: { metricaId: string; valor: string }[];
}
