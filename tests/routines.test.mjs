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

const model = load("features/routines/routineModel.ts");

const makeRoutine = (id, titulo, modalidadeId, frequencia, ativo = true, status = "ATIVA", alunos = [], metricas = []) => ({
  id,
  titulo,
  modalidadeId,
  nomeModalidade: modalidadeId === 1 ? "Natação" : "Academia",
  frequenciaSemanal: frequencia,
  objetivos: "Ganho aeróbico",
  ativo,
  status,
  alunos,
  metricas,
});

const makeStudent = (id, nome, status = "ATIVO") => ({
  id,
  usuario: { nome, email: `${id}@gymnasion.test` },
  status,
  modalidades: [{ id: 1, nome: "Natação" }],
});

test("isRoutineActive recognizes status and ativo boolean correctly", () => {
  assert.equal(model.isRoutineActive(makeRoutine("1", "R1", 1, 3, true, "ATIVA")), true);
  assert.equal(model.isRoutineActive(makeRoutine("2", "R2", 1, 3, false, "ATIVA")), false);
  assert.equal(model.isRoutineActive(makeRoutine("3", "R3", 1, 3, true, "ENCERRADA")), false);
  assert.equal(model.isRoutineActive(makeRoutine("4", "R4", 1, 3, false, "ENCERRADA")), false);
});

test("routineCounts computes all, active, and ended correctly", () => {
  const list = [
    makeRoutine("1", "R1", 1, 3, true, "ATIVA"),
    makeRoutine("2", "R2", 1, 3, true, "ATIVA"),
    makeRoutine("3", "R3", 1, 3, false, "ENCERRADA"),
    makeRoutine("4", "R4", 1, 3, false, "ATIVA"),
  ];
  assert.equal(JSON.stringify(model.routineCounts(list)), JSON.stringify({ all: 4, active: 2, ended: 2 }));
  assert.equal(JSON.stringify(model.routineCounts([])), JSON.stringify({ all: 0, active: 0, ended: 0 }));
});

test("visibleRoutines filters by status, search, and modality", () => {
  const list = [
    makeRoutine("1", "Natação Velocidade", 1, 4, true, "ATIVA", [{ id: "s1", nome: "Mariana Silva" }], [{ id: "m1", titulo: "Ritmo 100m" }]),
    makeRoutine("2", "Hipertrofia Força", 2, 5, true, "ATIVA", [{ id: "s2", nome: "Carlos Andrade" }]),
    makeRoutine("3", "Natação Resistência", 1, 3, false, "ENCERRADA", [{ id: "s3", nome: "Beatriz Costa" }]),
  ];

  // Filtro por status
  assert.deepEqual(
    model.visibleRoutines(list, "active", "").map((r) => r.id),
    ["2", "1"] // Hipertrofia Força (2) vem antes de Natação Velocidade (1) alfabeticamente
  );
  assert.deepEqual(
    model.visibleRoutines(list, "ended", "").map((r) => r.id),
    ["3"]
  );

  // Filtro por busca insensível a acento no título
  assert.deepEqual(
    model.visibleRoutines(list, "all", "natacao").map((r) => r.id),
    ["1", "3"]
  );

  // Filtro por busca no nome do aluno vinculado
  assert.deepEqual(
    model.visibleRoutines(list, "all", "andrade").map((r) => r.id),
    ["2"]
  );

  // Filtro por busca no nome da métrica agregada das sessões
  assert.deepEqual(
    model.visibleRoutines(list, "all", "ritmo").map((r) => r.id),
    ["1"]
  );

  // Filtro por modalidade
  assert.deepEqual(
    model.visibleRoutines(list, "all", "", 1).map((r) => r.id),
    ["1", "3"]
  );
  assert.deepEqual(
    model.visibleRoutines(list, "all", "", 2).map((r) => r.id),
    ["2"]
  );
});

