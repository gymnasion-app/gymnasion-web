import { api } from "./api";
import type { PaginatedOrArray } from "../types/api";
import { unpackPage } from "../types/api";
import type { Modalidade } from "../types/modalidade";

export const modalidadeService = {
  async listarTodas(params?: { page?: number; size?: number; apenasAtivas?: boolean }): Promise<Modalidade[]> {
    const { data } = await api.get<PaginatedOrArray<Modalidade>>("/api/modalidades", {
      params: { size: 100, apenasAtivas: true, ...params },
    });
    return unpackPage(data);
  },
};
