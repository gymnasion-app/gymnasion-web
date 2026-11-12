import type { TipoMetrica } from "./metric";

export type RoutineStatus = "ATIVA" | "ENCERRADA";

export interface RoutineMetricSummary {
  id: string;
  titulo: string;
  tipo: TipoMetrica;
  obrigatoria?: boolean;
  quemPreenche?: "ALUNO" | "PERSONAL" | "AMBOS";
  campoStrava?: import("./strava").CampoStrava | null;
}

export interface RotinaResponse {
  id: string;
  titulo: string;
  modalidadeId: number;
  nomeModalidade: string;
  modalidade?: { id: number; nome: string };
  frequenciaSemanal: number;
  objetivos: string | null;
  status?: RoutineStatus;
  ativo?: boolean;
  alunos: { id: string; nome: string | null }[];
  metricas: RoutineMetricSummary[];
}

export interface CriarRotinaPayload {
  titulo: string;
  modalidadeId: number;
  frequenciaSemanal: number;
  objetivos: string;
  alunosIds: string[];
}

export interface ReutilizarRotinaPayload {
  alunoId: string;
  dataInicio: string; // YYYY-MM-DD
  titulo: string;
  objetivos: string;
}

export interface SessaoTreinoPlanejadaDTO {
  id: string;
  rotinaTreinoId?: string;
  semana: number;
  dataPlanejada: string;
  dataReal?: string | null;
  duracao?: number | null;
  atividades: string;
  status: string;
  concluidaAluno?: boolean;
  validadaPersonal?: boolean;
  metricasIds?: string[];
  metricas?: RoutineMetricSummary[];
  desempenho?: {
    id: string;
    nivelCansaco: number | null;
    registradoPor?: string;
    metricas?: {
      id?: string;
      metricaId: string;
      titulo?: string;
      tituloMetrica?: string;
      tipo?: string;
      tipoMetrica?: string;
      valor: string;
    }[];
  } | null;
}

export interface PlanejamentoSemanaDTO {
  numeroSemana: number;
  sessoes: SessaoTreinoPlanejadaDTO[];
}

export interface PlanejamentoRotinaResponseDTO {
  rotinaId: string;
  tituloRotina: string;
  modalidadeId?: number;
  nomeModalidade?: string;
  frequenciaSemanal?: number;
  objetivos?: string | null;
  semanas: PlanejamentoSemanaDTO[];
}

export interface CriarSessaoTreinoPayload {
  semana: number;
  dataPlanejada: string; // YYYY-MM-DD
  duracao?: number | null;
  atividades?: string | null;
  metricasIds?: string[];
}

export interface DuplicarSessaoPayload {
  semana: number;
  dataPlanejada: string; // YYYY-MM-DD
}

