import { api } from "./api";
import type {
  StravaAuthUrlResponse,
  StravaConectarRequest,
  StravaStatusResponse,
  StravaAtividade
} from "../types/strava";

const BASE_URL = "/api/alunos/strava";

export const stravaService = {
  // Aluno
  async obterAuthUrl(): Promise<StravaAuthUrlResponse> {
    const res = await api.get<StravaAuthUrlResponse>(`${BASE_URL}/auth-url`);
    return res.data;
  },

  async conectar(dados: StravaConectarRequest): Promise<StravaStatusResponse> {
    const res = await api.post<StravaStatusResponse>(`${BASE_URL}/conectar`, dados);
    return res.data;
  },

  async obterStatus(): Promise<StravaStatusResponse> {
    const res = await api.get<StravaStatusResponse>(`${BASE_URL}/status`);
    return res.data;
  },

  async desconectar(): Promise<void> {
    await api.delete(`${BASE_URL}/desconectar`);
  },

  async listarAtividades(limite = 10): Promise<StravaAtividade[]> {
    const res = await api.get<StravaAtividade[]>(`${BASE_URL}/atividades`, {
      params: { limite }
    });
    return res.data;
  },

  async obterDetalheAtividade(atividadeId: string): Promise<StravaAtividade> {
    const res = await api.get<StravaAtividade>(
      `${BASE_URL}/atividades/${encodeURIComponent(atividadeId)}`
    );
    return res.data;
  },

  // Personal Trainer
  async obterStatusAluno(alunoId: string): Promise<StravaStatusResponse> {
    const res = await api.get<StravaStatusResponse>(`/api/personal-trainers/alunos/${encodeURIComponent(alunoId)}/strava/status`);
    return res.data;
  },

  async listarAtividadesAluno(alunoId: string, limite = 10): Promise<StravaAtividade[]> {
    const res = await api.get<StravaAtividade[]>(`/api/personal-trainers/alunos/${encodeURIComponent(alunoId)}/strava/atividades`, {
      params: { limite }
    });
    return res.data;
  },

  async obterDetalheAtividadeAluno(alunoId: string, atividadeId: string): Promise<StravaAtividade> {
    const res = await api.get<StravaAtividade>(
      `/api/personal-trainers/alunos/${encodeURIComponent(alunoId)}/strava/atividades/${encodeURIComponent(atividadeId)}`
    );
    return res.data;
  }
};
