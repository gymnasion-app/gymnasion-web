// src/types/sessionDetail.ts
import type { TipoMetrica, ResponsavelPreenchimento } from "./metric";

export interface MetricaDesempenhoDetalhe {
  metricaId: string;
  titulo: string;
  tipo: TipoMetrica;
  obrigatoria: boolean;
  quemPreenche: ResponsavelPreenchimento;
  ativa: boolean;
  valor: string | null;
  correcaoPermitida: boolean;
  inclusaoPermitida: boolean;
}

export interface DesempenhoDetalheResponse {
  sessaoId: string;
  rotinaTreinoId: string;
  rotinaTitulo?: string | null;
  modalidadeNome?: string | null;
  desempenhoId: string;
  alunoId: string;
  nomeAluno: string;
  semana: number;
  dataPlanejada: string;
  dataReal?: string | null;
  duracao?: number | null;
  atividades?: string | null;
  status: "PLANEJADA" | "CONCLUIDA" | "CANCELADA";
  concluidaAluno: boolean;
  validadaPersonal: boolean;
  nivelCansaco?: number | null;
  registradoPor?: string | null;
  dataRegistro?: string | null;
  observacoes?: string | null;
  metricas: MetricaDesempenhoDetalhe[];
}

export interface AuditoriaDesempenhoItem {
  id: string;
  tipoOperacao: "INCLUSAO" | "CORRECAO";
  tipoAlteracao?: "INCLUSAO" | "CORRECAO";
  campo: "DATA_REAL" | "OBSERVACOES" | "METRICA";
  metricaId?: string | null;
  tituloMetrica?: string | null;
  metricaTitulo?: string | null;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  usuarioId: string;
  nomeUsuario: string;
  responsavelNome?: string;
  responsavelRole?: string;
  dataHora: string;
  dataHoraAlteracao?: string;
}

export interface CorrigirDesempenhoPayload {
  dataReal?: string | null;
  observacoes?: string | null;
  metricas?: Array<{
    metricaId: string;
    valor: string;
  }>;
}

export interface AtualizarSessaoTreinoPayload {
  semana: number;
  dataPlanejada: string;
  duracao?: number | null;
  atividades?: string | null;
}

export interface ObservacaoFeedbackResponse {
  id: string;
  autorId: string;
  nomeAutor: string;
  papelAutor: "PERSONAL_TRAINER" | "ALUNO";
  conteudo: string;
  dataCriacao: string;
}
