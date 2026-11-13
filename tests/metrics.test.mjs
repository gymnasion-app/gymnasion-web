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

const metricValueFormat = load("utils/metricValueFormat.ts");
const model = load("features/metrics/metricModel.ts", {
  "../../utils/metricValueFormat": metricValueFormat,
});

const makeMetric = (id, titulo, modalidadeId, tipo = "NUMERICO", registros = 0, ativo = true, quem = "ALUNO") => ({
  id,
  titulo,
  modalidadeId,
  nomeModalidade: modalidadeId === 1 ? "Natação" : modalidadeId === 2 ? "Tênis" : "Academia",
  tipo,
  quantidadeAlunosComRegistros: registros,
  ativo,
  quemPreenche: quem,
  obrigatoria: true,
});

test("getMetricStudentCount extracts count from quantidadeAlunosComRegistros", () => {
  assert.equal(model.getMetricStudentCount({ quantidadeAlunosComRegistros: 4 }), 4);
  assert.equal(model.getMetricStudentCount({}), 0);
});

test("isMetricActive respects ativo flag", () => {
  assert.equal(model.isMetricActive({ ativo: false }), false);
  assert.equal(model.isMetricActive({ ativo: true }), true);
  assert.equal(model.isMetricActive({}), true);
});

test("getPreenchimentoLabel returns human-friendly Portuguese labels", () => {
  assert.equal(model.getPreenchimentoLabel("ALUNO"), "aluno");
  assert.equal(model.getPreenchimentoLabel("PERSONAL"), "personal");
  assert.equal(model.getPreenchimentoLabel("AMBOS"), "aluno e personal");
  assert.equal(model.getPreenchimentoLabel(undefined), "aluno e personal");
});

test("normalizeTipo canonicalizes metric types safely", () => {
  assert.equal(model.normalizeTipo("TEMPO"), "TEMPO");
  assert.equal(model.normalizeTipo("TEXTO"), "TEXTO");
  assert.equal(model.normalizeTipo("FREQUENCIA_CARDIACA"), "FREQUENCIA_CARDIACA");
  assert.equal(model.normalizeTipo("NUMERICO"), "NUMERICO");
  assert.equal(model.normalizeTipo("DESCONHECIDO"), "NUMERICO");
});

test("toBackendTipoMetrica produces strictly the 4 Spring Boot accepted enum values", () => {
  const allowed = ["FREQUENCIA_CARDIACA", "TEXTO", "TEMPO", "NUMERICO"];
  for (const opt of model.METRIC_TYPE_OPTIONS) {
    assert.equal(allowed.includes(model.toBackendTipoMetrica(opt.value)), true);
  }
  assert.equal(model.toBackendTipoMetrica("TEMPO"), "TEMPO");
  assert.equal(model.toBackendTipoMetrica("TEXTO"), "TEXTO");
  assert.equal(model.toBackendTipoMetrica("NUMERICO"), "NUMERICO");
  assert.equal(model.toBackendTipoMetrica("FREQUENCIA_CARDIACA"), "FREQUENCIA_CARDIACA");
});

test("isMetricDuplicate enforces case/accent-insensitive uniqueness per modality (RN-016)", () => {
  const existing = [
    makeMetric("1", "Ritmo 100m", 1),
    makeMetric("2", "Braçadas por piscina", 1),
    makeMetric("3", "Ritmo 100m", 2),
  ];

  assert.equal(model.isMetricDuplicate("ritmo 100m", 1, existing), true);
  assert.equal(model.isMetricDuplicate("RITMO 100M", 1, existing), true);
  assert.equal(model.isMetricDuplicate("Ritmo 100m", 1, existing, "1"), false); // Ignora a própria ao editar
  assert.equal(model.isMetricDuplicate("Ritmo 200m", 1, existing), false);
  assert.equal(model.isMetricDuplicate("Braçadas por piscina", 2, existing), false); // Modalidade diferente é permitido
});