test("eligibleStudentsForRoutine enforces 1 active routine per student limit", () => {
  const s1 = makeStudent("s1", "Atleta 1", "ATIVO");
  const s2 = makeStudent("s2", "Atleta 2", "ATIVO");
  const s3 = makeStudent("s3", "Atleta 3", "INATIVO"); // inativo
  const s4 = makeStudent("s4", "Atleta 4", "PENDENTE"); // pendente
  const s5 = makeStudent("s5", "Atleta 5", "ATIVO");

  const routines = [
    makeRoutine("r1", "Rotina 1", 1, 3, true, "ATIVA", [{ id: "s1", nome: "Atleta 1" }]),
    makeRoutine("r2", "Rotina 2", 1, 3, false, "ENCERRADA", [{ id: "s5", nome: "Atleta 5" }]),
  ];

  // s1 tem rotina ativa r1, então não está elegível
  // s3 e s4 não são ativos
  // s5 estava numa rotina já ENCERRADA, então está elegível!
  // s2 não tem nenhuma rotina, então está elegível!
  const eligible = model.eligibleStudentsForRoutine([s1, s2, s3, s4, s5], routines);
  assert.deepEqual(eligible.map((s) => s.id), ["s2", "s5"]);

  // Se estivermos editando r1, s1 deve permanecer elegível para a própria r1
  const eligibleForR1 = model.eligibleStudentsForRoutine([s1, s2, s3, s4, s5], routines, "r1");
  assert.deepEqual(eligibleForR1.map((s) => s.id), ["s1", "s2", "s5"]);

  // Aluno s1 possui rotina ativa na modalidade 1, mas está elegível para rotina na modalidade 2 (1 rotina ativa por modalidade)
  const s1Multi = { ...s1, modalidades: [{ id: 1, nome: "Natação" }, { id: 2, nome: "Academia" }] };
  const s2Multi = { ...s2, modalidades: [{ id: 1, nome: "Natação" }, { id: 2, nome: "Academia" }] };
  const eligibleForMod2 = model.eligibleStudentsForRoutine([s1Multi, s2Multi], routines, undefined, 2);
  assert.deepEqual(eligibleForMod2.map((s) => s.id), ["s1", "s2"]);
});

test("validateCreateRoutinePayload enforces title, modality, frequency 1..7, goals, and student without requiring routine metrics", () => {
  assert.ok(model.validateCreateRoutinePayload({}).titulo);
  assert.ok(model.validateCreateRoutinePayload({}).modalidadeId);
  assert.ok(model.validateCreateRoutinePayload({}).frequenciaSemanal);
  assert.ok(model.validateCreateRoutinePayload({}).objetivos);
  assert.ok(model.validateCreateRoutinePayload({}).alunosIds);
  assert.equal(model.validateCreateRoutinePayload({}).metricasIds, undefined);

  // Frequência inválida
  assert.ok(model.validateCreateRoutinePayload({ frequenciaSemanal: 0 }).frequenciaSemanal);
  assert.ok(model.validateCreateRoutinePayload({ frequenciaSemanal: 8 }).frequenciaSemanal);

  // Payload válido (sem metricasIds na criação da rotina)
  const valid = {
    titulo: "Treino A",
    modalidadeId: 1,
    frequenciaSemanal: 4,
    objetivos: "Resistência",
    alunosIds: ["s1"],
  };
  assert.equal(Object.keys(model.validateCreateRoutinePayload(valid)).length, 0);
});

test("validateReuseRoutinePayload validates student, date YYYY-MM-DD, title, and goals", () => {
  assert.ok(model.validateReuseRoutinePayload({}).alunoId);
  assert.ok(model.validateReuseRoutinePayload({}).dataInicio);
  assert.ok(model.validateReuseRoutinePayload({ dataInicio: "20-10-2026" }).dataInicio);
  assert.ok(model.validateReuseRoutinePayload({}).titulo);
  assert.ok(model.validateReuseRoutinePayload({}).objetivos);

  const valid = {
    alunoId: "s1",
    dataInicio: "2026-11-01",
    titulo: "Cópia Treino A",
    objetivos: "Evolução contínua",
  };
  assert.equal(Object.keys(model.validateReuseRoutinePayload(valid)).length, 0);
});

