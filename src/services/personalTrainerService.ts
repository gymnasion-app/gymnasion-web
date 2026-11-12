import { api } from "./api";
import type { MensagemResponse, PaginatedOrArray } from "../types/api";
import { unpackPage } from "../types/api";
import type {
  AlunoResponse,
  AtualizarModalidadesPayload,
  ConviteAlunoPayload,
  ConviteAlunoResponse,
} from "../types/student";

export const personalTrainerService = {
  async gerarConvite(modalidadesIds: number | number[], emailAluno?: string): Promise<ConviteAlunoResponse> {
    const ids = Array.isArray(modalidadesIds) ? modalidadesIds : [modalidadesIds];
    const payload: ConviteAlunoPayload = {
      modalidadesIds: ids,
      modalidadeId: ids[0],
      emailAluno: emailAluno?.trim() || undefined,
    };
    const { data } = await api.post<ConviteAlunoResponse>(
      "/api/personal-trainers/convites",
      payload
    );
    return data;
  },

  async atualizarModalidades(alunoId: string, modalidadesIds: number[]): Promise<AlunoResponse> {
    const payload: AtualizarModalidadesPayload = { modalidadesIds };
    const { data } = await api.put<AlunoResponse>(
      `/api/personal-trainers/alunos/${encodeURIComponent(alunoId)}/modalidades`,
      payload
    );
    return data;
  },

  async listarPendentes(params?: { page?: number; size?: number }): Promise<AlunoResponse[]> {
    const { data } = await api.get<PaginatedOrArray<AlunoResponse>>(
      "/api/personal-trainers/alunos/pendentes",
      { params: { size: 100, ...params } }
    );
    return unpackPage(data);
  },

  async listarTodos(params?: { page?: number; size?: number }): Promise<AlunoResponse[]> {
    const { data } = await api.get<PaginatedOrArray<AlunoResponse>>(
      "/api/personal-trainers/alunos",
      { params: { size: 100, ...params } }
    );
    return unpackPage(data);
  },

  async listarInativos(params?: { page?: number; size?: number }): Promise<AlunoResponse[]> {
    const { data } = await api.get<PaginatedOrArray<AlunoResponse>>(
      "/api/personal-trainers/alunos/inativos",
      { params: { size: 100, ...params } }
    );
    return unpackPage(data);
  }, 

  async aprovarAtleta(alunoId: string): Promise<void> {
    await api.patch(`/api/personal-trainers/alunos/${alunoId}/aprovar`);
  },

  async recusarAtleta(alunoId: string): Promise<void> {
    await api.patch(`/api/personal-trainers/alunos/${alunoId}/recusar`);
  },

  async desativarAtleta(alunoId: string): Promise<MensagemResponse> {
    const { data } = await api.patch<MensagemResponse>(
      `/api/personal-trainers/alunos/${alunoId}/desativar`
    );
    return data;
  },

  async reativarAtleta(alunoId: string): Promise<MensagemResponse> {
    const { data } = await api.patch<MensagemResponse>(
      `/api/personal-trainers/alunos/${alunoId}/reativar`
    );
    return data;
  },
};