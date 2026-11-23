export type CampoStrava =
  | 'DISTANCIA_KM'
  | 'DISTANCIA_METROS'
  | 'TEMPO_MOVIMENTO'
  | 'TEMPO_TOTAL'
  | 'DURACAO_MINUTOS'
  | 'VELOCIDADE_MEDIA_KMH'
  | 'VELOCIDADE_MAXIMA_KMH'
  | 'RITMO_MEDIO'
  | 'FREQUENCIA_CARDIACA_MEDIA'
  | 'FREQUENCIA_CARDIACA_MAXIMA'
  | 'CADENCIA_MEDIA'
  | 'POTENCIA_MEDIA_WATTS'
  | 'POTENCIA_MAXIMA_WATTS'
  | 'ELEVACAO_GANHO_METROS'
  | 'CALORIAS'
  | 'NENHUM';

export interface StravaAuthUrlResponse {
  authUrl: string;
  mock: boolean;
}

export interface StravaConectarRequest {
  code: string;
  scope?: string;
  state?: string;
}

export interface StravaStatusResponse {
  conectado: boolean;
  expirado: boolean;
  atletaId?: number | null;
  nomeAtleta?: string | null;
  mock: boolean;
}

export interface StravaAtividade {
  id: string;
  nome: string;
  tipo: string;
  esporte: string;
  data: string; // YYYY-MM-DD
  dataHora?: string;
  distanciaMetros?: number;
  distanciaKm?: number;
  distanciaFormatada?: string;
  tempoSegundos?: number;
  tempoFormatado?: string;
  duracaoMinutos?: number;
  frequenciaCardiacaMedia?: number | null;
  frequenciaCardiacaMaxima?: number | null;
  ritmoMedio?: string;
  tempoTotalFormatado?: string;
  cadenciaMedia?: number | null;
  potenciaMediaWatts?: number | null;
  potenciaMaximaWatts?: number | null;
  elevacaoGanhoMetros?: number | null;
  velocidadeMediaKmh?: number | null;
  velocidadeMaximaKmh?: number | null;
  calorias?: number | null;
  /** Velocidade média bruta (m/s), usada para converter o ritmo à unidade da métrica. */
  velocidadeMediaMs?: number | null;
}

export type CampoStravaGrupo =
  | 'Preenchimento manual'
  | 'Distância e Altimetria'
  | 'Tempo e Duração'
  | 'Ritmo e Velocidade'
  | 'Frequência Cardíaca'
  | 'Cadência e Potência'
  | 'Energia';

export interface CampoStravaOption {
  value: CampoStrava;
  label: string;
  group: CampoStravaGrupo;
  description: string;
  sensorWarning?: string;
  unidade?: string | null;
  tiposValidos: string[];
}

