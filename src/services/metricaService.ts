import { api } from "./api";
import { modalidadeService } from "./modalidadeService";
import type { PaginatedOrArray } from "../types/api";
import { unpackPage } from "../types/api";
import {
  MetricaResponseDTO,
  CriarMetricaRequestDTO,
  AtualizarMetricaRequestDTO,
  MensagemResponseDTO,
} from '../types/metric';

function sanitizeBackendTipo(tipo: string): 'FREQUENCIA_CARDIACA' | 'TEXTO' | 'TEMPO' | 'NUMERICO' {
  if (tipo === 'TEMPO' || tipo === 'TEXTO' || tipo === 'FREQUENCIA_CARDIACA' || tipo === 'NUMERICO') {
    return tipo;
  }
  return 'NUMERICO';
}

export const metricaService = {
  async listarTodas(params?: { page?: number; size?: number }): Promise<MetricaResponseDTO[]> {
    // O endpoint exige modalidadeId, inclusive para a visão de todas as métricas.
    const modalities = await modalidadeService.listarTodas();
    const lists = await Promise.all(modalities.map(modality => metricaService.listarPorModalidade(modality.id, params)));
    return Array.from(new Map(lists.flat().map(metric => [metric.id, metric])).values());
  },

  async listarPorModalidade(modalidadeId: number, params?: { page?: number; size?: number }): Promise<MetricaResponseDTO[]> {
    const response = await api.get<PaginatedOrArray<MetricaResponseDTO>>('/api/personal-trainers/metricas', {
      params: { modalidadeId, size: 100, ...params },
    });
    return unpackPage(response.data);
  },

  async criarMetrica(data: CriarMetricaRequestDTO): Promise<MetricaResponseDTO> {
    const payload: CriarMetricaRequestDTO = {
      ...data,
      tipo: sanitizeBackendTipo(data.tipo),
      unidade: data.unidade === '' ? null : (data.unidade ?? null),
    };
    const response = await api.post<MetricaResponseDTO>('/api/personal-trainers/metricas', payload);
    return response.data;
  },

  async atualizarMetrica(
    id: string,
    data: AtualizarMetricaRequestDTO
  ): Promise<MetricaResponseDTO> {
    const payload: AtualizarMetricaRequestDTO = {
      ...data,
      tipo: sanitizeBackendTipo(data.tipo),
      ...(data.unidade !== undefined ? { unidade: data.unidade } : {}),
    };
    const response = await api.put<MetricaResponseDTO>(
      `/api/personal-trainers/metricas/${id}`,
      payload
    );
    return response.data;
  },

  async excluirMetrica(id: string): Promise<MensagemResponseDTO> {
    const response = await api.delete<MensagemResponseDTO>(
      `/api/personal-trainers/metricas/${id}`
    );
    return response.data;
  },
};
