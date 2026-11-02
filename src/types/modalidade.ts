export interface Modalidade {
  id: number;
  nome: string;
  descricao: string;
  ativo?: boolean;
}

export interface ModalidadeResponseDTO {
  id: number;
  nome: string;
  descricao?: string;
  ativo?: boolean;
}
