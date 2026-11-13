import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const exports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL("../src/" + path, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: (name) => dependencies[name] }
  );
  return exports;
}

const durationFormat = load("utils/durationFormat.ts");
const metricValueFormat = load("utils/metricValueFormat.ts");
const stravaMapping = load("utils/stravaMapping.ts", {
  "./metricValueFormat": metricValueFormat,
});

test("durationFormat formats minutes and parses flexible user durations cleanly", () => {
  assert.equal(durationFormat.formatDurationMinutes(45), "45 min");
  assert.equal(durationFormat.formatDurationMinutes(60), "1h");
  assert.equal(durationFormat.formatDurationMinutes(80), "1h 20min");
  assert.equal(durationFormat.formatDurationMinutes(null), "-");
  assert.equal(durationFormat.formatDurationMinutes(0), "-");

  assert.equal(durationFormat.parseDurationToMinutes("80"), 80);
  assert.equal(durationFormat.parseDurationToMinutes("80 min"), 80);
  assert.equal(durationFormat.parseDurationToMinutes("2h"), 120);
  assert.equal(durationFormat.parseDurationToMinutes("1h20"), 80);
  assert.equal(durationFormat.parseDurationToMinutes("1h 20min"), 80);
  assert.equal(durationFormat.parseDurationToMinutes("1440"), 1440);
  assert.equal(durationFormat.parseDurationToMinutes("1441"), null);
  assert.equal(durationFormat.parseDurationToMinutes("0"), null);
  assert.equal(durationFormat.parseDurationToMinutes(""), null);
});

test("metricValueFormat enforces adaptive units, Strava compatibility, and title cleanup", () => {
  assert.equal(metricValueFormat.UNIT_OPTIONS_BY_TIPO.NUMERICO[0].value, "");
  assert.equal(metricValueFormat.UNIT_OPTIONS_BY_TIPO.NUMERICO[0].label, "Sem unidade");

  assert.equal(metricValueFormat.isUnidadeValida("NUMERICO", null), true);
  assert.equal(metricValueFormat.isUnidadeValida("NUMERICO", "km"), true);
  assert.equal(metricValueFormat.isUnidadeValida("TEMPO", "min/km"), true);
  assert.equal(metricValueFormat.isUnidadeValida("TEMPO", "kg"), false);
  assert.equal(metricValueFormat.isUnidadeValida("FREQUENCIA_CARDIACA", "bpm"), true);

  assert.equal(
    metricValueFormat.isCampoStravaCompatible("RITMO_MEDIO", "TEMPO", "min/km"),
    true
  );
  assert.equal(
    metricValueFormat.isCampoStravaCompatible("RITMO_MEDIO", "TEMPO", "mm:ss"),
    false
  );
  assert.equal(
    metricValueFormat.isCampoStravaCompatible("TEMPO_MOVIMENTO", "TEMPO", "hh:mm:ss"),
    true
  );
  assert.equal(
    metricValueFormat.isCampoStravaCompatible("CALORIAS", "NUMERICO", "kcal"),
    true
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(metricValueFormat.sugerirTipoEUnidade("RITMO_MEDIO", "Corrida de Rua"))),
    { tipo: "TEMPO", unidade: "min/km" }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(metricValueFormat.sugerirTipoEUnidade("RITMO_MEDIO", "Natação"))),
    { tipo: "TEMPO", unidade: "min/100m" }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(metricValueFormat.sugerirTipoEUnidade("RITMO_MEDIO", "Remo"))),
    { tipo: "TEMPO", unidade: "min/500m" }
  );
  assert.equal(metricValueFormat.sugerirTipoEUnidade("NENHUM", "Corrida"), null);

  assert.equal(
    metricValueFormat.stripDuplicateUnitSuffix("Distância percorrida (km)", "km"),
    "Distância percorrida"
  );
  assert.equal(
    metricValueFormat.stripDuplicateUnitSuffix("Distância percorrida (km)", "m"),
    "Distância percorrida (km)"
  );
  assert.equal(
    metricValueFormat.formatMetricDisplayValue("10.5", "NUMERICO", "km"),
    "10,5 km"
  );
  assert.equal(
    metricValueFormat.formatMetricDisplayValue("4:35", "TEMPO", "min/km"),
    "04:35 min/km"
  );
  assert.equal(
    metricValueFormat.formatMetricDisplayValue("152", "FREQUENCIA_CARDIACA", null),
    "152 bpm"
  );
});

