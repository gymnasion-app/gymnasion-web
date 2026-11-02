import type { MetricaResponseDTO, ResponsavelPreenchimento, TipoMetrica } from "../../types/metric";
import type { ModalidadeResponseDTO } from "../../types/modalidade";
import type { CampoStrava } from "../../types/strava";

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function getMetricStudentCount(m: MetricaResponseDTO): number {
  return m.quantidadeAlunosComRegistro ?? m.quantidadeAlunosComRegistros ?? 0;
}

export function isMetricActive(m: MetricaResponseDTO): boolean {
  if (typeof m.descontinuada === "boolean") {
    return !m.descontinuada;
  }
  if (typeof m.ativo === "boolean") {
    return m.ativo;
  }
  return true;
}

export function getPreenchimentoLabel(quem?: ResponsavelPreenchimento): string {
  if (quem === "ALUNO") return "aluno";
  if (quem === "PERSONAL") return "personal";
  return "aluno e personal";
}

export function normalizeTipo(tipo: TipoMetrica | string): "NUMERICO" | "TEMPO" | "FREQUENCIA_CARDIACA" | "TEXTO" {
  if (tipo === "TEMPO_CRONOMETRO" || tipo === "TEMPO") return "TEMPO";
  if (tipo === "TEXTO_OBSERVACAO" || tipo === "TEXTO") return "TEXTO";
  if (tipo === "FREQUENCIA_CARDIACA") return "FREQUENCIA_CARDIACA";
  return "NUMERICO";
}

export function toBackendTipoMetrica(
  tipo: TipoMetrica | string
): "FREQUENCIA_CARDIACA" | "TEXTO" | "TEMPO" | "NUMERICO" {
  if (tipo === "TEMPO_CRONOMETRO" || tipo === "TEMPO") return "TEMPO";
  if (tipo === "TEXTO_OBSERVACAO" || tipo === "TEXTO") return "TEXTO";
  if (tipo === "FREQUENCIA_CARDIACA") return "FREQUENCIA_CARDIACA";
  return "NUMERICO";
}

export interface MetricTypeOption {
  value: TipoMetrica;
  title: string;
  subtitle: string;
}

export const METRIC_TYPE_OPTIONS: MetricTypeOption[] = [
  {
    value: "NUMERICO",
    title: "Numérico",
    subtitle: "Valores numéricos (ex.: kg, metros)",
  },
  {
    value: "TEMPO",
    title: "Tempo / Cronômetro",
    subtitle: "Formato mm:ss ou hh:mm:ss · calcula ritmo médio",
  },
  {
    value: "FREQUENCIA_CARDIACA",
    title: "Frequência cardíaca",
    subtitle: "Faixa plausível em bpm",
  },
  {
    value: "TEXTO",
    title: "Texto / Observação",
    subtitle: "Anotações livres do personal",
  },
];

export function getMetricTypeDetails(tipo: TipoMetrica | string): {
  key: "NUMERICO" | "TEMPO" | "FREQUENCIA_CARDIACA" | "TEXTO";
  title: string;
  subtitle: string;
} {
  const norm = normalizeTipo(tipo);
  switch (norm) {
    case "TEMPO":
      return {
        key: "TEMPO",
        title: "Tempo / Cronômetro",
        subtitle: "Formato mm:ss ou hh:mm:ss · calcula ritmo médio",
      };
    case "FREQUENCIA_CARDIACA":
      return {
        key: "FREQUENCIA_CARDIACA",
        title: "Frequência cardíaca",
        subtitle: "Faixa plausível em bpm",
      };
    case "TEXTO":
      return {
        key: "TEXTO",
        title: "Texto / Observação",
        subtitle: "Anotações livres do personal",
      };
    case "NUMERICO":
    default:
      return {
        key: "NUMERICO",
        title: "Numérico",
        subtitle: "Valores numéricos (ex.: kg, metros)",
      };
  }
}

