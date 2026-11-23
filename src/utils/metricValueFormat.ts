import type { CampoStrava } from "../types/strava";

export type CanonicalTipoMetrica = "NUMERICO" | "TEMPO" | "FREQUENCIA_CARDIACA" | "TEXTO";

export const UNIDADES_NUMERICO = [
  "kg",
  "km",
  "m",
  "cm",
  "%",
  "reps",
  "rounds",
  "séries",
  "kcal",
  "min",
  "km/h",
  "W",
  "spm",
  "rpm",
  "pontos",
] as const;

export const UNIDADES_TEMPO_CRONOMETRO = ["mm:ss", "hh:mm:ss"] as const;
export const UNIDADES_TEMPO_RITMO = ["min/km", "min/100m", "min/500m"] as const;
export const UNIDADES_TEMPO = [...UNIDADES_TEMPO_CRONOMETRO, ...UNIDADES_TEMPO_RITMO] as const;
export const UNIDADE_BPM = "bpm";

export interface UnitSelectOption {
  value: string;
  label: string;
}

export const UNIT_OPTIONS_BY_TIPO: Record<CanonicalTipoMetrica, UnitSelectOption[]> = {
  NUMERICO: [
    { value: "", label: "Sem unidade" },
    ...UNIDADES_NUMERICO.map((u) => ({ value: u, label: u })),
  ],
  TEMPO: [
    { value: "mm:ss", label: "Cronômetro (mm:ss)" },
    { value: "hh:mm:ss", label: "Cronômetro longo (hh:mm:ss)" },
    { value: "min/km", label: "Ritmo Corrida/Geral (min/km)" },
    { value: "min/100m", label: "Ritmo Natação (min/100m)" },
    { value: "min/500m", label: "Ritmo Remo (min/500m)" },
  ],
  FREQUENCIA_CARDIACA: [{ value: "bpm", label: "bpm" }],
  TEXTO: [{ value: "", label: "Sem unidade" }],
};

export function normalizeTextAscii(text?: string | null): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizeTipo(tipo?: string | null): CanonicalTipoMetrica {
  if (tipo === "TEMPO" || tipo === "TEMPO_CRONOMETRO") return "TEMPO";
  if (tipo === "TEXTO" || tipo === "TEXTO_OBSERVACAO") return "TEXTO";
  if (tipo === "FREQUENCIA_CARDIACA") return "FREQUENCIA_CARDIACA";
  return "NUMERICO";
}

export function isUnidadeRitmo(unidade?: string | null): boolean {
  if (!unidade) return false;
  return (UNIDADES_TEMPO_RITMO as readonly string[]).includes(unidade);
}

export function isUnidadeValida(tipo: string, unidade?: string | null): boolean {
  const norm = normalizeTipo(tipo);
  const clean = unidade?.trim() ? unidade.trim() : null;
  switch (norm) {
    case "NUMERICO":
      return clean === null || (UNIDADES_NUMERICO as readonly string[]).includes(clean);
    case "TEMPO":
      return clean !== null && (UNIDADES_TEMPO as readonly string[]).includes(clean);
    case "FREQUENCIA_CARDIACA":
      return clean === UNIDADE_BPM;
    case "TEXTO":
      return clean === null;
  }
}

export function defaultUnidadeForTipo(tipo: string): string | null {
  const norm = normalizeTipo(tipo);
  if (norm === "FREQUENCIA_CARDIACA") return UNIDADE_BPM;
  if (norm === "TEMPO") return "mm:ss";
  return null;
}