export const CAMPO_STRAVA_OPTIONS: CampoStravaOption[] = [
  {
    value: 'NENHUM',
    label: 'Nenhum (Preenchimento Manual)',
    group: 'Preenchimento manual',
    description: 'Desvincula a métrica do Strava ao salvar e permite digitação manual.',
    unidade: null,
    tiposValidos: ['NUMERICO', 'TEMPO', 'FREQUENCIA_CARDIACA', 'TEXTO'],
  },
  // Distância e Altimetria
  {
    value: 'DISTANCIA_KM',
    label: 'Distância em km (ex: 4,02)',
    group: 'Distância e Altimetria',
    description: 'Distância total percorrida convertida para quilômetros.',
    sensorWarning: 'Requer atividade com GPS ou distância registrada no Strava.',
    unidade: 'km',
    tiposValidos: ['NUMERICO'],
  },
  {
    value: 'DISTANCIA_METROS',
    label: 'Distância em metros (ex: 4017)',
    group: 'Distância e Altimetria',
    description: 'Distância total percorrida em metros (ideal para natação ou tiro em pista).',
    sensorWarning: 'Requer GPS ou registro de distância na piscina.',
    unidade: 'm',
    tiposValidos: ['NUMERICO'],
  },
  {
    value: 'ELEVACAO_GANHO_METROS',
    label: 'Ganho de Elevação em metros (ex: 120)',
    group: 'Distância e Altimetria',
    description: 'Desnível positivo acumulado ao longo da atividade.',
    sensorWarning: 'Requer GPS ou altímetro barométrico no dispositivo.',
    unidade: 'm',
    tiposValidos: ['NUMERICO'],
  },
  // Tempo e Duração
  {
    value: 'TEMPO_MOVIMENTO',
    label: 'Tempo em Movimento (ex: 34:40)',
    group: 'Tempo e Duração',
    description: 'Duração ativa registrada enquanto o atleta estava em movimento (moving_time).',
    unidade: 'mm:ss',
    tiposValidos: ['TEMPO'],
  },
  {
    value: 'TEMPO_TOTAL',
    label: 'Tempo Total / Elapsed Time (ex: 35:10)',
    group: 'Tempo e Duração',
    description: 'Tempo total decorrido do início ao fim da atividade, incluindo pausas (elapsed_time).',
    unidade: 'mm:ss',
    tiposValidos: ['TEMPO'],
  },
  {
    value: 'DURACAO_MINUTOS',
    label: 'Duração em minutos inteiros (ex: 35)',
    group: 'Tempo e Duração',
    description: 'Tempo em movimento arredondado para minutos inteiros.',
    unidade: 'min',
    tiposValidos: ['NUMERICO'],
  },
  // Ritmo e Velocidade
  {
    value: 'RITMO_MEDIO',
    label: 'Ritmo / Pace médio (ex: 05:13 min/km)',
    group: 'Ritmo e Velocidade',
    description: 'Ritmo médio por trecho (min/km, min/100m na natação ou min/500m no remo).',
    sensorWarning: 'Requer GPS ou distância válida; não aplicável ao ciclismo (prefira Velocidade Média km/h).',
    unidade: 'min/km',
    tiposValidos: ['TEMPO'],
  },
  {
    value: 'VELOCIDADE_MEDIA_KMH',
    label: 'Velocidade Média em km/h (ex: 19,9)',
    group: 'Ritmo e Velocidade',
    description: 'Velocidade média da atividade em km/h (recomendado para ciclismo).',
    unidade: 'km/h',
    tiposValidos: ['NUMERICO'],
  },
  {
    value: 'VELOCIDADE_MAXIMA_KMH',
    label: 'Velocidade Máxima em km/h (ex: 39,6)',
    group: 'Ritmo e Velocidade',
    description: 'Pico de velocidade registrado na atividade em km/h.',
    unidade: 'km/h',
    tiposValidos: ['NUMERICO'],
  },
  // Frequência Cardíaca
  {
    value: 'FREQUENCIA_CARDIACA_MEDIA',
    label: 'Frequência Cardíaca Média em bpm (ex: 140)',
    group: 'Frequência Cardíaca',
    description: 'Batimentos cardíacos médios durante a atividade.',
    sensorWarning: 'Requer cinta peitoral ou sensor óptico de FC no dispositivo.',
    unidade: 'bpm',
    tiposValidos: ['FREQUENCIA_CARDIACA'],
  },
  {
    value: 'FREQUENCIA_CARDIACA_MAXIMA',
    label: 'Frequência Cardíaca Máxima em bpm (ex: 178)',
    group: 'Frequência Cardíaca',
    description: 'Maior frequência cardíaca atingida durante a atividade.',
    sensorWarning: 'Requer cinta peitoral ou sensor óptico de FC no dispositivo.',
    unidade: 'bpm',
    tiposValidos: ['FREQUENCIA_CARDIACA'],
  },
  // Cadência e Potência
  {
    value: 'CADENCIA_MEDIA',
    label: 'Cadência Média - spm ou rpm (ex: 170)',
    group: 'Cadência e Potência',
    description: 'Passos por minuto (corrida) ou rotações por minuto do pedal (ciclismo).',
    sensorWarning: 'Requer sensor de cadência ou relógio compatível; o sistema dobra o valor na corrida.',
    unidade: 'spm',
    tiposValidos: ['NUMERICO'],
  },
  {
    value: 'POTENCIA_MEDIA_WATTS',
    label: 'Potência Média em Watts (ex: 175)',
    group: 'Cadência e Potência',
    description: 'Potência média gerada ao longo da atividade.',
    sensorWarning: 'Requer medidor de potência (bike ou remo ergômetro).',
    unidade: 'W',
    tiposValidos: ['NUMERICO'],
  },
  {
    value: 'POTENCIA_MAXIMA_WATTS',
    label: 'Potência Máxima em Watts (ex: 406)',
    group: 'Cadência e Potência',
    description: 'Pico máximo de potência registrado na atividade.',
    sensorWarning: 'Requer medidor de potência (bike ou remo ergômetro).',
    unidade: 'W',
    tiposValidos: ['NUMERICO'],
  },
  // Energia
  {
    value: 'CALORIAS',
    label: 'Gasto Calórico em kcal (ex: 380)',
    group: 'Energia',
    description: 'Estimativa de calorias gastas na atividade.',
    sensorWarning: 'Carregado sob demanda ao selecionar a atividade; sujeito à disponibilidade no Strava.',
    unidade: 'kcal',
    tiposValidos: ['NUMERICO'],
  },
];