export function isMetricDuplicate(
  titulo: string,
  modalidadeId: number,
  existingMetrics: MetricaResponseDTO[],
  currentMetricId?: string
): boolean {
  const clean = normalizeText(titulo);
  if (!clean) return false;
  return existingMetrics.some(
    (m) =>
      m.id !== currentMetricId &&
      m.modalidadeId === modalidadeId &&
      isMetricActive(m) &&
      normalizeText(m.titulo) === clean
  );
}

export function metricModalityCounts(
  metrics: MetricaResponseDTO[],
  modalities: ModalidadeResponseDTO[],
  options?: { includeZero?: boolean; activeModalityId?: number | null }
): { id: number | null; nome: string; count: number }[] {
  const result: { id: number | null; nome: string; count: number }[] = [
    { id: null, nome: "Todas", count: metrics.length },
  ];

  for (const mod of modalities) {
    const count = metrics.filter((m) => m.modalidadeId === mod.id).length;
    // Apenas exibe esportes que possuam métricas cadastradas (count > 0)
    // ou se o esporte for o filtro atualmente selecionado na URL
    if (
      options?.includeZero ||
      count > 0 ||
      (options?.activeModalityId != null && options.activeModalityId === mod.id)
    ) {
      result.push({ id: mod.id, nome: mod.nome, count });
    }
  }

  return result;
}

export type MetricWorkspaceTab = "active" | "presets" | "discontinued";

export type MetricQuickFilter =
  | "ALL"
  | "TEMPO"
  | "NUMERICO"
  | "FREQUENCIA_CARDIACA"
  | "TEXTO"
  | "STRAVA";

export type MetricSortOption = "alpha" | "students_desc" | "type";

const STRAVA_SHORT_LABELS: Record<string, string> = {
  DISTANCIA_KM: "Distância (km)",
  DISTANCIA_METROS: "Distância (m)",
  TEMPO_MOVIMENTO: "Tempo em movimento",
  TEMPO_TOTAL: "Tempo total",
  DURACAO_MINUTOS: "Duração (min)",
  VELOCIDADE_MEDIA_KMH: "Velocidade média (km/h)",
  VELOCIDADE_MAXIMA_KMH: "Velocidade máx (km/h)",
  RITMO_MEDIO: "Pace / Ritmo médio",
  FREQUENCIA_CARDIACA_MEDIA: "FC Média (bpm)",
  FREQUENCIA_CARDIACA_MAXIMA: "FC Máxima (bpm)",
  CADENCIA_MEDIA: "Cadência média",
  POTENCIA_MEDIA_WATTS: "Potência média (W)",
  POTENCIA_MAXIMA_WATTS: "Potência máx (W)",
  ELEVACAO_GANHO_METROS: "Ganho de elevação (m)",
  CALORIAS: "Gasto calórico (kcal)",
};

export function hasStravaSync(m: Partial<MetricaResponseDTO>): boolean {
  return Boolean(m.campoStrava && m.campoStrava !== "NENHUM");
}

export function getStravaFieldLabel(campoStrava?: string | null): string {
  if (!campoStrava || campoStrava === "NENHUM") return "Preenchimento manual";
  return STRAVA_SHORT_LABELS[campoStrava] || campoStrava;
}

export function getMetricTypeBadgeStyle(tipo: TipoMetrica | string): {
  bg: string;
  color: string;
  border: string;
  label: string;
  unitHint: string;
} {
  const norm = normalizeTipo(tipo);
  switch (norm) {
    case "TEMPO":
      return {
        bg: "#eff8ff",
        color: "#175cd3",
        border: "#b2ddff",
        label: "Tempo / Cronômetro",
        unitHint: "Formato mm:ss",
      };
    case "FREQUENCIA_CARDIACA":
      return {
        bg: "#fff1f3",
        color: "#e11d48",
        border: "#fecdd3",
        label: "Frequência cardíaca",
        unitHint: "Faixa em bpm",
      };
    case "TEXTO":
      return {
        bg: "#fffaeb",
        color: "#b54708",
        border: "#fedf89",
        label: "Texto / Observação",
        unitHint: "Relato qualitativo",
      };
    case "NUMERICO":
    default:
      return {
        bg: "#f4f3ff",
        color: "#5925dc",
        border: "#d9d6fe",
        label: "Numérico",
        unitHint: "Carga, distância ou reps",
      };
  }
}

