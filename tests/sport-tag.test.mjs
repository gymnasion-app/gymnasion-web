import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";
function load(path, dependencies) {
  const exports = {};
  const source = readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
  runInNewContext(ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText, {exports,require:name=>dependencies[name]});
  return exports;
}
const SportTag = load("components/SportTag/SportTag.tsx", {"react/jsx-runtime":jsx,"./SportTag.css":{}}).default;
test("SportTag supports custom, missing and accented modality names",()=>{
  for(const sport of ["Corrida de Rua","Natação","Tênis","toString",undefined,null,""]) {
    const html=renderToStaticMarkup(createElement(SportTag,{sport}));
    assert.ok(html.includes(sport?.trim() || "Modalidade não informada"));
    assert.ok(!html.includes("undefined.svg"));
  }
  assert.match(renderToStaticMarkup(createElement(SportTag,{sport:"natacao"})),/imgIconWaves/);
  assert.match(renderToStaticMarkup(createElement(SportTag,{sport:"Corrida de Rua"})),/ds-sport-tag--neutral/);
});
test("all metrics requests include the backend required modalityId", async()=>{
  const calls=[];
  const service=load("services/metricaService.ts",{
    "./api":{api:{get:async(url,config)=>{calls.push(config.params);return {data:[{id:String(config.params.modalidadeId)}]};}}},
    "./modalidadeService":{modalidadeService:{listarTodas:async()=>[{id:1},{id:2}]}},
    "../types/api":{unpackPage:data=>data},
  }).metricaService;
  const result=await service.listarTodas();
  assert.deepEqual(calls.map(params=>params.modalidadeId),[1,2]);
  assert.equal(result.length,2);
});
test("B7: criarMetrica converte tipos legados antes de enviar ao back", async()=>{
  const bodies=[];
  const service=load("services/metricaService.ts",{
    "./api":{api:{post:async(url,body)=>{bodies.push(body);return {data:body};}}},
    "./modalidadeService":{modalidadeService:{listarTodas:async()=>[]}},
    "../types/api":{unpackPage:data=>data},
  }).metricaService;
  await service.criarMetrica({modalidadeId:1,titulo:"Tempo",tipo:"TEMPO_CRONOMETRO",obrigatoria:false,quemPreenche:"ALUNO",unidade:"mm:ss"});
  await service.criarMetrica({modalidadeId:1,titulo:"Obs",tipo:"TEXTO_OBSERVACAO",obrigatoria:false,quemPreenche:"ALUNO",unidade:""});
  assert.equal(bodies[0].tipo,"TEMPO");
  assert.equal(bodies[1].tipo,"TEXTO");
  assert.equal(bodies[1].unidade,null);
});
