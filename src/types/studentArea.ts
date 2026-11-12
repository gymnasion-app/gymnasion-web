import type { CampoStrava, TipoMetrica } from "./metric";

export type StudentSessionStatus = "PLANEJADA" | "CONCLUIDA" | "VALIDADA";

export interface StudentSessionMetricResult {
  metricaId: string;
  titulo: string;
  tipo: TipoMetrica | string;
  valor: string;
  unidade?: string;
}

export interface StudentWorkoutSession {
  id: string;
  numero: number;
  semana: number;
  diaSemana: string;
  dataPlanejada: string; // DD/MM
  dataPlanejadaIso: string; // YYYY-MM-DD
  horario?: string;
  titulo: string;
  descricao: string;
  local?: string;
  duracaoPlanejada?: number;
  duracaoReal?: number | null;
  dataReal?: string | null;
  status: StudentSessionStatus;
  destaque?: boolean;
  rpe?: number | null;
  resultados?: StudentSessionMetricResult[];
  metricas?: StudentExecutionMetricDTO[];
  rotinaTreinoId?: string;
  rotinaTitulo?: string;
  modalidadeId?: number;
  modalidadeNome?: string;
}

export interface StudentRoutineWeek {
  numero: number;
  titulo: string;
  periodo: string;
  estado: "anterior" | "atual" | "bloqueada";
  disponivelEm?: string;
  sessoes: StudentWorkoutSession[];
}

export interface StudentHistoricalRoutine {
  id: string;
  titulo: string;
  periodo: string;
  semanas: number;
  status: "ENCERRADA";
  modalidade: string;
  objetivo: string;
  sessoesConcluidas: number;
}

export interface StudentFeedbackItem {
  id: string;
  autorNome: string;
  autorIniciais: string;
  tempoRelativo: string;
  conteudo: string;
  novo?: boolean;
}

export interface StudentWeekDaySummary {
  id: string;
  label: string;
  status: "completed" | "today" | "planned" | "rest";
}

export interface StudentEvolutionChart {
  id: string;
  titulo: string;
  subtitulo: string;
  valorPrincipal: string;
  unidade: string;
  badgeTexto: string;
  badgeTone: "success" | "neutral" | "warning" | "info" | "primary";
  cor: "blue" | "orange" | "red" | "purple";
  eixoX: string[];
  valores: number[];
}

export type EvolutionPeriodKey = "4w" | "3m" | "6m";

export interface StudentEvolutionPeriodData {
  key: EvolutionPeriodKey;
  label: string;
  bannerTexto: string;
  graficos: StudentEvolutionChart[];
}

// Espelha DashboardEvolucaoResponseDTO do back-end (GET /api/alunos/evolucao).
export interface StudentEvolutionMetricPoint {
  sessaoId: string;
  data: string;
  valor: string;
  valorNumerico: number | null;
  formatado?: string;
}

export interface StudentEvolutionMetricSeries {
  metricaId: string;
  titulo: string;
  tipo: TipoMetrica | string;
  descontinuada: boolean;
  statusMetrica?: string;
  tendencia?: {
    direcao?: string;
    indicadorVisual?: string;
    resumo?: string;
  } | null;
  pontos: StudentEvolutionMetricPoint[];
}

export interface StudentEvolutionRpePoint {
  sessaoId: string;
  data: string;
  nivelCansaco: number;
  descricao?: string;
}

export interface StudentEvolutionResponseDTO {
  aluno?: { id: string; nome: string; email: string } | null;
  modalidade?: { id: number; nome: string } | null;
  modalidadesDisponiveis?: { id: number; nome: string }[];
  periodo?: { dataInicio: string; dataFim: string } | null;
  possuiDadosSuficientes: boolean;
  mensagem?: string;
  metricas: StudentEvolutionMetricSeries[];
  evolucaoRpe?: {
    totalSessoesComRpe: number;
    possuiDadosSuficientes: boolean;
    mensagem?: string;
    mediaRpe: number | null;
    ultimoRpe: number | null;
    direcaoTendencia?: string;
    pontos: StudentEvolutionRpePoint[];
  } | null;
}

export interface StudentExecutionMetricDTO {
  id: string;
  titulo: string;
  tipo: TipoMetrica | string;
  unidade?: string | null;
  obrigatoria: boolean;
  quemPreenche: "ALUNO" | "PERSONAL" | "AMBOS";
  campoStrava?: CampoStrava | null;
}

export interface StudentExecutionFormDTO {
  sessao?: {
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
  };
  registroPermitido?: boolean;
  metricas: StudentExecutionMetricDTO[];
}

export interface StudentExecutionPayloadDTO {
  dataReal: string;
  duracao: number | null;
  nivelCansaco: number | null;
  resultados: { metricaId: string; valor: string }[];
}

export interface StudentHistorySessionDTO {
  id?: string;
  sessaoId?: string;
  rotinaId?: string;
  rotinaTreinoId?: string;
  semana?: number;
  dataPlanejada: string;
  dataReal: string | null;
  duracao: number | null;
  atividades?: string;
  nivelCansaco?: number | null;
  concluidaAluno?: boolean;
  validadaPersonal?: boolean;
  validadoPeloPersonal?: boolean;
  status: string;
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
  resultados?: {
    metricaId: string;
    metricaTitulo: string;
    tipo: string;
    valor: string;
  }[];
}

export interface StudentFeedbackDTO {
  id: string;
  autorNome: string;
  autorRole: string;
  conteudo: string;
  dataHora: string;
}