test("rotinaService integration signatures and URLs match API routes", async () => {
  let calledUrl = "";
  let calledMethod = "";
  let calledBody = null;

  const mockApi = {
    get: async (url) => { calledUrl = url; calledMethod = "GET"; return { data: [{ id: "r1" }] }; },
    post: async (url, body) => { calledUrl = url; calledMethod = "POST"; calledBody = body; return { data: { id: "r1" } }; },
    put: async (url, body) => { calledUrl = url; calledMethod = "PUT"; calledBody = body; return { data: { id: "r1" } }; },
    patch: async (url) => { calledUrl = url; calledMethod = "PATCH"; return { data: { id: "r1", status: "ENCERRADA" } }; },
    delete: async (url) => { calledUrl = url; calledMethod = "DELETE"; return { data: { mensagem: "Sucesso" } }; },
  };

  const apiTypes = load("types/api.ts");
  const serviceModule = load("services/rotinaService.ts", {
    "./api": { api: mockApi },
    "../types/api": apiTypes,
  });
  const { rotinaService } = serviceModule;

  await rotinaService.listar();
  assert.equal(calledUrl, "/api/personal-trainers/rotinas");
  assert.equal(calledMethod, "GET");

  await rotinaService.buscarPorId("abc");
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/abc");

  await rotinaService.criar({ titulo: "Nova" });
  assert.equal(calledUrl, "/api/personal-trainers/rotinas");
  assert.equal(calledMethod, "POST");

  await rotinaService.encerrar("abc");
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/abc/encerrar");
  assert.equal(calledMethod, "PATCH");

  await rotinaService.excluir("abc");
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/abc");
  assert.equal(calledMethod, "DELETE");

  await rotinaService.reutilizar("abc", { alunoId: "s1", dataInicio: "2026-11-01", titulo: "T2", objetivos: "O2" });
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/abc/reutilizar");
  assert.equal(calledMethod, "POST");

  await rotinaService.desvincularAluno("abc", "s1");
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/abc/alunos/s1");
  assert.equal(calledMethod, "DELETE");

  await rotinaService.atualizar("abc", {
    titulo: "Treino Atualizado",
    frequenciaSemanal: 5,
    objetivos: "Novos objetivos",
    alunosIds: ["s1"],
  });
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/abc");
  assert.equal(calledMethod, "PUT");
  assert.equal(calledBody.titulo, "Treino Atualizado");

  await rotinaService.vincularTurma("rot-1", "turma-9");
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/rot-1/turmas/turma-9");
  assert.equal(calledMethod, "POST");
  assert.equal(calledBody, undefined);

  await rotinaService.vincularTurma("rot-1", "turma-9", true);
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/rot-1/turmas/turma-9");
  assert.equal(calledMethod, "POST");
  assert.equal(calledBody, undefined);

  await rotinaService.consultarPlanejamento("abc");
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/abc/planejamento");
  assert.equal(calledMethod, "GET");

  await rotinaService.adicionarSessao("abc", {
    semana: 1,
    dataPlanejada: "2026-11-10",
    duracao: 45,
    atividades: "Recuperação ativa\nAquecimento: 10 min",
    metricasIds: ["m1"],
  });
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/abc/sessoes");
  assert.equal(calledMethod, "POST");
  assert.equal(calledBody.semana, 1);
  assert.equal(calledBody.duracao, 45);
  assert.deepEqual(calledBody.metricasIds, ["m1"]);

  await rotinaService.duplicarSessao("sess-1", {
    semana: 2,
    dataPlanejada: "2026-11-17",
  });
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/sessoes/sess-1/duplicar");
  assert.equal(calledMethod, "POST");
  assert.deepEqual(calledBody, { semana: 2, dataPlanejada: "2026-11-17" });

  await rotinaService.duplicarSemana("abc", 1);
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/abc/semanas/1/duplicar");
  assert.equal(calledMethod, "POST");
});

test("eligibleGroupsForRoutine and extractProblemDetail enforce modality match and RFC 7807 detail", () => {
  const routine = makeRoutine("r1", "Treino Natação", 1, 3, true, "ATIVA");
  const groups = [
    { id: "g1", nome: "Natação Manhã", modalidadeId: 1 },
    { id: "g2", nome: "Tênis Tarde", modalidadeId: 2 },
    { id: "g3", nome: "Natação Noite", modalidadeId: 1 },
  ];
  assert.deepEqual(
    model.eligibleGroupsForRoutine(groups, routine).map((g) => g.id),
    ["g1", "g3"]
  );

  const err422 = {
    response: {
      status: 422,
      data: {
        type: "https://api.gymnasion.com/errors/regra-de-negocio",
        title: "Violação de Regra de Negócio",
        status: 422,
        detail: "O aluno Lucas já possui uma rotina de treino ativa. A rotina atual precisa ser encerrada antes.",
      },
    },
  };
  assert.equal(
    model.extractProblemDetail(err422, "Erro genérico"),
    "O aluno Lucas já possui uma rotina de treino ativa. A rotina atual precisa ser encerrada antes."
  );
  assert.equal(model.extractProblemDetail({}, "Erro genérico"), "Erro genérico");
});

