import type { CampoStrava, StravaAtividade } from "../types/strava";
import {
  formatSecondsToTime,
  normalizeMetricInput,
  normalizeTipo,
  paceFromSpeed,
  paceUnitForSportType,
  parseMetricNumericValue,
  parseTimeSegments,
} from "./metricValueFormat";

export type StravaActorRole = "ALUNO" | "PERSONAL";

export interface StravaMappableMetric {
  id: string;
  tipo: string;
  unidade?: string | null;
  campoStrava?: CampoStrava | string | null;
  quemPreenche?: "ALUNO" | "PERSONAL" | "AMBOS" | string;
}

export interface StravaMetaBaseline {
  dataReal: string;
  duracao: string;
}

export interface StravaMetaFilled {
  dataReal?: string;
  duracao?: string;
}

export interface StravaSelectionResult {
  nextMetricValues: Record<string, string>;
  nextStravaFilledMap: Record<string, string>;
  nextDataReal: string;
  nextDuracao: string;
  nextMetaFilled: StravaMetaFilled;
  selectedStravaActivityId: string | null;
}

function canActorFillMetric(metric: StravaMappableMetric, actorRole: StravaActorRole): boolean {
  if (actorRole === "PERSONAL" && metric.quemPreenche === "ALUNO") {
    return false;
  }
  if (actorRole === "ALUNO" && metric.quemPreenche === "PERSONAL") {
    return false;
  }
  return Boolean(metric.campoStrava && metric.campoStrava !== "NENHUM");
}

function extractPureMmSs(ritmoMedio?: string | null): string | null {
  if (!ritmoMedio) return null;
  const trimmed = ritmoMedio.trim();
  const match = /^(\d{1,2}:[0-5]\d)/.exec(trimmed);
  return match ? match[1] : null;
}

/**
 * Ritmo da atividade convertido para a unidade da métrica (min/km, min/100m ou min/500m).
 * Sem `ritmoMedio` (ex.: pedal) não há ritmo a importar. Sem velocidade bruta (back antigo),
 * só reaproveita `ritmoMedio` quando a unidade calculada pelo back coincide com a da métrica.
 */
function extractPaceForUnit(activity: StravaAtividade, unidade?: string | null): string | null {
  if (!activity.ritmoMedio) return null;
  const converted = paceFromSpeed(activity.velocidadeMediaMs, unidade);
  if (converted) return converted;
  if (activity.velocidadeMediaMs != null) return null;
  const unidadeMetrica = unidade || "min/km";
  return paceUnitForSportType(activity.tipo) === unidadeMetrica ? extractPureMmSs(activity.ritmoMedio) : null;
}

/**
 * Extrai estritamente o campo configurado em `metric.campoStrava` a partir da atividade do Strava.
 * Não utiliza nenhuma heurística por título ou nome de métrica.
 */
export function extractStravaFieldValue(
  activity: StravaAtividade,
  metric: StravaMappableMetric
): string | null {
  const campo = metric.campoStrava;
  if (!campo || campo === "NENHUM") return null;

  let raw: string | null = null;
  switch (campo) {
    case "DISTANCIA_KM":
      raw = activity.distanciaKm != null ? String(activity.distanciaKm) : null;
      break;
    case "DISTANCIA_METROS":
      raw = activity.distanciaMetros != null ? String(Math.round(activity.distanciaMetros * 100) / 100) : null;
      break;
    case "TEMPO_MOVIMENTO":
      raw =
        activity.tempoFormatado ||
        (activity.tempoSegundos != null ? formatSecondsToTime(activity.tempoSegundos) : null);
      break;
    case "TEMPO_TOTAL":
      raw = activity.tempoTotalFormatado || null;
      break;
    case "DURACAO_MINUTOS":
      raw = activity.duracaoMinutos != null && activity.duracaoMinutos > 0
        ? String(activity.duracaoMinutos)
        : null;
      break;
    case "VELOCIDADE_MEDIA_KMH":
      raw = activity.velocidadeMediaKmh != null ? String(activity.velocidadeMediaKmh) : null;
      break;
    case "VELOCIDADE_MAXIMA_KMH":
      raw = activity.velocidadeMaximaKmh != null ? String(activity.velocidadeMaximaKmh) : null;
      break;
    case "RITMO_MEDIO":
      raw = extractPaceForUnit(activity, metric.unidade);
      break;
    case "FREQUENCIA_CARDIACA_MEDIA":
      raw =
        activity.frequenciaCardiacaMedia != null
          ? String(Math.round(activity.frequenciaCardiacaMedia))
          : null;
      break;
    case "FREQUENCIA_CARDIACA_MAXIMA":
      raw =
        activity.frequenciaCardiacaMaxima != null
          ? String(Math.round(activity.frequenciaCardiacaMaxima))
          : null;
      break;
    case "CADENCIA_MEDIA":
      raw = activity.cadenciaMedia != null ? String(Math.round(activity.cadenciaMedia)) : null;
      break;
    case "POTENCIA_MEDIA_WATTS":
      raw = activity.potenciaMediaWatts != null ? String(Math.round(activity.potenciaMediaWatts)) : null;
      break;
    case "POTENCIA_MAXIMA_WATTS":
      raw = activity.potenciaMaximaWatts != null ? String(Math.round(activity.potenciaMaximaWatts)) : null;
      break;
    case "ELEVACAO_GANHO_METROS":
      raw = activity.elevacaoGanhoMetros != null ? String(Math.round(activity.elevacaoGanhoMetros)) : null;
      break;
    case "CALORIAS":
      raw = activity.calorias != null ? String(Math.round(activity.calorias)) : null;
      break;
    default:
      raw = null;
  }

  if (!raw) return null;
  const normalized = normalizeMetricInput(metric.tipo, raw, metric.unidade, campo);
  return normalized || null;
}