export function filterMetrics(
  metrics: MetricaResponseDTO[],
  selectedModalityId: number | null,
  searchQuery: string = "",
  options?: {
    typeFilter?: MetricQuickFilter;
    sortBy?: MetricSortOption;
    statusFilter?: "all" | "active" | "discontinued";
  }
): MetricaResponseDTO[] {
  let list = metrics;

  const statusFilter = options?.statusFilter || "all";
  if (statusFilter === "active") {
    list = list.filter((m) => isMetricActive(m));
  } else if (statusFilter === "discontinued") {
    list = list.filter((m) => !isMetricActive(m));
  }

  if (selectedModalityId !== null) {
    list = list.filter((m) => m.modalidadeId === selectedModalityId);
  }

  const typeFilter = options?.typeFilter || "ALL";
  if (typeFilter === "STRAVA") {
    list = list.filter((m) => hasStravaSync(m));
  } else if (typeFilter !== "ALL") {
    list = list.filter((m) => normalizeTipo(m.tipo) === typeFilter);
  }

  const cleanSearch = normalizeText(searchQuery);
  if (cleanSearch) {
    list = list.filter((m) => {
      const matchTitle = normalizeText(m.titulo).includes(cleanSearch);
      const matchMod = m.nomeModalidade
        ? normalizeText(m.nomeModalidade).includes(cleanSearch)
        : false;
      const matchStrava = hasStravaSync(m)
        ? normalizeText(getStravaFieldLabel(m.campoStrava)).includes(cleanSearch) ||
          "strava".includes(cleanSearch)
        : false;
      const matchType = normalizeText(getMetricTypeBadgeStyle(m.tipo).label).includes(
        cleanSearch
      );
      return matchTitle || matchMod || matchStrava || matchType;
    });
  }

  if (options?.sortBy) {
    list = [...list].sort((a, b) => {
      if (options.sortBy === "students_desc") {
        const diff = getMetricStudentCount(b) - getMetricStudentCount(a);
        if (diff !== 0) return diff;
      } else if (options.sortBy === "type") {
        const typeCmp = normalizeTipo(a.tipo).localeCompare(normalizeTipo(b.tipo));
        if (typeCmp !== 0) return typeCmp;
      }
      return a.titulo.localeCompare(b.titulo, "pt-BR");
    });
  }

  return list;
}

export interface PaginatedResult<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  pageNumbers: number[];
}

export function paginateMetrics<T>(
  items: T[],
  page: number,
  pageSize: number = 8
): PaginatedResult<T> {
  const safePageSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const offset = (currentPage - 1) * safePageSize;
  const pagedItems = items.slice(offset, offset + safePageSize);

  const startIndex = totalItems === 0 ? 0 : offset + 1;
  const endIndex = totalItems === 0 ? 0 : Math.min(offset + safePageSize, totalItems);

  const pageNumbers: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  return {
    items: pagedItems,
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    pageNumbers,
  };
}

export interface MetricPresetItem {
  presetId: string;
  titulo: string;
  descricao: string;
  tipo: TipoMetrica;
  obrigatoria: boolean;
  quemPreenche: ResponsavelPreenchimento;
  campoStrava: CampoStrava;
  modalidadeId: number;
  nomeModalidade: string;
  alreadyExists: boolean;
}

interface RawPresetDefinition {
  sportKeyword: string;
  fallbackSportName: string;
  titulo: string;
  descricao: string;
  tipo: TipoMetrica;
  obrigatoria: boolean;
  quemPreenche: ResponsavelPreenchimento;
  campoStrava: CampoStrava;
}