test("routineModalityCounts, getStudentInitials, and getModalityBadgeStyle match Figma specs", () => {
  // Initials
  assert.equal(model.getStudentInitials("Ana Beatriz Silva"), "AS");
  assert.equal(model.getStudentInitials("Gabriel"), "GA");
  assert.equal(model.getStudentInitials(""), "AL");

  // Modality styling
  const natacao = model.getModalityBadgeStyle("Natação");
  assert.equal(natacao.bg, "#eff8ff");
  assert.equal(natacao.color, "#175cd3");

  const tenis = model.getModalityBadgeStyle("Tênis");
  assert.equal(tenis.bg, "#f4fce3");
  assert.equal(tenis.color, "#598b00");

  const academia = model.getModalityBadgeStyle("Academia");
  assert.equal(academia.bg, "#f4f3ff");
  assert.equal(academia.color, "#5925dc");

  // Counts
  const routinesList = [
    makeRoutine("1", "R1", 1, 4),
    makeRoutine("2", "R2", 1, 3),
    makeRoutine("3", "R3", 2, 3),
  ];
  const mods = [
    { id: 1, nome: "Natação" },
    { id: 2, nome: "Tênis" },
  ];
  const counts = model.routineModalityCounts(routinesList, mods);
  assert.equal(
    JSON.stringify(counts),
    JSON.stringify([
      { id: null, nome: "Todas", count: 3 },
      { id: 1, nome: "Natação", count: 2 },
      { id: 2, nome: "Tênis", count: 1 },
    ])
  );
});

test("studentRoutines filters student active routines by modality when specified", () => {
  const studentModel = load("features/personal/studentModel.ts");
  const routinesList = [
    makeRoutine("r1", "Treino Natação", 1, 3, true, "ATIVA", [{ id: "aluno-1", nome: "Mikael" }]),
    makeRoutine("r2", "Treino Academia", 2, 4, true, "ATIVA", [{ id: "aluno-1", nome: "Mikael" }]),
  ];

  // Sem filtro de modalidade: retorna ambas as rotinas ativas
  const allStudentRoutines = studentModel.studentRoutines(routinesList, "aluno-1");
  assert.equal(allStudentRoutines.length, 2);

  // Com filtro para modalidade 2 (Academia): retorna apenas a rotina de Academia
  const academiaRoutines = studentModel.studentRoutines(routinesList, "aluno-1", 2);
  assert.equal(academiaRoutines.length, 1);
  assert.equal(academiaRoutines[0].id, "r2");

  // Com filtro para modalidade 1 (Natação): retorna apenas a rotina de Natação
  const natacaoRoutines = studentModel.studentRoutines(routinesList, "aluno-1", 1);
  assert.equal(natacaoRoutines.length, 1);
  assert.equal(natacaoRoutines[0].id, "r1");
});

test("getRoutineStructureTag and extended getModalityBadgeStyle return division and sport colors", () => {
  assert.equal(model.getRoutineStructureTag(3, "Academia"), "Divisão A/B/C");
  assert.equal(model.getRoutineStructureTag(4, "Musculação"), "Divisão A/B/C/D");
  assert.equal(model.getRoutineStructureTag(3, "Natação"), "Microciclo · 3 sessões");
  assert.equal(model.getRoutineStructureTag(1, "Corrida de Rua"), "Microciclo · 1 sessão");

  const corrida = model.getModalityBadgeStyle("Corrida de Rua");
  assert.equal(corrida.color, "#e11d48");

  const crossfit = model.getModalityBadgeStyle("Crossfit");
  assert.equal(crossfit.color, "#dc6803");

  const pilates = model.getModalityBadgeStyle("Pilates");
  assert.equal(pilates.color, "#027a48");
});

