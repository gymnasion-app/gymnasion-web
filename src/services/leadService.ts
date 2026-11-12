import { api } from "./api";
import type { LeadPayload } from "../types/lead";

export const leadService = {
  async registrar(payload: LeadPayload): Promise<void> {
    await api.post("/api/leads", payload);
  },
};