const MARKET_PRESET_DEFINITIONS: RawPresetDefinition[] = [
  // Natação (TrainingPeaks / Garmin Swim)
  {
    sportKeyword: "natacao",
    fallbackSportName: "Natação",
    titulo: "Ritmo médio 100m",
    descricao: "Pace de nado a cada 100m (padrão CSS / TrainingPeaks).",
    tipo: "TEMPO",
    obrigatoria: true,
    quemPreenche: "AMBOS",
    campoStrava: "TEMPO_MOVIMENTO",
  },
  {
    sportKeyword: "natacao",
    fallbackSportName: "Natação",
    titulo: "Distância total (m)",
    descricao: "Volume total nadado na sessão em metros.",
    tipo: "NUMERICO",
    obrigatoria: true,
    quemPreenche: "AMBOS",
    campoStrava: "DISTANCIA_METROS",
  },
  {
    sportKeyword: "natacao",
    fallbackSportName: "Natação",
    titulo: "Braçadas por piscina (SWOLF)",
    descricao: "Contagem média de ciclos de braçada por comprimento de piscina.",
    tipo: "NUMERICO",
    obrigatoria: false,
    quemPreenche: "ALUNO",
    campoStrava: "NENHUM",
  },
  {
    sportKeyword: "natacao",
    fallbackSportName: "Natação",
    titulo: "FC média na água",
    descricao: "Frequência cardíaca média aferida durante a série principal.",
    tipo: "FREQUENCIA_CARDIACA",
    obrigatoria: false,
    quemPreenche: "AMBOS",
    campoStrava: "FREQUENCIA_CARDIACA_MEDIA",
  },
  // Corrida (Strava / Garmin Run / SisRun)
  {
    sportKeyword: "corrida",
    fallbackSportName: "Corrida de Rua",
    titulo: "Pace médio (min/km)",
    descricao: "Ritmo médio por quilômetro importado automaticamente do Strava.",
    tipo: "TEXTO",
    obrigatoria: true,
    quemPreenche: "AMBOS",
    campoStrava: "RITMO_MEDIO",
  },
  {
    sportKeyword: "corrida",
    fallbackSportName: "Corrida de Rua",
    titulo: "Distância percorrida (km)",
    descricao: "Quilometragem total da sessão de corrida.",
    tipo: "NUMERICO",
    obrigatoria: true,
    quemPreenche: "AMBOS",
    campoStrava: "DISTANCIA_KM",
  },
  {
    sportKeyword: "corrida",
    fallbackSportName: "Corrida de Rua",
    titulo: "Cadência média (spm)",
    descricao: "Passadas por minuto para avaliação biomecânica de corrida.",
    tipo: "NUMERICO",
    obrigatoria: false,
    quemPreenche: "AMBOS",
    campoStrava: "CADENCIA_MEDIA",
  },
  {
    sportKeyword: "corrida",
    fallbackSportName: "Corrida de Rua",
    titulo: "Ganho de elevação (m)",
    descricao: "Altimetria acumulada em treinos de subida ou trail run.",
    tipo: "NUMERICO",
    obrigatoria: false,
    quemPreenche: "AMBOS",
    campoStrava: "ELEVACAO_GANHO_METROS",
  },
  // Academia / Musculação (Hevy / TrueCoach / Tecnofit)
  {
    sportKeyword: "academia",
    fallbackSportName: "Academia",
    titulo: "Carga máxima (kg)",
    descricao: "Peso utilizado na série principal ou teste de carga (1RM / PR).",
    tipo: "NUMERICO",
    obrigatoria: true,
    quemPreenche: "AMBOS",
    campoStrava: "NENHUM",
  },
  {
    sportKeyword: "academia",
    fallbackSportName: "Academia",
    titulo: "Percepção de esforço (RPE 1-10)",
    descricao: "Escala subjetiva de esforço de Borg/RIR ao final do treino.",
    tipo: "NUMERICO",
    obrigatoria: true,
    quemPreenche: "ALUNO",
    campoStrava: "NENHUM",
  },
  {
    sportKeyword: "academia",
    fallbackSportName: "Academia",
    titulo: "Repetições em reserva (RIR)",
    descricao: "Quantas repetições restavam antes da falha concêntrica.",
    tipo: "NUMERICO",
    obrigatoria: false,
    quemPreenche: "ALUNO",
    campoStrava: "NENHUM",
  },
  {
    sportKeyword: "academia",
    fallbackSportName: "Academia",
    titulo: "Sensação pós-treino / Dor articular",
    descricao: "Relato qualitativo sobre fadiga, pump ou desconfortos.",
    tipo: "TEXTO",
    obrigatoria: false,
    quemPreenche: "AMBOS",
    campoStrava: "NENHUM",
  },
  // Tênis
  {
    sportKeyword: "tenis",
    fallbackSportName: "Tênis",
    titulo: "Aproveitamento de 1º saque (%)",
    descricao: "Percentual de primeiros serviços convertidos em quadra.",
    tipo: "NUMERICO",
    obrigatoria: true,
    quemPreenche: "AMBOS",
    campoStrava: "NENHUM",
  },
  {
    sportKeyword: "tenis",
    fallbackSportName: "Tênis",
    titulo: "Tempo em quadra",
    descricao: "Duração efetiva da sessão técnica ou partida treino.",
    tipo: "TEMPO",
    obrigatoria: true,
    quemPreenche: "AMBOS",
    campoStrava: "TEMPO_MOVIMENTO",
  },
  {
    sportKeyword: "tenis",
    fallbackSportName: "Tênis",
    titulo: "Erros não forçados",
    descricao: "Contagem de erros não forçados em simulações de set.",
    tipo: "NUMERICO",
    obrigatoria: false,
    quemPreenche: "PERSONAL",
    campoStrava: "NENHUM",
  },
  // Crossfit / Funcional / Calistenia (Wodify / SugarWOD)
  {
    sportKeyword: "crossfit",
    fallbackSportName: "Crossfit",
    titulo: "Time Cap / Tempo do WOD",
    descricao: "Tempo de conclusão de treinos For Time no formato mm:ss.",
    tipo: "TEMPO",
    obrigatoria: true,
    quemPreenche: "AMBOS",
    campoStrava: "TEMPO_MOVIMENTO",
  },
  {
    sportKeyword: "crossfit",
    fallbackSportName: "Crossfit",
    titulo: "Total de Rounds / Reps (AMRAP)",
    descricao: "Pontuação total de repetições ou rounds atingidos no AMRAP.",
    tipo: "NUMERICO",
    obrigatoria: true,
    quemPreenche: "AMBOS",
    campoStrava: "NENHUM",
  },
  // Ciclismo / Spinning
  {
    sportKeyword: "ciclismo",
    fallbackSportName: "Ciclismo",
    titulo: "Potência média (Watts)",
    descricao: "Produção média de potência no pedal sincronizada via Strava.",
    tipo: "NUMERICO",
    obrigatoria: true,
    quemPreenche: "AMBOS",
    campoStrava: "POTENCIA_MEDIA_WATTS",
  },
  {
    sportKeyword: "ciclismo",
    fallbackSportName: "Ciclismo",
    titulo: "Velocidade média (km/h)",
    descricao: "Velocidade média da sessão de ciclismo indoor ou estrada.",
    tipo: "NUMERICO",
    obrigatoria: true,
    quemPreenche: "AMBOS",
    campoStrava: "VELOCIDADE_MEDIA_KMH",
  },
  // Pilates / Mobilidade
  {
    sportKeyword: "pilates",
    fallbackSportName: "Pilates",
    titulo: "Controle de core e alinhamento",
    descricao: "Observação clínica do instrutor sobre estabilidade e postura.",
    tipo: "TEXTO",
    obrigatoria: true,
    quemPreenche: "PERSONAL",
    campoStrava: "NENHUM",
  },
];