test("buildRoutineTemplates consolidates duplicate and cycle routines into unique models", () => {
  const r1 = makeRoutine(
    "r1",
    "Periodização Aquática - Velocidade e Endurance",
    1,
    3,
    true,
    "ATIVA",
    [{ id: "s1", nome: "Mikael Torres" }],
    [{ id: "m1", titulo: "Tempo 100m", tipo: "TEMPO" }]
  );
  const r2 = makeRoutine(
    "r2",
    "Periodização Aquática - Velocidade e Endurance",
    1,
    3,
    true,
    "ATIVA",
    [
      { id: "s1", nome: "Mikael Torres" },
      { id: "s2", nome: "Carlos Dias" },
      { id: "s3", nome: "Ana Martins" },
    ],
    [
      { id: "m1", titulo: "Tempo 100m", tipo: "TEMPO" },
      { id: "m2", titulo: "FC Máxima", tipo: "FREQUENCIA_CARDIACA" },
    ]
  );
  const r3 = makeRoutine(
    "r3",
    "Periodização Aquática - Velocidade e Endurance (Ciclo 2)",
    1,
    3,
    false,
    "ENCERRADA",
    [{ id: "s4", nome: "Beatriz Lima" }],
    [{ id: "m1", titulo: "Tempo 100m", tipo: "TEMPO" }]
  );
  const r4 = makeRoutine(
    "r4",
    "Hipertrofia e Força Pura",
    2,
    4,
    true,
    "ATIVA",
    [{ id: "s5", nome: "Lucas Ferreira" }],
    [{ id: "m3", titulo: "Carga Supino", tipo: "NUMERICO" }]
  );

  const templates = model.buildRoutineTemplates([r1, r2, r3, r4]);
  assert.equal(templates.length, 2);

  // O modelo com mais ciclos ativos (Periodização Aquática: 2 ativos de 3 totais) vem primeiro
  const aquaticTemplate = templates[0];
  assert.equal(aquaticTemplate.displayTitle, "Periodização Aquática - Velocidade e Endurance");
  assert.equal(aquaticTemplate.cyclesCount, 3);
  assert.equal(aquaticTemplate.activeCyclesCount, 2);
  // Alunos únicos somados sem duplicar s1 (s1, s2, s3, s4 = 4 alunos)
  assert.equal(aquaticTemplate.totalStudentsCount, 4);
  // Escolhe r2 como baseRoutine por ser ativa e ter mais métricas/alunos
  assert.equal(aquaticTemplate.baseRoutine.id, "r2");

  // Escopo individual vs coletivo
  assert.equal(model.getRoutineScopeLabel(r1), "Individual · Mikael");
  assert.equal(model.getRoutineScopeLabel(r2), "Turma / Coletivo · 3 alunos");
});

test("new routine draft cache starts without preselected fields and roundtrips cleanly", () => {
  const initial = model.createInitialNewRoutineDraft();
  assert.equal(initial.titulo, "");
  assert.equal(initial.modalidadeId, null);
  assert.equal(initial.frequenciaSemanal, 0);
  assert.equal(JSON.stringify(initial.selectedStudentIds), JSON.stringify([]));
  assert.equal(initial.sendToTurma, false);

  const serialized = model.serializeNewRoutineDraft({
    titulo: "Resistência 1500m",
    modalidadeId: 1,
    frequenciaSemanal: 3,
    objetivos: "Melhorar ritmo médio em águas abertas",
    selectedStudentIds: ["s1"],
    sendToTurma: false,
  });

  const restored = model.parseNewRoutineDraft(serialized);
  assert.equal(restored.titulo, "Resistência 1500m");
  assert.equal(restored.modalidadeId, 1);
  assert.equal(restored.frequenciaSemanal, 3);
  assert.equal(JSON.stringify(restored.selectedStudentIds), JSON.stringify(["s1"]));
});