test("stravaMapping uses only explicit campoStrava without title heuristics and respects OQ4 actor permissions", () => {
  const act1 = {
    id: "act-101",
    nome: "Rodagem matinal",
    tipo: "Run",
    esporte: "Run",
    data: "2026-11-10",
    distanciaKm: 10.4,
    tempoSegundos: 3120,
    duracaoMinutos: 52,
    tempoTotalFormatado: "00:54:00",
    velocidadeMediaKmh: 12.0,
    ritmoMedio: "05:00 min/km",
    frequenciaCardiacaMedia: 154,
    frequenciaCardiacaMaxima: 171,
    calorias: null,
  };

  const metrics = [
    {
      id: "m-dist-no-strava",
      titulo: "Distância (km)",
      tipo: "NUMERICO",
      unidade: "km",
      quemPreenche: "ALUNO",
      campoStrava: "NENHUM",
    },
    {
      id: "m-dist-aluno",
      titulo: "Distância Strava",
      tipo: "NUMERICO",
      unidade: "km",
      quemPreenche: "ALUNO",
      campoStrava: "DISTANCIA_KM",
    },
    {
      id: "m-pace-ambos",
      titulo: "Pace",
      tipo: "TEMPO",
      unidade: "min/km",
      quemPreenche: "AMBOS",
      campoStrava: "RITMO_MEDIO",
    },
    {
      id: "m-cal-personal",
      titulo: "Calorias",
      tipo: "NUMERICO",
      unidade: "kcal",
      quemPreenche: "PERSONAL",
      campoStrava: "CALORIAS",
    },
  ];

  // Zero title heuristic: manual "Distância (km)" never auto-fills
  const mappedAluno = stravaMapping.mapStravaActivityToMetrics(act1, metrics, "ALUNO");
  assert.equal(mappedAluno["m-dist-no-strava"], undefined);
  assert.equal(mappedAluno["m-dist-aluno"], "10.4");
  assert.equal(mappedAluno["m-pace-ambos"], "05:00");
  assert.equal(mappedAluno["m-cal-personal"], undefined);

  // OQ4: PERSONAL cannot fill ALUNO-only metrics; ALUNO cannot trigger CALORIAS detail for PERSONAL-only metric
  const mappedPersonal = stravaMapping.mapStravaActivityToMetrics(act1, metrics, "PERSONAL");
  assert.equal(mappedPersonal["m-dist-aluno"], undefined);
  assert.equal(mappedPersonal["m-pace-ambos"], "05:00");
  assert.equal(
    stravaMapping.activityNeedsCaloriesDetail(act1, metrics, "PERSONAL"),
    true
  );
  assert.equal(
    stravaMapping.activityNeedsCaloriesDetail(act1, metrics, "ALUNO"),
    false
  );
});