/** Métrica vinculada a algum campo do Strava (pode ser preenchida automaticamente). */
export function isStravaLinked(metric: Pick<StravaMappableMetric, "campoStrava">): boolean {
  return Boolean(metric.campoStrava && metric.campoStrava !== "NENHUM");
}

/**
 * Atividade realizada no mesmo dia da sessão planejada (a mais recente, se houver várias).
 * Sem correspondência, retorna null: nada é pré-selecionado e o usuário escolhe ou preenche manualmente,
 * evitando importar dados (e a data real) de um treino de outro dia.
 */
export function pickActivityForDate(
  activities: StravaAtividade[],
  plannedIso?: string | null
): StravaAtividade | null {
  if (!plannedIso) return null;
  return activities.find((a) => a.data === plannedIso) ?? null;
}

/**
 * Mapeia valores da atividade Strava apenas para métricas com `campoStrava != "NENHUM"`
 * compatíveis com o papel do usuário autenticado.
 */
export function mapStravaActivityToMetrics(
  activity: StravaAtividade,
  metrics: StravaMappableMetric[],
  actorRole: StravaActorRole
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const metric of metrics) {
    if (!canActorFillMetric(metric, actorRole)) continue;
    const val = extractStravaFieldValue(activity, metric);
    if (val != null) {
      result[metric.id] = val;
    }
  }
  return result;
}

/**
 * Verifica se é necessário consultar `GET .../strava/atividades/{id}` para enriquecer `calorias`.
 */
export function activityNeedsCaloriesDetail(
  activity: StravaAtividade | null | undefined,
  metrics: StravaMappableMetric[],
  actorRole: StravaActorRole
): boolean {
  if (!activity || activity.calorias != null) return false;
  return metrics.some(
    (m) => m.campoStrava === "CALORIAS" && canActorFillMetric(m, actorRole)
  );
}

export function valuesMatchForStrava(
  currentVal: string | undefined,
  stravaVal: string | undefined,
  metric?: Pick<StravaMappableMetric, "tipo" | "unidade" | "campoStrava">
): boolean {
  if (!currentVal?.trim() || !stravaVal?.trim()) return false;
  if (!metric) return currentVal.trim() === stravaVal.trim();

  const normTipo = normalizeTipo(metric.tipo);
  if (normTipo === "NUMERICO") {
    const a = parseMetricNumericValue(currentVal);
    const b = parseMetricNumericValue(stravaVal);
    return a !== null && b !== null && Math.abs(a - b) < 1e-9;
  }
  if (normTipo === "TEMPO") {
    const a = parseTimeSegments(currentVal);
    const b = parseTimeSegments(stravaVal);
    if (a && b) return a.totalSeconds === b.totalSeconds;
  }
  return (
    normalizeMetricInput(metric.tipo, currentVal, metric.unidade, metric.campoStrava) ===
    normalizeMetricInput(metric.tipo, stravaVal, metric.unidade, metric.campoStrava)
  );
}

/**
 * Transição limpa ao selecionar, trocar ou limpar ("Não importar") uma atividade do Strava:
 * 1. Reverte apenas campos cujo valor atual ainda coincide com o importado anteriormente.
 * 2. Preserva edições manuais feitas pelo usuário.
 * 3. Quando há `newActivity`, preenche apenas os campos livres (vazios ou recém-revertidos).
 */