export function isCampoStravaCompatible(
  campo?: CampoStrava | string | null,
  tipo?: string | null,
  unidade?: string | null
): boolean {
  if (!campo || campo === "NENHUM" || !tipo) return true;
  const normTipo = normalizeTipo(tipo);
  const cleanUnidade = unidade?.trim() ? unidade.trim() : null;

  switch (campo) {
    case "DISTANCIA_KM":
      return normTipo === "NUMERICO" && (cleanUnidade === null || cleanUnidade === "km");
    case "DISTANCIA_METROS":
    case "ELEVACAO_GANHO_METROS":
      return normTipo === "NUMERICO" && (cleanUnidade === null || cleanUnidade === "m");
    case "DURACAO_MINUTOS":
      return normTipo === "NUMERICO" && (cleanUnidade === null || cleanUnidade === "min");
    case "VELOCIDADE_MEDIA_KMH":
    case "VELOCIDADE_MAXIMA_KMH":
      return normTipo === "NUMERICO" && (cleanUnidade === null || cleanUnidade === "km/h");
    case "CADENCIA_MEDIA":
      return (
        normTipo === "NUMERICO" &&
        (cleanUnidade === null || cleanUnidade === "rpm" || cleanUnidade === "spm")
      );
    case "POTENCIA_MEDIA_WATTS":
    case "POTENCIA_MAXIMA_WATTS":
      return normTipo === "NUMERICO" && (cleanUnidade === null || cleanUnidade === "W");
    case "CALORIAS":
      return normTipo === "NUMERICO" && (cleanUnidade === null || cleanUnidade === "kcal");
    case "TEMPO_MOVIMENTO":
    case "TEMPO_TOTAL":
      return (
        normTipo === "TEMPO" &&
        (cleanUnidade === null || (UNIDADES_TEMPO_CRONOMETRO as readonly string[]).includes(cleanUnidade))
      );
    case "RITMO_MEDIO":
      return (
        normTipo === "TEMPO" &&
        cleanUnidade !== null &&
        (UNIDADES_TEMPO_RITMO as readonly string[]).includes(cleanUnidade)
      );
    case "FREQUENCIA_CARDIACA_MEDIA":
    case "FREQUENCIA_CARDIACA_MAXIMA":
      return (
        normTipo === "FREQUENCIA_CARDIACA" &&
        (cleanUnidade === null || cleanUnidade === UNIDADE_BPM)
      );
    default:
      return true;
  }
}

export function sugerirTipoEUnidade(
  campo?: CampoStrava | string | null,
  nomeModalidade?: string | null
): { tipo: CanonicalTipoMetrica; unidade: string | null } | null {
  if (!campo || campo === "NENHUM") return null;
  const mod = normalizeTextAscii(nomeModalidade);
  const isNatacao = mod.includes("natac") || mod.includes("swim");
  const isRemo = mod.includes("remo") || mod.includes("rowing");
  // Mesma heurística de CampoStrava.sugerirTipoEUnidade (back) e da migração V25
  const isCiclismo = mod.includes("ciclismo") || mod.includes("spinning");
  const isEndurance =
    isCiclismo ||
    mod.includes("triatl") ||
    mod.includes("triathl") ||
    mod.includes("duatl") ||
    mod.includes("ironman");

  switch (campo) {
    case "DISTANCIA_KM":
      return { tipo: "NUMERICO", unidade: "km" };
    case "DISTANCIA_METROS":
    case "ELEVACAO_GANHO_METROS":
      return { tipo: "NUMERICO", unidade: "m" };
    case "DURACAO_MINUTOS":
      return { tipo: "NUMERICO", unidade: "min" };
    case "VELOCIDADE_MEDIA_KMH":
    case "VELOCIDADE_MAXIMA_KMH":
      return { tipo: "NUMERICO", unidade: "km/h" };
    case "POTENCIA_MEDIA_WATTS":
    case "POTENCIA_MAXIMA_WATTS":
      return { tipo: "NUMERICO", unidade: "W" };
    case "CALORIAS":
      return { tipo: "NUMERICO", unidade: "kcal" };
    case "CADENCIA_MEDIA":
      return { tipo: "NUMERICO", unidade: isCiclismo ? "rpm" : "spm" };
    case "FREQUENCIA_CARDIACA_MEDIA":
    case "FREQUENCIA_CARDIACA_MAXIMA":
      return { tipo: "FREQUENCIA_CARDIACA", unidade: UNIDADE_BPM };
    case "TEMPO_MOVIMENTO":
    case "TEMPO_TOTAL":
      return { tipo: "TEMPO", unidade: isEndurance ? "hh:mm:ss" : "mm:ss" };
    case "RITMO_MEDIO":
      return {
        tipo: "TEMPO",
        unidade: isNatacao ? "min/100m" : isRemo ? "min/500m" : "min/km",
      };
    default:
      return null;
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Remove sufixo "(unidade)" duplicado ao final do título quando exibimos `unidade` separadamente.
 * Trata também "(Watts)" quando `unidade === "W"`.
 */
export function stripDuplicateUnitSuffix(titulo: string, unidade?: string | null): string {
  const cleanTitle = (titulo || "").trim();
  const cleanUnit = unidade?.trim();
  if (!cleanTitle || !cleanUnit) return cleanTitle;

  const patterns = [cleanUnit];
  if (cleanUnit === "W") patterns.push("Watts");
  if (cleanUnit === "séries") patterns.push("series");

  for (const unitVariant of patterns) {
    const regex = new RegExp(`\\s*\\(${escapeRegExp(unitVariant)}\\)\\s*$`, "i");
    if (regex.test(cleanTitle)) {
      const stripped = cleanTitle.replace(regex, "").trim();
      return stripped || cleanTitle;
    }
  }
  return cleanTitle;
}

export function parseMetricNumericValue(raw?: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed)) {
    return null;
  }
  const num = Number(trimmed.replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

export interface ParsedTimeSegments {
  hours?: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  segments: 2 | 3;
}

export function parseTimeSegments(raw?: string | null): ParsedTimeSegments | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":");
  if (parts.length === 2) {
    if (!/^\d+$/.test(parts[0]) || !/^[0-5]\d$/.test(parts[1])) {
      return null;
    }
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    return {
      minutes,
      seconds,
      totalSeconds: minutes * 60 + seconds,
      segments: 2,
    };
  }

  if (parts.length === 3) {
    if (!/^\d{1,2}$/.test(parts[0]) || !/^[0-5]\d$/.test(parts[1]) || !/^[0-5]\d$/.test(parts[2])) {
      return null;
    }
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = Number(parts[2]);
    return {
      hours,
      minutes,
      seconds,
      totalSeconds: hours * 3600 + minutes * 60 + seconds,
      segments: 3,
    };
  }

  return null;
}

