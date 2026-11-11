import { Modalidade } from "./modalidade";

export interface UsuarioAluno {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  celular: string;
  role: string;
}

export interface AlunoResponse {
  id: string;
  usuario: UsuarioAluno;
  personalId: string;
  nomePersonal: string;
  status: "PENDENTE" | "ATIVO" | "INATIVO" | "RECUSADO" | string;
  modalidades: Modalidade[];
}

export type AlunoPendente = AlunoResponse;

export interface ConviteAlunoPayload {
  modalidadeId?: number;
  modalidadesIds?: number[];
  emailAluno?: string;
}

export interface AtualizarModalidadesPayload {
  modalidadesIds: number[];
}

export interface ConviteAlunoResponse {
  url: string;
  emailEnviado?: string;
}