export function applyStravaSelection(params: {
  newActivity: StravaAtividade | null;
  metrics: StravaMappableMetric[];
  actorRole: StravaActorRole;
  currentMetricValues: Record<string, string>;
  prevStravaFilledMap: Record<string, string>;
  currentDataReal: string;
  currentDuracao: string;
  prevMetaFilled: StravaMetaFilled;
  baseline: StravaMetaBaseline;
}): StravaSelectionResult {
  const {
    newActivity,
    metrics,
    actorRole,
    currentMetricValues,
    prevStravaFilledMap,
    currentDataReal,
    currentDuracao,
    prevMetaFilled,
    baseline,
  } = params;

  const metricById = new Map(metrics.map((m) => [m.id, m]));
  const nextMetricValues: Record<string, string> = { ...currentMetricValues };

  // Passo 1: reverte apenas o que ainda bate com os valores importados da atividade anterior
  for (const [metricId, prevVal] of Object.entries(prevStravaFilledMap)) {
    const metric = metricById.get(metricId);
    if (valuesMatchForStrava(nextMetricValues[metricId], prevVal, metric)) {
      nextMetricValues[metricId] = "";
    }
  }

  let nextDataReal =
    prevMetaFilled.dataReal && currentDataReal === prevMetaFilled.dataReal
      ? baseline.dataReal
      : currentDataReal;

  let nextDuracao =
    prevMetaFilled.duracao && currentDuracao === prevMetaFilled.duracao
      ? baseline.duracao
      : currentDuracao;

  if (!newActivity) {
    return {
      nextMetricValues,
      nextStravaFilledMap: {},
      nextDataReal,
      nextDuracao,
      nextMetaFilled: {},
      selectedStravaActivityId: null,
    };
  }

  // Passo 2: aplica valores da nova atividade apenas nos campos vazios/revertidos
  const mapped = mapStravaActivityToMetrics(newActivity, metrics, actorRole);
  const nextStravaFilledMap: Record<string, string> = {};

  for (const [metricId, val] of Object.entries(mapped)) {
    if (!nextMetricValues[metricId]?.trim()) {
      nextMetricValues[metricId] = val;
      nextStravaFilledMap[metricId] = val;
    }
  }

  const nextMetaFilled: StravaMetaFilled = {};
  if (newActivity.data && (!nextDataReal.trim() || nextDataReal === baseline.dataReal)) {
    nextDataReal = newActivity.data;
    nextMetaFilled.dataReal = newActivity.data;
  }

  if (
    newActivity.duracaoMinutos != null &&
    newActivity.duracaoMinutos > 0 &&
    (!nextDuracao.trim() || nextDuracao === baseline.duracao)
  ) {
    const durStr = String(newActivity.duracaoMinutos);
    nextDuracao = durStr;
    nextMetaFilled.duracao = durStr;
  }

  return {
    nextMetricValues,
    nextStravaFilledMap,
    nextDataReal,
    nextDuracao,
    nextMetaFilled,
    selectedStravaActivityId: newActivity.id,
  };
}

/**
 * Mantém `stravaAtividadeId` enquanto ao menos um campo importado ainda coincidir com `stravaFilledMap`
 * ou com a duração/data importada; limpa para `null` se todos os campos importados tiverem sido alterados manualmente.
 */
export function resolveStravaAtividadeIdToSubmit(params: {
  selectedActivityId: string | null;
  metrics: StravaMappableMetric[];
  currentMetricValues: Record<string, string>;
  stravaFilledMap: Record<string, string>;
  currentDataReal: string;
  currentDuracao: string;
  metaFilled: StravaMetaFilled;
  baseline: StravaMetaBaseline;
}): string | null {
  const {
    selectedActivityId,
    metrics,
    currentMetricValues,
    stravaFilledMap,
    currentDataReal,
    currentDuracao,
    metaFilled,
    baseline,
  } = params;

  if (!selectedActivityId) return null;

  const metricById = new Map(metrics.map((m) => [m.id, m]));
  for (const [metricId, filledVal] of Object.entries(stravaFilledMap)) {
    const metric = metricById.get(metricId);
    if (valuesMatchForStrava(currentMetricValues[metricId], filledVal, metric)) {
      return selectedActivityId;
    }
  }

  if (metaFilled.duracao && currentDuracao === metaFilled.duracao) {
    return selectedActivityId;
  }

  if (
    metaFilled.dataReal &&
    metaFilled.dataReal !== baseline.dataReal &&
    currentDataReal === metaFilled.dataReal
  ) {
    return selectedActivityId;
  }

  return null;
}
