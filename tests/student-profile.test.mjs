import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function load(path, dependencies={}) {
  const exports={};
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>dependencies[name]});
  return exports;
}
const dates=load('features/personal/dashboardModel.ts');
const model=load('features/studentProfile/profileModel.ts',{'../personal/dashboardModel':dates});
const session=(id,date,owner='a',value='01:42')=>({id,status:'CONCLUIDA',dataReal:date,desempenho:{alunoId:owner,nivelCansaco:7,metricas:[{metricaId:'time',tituloMetrica:'Tempo',tipoMetrica:'TEMPO',valor:value}]}});
test('history excludes other students and planned sessions, and deduplicates',()=>{
  const rows=[session('1','2026-10-05'),session('1','2026-10-05'),session('2','2026-10-08','b'),{...session('3','2026-10-08'),status:'PLANEJADA'}];
  assert.deepEqual(Array.from(model.ownHistory(rows,'a'),s=>s.id),['1']);
});
test('only unexecuted planned sessions can receive new results',()=>{
  const tracking={sessoes:[{sessaoId:'1',status:'PLANEJADA',desempenho:null},{sessaoId:'2',status:'CONCLUIDA'},{sessaoId:'3',status:'CANCELADA'},{sessaoId:'4',status:'PLANEJADA',desempenho:{alunoId:'b'}}]};
  assert.deepEqual(Array.from(model.sessionCandidates(tracking,'a'),s=>s.sessaoId),['1']);
});
test('metric input validation and serialization match backend constraints',()=>{
  assert.ok(model.metricError('NUMERICO','mil e quinhentos'));
  assert.equal(model.metricError('NUMERICO','12,5'),undefined);
  assert.ok(model.metricError('NUMERICO','Infinity'));
  assert.ok(model.metricError('TEMPO','01:99'));
  assert.equal(model.metricError('TEMPO','1:42'),undefined);
  assert.equal(model.serializeMetric({tipo:'TEMPO'},'1:42'),'01:42');
  assert.equal(model.serializeMetric({tipo:'NUMERICO'},'12,5'),'12.5');
  for(const value of ['29','251','148.5'])assert.ok(model.metricError('FREQUENCIA_CARDIACA',value));
  assert.equal(model.metricError('FREQUENCIA_CARDIACA','148'),undefined);
  assert.ok(model.metricError('TEXTO','x'.repeat(256)));
});
test('evolution respects dates and metric IDs without mixing similarly named metrics',()=>{
  const rows=[session('1','2026-10-05'),session('2','2026-09-01'),{...session('3','2026-10-08'),desempenho:{alunoId:'a',nivelCansaco:null,metricas:[{metricaId:'other',tituloMetrica:'Tempo',tipoMetrica:'TEMPO',valor:'02:00'}]}}];
  const series=model.evolutionSeries(rows,[],'2026-10-01','2026-10-31');
  assert.equal(series.find(s=>s.id==='time').points.length,1);
  assert.equal(series.find(s=>s.id==='time').points[0].value,102);
  assert.equal(series.find(s=>s.id==='other').points[0].value,120);
  assert.equal(series.find(s=>s.id==='rpe').points.length,1);
  assert.equal(model.formatMetric(119.9,'TEMPO'),'2:00');
});
test('weekly summary follows actual execution date and ignores other students',()=>{
  const data={sessoes:[{dataPlanejada:'2026-10-12',dataReal:'2026-10-14',status:'CONCLUIDA',desempenho:{alunoId:'a'}},{dataPlanejada:'2026-10-13',status:'PLANEJADA'},{dataReal:'2026-10-14',status:'CONCLUIDA',desempenho:{alunoId:'b'}}]};
  const days=model.weekDays(data,'a',new Date(2026,9,14));
  assert.equal(days[0].date,'2026-10-12');assert.equal(days[0].completed,0);
  assert.equal(days[2].completed,1);assert.equal(days[2].today,true);
});
test('session registration sends the selected student and optional RPE to the existing endpoint',async()=>{
  let request;
  const {studentProfileService}=load('services/studentProfileService.ts',{'./api':{api:{post:async(...args)=>{request=args;return {data:{id:'session'}};}}}});
  const payload={alunoId:'a',dataReal:'2026-10-14',duracao:52,nivelCansaco:null,resultados:[{metricaId:'time',valor:'01:42'}]};
  assert.equal((await studentProfileService.execute('session',payload)).id,'session');
  assert.equal(request[0],'/api/personal-trainers/rotinas/sessoes/session/execucao');assert.equal(request[1],payload);
});
test('buildTrackingFromPlanning evaluates pending metrics per session and handles 0-metric sessions',()=>{
  const routine={id:'r1',titulo:'Corrida Base',frequenciaSemanal:2,ativo:true,alunos:[],metricas:[]};
  const planning={
    semanas:[{
      numeroSemana:1,
      sessoes:[
        {id:'s1',semana:1,dataPlanejada:'2026-10-10',duracao:40,atividades:'Tiros',status:'PLANEJADA',metricasIds:['m1'],metricas:[{id:'m1',titulo:'FC Média',tipo:'FREQUENCIA_CARDIACA',obrigatoria:true,quemPreenche:'PERSONAL'}]},
        {id:'s2',semana:1,dataPlanejada:'2026-10-12',duracao:30,atividades:'Regenerativo',status:'PLANEJADA',metricasIds:[],metricas:[]},
      ]
    }]
  };
  const history=[{id:'s1',rotinaTreinoId:'r1',semana:1,dataPlanejada:'2026-10-10',dataReal:'2026-10-10',duracao:40,status:'CONCLUIDA',concluidaAluno:true,validadaPersonal:false,desempenho:{alunoId:'a',nivelCansaco:6,metricas:[]}},{id:'s2',rotinaTreinoId:'r1',semana:1,dataPlanejada:'2026-10-12',dataReal:'2026-10-12',duracao:30,status:'CONCLUIDA',concluidaAluno:true,validadaPersonal:false,desempenho:{alunoId:'a',nivelCansaco:4,metricas:[]}}];
  const tracking=model.buildTrackingFromPlanning('a',routine,planning,history);
  assert.equal(tracking.quantidadeMetricasPendentes,1);
  assert.equal(tracking.sessoes[0].quantidadePendenciasPersonal,1);
  assert.equal(tracking.sessoes[1].quantidadePendenciasPersonal,0);
  assert.deepEqual(tracking.sessoes[0].metricasIds,['m1']);
  assert.deepEqual(tracking.sessoes[1].metricas,[]);
});
