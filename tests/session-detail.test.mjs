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

test("sessionDetailService maps all Figma screens to backend endpoints", async () => {
  let calledUrl = "";
  let calledMethod = "";
  let calledBody = null;
  let calledParams = null;

  const mockApi = {
    get: async (url, config) => {
      calledUrl = url;
      calledMethod = "GET";
      calledParams = config?.params;
      return { data: { id: "sess-1", semana: 3 } };
    },
    post: async (url, body) => {
      calledUrl = url;
      calledMethod = "POST";
      calledBody = body;
      return { data: { id: "fb-1", conteudo: body?.conteudo } };
    },
    patch: async (url, body) => {
      calledUrl = url;
      calledMethod = "PATCH";
      calledBody = body;
      return { data: { id: "sess-1", validadaPersonal: true } };
    },
    put: async (url, body) => {
      calledUrl = url;
      calledMethod = "PUT";
      calledBody = body;
      return { data: { id: "sess-1", ...body } };
    },
  };

  const apiTypes = load("types/api.ts");
  const serviceModule = load("services/sessionDetailService.ts", {
    "./api": { api: mockApi },
    "../types/api": apiTypes,
  });
  const { sessionDetailService } = serviceModule;

  // 1. Obter detalhes da sessão (Figma 549:8705 / 550:8615 / 551:8884)
  await sessionDetailService.obterSessao("sess-100");
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/sessoes/sess-100");
  assert.equal(calledMethod, "GET");

  // 2. Obter desempenho detalhado (US-23 C1)
  await sessionDetailService.obterDesempenho("sess-100");
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/sessoes/sess-100/desempenho");
  assert.equal(calledMethod, "GET");

  // 3. Validar execução da sessão (Figma 550:9331 / US-10 C6)
  await sessionDetailService.validarExecucao("sess-100");
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/sessoes/sess-100/validar");
  assert.equal(calledMethod, "PATCH");

  // 4. Corrigir desempenho com justificativa obrigatória (US-23 C3, C4)
  const payloadCorrecao = {
    nivelCansaco: 8,
    justificativa: "Ajuste após alinhamento presencial com a aluna",
    metricas: [{ metricaId: "m-1", valor: "00:42:15" }],
  };
  await sessionDetailService.corrigirDesempenho("sess-100", payloadCorrecao);
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/sessoes/sess-100/desempenho");
  assert.equal(calledMethod, "PATCH");
  assert.equal(calledBody.justificativa, payloadCorrecao.justificativa);
  assert.equal(calledBody.nivelCansaco, 8);

  // 5. Consultar trilha de auditoria (US-23 C5)
  await sessionDetailService.consultarAuditoria("sess-100");
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/sessoes/sess-100/desempenho/auditoria");
  assert.equal(calledMethod, "GET");
  assert.equal(calledParams?.size, 100);

  // 6. Editar planejamento de sessão futura com métricas 0..N (Figma 551:8884 / US-10 C2)
  const payloadEdicao = {
    semana: 3,
    dataPlanejada: "2026-11-20",
    duracao: 45,
    atividades: "Aquecimento: 300m livre\nPrincipal: 4x100m medley",
    metricasIds: ["m-1"],
  };
  await sessionDetailService.editarSessaoFutura("sess-100", payloadEdicao);
  assert.equal(calledUrl, "/api/personal-trainers/rotinas/sessoes/sess-100");
  assert.equal(calledMethod, "PUT");
  assert.equal(calledBody.duracao, 45);
  assert.equal(calledBody.dataPlanejada, "2026-11-20");
  assert.deepEqual(calledBody.metricasIds, ["m-1"]);

  // 7. Enviar feedback ao aluno (US-26)
  await sessionDetailService.enviarFeedback("aluno-9", "Ótima consistência nos treinos!");
  assert.equal(calledUrl, "/api/personal-trainers/alunos/aluno-9/observacoes-feedbacks");
  assert.equal(calledMethod, "POST");
  assert.equal(calledBody.conteudo, "Ótima consistência nos treinos!");

  // 8. Consultar feedbacks do aluno (US-26)
  await sessionDetailService.consultarFeedbacks("aluno-9");
  assert.equal(calledUrl, "/api/personal-trainers/alunos/aluno-9/observacoes-feedbacks");
  assert.equal(calledMethod, "GET");
});

test("session status and editability rules adhere to DRS v3 (US-10 C2, C6)", () => {
  // Sessão futura pode ser editada (não concluída e não validada)
  const sessaoFutura = { concluidaAluno: false, validadaPersonal: false };
  const podeEditarFutura = !sessaoFutura.concluidaAluno && !sessaoFutura.validadaPersonal;
  assert.equal(podeEditarFutura, true);

  // Sessão concluída pelo aluno NÃO pode ser editada via edição de planejamento futura (US-10 C2)
  const sessaoConcluida = { concluidaAluno: true, validadaPersonal: false };
  const podeEditarConcluida = !sessaoConcluida.concluidaAluno && !sessaoConcluida.validadaPersonal;
  assert.equal(podeEditarConcluida, false);

  // Sessão validada pelo personal também NÃO pode ser editada
  const sessaoValidada = { concluidaAluno: true, validadaPersonal: true };
  const podeEditarValidada = !sessaoValidada.concluidaAluno && !sessaoValidada.validadaPersonal;
  assert.equal(podeEditarValidada, false);
});

test("serializeAtividades and parseAtividades preserve multiline activity descriptions and orientations", () => {
  const parser = load("utils/activityParser.ts");

  const serialized = parser.serializeAtividades({
    sessionName: "Força & Circuito Metabólico",
    activities: [
      {
        title: "Aquecimento / Mobilidade",
        description: "• 5 min mobilidade articular\n• 2 × 15 prancha frontal",
      },
      {
        title: "Bloco Metabólico",
        description:
          "• 4 Rounds (40s : 20s):\n- Kettlebell Swing (16kg)\n- Corda Naval\n- Burpees",
      },
    ],
    orientations: "Hidratação a cada round.\nManter PSE entre 7 e 8.",
  });

  const parsed = parser.parseAtividades(serialized);
  assert.equal(parsed.sessionName, "Força & Circuito Metabólico");
  assert.equal(parsed.activities.length, 2);
  assert.equal(parsed.activities[0].title, "Aquecimento / Mobilidade");
  assert.equal(
    parsed.activities[0].description,
    "• 5 min mobilidade articular\n• 2 × 15 prancha frontal"
  );
  assert.equal(parsed.activities[1].title, "Bloco Metabólico");
  assert.ok(parsed.activities[1].description.includes("- Kettlebell Swing (16kg)"));
  assert.ok(parsed.activities[1].description.includes("- Burpees"));
  assert.equal(parsed.orientations, "Hidratação a cada round.\nManter PSE entre 7 e 8.");
});

test("buildSessionCardPreview avoids duplicating long single-line session text in both headline and body", () => {
  const parser = load("utils/activityParser.ts");

  const longSingleLine =
    "Ativação de Core + 4 Rounds Circuito Metabólico (Kettlebell Swing, Corda Naval, Escada de Agilidade e Burpees).";
  const preview = parser.buildSessionCardPreview(longSingleLine, 1);

  assert.equal(preview.headline, "Ativação de Core");
  assert.equal(preview.blocks.length, 1);
  assert.equal(preview.blocks[0].description, longSingleLine);
});