function matchModalityForKeyword(
  keyword: string,
  modalities: ModalidadeResponseDTO[]
): ModalidadeResponseDTO | undefined {
  return modalities.find((m) => {
    const norm = normalizeText(m.nome);
    if (keyword === "academia") {
      return norm.includes("academia") || norm.includes("musculacao");
    }
    if (keyword === "corrida") {
      return norm.includes("corrida") || norm.includes("atletismo");
    }
    if (keyword === "crossfit") {
      return (
        norm.includes("crossfit") ||
        norm.includes("funcional") ||
        norm.includes("calistenia")
      );
    }
    if (keyword === "ciclismo") {
      return (
        norm.includes("ciclismo") ||
        norm.includes("spinning") ||
        norm.includes("bike")
      );
    }
    if (keyword === "pilates") {
      return (
        norm.includes("pilates") ||
        norm.includes("yoga") ||
        norm.includes("mobilidade")
      );
    }
    return norm.includes(keyword);
  });
}

export function getMarketMetricPresets(
  modalities: ModalidadeResponseDTO[],
  existingMetrics: MetricaResponseDTO[],
  selectedModalityId: number | null = null,
  searchQuery: string = ""
): MetricPresetItem[] {
  const defaultMod = modalities[0] || { id: 1, nome: "Modalidade" };

  let items: MetricPresetItem[] = MARKET_PRESET_DEFINITIONS.map((raw, idx) => {
    const matchedMod = matchModalityForKeyword(raw.sportKeyword, modalities);
    const targetModId = matchedMod ? matchedMod.id : defaultMod.id;
    const targetModName = matchedMod ? matchedMod.nome : raw.fallbackSportName;

    // Se a definição era para um esporte que não existe na lista de modalidades do personal,
    // só incluímos se não houver filtro de modalidade ou se corresponder à modalidade mapeada.
    const alreadyExists = isMetricDuplicate(raw.titulo, targetModId, existingMetrics);

    return {
      presetId: `preset-${idx}-${raw.sportKeyword}`,
      titulo: raw.titulo,
      descricao: raw.descricao,
      tipo: raw.tipo,
      obrigatoria: raw.obrigatoria,
      quemPreenche: raw.quemPreenche,
      campoStrava: raw.campoStrava,
      modalidadeId: targetModId,
      nomeModalidade: targetModName,
      alreadyExists,
      _hasMatchedModality: Boolean(matchedMod),
    };
  })
    .filter((item) => {
      // Se o sistema possui modalidades carregadas, prioriza os presets das modalidades existentes
      if (modalities.length > 0 && !(item as { _hasMatchedModality?: boolean })._hasMatchedModality) {
        return false;
      }
      return true;
    })
    .map(({ ...rest }) => {
      delete (rest as { _hasMatchedModality?: boolean })._hasMatchedModality;
      return rest;
    });

  if (selectedModalityId !== null) {
    items = items.filter((item) => item.modalidadeId === selectedModalityId);
  }

  const cleanSearch = normalizeText(searchQuery);
  if (cleanSearch) {
    items = items.filter(
      (item) =>
        normalizeText(item.titulo).includes(cleanSearch) ||
        normalizeText(item.descricao).includes(cleanSearch) ||
        normalizeText(item.nomeModalidade).includes(cleanSearch)
    );
  }

  return items;
}