export function formatTimeSegments(
  segments: { hours?: number; minutes: number; seconds: number },
  forceThreeSegments = false
): string {
  const mm = String(Math.max(0, Math.floor(segments.minutes))).padStart(2, "0");
  const ss = String(Math.max(0, Math.min(59, Math.floor(segments.seconds)))).padStart(2, "0");
  if (forceThreeSegments || segments.hours !== undefined) {
    const hh = String(Math.max(0, Math.floor(segments.hours ?? 0))).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function formatSecondsToTime(totalSeconds: number, forceHours = false): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  if (safe < 3600 && !forceHours) {
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const METROS_POR_UNIDADE_RITMO: Record<string, number> = {
  "min/km": 1000,
  "min/100m": 100,
  "min/500m": 500,
};

/**
 * Unidade em que o back calcula `ritmoMedio`, a partir do `sport_type` bruto do Strava
 * (mesma regra de StravaService.calcularRitmo).
 */
export function paceUnitForSportType(sportType?: string | null): string {
  const tipo = (sportType || "").toLowerCase();
  if (tipo.includes("swim")) return "min/100m";
  if (tipo.includes("rowing") || tipo.includes("virtualrow")) return "min/500m";
  return "min/km";
}

/**
 * Converte velocidade (m/s) em ritmo mm:ss na unidade pedida (padrão min/km).
 * Retorna null quando não há velocidade ou o ritmo passa de 99:59 (limite do validador).
 */
export function paceFromSpeed(speedMs?: number | null, unidade?: string | null): string | null {
  if (speedMs == null || !Number.isFinite(speedMs) || speedMs <= 0) return null;
  const metros = METROS_POR_UNIDADE_RITMO[unidade || "min/km"] ?? 1000;
  const totalSeconds = Math.round(metros / speedMs);
  if (totalSeconds <= 0 || totalSeconds > 99 * 60 + 59) return null;
  return formatSecondsToTime(totalSeconds);
}

function isPaceMetric(unidade?: string | null, campoStrava?: CampoStrava | string | null): boolean {
  return isUnidadeRitmo(unidade) || campoStrava === "RITMO_MEDIO";
}

export function normalizeMetricInput(
  tipo: string,
  value: string,
  unidade?: string | null,
  campoStrava?: CampoStrava | string | null
): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";

  const normTipo = normalizeTipo(tipo);
  if (normTipo === "TEXTO" || normTipo === "FREQUENCIA_CARDIACA") {
    return trimmed;
  }

  if (normTipo === "NUMERICO") {
    return trimmed.replace(",", ".");
  }

  const parsed = parseTimeSegments(trimmed);
  if (!parsed) return trimmed;

  if (isPaceMetric(unidade, campoStrava)) {
    if (parsed.segments !== 2 || parsed.minutes > 99) return trimmed;
    return formatTimeSegments({ minutes: parsed.minutes, seconds: parsed.seconds }, false);
  }

  if (parsed.segments === 2) {
    if (parsed.minutes >= 60) {
      return formatSecondsToTime(parsed.totalSeconds, true);
    }
    return formatTimeSegments({ minutes: parsed.minutes, seconds: parsed.seconds }, false);
  }

  return formatTimeSegments(
    { hours: parsed.hours ?? 0, minutes: parsed.minutes, seconds: parsed.seconds },
    true
  );
}

export function validateMetricValue(
  tipo: string,
  value: string,
  unidade?: string | null,
  campoStrava?: CampoStrava | string | null
): string | undefined {
  const trimmed = (value || "").trim();
  if (!trimmed) return undefined;

  if (trimmed.length > 255) {
    return "Use até 255 caracteres.";
  }

  const normTipo = normalizeTipo(tipo);
  if (normTipo === "TEXTO") {
    return undefined;
  }

  if (normTipo === "NUMERICO") {
    if (parseMetricNumericValue(trimmed) === null) {
      return "Informe um valor numérico.";
    }
    return undefined;
  }

  if (normTipo === "FREQUENCIA_CARDIACA") {
    if (!/^\d+$/.test(trimmed)) {
      return "Informe um número inteiro entre 30 e 250 bpm.";
    }
    const bpm = Number(trimmed);
    if (bpm < 30 || bpm > 250) {
      return "Informe um número inteiro entre 30 e 250 bpm.";
    }
    return undefined;
  }

  // TEMPO (ritmo ou cronômetro)
  const pace = isPaceMetric(unidade, campoStrava);
  if (pace) {
    if (!/^\d{1,2}:[0-5]\d$/.test(trimmed)) {
      return "Verifique o formato esperado do ritmo: use mm:ss (ex: 05:13).";
    }
    return undefined;
  }

  // mm:ss com 60+ minutos (ex: 75:30) é aceito: normalizeMetricInput converte para hh:mm:ss (até 99:59:59)
  const twoParts = /^(\d{1,4}):[0-5]\d$/.exec(trimmed);
  const validTwo = twoParts !== null && Number(twoParts[1]) <= 5999;
  const validThree = /^\d{1,2}:[0-5]\d:[0-5]\d$/.test(trimmed);
  if (!validTwo && !validThree) {
    return "Use o formato mm:ss (ex: 01:42) ou hh:mm:ss (ex: 01:15:30).";
  }
  return undefined;
}

/**
 * Formata o valor numérico de uma série de gráfico conforme o tipo da métrica:
 * TEMPO chega em segundos (mm:ss / hh:mm:ss), FC em bpm inteiro, demais em número pt-BR.
 */
export function chartValueFormatter(tipo?: string | null): (value: number) => string {
  const normTipo = normalizeTipo(tipo);
  if (normTipo === "TEMPO") return (v) => formatSecondsToTime(v);
  if (normTipo === "FREQUENCIA_CARDIACA") return (v) => String(Math.round(v));
  const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
  return (v) => nf.format(v);
}

/** Formatador do RPE (Borg CR-10): até 1 casa decimal. */
export const formatRpeValue = (value: number): string =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);

export function formatMetricDisplayValue(
  valor?: string | null,
  tipo?: string | null,
  unidade?: string | null
): string {
  const trimmed = (valor || "").trim();
  if (!trimmed) return "-";

  const normTipo = normalizeTipo(tipo);
  if (normTipo === "NUMERICO") {
    const num = parseMetricNumericValue(trimmed);
    if (num !== null) {
      const formattedNum = new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 2,
      }).format(num);
      return unidade ? `${formattedNum} ${unidade}` : formattedNum;
    }
    return trimmed;
  }

  if (normTipo === "FREQUENCIA_CARDIACA") {
    return `${trimmed} ${unidade || "bpm"}`;
  }

  if (normTipo === "TEMPO") {
    const parsed = parseTimeSegments(trimmed);
    if (parsed) {
      const formattedTime =
        parsed.segments === 3
          ? formatTimeSegments({ hours: parsed.hours ?? 0, minutes: parsed.minutes, seconds: parsed.seconds }, true)
          : formatTimeSegments({ minutes: parsed.minutes, seconds: parsed.seconds }, false);
      return unidade && isUnidadeRitmo(unidade) ? `${formattedTime} ${unidade}` : formattedTime;
    }
    return trimmed;
  }

  return trimmed;
}