test("applyStravaSelection handles pre-selected activity switch, clean revert to manual, and preserves manual edits", () => {
  const act1 = {
    id: "act-1",
    nome: "Corrida 1",
    tipo: "Run",
    esporte: "Run",
    data: "2026-11-10",
    distanciaKm: 8.2,
    tempoSegundos: 2700,
    duracaoMinutos: 45,
    ritmoMedio: "05:29 min/km",
  };
  const act2 = {
    id: "act-2",
    nome: "Corrida 2",
    tipo: "Run",
    esporte: "Run",
    data: "2026-11-12",
    distanciaKm: 12.0,
    tempoSegundos: 3600,
    duracaoMinutos: 60,
    ritmoMedio: "05:00 min/km",
  };
  const metrics = [
    {
      id: "m-dist",
      titulo: "Distância",
      tipo: "NUMERICO",
      unidade: "km",
      quemPreenche: "ALUNO",
      campoStrava: "DISTANCIA_KM",
    },
    {
      id: "m-pace",
      titulo: "Pace",
      tipo: "TEMPO",
      unidade: "min/km",
      quemPreenche: "ALUNO",
      campoStrava: "RITMO_MEDIO",
    },
  ];
  const baseline = { dataReal: "2026-11-11", duracao: "50" };

  // Step 1: Pre-select act1 from manual baseline
  const sel1 = stravaMapping.applyStravaSelection({
    newActivity: act1,
    metrics,
    actorRole: "ALUNO",
    currentMetricValues: {},
    prevStravaFilledMap: {},
    currentDataReal: baseline.dataReal,
    currentDuracao: baseline.duracao,
    prevMetaFilled: { dataReal: false, duracao: false },
    baseline,
  });
  assert.equal(sel1.nextMetricValues["m-dist"], "8.2");
  assert.equal(sel1.nextMetricValues["m-pace"], "05:29");
  assert.equal(sel1.nextDataReal, "2026-11-10");
  assert.equal(sel1.nextDuracao, "45");

  // Step 2: Simulate user manually overriding pace before switching to act2
  const editedValues = { ...sel1.nextMetricValues, "m-pace": "04:45" };
  const sel2 = stravaMapping.applyStravaSelection({
    newActivity: act2,
    metrics,
    actorRole: "ALUNO",
    currentMetricValues: editedValues,
    prevStravaFilledMap: sel1.nextStravaFilledMap,
    currentDataReal: sel1.nextDataReal,
    currentDuracao: sel1.nextDuracao,
    prevMetaFilled: sel1.nextMetaFilled,
    baseline,
  });
  assert.equal(sel2.nextMetricValues["m-dist"], "12");
  assert.equal(sel2.nextMetricValues["m-pace"], "04:45"); // manual edit preserved
  assert.equal(sel2.nextDuracao, "60");

  // Step 3: Deselect to manual ("Não importar do Strava"): revert Strava fields, keep manual pace edit
  const selManual = stravaMapping.applyStravaSelection({
    newActivity: null,
    metrics,
    actorRole: "ALUNO",
    currentMetricValues: sel2.nextMetricValues,
    prevStravaFilledMap: sel2.nextStravaFilledMap,
    currentDataReal: sel2.nextDataReal,
    currentDuracao: sel2.nextDuracao,
    prevMetaFilled: sel2.nextMetaFilled,
    baseline,
  });
  assert.equal(selManual.nextMetricValues["m-dist"], "");
  assert.equal(selManual.nextMetricValues["m-pace"], "04:45");
  assert.equal(selManual.nextDataReal, baseline.dataReal);
  assert.equal(selManual.nextDuracao, baseline.duracao);

  // Step 4: resolveStravaAtividadeIdToSubmit returns null when every Strava value was overridden
  const resolvedCleared = stravaMapping.resolveStravaAtividadeIdToSubmit({
    selectedActivityId: "act-1",
    metrics,
    currentMetricValues: { "m-dist": "99", "m-pace": "04:00" },
    stravaFilledMap: sel1.nextStravaFilledMap,
    currentDataReal: "2026-11-15",
    currentDuracao: "30",
    metaFilled: sel1.nextMetaFilled,
    baseline,
  });
  assert.equal(resolvedCleared, null);
});

test("stravaService uses default limit 10 and hits detail endpoints for aluno and personal", async () => {
  const calls = [];
  const mockApi = {
    get: async (url, config) => {
      calls.push({ method: "GET", url, params: config?.params });
      return { data: [] };
    },
    post: async (url, body) => ({ data: { url, body } }),
    delete: async () => ({ data: undefined }),
  };

  const { stravaService } = load("services/stravaService.ts", {
    "./api": { api: mockApi },
  });

  await stravaService.listarAtividades();
  assert.equal(calls[0].url, "/api/alunos/strava/atividades");
  assert.equal(calls[0].params.limite, 10);

  await stravaService.obterDetalheAtividade("98765");
  assert.equal(calls[1].url, "/api/alunos/strava/atividades/98765");

  await stravaService.listarAtividadesAluno("aluno 1");
  assert.equal(calls[2].url, "/api/personal-trainers/alunos/aluno%201/strava/atividades");
  assert.equal(calls[2].params.limite, 10);

  await stravaService.obterDetalheAtividadeAluno("aluno 1", "98765");
  assert.equal(calls[3].url, "/api/personal-trainers/alunos/aluno%201/strava/atividades/98765");
});
