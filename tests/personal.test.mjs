import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const source = readFileSync(new URL("../src/features/personal/studentModel.ts",import.meta.url),"utf8");
const exports = {};
runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const { visibleStudents, studentCounts, applyStudentMutation, studentsWithoutRoutine, filterModalities } = exports;
const aluno = (id,nome,status,modality=1) => ({id,usuario:{nome,email:nome+"@example.test"},status,modalidades:[{id:modality,nome:"Natação"}]});
const data = [aluno("a","André","ATIVO"),aluno("b","Bruna","INATIVO",2),aluno("c","Caio","PENDENTE"),aluno("d","Diana","ATIVO")];
const ids = values => Array.from(values,item=>item.id);
test("status totals exclude pending students from the enrolled list",()=>{
  assert.equal(studentCounts(data).all,3);
  assert.equal(studentCounts(data).pending,1);
  assert.deepEqual(ids(visibleStudents(data,"all","","")),["a","b","d"]);
});
test("search is accent insensitive and combines status and modality",()=>{
  assert.deepEqual(ids(visibleStudents(data,"active","andre","1")),["a"]);
  assert.deepEqual(ids(visibleStudents(data,"active","andre","2")),[]);
  assert.deepEqual(ids(visibleStudents(data,"inactive","@example.test","2")),["b"]);
});
test("approval moves a student from pending to active without duplicating",()=>{
  const result = applyStudentMutation(data,"c","approve");
  assert.equal(result.length,4);
  assert.equal(studentCounts(result).pending,0);
  assert.equal(studentCounts(result).active,3);
  assert.equal(data[2].status,"PENDENTE");
});
test("rejection removes only the selected student",()=>{
  assert.deepEqual(ids(applyStudentMutation(data,"c","reject")),["a","b","d"]);
  assert.equal(data.length,4);
});
test("deactivation and reactivation preserve student information",()=>{
  const inactive = applyStudentMutation(data,"a","deactivate");
  assert.equal(inactive[0].status,"INATIVO");
  assert.equal(inactive[0].usuario,data[0].usuario);
  assert.equal(applyStudentMutation(inactive,"a","reactivate")[0].status,"ATIVO");
});
test("without routine only includes active students with no routine membership",()=>{
  const routines = [{id:"r",alunos:[{id:"a"}]}];
  assert.deepEqual(ids(studentsWithoutRoutine(data,routines)),["d"]);
});
test("empty lists and missing IDs are safe",()=>{
  assert.equal(studentCounts([]).all,0);
  assert.deepEqual(ids(applyStudentMutation(data,"missing","reject")),ids(data));
});
test("ended routines do not prevent a new active routine",()=>{
  const routines = [{id:"old",ativo:false,alunos:[{id:"a"}]}];
  assert.deepEqual(ids(studentsWithoutRoutine(data,routines)),["a","d"]);
});
const dashboardExports = {};
runInNewContext(ts.transpileModule(readFileSync(new URL("../src/features/personal/dashboardModel.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:dashboardExports});
const {weeklySessions,rpeSeries,lastSession} = dashboardExports;
const session = (id,date,rpe,status="CONCLUIDA")=>({id,dataReal:date,status,desempenho:{nivelCansaco:rpe}});
const histories = [
  {alunoId:"a",sessions:[session("s1","2026-10-12",4),session("s2","2026-10-14",8),session("s3","2026-10-11",6)]},
  {alunoId:"d",sessions:[session("s2","2026-10-14",8),session("s4","2026-10-14",null),session("s5","2026-10-14",6),session("future","2026-10-15",10),session("planned","2026-10-14",5,"PLANEJADA")]},
];
test("weekly total starts on Monday and excludes future, planned and duplicate sessions",()=>{
  assert.equal(weeklySessions(histories,new Date(2026,9,14)),4);
});
test("RPE daily average ignores missing scores and duplicate sessions",()=>{
  const series = rpeSeries(histories,7,new Date(2026,9,14));
  const today = series.find(item=>item.date==="2026-10-14");
  assert.equal(today.value,7);
  assert.equal(today.count,2);
});
test("RPE range keeps date-only values in local time",()=>{
  const values = rpeSeries(histories,2,new Date(2026,9,14));
  assert.equal(values.length,1);
  assert.equal(values[0].date,"2026-10-14");
});
test("last session is selected for the correct student",()=>{
  assert.equal(lastSession(histories,"a").id,"s2");
  assert.equal(lastSession(histories,"missing"),undefined);
});
test("personalTrainerService sends hybrid modalidadesIds on invites and modality updates", async () => {
  const calls = [];
  const mockApi = {
    post: async (url, body) => {
      calls.push(["POST", url, body]);
      return { data: { url: "https://gymnasion.test/convite" } };
    },
    put: async (url, body) => {
      calls.push(["PUT", url, body]);
      return { data: { id: "a1", modalidades: [{ id: 1, nome: "Natação" }, { id: 2, nome: "Musculação" }] } };
    },
  };
  const ptExports = {};
  runInNewContext(
    ts.transpileModule(readFileSync(new URL("../src/services/personalTrainerService.ts", import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports: ptExports,
      require: (name) => {
        if (name === "./api") return { api: mockApi };
        return {};
      },
    }
  );
  await ptExports.personalTrainerService.gerarConvite([1, 2], "atleta@gymnasion.test");
  await ptExports.personalTrainerService.gerarConvite(3);
  await ptExports.personalTrainerService.atualizarModalidades("a1", [1, 2]);
  assert.equal(JSON.stringify(calls), JSON.stringify([
    ["POST", "/api/personal-trainers/convites", { modalidadesIds: [1, 2], modalidadeId: 1, emailAluno: "atleta@gymnasion.test" }],
    ["POST", "/api/personal-trainers/convites", { modalidadesIds: [3], modalidadeId: 3 }],
    ["PUT", "/api/personal-trainers/alunos/a1/modalidades", { modalidadesIds: [1, 2] }],
  ]));
});
test("filterModalities sorts alphabetically and searches accent-insensitively", () => {
  const catalog = [
    { id: 1, nome: "Remo" },
    { id: 2, nome: "Natação" },
    { id: 3, nome: "Academia" },
    { id: 4, nome: "Karatê" },
  ];
  assert.deepEqual(Array.from(filterModalities(catalog, ""), (m) => m.nome), ["Academia", "Karatê", "Natação", "Remo"]);
  assert.deepEqual(Array.from(filterModalities(catalog, "natacao"), (m) => m.nome), ["Natação"]);
  assert.deepEqual(Array.from(filterModalities(catalog, "karate"), (m) => m.nome), ["Karatê"]);
  assert.deepEqual(Array.from(filterModalities(catalog, "inexistente"), (m) => m.nome), []);
});
