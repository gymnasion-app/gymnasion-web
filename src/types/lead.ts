export interface LeadPayload {
  nome: string;
  email: string;
  modalidade: string | null;
  aceitaNovidades: boolean;
  captchaToken: string;
}