test("metricModalityCounts calculates total and per modality correctly", () => {
  const metrics = [
    makeMetric("1", "Ritmo 100m", 1),
    makeMetric("2", "Distância", 1),
    makeMetric("3", "FC média", 1),
    makeMetric("4", "Braçadas", 1),
    makeMetric("5", "Primeiro saque", 2),
    makeMetric("6", "Duração rally", 2),
    makeMetric("7", "Carga agachamento", 3),
    makeMetric("8", "Observações", 3),
  ];
  const modalities = [
    { id: 1, nome: "Natação" },
    { id: 2, nome: "Tênis" },
    { id: 3, nome: "Academia" },
    { id: 4, nome: "Crossfit" }, // 0 métricas cadastradas
  ];

  const counts = model.metricModalityCounts(metrics, modalities);
  assert.equal(
    JSON.stringify(counts),
    JSON.stringify([
      { id: null, nome: "Todas", count: 8 },
      { id: 1, nome: "Natação", count: 4 },
      { id: 2, nome: "Tênis", count: 2 },
      { id: 3, nome: "Academia", count: 2 },
    ])
  );

  // Se options.includeZero for true, inclui a modalidade com 0
  const countsWithZero = model.metricModalityCounts(metrics, modalities, { includeZero: true });
  assert.equal(countsWithZero.some((c) => c.nome === "Crossfit" && c.count === 0), true);

  // Se activeModalityId for o id da modalidade vazia, ela também é exibida
  const countsWithActive = model.metricModalityCounts(metrics, modalities, { activeModalityId: 4 });
  assert.equal(countsWithActive.some((c) => c.id === 4 && c.count === 0), true);
});

test("filterMetrics filters by modality and search text", () => {
  const metrics = [
    makeMetric("1", "Ritmo 100m", 1),
    makeMetric("2", "Distância total", 1),
    makeMetric("3", "Duração do rally", 2),
  ];

  // Filtro por modalidade
  assert.equal(model.filterMetrics(metrics, 1).length, 2);
  assert.equal(model.filterMetrics(metrics, 2).length, 1);
  assert.equal(model.filterMetrics(metrics, null).length, 3);

  // Busca por texto
  assert.equal(model.filterMetrics(metrics, null, "ritmo")[0].id, "1");
  assert.equal(model.filterMetrics(metrics, 1, "rally").length, 0);
  assert.equal(model.filterMetrics(metrics, null, "rally")[0].id, "3");
});

test("hasStravaSync, getStravaFieldLabel, getMetricTypeBadgeStyle and extended filterMetrics work accurately", () => {
  const m1 = {
    ...makeMetric("1", "Tempo 100m Livre", 1, "TEMPO", 8),
    campoStrava: "TEMPO_MOVIMENTO",
  };
  const m2 = {
    ...makeMetric("2", "FC Média", 1, "FREQUENCIA_CARDIACA", 12),
    campoStrava: "FREQUENCIA_CARDIACA_MEDIA",
  };
  const m3 = {
    ...makeMetric("3", "Observação Técnica", 1, "TEXTO", 2),
    campoStrava: "NENHUM",
  };

  assert.equal(model.hasStravaSync(m1), true);
  assert.equal(model.hasStravaSync(m3), false);
  assert.equal(model.getStravaFieldLabel("TEMPO_MOVIMENTO"), "Tempo em movimento");
  assert.equal(model.getStravaFieldLabel("NENHUM"), "Preenchimento manual");

  const tempoStyle = model.getMetricTypeBadgeStyle("TEMPO");
  assert.equal(tempoStyle.color, "#175cd3");
  const fcStyle = model.getMetricTypeBadgeStyle("FREQUENCIA_CARDIACA");
  assert.equal(fcStyle.color, "#e11d48");

  // Filtro por integração Strava
  const stravaOnly = model.filterMetrics([m1, m2, m3], null, "", { typeFilter: "STRAVA" });
  assert.equal(stravaOnly.length, 2);

  // Ordenação por mais alunos com registro
  const sortedByStudents = model.filterMetrics([m1, m2, m3], null, "", {
    sortBy: "students_desc",
  });
  assert.equal(
    JSON.stringify(sortedByStudents.map((m) => m.id)),
    JSON.stringify(["2", "1", "3"])
  );
});

