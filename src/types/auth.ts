export interface SignUpAlunoPayload {
  nome: string;
  email: string;
  password: string;
  cpf: string;
  celular: string;
  aceitouTermos: boolean;
}

export interface SignUpAlunoResponse {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  celular: string;
  role: string;
}

export interface SignUpPersonalPayload {
  nome: string;
  email: string;
  password: string;
  cpf: string;       
  celular: string;   
  modalidade: number; 
  aceitouTermos: boolean;
  captchaToken: string;
}

export interface SignUpPersonalResponse {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  celular: string;
  role: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  captchaToken: string;
}

export type UserRole = "PERSONAL_TRAINER" | "ALUNO" | "ADMIN";

export interface LoginResponse {
  token: string;
  id: string;
  role: UserRole;
}