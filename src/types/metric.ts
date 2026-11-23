import type { CampoStrava } from './strava';

export type { CampoStrava };

export type TipoMetrica =
  | 'NUMERICO'
  | 'TEMPO'
  | 'FREQUENCIA_CARDIACA'
  | 'TEXTO';

export type ResponsavelPreenchimento = 'ALUNO' | 'PERSONAL' | 'AMBOS';

export interface MetricaResponseDTO {
  id: string;
  titulo: string;
  tipo: TipoMetrica;
  unidade?: string | null;
  modalidadeId: number;
  nomeModalidade?: string;
  modalidade?: { id: number; nome: string };
  obrigatoria?: boolean;
  quemPreenche?: ResponsavelPreenchimento;
  campoStrava?: CampoStrava | null;
  ativo?: boolean;
  quantidadeAlunosComRegistros?: number;
  possuiHistorico?: boolean;
}

export interface CriarMetricaRequestDTO {
  modalidadeId: number;
  titulo: string;
  tipo: TipoMetrica;
  unidade?: string | null;
  obrigatoria?: boolean;
  quemPreenche?: ResponsavelPreenchimento;
  campoStrava?: CampoStrava | null;
}

export interface AtualizarMetricaRequestDTO {
  titulo: string;
  tipo: TipoMetrica;
  unidade?: string | null;
  obrigatoria?: boolean;
  quemPreenche?: ResponsavelPreenchimento;
  campoStrava?: CampoStrava | null;
}

export interface MensagemResponseDTO {
  mensagem: string;
}

export function getMetricStudentCount(m: MetricaResponseDTO): number {
  return m.quantidadeAlunosComRegistros ?? 0;
}

export function isMetricActive(m: MetricaResponseDTO): boolean {
  if (typeof m.ativo === 'boolean') {
    return m.ativo;
  }
  return true;
}