export function getModalityBadgeStyle(nome: string): { bg: string; color: string; icon: string } {
  const lower = normalizeText(nome || "");
  if (lower.includes("natacao")) {
    return { bg: "#eff8ff", color: "#175cd3", icon: "/design-system/imgIconWaves.svg" };
  }
  if (lower.includes("tenis")) {
    return { bg: "#f4fce3", color: "#598b00", icon: "/design-system/imgIconTennis.svg" };
  }
  if (lower.includes("academia") || lower.includes("musculacao")) {
    return { bg: "#f4f3ff", color: "#5925dc", icon: "/design-system/imgIconDumbbell.svg" };
  }
  if (lower.includes("corrida") || lower.includes("atletismo")) {
    return { bg: "#fff1f3", color: "#e11d48", icon: "/design-system/imgIconRun.svg" };
  }
  if (lower.includes("ciclismo") || lower.includes("spinning") || lower.includes("bike")) {
    return { bg: "#f0fdf9", color: "#0e9384", icon: "/design-system/imgIconBike.svg" };
  }
  if (lower.includes("crossfit") || lower.includes("funcional") || lower.includes("calistenia")) {
    return { bg: "#fef6ee", color: "#dc6803", icon: "/design-system/imgIconZap.svg" };
  }
  if (lower.includes("pilates") || lower.includes("yoga") || lower.includes("mobilidade")) {
    return { bg: "#ecfdf3", color: "#027a48", icon: "/design-system/imgIconActivity.svg" };
  }
  return { bg: "#f2f4f7", color: "#344054", icon: "/design-system/imgIconGrid.svg" };
}
