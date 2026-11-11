import { api } from "./api";
import { session } from "./session";
import type { LoginPayload, LoginResponse, SignUpPersonalPayload, SignUpPersonalResponse, SignUpAlunoPayload, SignUpAlunoResponse } from "../types/auth";

export const authService = {
  async login(payload: LoginPayload, remember = false): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>("/api/auth/login", payload);

    session.save(data, remember, payload.email);

    return data;
  },

  logout(): void {
    session.clear();
  },

  async registroPersonal(payload: SignUpPersonalPayload): Promise<SignUpPersonalResponse> {
    const { data } = await api.post<SignUpPersonalResponse>("/api/auth/registro-personal", payload);
    return data;
  },

  async registroAlunoConvite(token: string, payload: SignUpAlunoPayload): Promise<SignUpAlunoResponse> {
    const { data } = await api.post<SignUpAlunoResponse>(
      "/api/auth/registro-aluno-convite",
      payload,
      { params: { token } }
    );
    return data;
  },
};
