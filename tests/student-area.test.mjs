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

const activityParser = load("utils/activityParser.ts");
const model = load("features/studentArea/studentAreaModel.ts", {
  "../../utils/activityParser": activityParser,
});

test("getBorgInfo returns exact Borg CR-10 descriptors and handles null", () => {
  const level7 = model.getBorgInfo(7);
  assert.equal(level7.levelLabel, "7");
  assert.equal(level7.title, "Muito intenso");
  assert.equal(level7.description, "Difícil manter uma conversa durante o esforço.");
  assert.equal(level7.tone, "orange");

  const level2 = model.getBorgInfo(2);
  assert.equal(level2.tone, "green");

  const level10 = model.getBorgInfo(10);
  assert.equal(level10.tone, "red");

  const skipped = model.getBorgInfo(null);
  assert.equal(skipped.levelLabel, "—");
  assert.equal(skipped.tone, "neutral");
});

test("formatLoginToast detects suspended student login errors (US-05 / RN-014)", () => {
  const suspended = model.formatLoginToast(
    "O seu acesso encontra-se suspenso. Entre em contacto com o seu Personal Trainer."
  );
  assert.equal(suspended.title, "Seu acesso está suspenso");
  assert.equal(suspended.message, "Entre em contato com seu personal.");

  const inactive = model.formatLoginToast("Aluno inativo no sistema.");
  assert.equal(inactive.title, "Seu acesso está suspenso");
  assert.equal(inactive.message, "Entre em contato com seu personal.");

  const invalid = model.formatLoginToast("E-mail ou senha inválidos.");
  assert.equal(invalid.title, "E-mail ou senha inválidos.");
  assert.equal(invalid.message, "Verifique os dados e tente novamente.");
});

test("filterStudentSessions searches across title, description, and day ignoring accents", () => {
  const week3 = model.INITIAL_ROUTINE_WEEKS.find((w) => w.numero === 3);
  assert.equal(model.filterStudentSessions(week3.sessoes, "").length, 4);
  assert.deepEqual(
    Array.from(model.filterStudentSessions(week3.sessoes, "aerobica"), (s) => s.id),
    ["w3-s3"]
  );
  assert.deepEqual(
    Array.from(model.filterStudentSessions(week3.sessoes, "tecnica"), (s) => s.id),
    ["w3-s1", "w3-s4"]
  );
  assert.equal(model.filterStudentSessions(week3.sessoes, "inexistente").length, 0);
});

test("applySessionExecution marks session completed, updates count, and shifts highlight", () => {
  const initialCount = model.countCompletedSessions(model.INITIAL_ROUTINE_WEEKS, 0);
  assert.equal(initialCount, 6);

  const updatedWeeks = model.applySessionExecution(
    model.INITIAL_ROUTINE_WEEKS,
    "w3-s3",
    7,
    "em 09/10"
  );
  const week3 = updatedWeeks.find((w) => w.numero === 3);
  const s3 = week3.sessoes.find((s) => s.id === "w3-s3");
  const s4 = week3.sessoes.find((s) => s.id === "w3-s4");

  assert.equal(s3.status, "CONCLUIDA");
  assert.equal(s3.rpe, 7);
  assert.equal(s3.destaque, false);
  assert.ok((s3.dataReal || s3.descricao).includes("09/10"));
  assert.equal(s4.destaque, true);
  assert.equal(model.countCompletedSessions(updatedWeeks, 0), 7);
});

test("alunoService endpoints match backend contract for ROLE_ALUNO", async () => {
  const calls = [];
  const mockApi = {
    get: async (url, config) => {
      calls.push(["GET", url, config]);
      return { data: [] };
    },
    post: async (url, body) => {
      calls.push(["POST", url, body]);
      return { data: { sessaoId: "s1", status: "CONCLUIDA" } };
    },
    patch: async (url) => {
      calls.push(["PATCH", url]);
      return { data: { id: "n1", lida: true } };
    },
  };

  const apiTypes = load("types/api.ts");
  const { alunoService } = load("services/alunoService.ts", {
    "./api": { api: mockApi },
    "../types/api": apiTypes,
  });

  await alunoService.obterMeuPerfil();
  await alunoService.listarRotinas();
  await alunoService.consultarPlanejamento("rot-1");
  await alunoService.obterFormularioExecucao("sess-1");
  await alunoService.registrarExecucao("sess-1", {
    dataReal: "2026-10-08",
    duracao: 55,
    nivelCansaco: 7,
    resultados: [],
  });
  await alunoService.consultarHistoricoRotina("rot-1");
  await alunoService.listarNotificacoes();
  await alunoService.lerNotificacao("notif-1");
  await alunoService.lerTodasNotificacoes();
  await alunoService.listarFeedbacks();
  await alunoService.registrarObservacao("Ótimo treino!");
  await alunoService.consultarEvolucao({ dataInicio: "2026-07-01", dataFim: "2026-10-08" });

  assert.deepEqual(
    calls.map((c) => [c[0], c[1]]),
    [
      ["GET", "/api/alunos/me"],
      ["GET", "/api/alunos/rotinas"],
      ["GET", "/api/alunos/rotinas/rot-1/planejamento"],
      ["GET", "/api/alunos/rotinas/sessoes/sess-1/execucao"],
      ["POST", "/api/alunos/rotinas/sessoes/sess-1/execucao"],
      ["GET", "/api/alunos/rotinas/rot-1/historico"],
      ["GET", "/api/alunos/notificacoes"],
      ["PATCH", "/api/alunos/notificacoes/notif-1/ler"],
      ["PATCH", "/api/alunos/notificacoes/marcar-como-lidas"],
      ["GET", "/api/alunos/observacoes-feedbacks"],
      ["POST", "/api/alunos/observacoes-feedbacks"],
      ["GET", "/api/alunos/evolucao"],
    ]
  );
});