test("filterAndSortRoutineMetrics, classifyStudentsForRoutine and multiple turmas selection work accurately", () => {
  const metrics = [
    { id: "m1", titulo: "Tempo 400m Livre", tipo: "TEMPO", obrigatoria: true },
    { id: "m2", titulo: "Frequência Cardíaca Média", tipo: "FREQUENCIA_CARDIACA", obrigatoria: false },
    { id: "m3", titulo: "Distância Total Nadada (m)", tipo: "NUMERICO", obrigatoria: true },
  ];

  // m2 está selecionada -> vem primeiro no topo, seguida pelas obrigatórias em ordem alfabética (m3, m1)
  const sorted = model.filterAndSortRoutineMetrics(metrics, ["m2"], "");
  assert.equal(
    JSON.stringify(sorted.map((m) => m.id)),
    JSON.stringify(["m2", "m3", "m1"])
  );

  // Filtro de busca por texto insensível a acentos, por tipo e por obrigatoriedade
  const filtered = model.filterAndSortRoutineMetrics(metrics, [], "distancia");
  assert.equal(
    JSON.stringify(filtered.map((m) => m.id)),
    JSON.stringify(["m3"])
  );
  assert.deepEqual(
    model.filterAndSortRoutineMetrics(metrics, [], "opcional").map((m) => m.id),
    ["m2"]
  );
  assert.deepEqual(
    model.filterAndSortRoutineMetrics(metrics, [], "freq").map((m) => m.id),
    ["m2"]
  );

  // IDs das métricas obrigatórias
  assert.equal(
    JSON.stringify(model.getRequiredMetricIds(metrics)),
    JSON.stringify(["m1", "m3"])
  );

  // Classificação de alunos ocupados (RN-012) com título da rotina ativa
  const s1 = makeStudent("s1", "Mikael Torres", "ATIVO");
  const s2 = makeStudent("s2", "Beatriz Lima", "ATIVO");
  const activeRoutines = [
    makeRoutine("r1", "Periodização Aquática", 1, 3, true, "ATIVA", [{ id: "s1", nome: "Mikael Torres" }]),
  ];
  const classified = model.classifyStudentsForRoutine([s1, s2], activeRoutines, undefined, 1);
  assert.equal(
    JSON.stringify(classified.eligible.map((s) => s.id)),
    JSON.stringify(["s2"])
  );
  assert.equal(classified.busy.length, 1);
  assert.equal(classified.busy[0].student.id, "s1");
  assert.equal(classified.busy[0].activeRoutineTitle, "Periodização Aquática");

  // Suporte a múltiplas turmas por modalidade
  const groups = [
    { id: "t1", nome: "Natação Alto Rendimento", modalidadeId: 1, alunos: [{ id: "s1" }, { id: "s2" }] },
    { id: "t2", nome: "Natação Master", modalidadeId: 1, alunos: [{ id: "s2" }, { id: "s3" }] },
    { id: "t3", nome: "Funcional Manhã", modalidadeId: 2, alunos: [{ id: "s4" }] },
  ];
  const modGroups = model.getModalityGroupsForRoutine(groups, 1);
  assert.equal(
    JSON.stringify(modGroups.map((g) => g.id)),
    JSON.stringify(["t1", "t2"])
  );

  // Toggle da turma t1 adiciona apenas alunos elegíveis (s2, pois s1 está ocupado)
  const step1 = model.toggleTurmaStudentsSelection([], [], "t1", modGroups, ["s2", "s3"]);
  assert.equal(JSON.stringify(step1.nextTurmaIds), JSON.stringify(["t1"]));
  assert.equal(JSON.stringify(step1.nextStudentIds), JSON.stringify(["s2"]));

  // Toggle da turma t2 adiciona s3 e mantém s2
  const step2 = model.toggleTurmaStudentsSelection(
    step1.nextStudentIds,
    step1.nextTurmaIds,
    "t2",
    modGroups,
    ["s2", "s3"]
  );
  assert.equal(JSON.stringify(step2.nextTurmaIds), JSON.stringify(["t1", "t2"]));
  assert.equal(JSON.stringify(step2.nextStudentIds), JSON.stringify(["s2", "s3"]));

  // Desmarcar t1 mantém s2 porque s2 também pertence à turma t2 que continua marcada
  const step3 = model.toggleTurmaStudentsSelection(
    step2.nextStudentIds,
    step2.nextTurmaIds,
    "t1",
    modGroups,
    ["s2", "s3"]
  );
  assert.equal(JSON.stringify(step3.nextTurmaIds), JSON.stringify(["t2"]));
  assert.equal(JSON.stringify(step3.nextStudentIds), JSON.stringify(["s2", "s3"]));
});

test("eligibleStudentsForRoutine enforces 1 active routine per linked sport for hybrid athletes", () => {
  const hybrid = {
    id: "h1",
    usuario: { nome: "Híbrido", email: "h@gymnasion.test" },
    status: "ATIVO",
    modalidades: [
      { id: 1, nome: "Natação" },
      { id: 2, nome: "Musculação" },
    ],
  };
  const routines = [
    makeRoutine("r-swim", "Natação Base", 1, 3, true, "ATIVA", [{ id: "h1", nome: "Híbrido" }]),
  ];

  // Bloqueado na mesma modalidade (1 = Natação)
  assert.deepEqual(model.eligibleStudentsForRoutine([hybrid], routines, undefined, 1), []);
  // Elegível em outra modalidade vinculada (2 = Musculação)
  assert.deepEqual(
    model.eligibleStudentsForRoutine([hybrid], routines, undefined, 2).map((s) => s.id),
    ["h1"]
  );
  // Inelegível em modalidade não vinculada ao perfil (3 = Corrida)
  assert.deepEqual(model.eligibleStudentsForRoutine([hybrid], routines, undefined, 3), []);
});