test("filterMetrics filters by statusFilter (active vs discontinued)", () => {
  const activeMetric = makeMetric("1", "Ritmo 100m", 1, "TEMPO", 4, true);
  const discMetric = makeMetric("2", "Pace antigo", 1, "TEMPO", 5, false);

  const onlyActive = model.filterMetrics([activeMetric, discMetric], null, "", {
    statusFilter: "active",
  });
  assert.equal(onlyActive.length, 1);
  assert.equal(onlyActive[0].id, "1");

  const onlyDisc = model.filterMetrics([activeMetric, discMetric], null, "", {
    statusFilter: "discontinued",
  });
  assert.equal(onlyDisc.length, 1);
  assert.equal(onlyDisc[0].id, "2");
});

test("paginateMetrics slices items, clamps page bounds and computes start/end indices", () => {
  const items = Array.from({ length: 10 }, (_, idx) => ({ id: String(idx + 1) }));

  const page1 = model.paginateMetrics(items, 1, 4);
  assert.equal(page1.currentPage, 1);
  assert.equal(page1.totalPages, 3);
  assert.equal(page1.totalItems, 10);
  assert.equal(page1.startIndex, 1);
  assert.equal(page1.endIndex, 4);
  assert.equal(page1.items.length, 4);

  // Página 3 (última página com 2 itens)
  const page3 = model.paginateMetrics(items, 99, 4);
  assert.equal(page3.currentPage, 3);
  assert.equal(page3.startIndex, 9);
  assert.equal(page3.endIndex, 10);
  assert.equal(page3.items.length, 2);

  // Lista vazia
  const emptyPage = model.paginateMetrics([], 1, 8);
  assert.equal(emptyPage.currentPage, 1);
  assert.equal(emptyPage.totalPages, 1);
  assert.equal(emptyPage.startIndex, 0);
  assert.equal(emptyPage.endIndex, 0);
  assert.equal(emptyPage.items.length, 0);
});

test("getMarketMetricPresets maps sport presets to modalities and flags alreadyExists", () => {
  const modalities = [
    { id: 1, nome: "Natação" },
    { id: 2, nome: "Corrida de Rua" },
    { id: 3, nome: "Academia" },
  ];
  const existing = [makeMetric("10", "Ritmo médio 100m", 1, "TEMPO")];

  const allPresets = model.getMarketMetricPresets(modalities, existing, null, "");
  assert.equal(allPresets.length > 0, true);

  const swimPace = allPresets.find((p) => p.titulo === "Ritmo médio 100m");
  assert.equal(Boolean(swimPace), true);
  assert.equal(swimPace.modalidadeId, 1);
  assert.equal(swimPace.alreadyExists, true);
  assert.equal(swimPace.campoStrava, "RITMO_MEDIO");
  assert.equal(swimPace.unidade, "min/100m");

  const runPace = allPresets.find((p) => p.titulo === "Pace médio (min/km)");
  assert.equal(Boolean(runPace), true);
  assert.equal(runPace.tipo, "TEMPO");
  assert.equal(runPace.campoStrava, "RITMO_MEDIO");
  assert.equal(runPace.unidade, "min/km");

  const swimSwolf = allPresets.find((p) => p.titulo.includes("SWOLF"));
  assert.equal(Boolean(swimSwolf), true);
  assert.equal(swimSwolf.alreadyExists, false);

  // Filtro por modalidade (apenas Corrida de Rua = id 2)
  const runPresets = model.getMarketMetricPresets(modalities, existing, 2, "");
  assert.equal(runPresets.every((p) => p.modalidadeId === 2), true);
});