test("buildUnifiedCalendarWeeks groups hybrid athlete sessions by real civil Monday-Sunday weeks", () => {
  const rSwim = {
    id: "rot-swim",
    titulo: "Travessia 1500m",
    modalidade: "Natação",
    modalidadeId: 1,
    frequenciaSemanal: 2,
    objetivos: "Resistência",
    totalSemanas: 2,
    semanaAtual: 1,
  };
  const rGym = {
    id: "rot-gym",
    titulo: "Força Geral",
    modalidade: "Musculação",
    modalidadeId: 2,
    frequenciaSemanal: 2,
    objetivos: "Potência",
    totalSemanas: 2,
    semanaAtual: 1,
  };

  assert.equal(model.getMondayIso("2026-10-14"), "2026-10-12");
  assert.equal(model.addDaysIso("2026-10-12", 6), "2026-10-18");
  assert.equal(model.sportKeyFromName("Musculação"), "academia");
  assert.equal(model.sportKeyFromName("Natação"), "natacao");
  assert.equal(model.sportKeyFromName("Pilates"), "Pilates");

  const unified = model.buildUnifiedCalendarWeeks(
    [
      {
        routine: rSwim,
        weeks: [
          {
            numero: 2,
            titulo: "Semana 2",
            periodo: "Semana atual",
            estado: "atual",
            sessoes: [
              {
                id: "s-swim-tue",
                numero: 1,
                semana: 2,
                diaSemana: "TER",
                dataPlanejada: "13/10",
                dataPlanejadaIso: "2026-10-13",
                titulo: "Crawl 1200m",
                descricao: "Série técnica",
                duracaoPlanejada: 50,
                status: "PLANEJADA",
                destaque: false,
                rpe: null,
              },
            ],
          },
        ],
      },
      {
        routine: rGym,
        weeks: [
          {
            numero: 1,
            titulo: "Semana 1",
            periodo: "Semana atual",
            estado: "atual",
            sessoes: [
              {
                id: "s-gym-tue",
                numero: 1,
                semana: 1,
                diaSemana: "TER",
                dataPlanejada: "13/10",
                dataPlanejadaIso: "2026-10-13",
                titulo: "Superior + Core",
                descricao: "Fortalecimento",
                duracaoPlanejada: 45,
                status: "PLANEJADA",
                destaque: false,
                rpe: null,
              },
              {
                id: "s-gym-prev",
                numero: 1,
                semana: 0,
                diaSemana: "QUA",
                dataPlanejada: "07/10",
                dataPlanejadaIso: "2026-10-07",
                titulo: "Adaptação",
                descricao: "Leve",
                duracaoPlanejada: 40,
                status: "CONCLUIDA",
                destaque: false,
                rpe: 5,
              },
            ],
          },
        ],
      },
    ],
    "2026-10-13"
  );

  assert.equal(unified.length, 2);
  assert.equal(unified[0].estado, "anterior");
  assert.equal(unified[0].sessoes[0].id, "s-gym-prev");
  assert.equal(unified[1].estado, "atual");
  assert.equal(unified[1].sessoes.length, 2);
  assert.deepEqual(
    Array.from(unified[1].sessoes, (s) => s.modalidadeNome),
    ["Musculação", "Natação"]
  );
  assert.equal(unified[1].sessoes.filter((s) => s.destaque).length, 1);
  assert.equal(model.filterStudentSessions(unified[1].sessoes, "musculacao").length, 1);
});

test("mapPlanningToWeeks maps session-level metrics onto StudentWorkoutSession including 0-metric sessions", () => {
  const rotina = {
    id: "r1",
    titulo: "Travessia",
    nomeModalidade: "Natação",
    modalidadeId: 1,
    frequenciaSemanal: 2,
    objetivos: "Base",
    metricas: [],
  };
  const planejamento = [
    {
      numeroSemana: 1,
      sessoes: [
        {
          id: "s1",
          semana: 1,
          dataPlanejada: "2026-10-12",
          duracao: 45,
          atividades: "Técnica",
          status: "PLANEJADA",
          metricas: [
            {
              id: "m1",
              titulo: "Tempo 400m",
              tipo: "TEMPO",
              obrigatoria: true,
              quemPreenche: "ALUNO",
            },
          ],
        },
        {
          id: "s2",
          semana: 1,
          dataPlanejada: "2026-10-14",
          duracao: 30,
          atividades: "Soltura",
          status: "PLANEJADA",
          metricas: [],
        },
      ],
    },
  ];

  const mapped = model.mapPlanningToWeeks(rotina, planejamento);
  assert.equal(mapped.weeks[0].sessoes[0].metricas.length, 1);
  assert.equal(mapped.weeks[0].sessoes[0].metricas[0].id, "m1");
  assert.equal(mapped.weeks[0].sessoes[1].metricas.length, 0);
});
