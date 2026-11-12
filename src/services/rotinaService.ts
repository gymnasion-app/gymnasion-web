import { api } from "./api";
import type { PaginatedOrArray } from "../types/api";
import { unpackPage } from "../types/api";
import type {
  CriarRotinaPayload,
  CriarSessaoTreinoPayload,
  DuplicarSessaoPayload,
  PlanejamentoRotinaResponseDTO,
  ReutilizarRotinaPayload,
  RotinaResponse,
  SessaoTreinoPlanejadaDTO,
} from "../types/rotina";

const BASE_URL = "/api/personal-trainers/rotinas";

export const rotinaService = {
  async listar(params?: { page?: number; size?: number }): Promise<RotinaResponse[]> {
    const { data } = await api.get<PaginatedOrArray<RotinaResponse>>(BASE_URL, {
      params: { size: 100, ...params },
    });
    return unpackPage(data);
  },

  async buscarPorId(id: string): Promise<RotinaResponse> {
    const { data } = await api.get<RotinaResponse>(`${BASE_URL}/${id}`);
    return data;
  },

  async listarPorAluno(alunoId: string, params?: { page?: number; size?: number }): Promise<RotinaResponse[]> {
    const { data } = await api.get<PaginatedOrArray<RotinaResponse>>(`${BASE_URL}/aluno/${alunoId}`, {
      params: { size: 100, ...params },
    });
    return unpackPage(data);
  },

  async criar(payload: CriarRotinaPayload): Promise<RotinaResponse> {
    const { data } = await api.post<RotinaResponse>(BASE_URL, payload);
    return data;
  },

  async atualizar(id: string, payload: Omit<CriarRotinaPayload, "modalidadeId">): Promise<RotinaResponse> {
    const { data } = await api.put<RotinaResponse>(`${BASE_URL}/${id}`, payload);
    return data;
  },

  async excluir(id: string): Promise<{ mensagem?: string }> {
    const { data } = await api.delete<{ mensagem?: string }>(`${BASE_URL}/${id}`);
    return data;
  },

  async encerrar(id: string): Promise<RotinaResponse> {
    const { data } = await api.patch<RotinaResponse>(`${BASE_URL}/${id}/encerrar`);
    return data;
  },

  async vincularAlunos(id: string, alunosIds: string[]): Promise<RotinaResponse> {
    const { data } = await api.post<RotinaResponse>(`${BASE_URL}/${id}/alunos`, { alunosIds });
    return data;
  },

  async vincularTurma(rotinaId: string, turmaId: string, substituirConflitos?: boolean): Promise<RotinaResponse> {
    const config = substituirConflitos ? { params: { substituirConflitos: true } } : undefined;
    const { data } = await api.post<RotinaResponse>(
      `${BASE_URL}/${rotinaId}/turmas/${turmaId}`,
      undefined,
      config
    );
    return data;
  },

  async desvincularAluno(id: string, alunoId: string): Promise<{ mensagem?: string }> {
    const { data } = await api.delete<{ mensagem?: string }>(`${BASE_URL}/${id}/alunos/${alunoId}`);
    return data;
  },

  async reutilizar(id: string, payload: ReutilizarRotinaPayload): Promise<RotinaResponse> {
    const { data } = await api.post<RotinaResponse>(`${BASE_URL}/${id}/reutilizar`, payload);
    return data;
  },

  async consultarPlanejamento(id: string): Promise<PlanejamentoRotinaResponseDTO> {
    const { data } = await api.get<PlanejamentoRotinaResponseDTO>(`${BASE_URL}/${id}/planejamento`);
    return data;
  },

  async adicionarSessao(id: string, payload: CriarSessaoTreinoPayload): Promise<SessaoTreinoPlanejadaDTO> {
    const { data } = await api.post<SessaoTreinoPlanejadaDTO>(`${BASE_URL}/${id}/sessoes`, payload);
    return data;
  },

  async duplicarSessao(sessaoId: string, payload: DuplicarSessaoPayload): Promise<SessaoTreinoPlanejadaDTO> {
    const { data } = await api.post<SessaoTreinoPlanejadaDTO>(
      `${BASE_URL}/sessoes/${encodeURIComponent(sessaoId)}/duplicar`,
      payload
    );
    return data;
  },

  async duplicarSemana(id: string, semanaOrigem: number): Promise<PlanejamentoRotinaResponseDTO> {
    const { data } = await api.post<PlanejamentoRotinaResponseDTO>(
      `${BASE_URL}/${encodeURIComponent(id)}/semanas/${semanaOrigem}/duplicar`
    );
    return data;
  },
};

