import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import Avatar from "../../components/Avatar/Avatar";
import Badge from "../../components/Badge/Badge";
import Button from "../../components/Button/Button";
import { StudentSports } from "../../components/StudentIdentity/StudentIdentity";
import StudentStatusDialog from "../../components/StudentStatusDialog/StudentStatusDialog";
import StudentRoutineDialog from "../../components/StudentRoutineDialog/StudentRoutineDialog";
import RoutineStatusDialog from "../../components/RoutineStatusDialog/RoutineStatusDialog";
import UnavailableAction from "../../components/UnavailableAction/UnavailableAction";
import ProfileRoutineCard from "../../components/ProfileRoutineCard/ProfileRoutineCard";
import ProfileSessions from "../../components/ProfileSessions/ProfileSessions";
import StudentEvolution, { EvolutionCard } from "../../components/StudentEvolution/StudentEvolution";
import SessionRegisterDialog from "../../components/SessionRegisterDialog/SessionRegisterDialog";
import ReportDialog from "../../components/ReportDialog/ReportDialog";
import { usePersonal } from "../../features/personal/PersonalContext";
import { localDateKey } from "../../features/personal/dashboardModel";
import { evolutionSeries, formatMetric, ownHistory, buildActiveRoutineSessions, buildTrackingFromPlanning } from "../../features/studentProfile/profileModel";
import { studentProfileService } from "../../services/studentProfileService";
import { rotinaService } from "../../services/rotinaService";
import { relatorioService } from "../../services/relatorioService";
import { stravaService } from "../../services/stravaService";
import { authError } from "../../utils/authError";
import { formatPhone } from "../SignUp/validation";
import type { StudentTracking } from "../../types/studentProfile";
import type { TrainingSession } from "../../types/personalDashboard";
import type { RotinaResponse } from "../../types/rotina";
import type { StravaStatusResponse } from "../../types/strava";
import "./StudentProfile.css";

export default function StudentProfile() {
  const {studentId=""}=useParams();
  return <StudentProfileContent key={studentId} studentId={studentId}/>;
}
function StudentProfileContent({studentId}:{studentId:string}) {
  const {students,refresh,busyId,notificationBusy}=usePersonal();
  const student=students.data.find(s=>s.id===studentId);
  const [params,setParams]=useSearchParams();
  const tab=["overview","evolution","routines","history"].includes(params.get("aba")||"")?params.get("aba")!:"overview";
  const [tracking,setTracking]=useState<StudentTracking|null>(null);
  const [extraTrackings,setExtraTrackings]=useState<Record<string,StudentTracking>>({});
  const [selectedRoutineId,setSelectedRoutineId]=useState("");
  const [routines,setRoutines]=useState<RotinaResponse[]>([]);
  const [sessions,setSessions]=useState<TrainingSession[]>([]);
  const [loading,setLoading]=useState(true);
  const [errors,setErrors]=useState({tracking:"",routines:"",history:""});
  const [register,setRegister]=useState(false);
  const [status,setStatus]=useState(false);
  const [assign,setAssign]=useState(false);
  const [unlinkRoutine,setUnlinkRoutine]=useState<RotinaResponse | null>(null);
  const [report,setReport]=useState(false);
  const [stravaStatus,setStravaStatus]=useState<StravaStatusResponse | null>(null);
  const version=useRef(0);
  const authorized=Boolean(student);
  const load=useCallback(async()=>{
    if(!authorized) return;
    const request=++version.current;
    stravaService.obterStatusAluno(studentId).then(res=>{ if(request===version.current) setStravaStatus(res); }).catch(()=>{});
    const result=await Promise.allSettled([studentProfileService.tracking(studentId),studentProfileService.routines(studentId),studentProfileService.history(studentId)]);
    if(request!==version.current)return;
    const [trackingResult,routineResult,historyResult]=result;
    const fetchedTracking=trackingResult.status==="fulfilled"?trackingResult.value:null;
    const fetchedRoutines=routineResult.status==="fulfilled"?routineResult.value:null;
    const fetchedHistory=historyResult.status==="fulfilled"?ownHistory(historyResult.value,studentId):null;
    if(fetchedTracking!==null)setTracking(fetchedTracking);
    if(fetchedRoutines!==null)setRoutines(fetchedRoutines);
    if(fetchedHistory!==null)setSessions(fetchedHistory);
    if(fetchedRoutines){
      const secondaryActive=fetchedRoutines.filter(r=>r.ativo!==false&&r.id!==fetchedTracking?.rotinaAtivaId);
      if(secondaryActive.length>0){
        const planResults=await Promise.allSettled(secondaryActive.map(r=>rotinaService.consultarPlanejamento(r.id)));
        if(request!==version.current)return;
        const nextExtra:Record<string,StudentTracking>={};
        secondaryActive.forEach((r,idx)=>{
          const pr=planResults[idx];
          if(pr.status==="fulfilled"){
            nextExtra[r.id]=buildTrackingFromPlanning(studentId,r,pr.value,fetchedHistory||[]);
          }
        });
        setExtraTrackings(nextExtra);
      }else{
        setExtraTrackings({});
      }
    }
    setErrors({tracking:trackingResult.status==="rejected"?authError(trackingResult.reason,"Não foi possível carregar o planejamento.").message:"",routines:routineResult.status==="rejected"?authError(routineResult.reason,"Não foi possível carregar as rotinas.").message:"",history:historyResult.status==="rejected"?authError(historyResult.reason,"Não foi possível carregar o histórico.").message:""});
    setLoading(false);
  },[studentId,authorized]);
  useEffect(()=>{const requests=version;void load();return()=>{requests.current++;};},[load]);
  useEffect(()=>{if(register)return;const onFocus=()=>{if(document.visibilityState==="visible")void load();};window.addEventListener("focus",onFocus);const interval=window.setInterval(onFocus,30000);return()=>{window.removeEventListener("focus",onFocus);window.clearInterval(interval);};},[load,register]);
  const changeTab=(value:string)=>{const next=new URLSearchParams(params);next.set("aba",value);setParams(next);};
  if(students.loading)return <div className="workspace-card" role="status">Carregando perfil...</div>;
  if(students.error)return <div className="workspace-error" role="alert">{students.error}<Button variant="secondary" onClick={()=>void refresh()}>Tentar novamente</Button></div>;
  if(!student)return <div className="workspace-card student-profile__missing"><h2>Aluno não encontrado</h2><p>Este aluno não está disponível na sua lista.</p><Link to="/alunos">Voltar aos alunos</Link></div>;
  const activeRoutines=routines.filter(r=>r.ativo!==false);
  const active=activeRoutines.find(r=>r.id===selectedRoutineId)||activeRoutines.find(r=>r.id===tracking?.rotinaAtivaId)||activeRoutines[0]||null;
  const resolveRoutineTracking=(r:RotinaResponse|null):StudentTracking|null=>!r||r.ativo===false?null:tracking?.rotinaAtivaId===r.id?tracking:extraTrackings[r.id]||null;
  const activeTracking=resolveRoutineTracking(active);
  const activeRoutineSessions=buildActiveRoutineSessions(active,activeTracking,sessions,studentId);
  const allMetrics=[...new Map(routines.flatMap(r=>r.metricas).map(m=>[m.id,m])).values()];
  const today=localDateKey(new Date());
  const month=sessions.filter(s=>s.dataReal?.slice(0,7)===today.slice(0,7)&&s.dataReal<=today);
  const efforts=month.map(s=>s.desempenho?.nivelCansaco).filter((v):v is number=>typeof v==="number");
  const series=evolutionSeries(sessions,allMetrics,"0000-01-01",today);
  const primarySeries=series.find(s=>s.type==="TEMPO" && s.points.length)||series.find(s=>s.points.length)||series.at(-1)!;
  const best=primarySeries.points.length?Math.min(...primarySeries.points.map(p=>p.value)):null;
  const blocked=student.status!=="ATIVO"?"Somente alunos ativos podem receber novos registros.":loading?"Carregando o planejamento do aluno.":errors.tracking||errors.routines?"Não foi possível consultar a rotina. Tente carregar novamente.":!active?"Vincule uma rotina ativa antes de registrar uma sessão.":"";
  return <div className="student-profile">
    <section className="workspace-card student-profile__header" aria-label="Dados do aluno"><Avatar name={student.usuario.nome} tone="info" className="student-profile__avatar"/><div className="student-profile__identity"><div className="student-profile__name"><h1>{student.usuario.nome}</h1><Badge tone={student.status==="ATIVO"?"success":student.status==="PENDENTE"?"warning":"neutral"}>{student.status==="ATIVO"?"Ativo":student.status==="PENDENTE"?"Pendente":"Inativo"}</Badge>{stravaStatus?.conectado && <Badge tone={stravaStatus.expirado ? "warning" : "info"} title={stravaStatus.nomeAtleta ? `Strava: ${stravaStatus.nomeAtleta}` : "Strava conectado"}>Strava {stravaStatus.expirado ? "(expirado)" : "ativo"}</Badge>}<StudentSports student={student}/></div><div className="student-profile__contacts"><span title="A data de nascimento ainda não é fornecida pelo backend." tabIndex={0}><img src="/student-profile/imgIconCal.svg" alt=""/>Nascimento não informado</span><span><img src="/student-profile/imgIconMail.svg" alt=""/>{student.usuario.email}</span><span><img src="/student-profile/imgIconActivity1.svg" alt=""/>{formatPhone(student.usuario.celular)||"Contato não informado"}</span></div></div><div className="student-profile__actions">{["ATIVO","INATIVO"].includes(student.status)?<Button variant="secondary" onClick={()=>setReport(true)}>Gerar relatório</Button>:<UnavailableAction variant="secondary" reason="O relatório fica disponível depois que o aluno aceita o convite e registra treinos.">Gerar relatório</UnavailableAction>}{blocked?<UnavailableAction reason={blocked}>+ Registrar sessão</UnavailableAction>:<Button onClick={()=>setRegister(true)}>+ Registrar sessão</Button>}<details className="student-profile__menu"><summary aria-label="Mais ações do aluno"><img src="/student-profile/imgIconMore.svg" alt=""/></summary><div><Button variant="ghost" disabled={Boolean(busyId)||notificationBusy||!["ATIVO","INATIVO"].includes(student.status)} onClick={()=>setStatus(true)}>{student.status==="INATIVO"?"Reativar aluno":"Desativar aluno"}</Button></div></details></div></section>
    <nav className="student-profile__tabs" aria-label="Seções do perfil">{[["overview","Visão geral"],["evolution","Evolução"],["routines","Rotinas"],["history","Histórico"]].map(([key,label])=><button key={key} aria-current={tab===key?"page":undefined} onClick={()=>changeTab(key)}>{label}{key==="routines"&&!loading&&!errors.routines&&<span>{routines.length}</span>}{key==="history"&&!loading&&!errors.history&&<span>{sessions.length}</span>}</button>)}</nav>
    {Object.values(errors).some(Boolean)&&<div className="workspace-error" role="alert">Alguns dados do perfil não puderam ser atualizados. <Button variant="secondary" onClick={()=>void load()}>Tentar novamente</Button></div>}
    {loading?<div className="workspace-card" role="status">Carregando rotinas e sessões...</div>:tab==="overview"?<div className="student-profile__overview"><div className="student-profile__main">
      {!errors.routines&&!errors.tracking&&activeRoutines.length>1&&(
        <div className="student-profile__routine-switcher" role="tablist" aria-label="Selecionar rotina ativa">
          <span className="student-profile__routine-switcher-label">Rotinas ativas ({activeRoutines.length}):</span>
          {activeRoutines.map((r,idx)=>(
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={active?.id===r.id}
              tabIndex={active?.id===r.id?0:-1}
              className="student-profile__routine-tab"
              onClick={()=>setSelectedRoutineId(r.id)}
              onKeyDown={(e)=>{
                if(e.key==="ArrowRight"||e.key==="ArrowLeft"){
                  e.preventDefault();
                  const nextIdx=e.key==="ArrowRight"?(idx+1)%activeRoutines.length:(idx-1+activeRoutines.length)%activeRoutines.length;
                  const nextRoutine=activeRoutines[nextIdx];
                  setSelectedRoutineId(nextRoutine.id);
                  const buttons=e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                  buttons?.[nextIdx]?.focus();
                }
              }}
            >
              <span>{r.titulo}</span>
              <small>{r.frequenciaSemanal}x/sem</small>
            </button>
          ))}
        </div>
      )}
      {errors.routines||errors.tracking?<div className="workspace-card workspace-error">{errors.routines||errors.tracking}</div>:active?<ProfileRoutineCard routine={active} tracking={activeTracking} studentId={studentId} onUnlink={()=>setUnlinkRoutine(active)}/>:<div className="workspace-card student-profile__missing"><h2>Aluno sem rotina ativa</h2><p>Vincule uma rotina para acompanhar as sessões e os resultados.</p>{student.status==="ATIVO"&&<Button onClick={()=>setAssign(true)}>Vincular rotina</Button>}</div>}
      {errors.history&&errors.tracking?<div className="workspace-error">{errors.history||errors.tracking}</div>:<ProfileSessions sessions={activeRoutineSessions} recent studentId={studentId} activeRoutine={active} routines={routines} onHistory={()=>changeTab("history")}/>}
    </div><aside className="student-profile__stats"><div className="workspace-card student-profile__stat"><span><img src="/student-profile/imgIconActivity2.svg" alt=""/></span><div><strong>{errors.history?"—":month.length}</strong><p>Sessões no mês</p></div></div><div className="workspace-card student-profile__stat student-profile__stat--effort"><span><img src="/student-profile/imgIconFlame.svg" alt=""/></span><div><strong>{!errors.history&&efforts.length?formatMetric(efforts.reduce((a,b)=>a+b,0)/efforts.length,"RPE"):"—"}</strong><p>RPE médio no mês (Borg)</p></div></div><div className="workspace-card student-profile__stat student-profile__stat--best"><span><img src="/student-profile/imgIconTrend.svg" alt=""/></span><div><strong>{!errors.history&&best!==null&&primarySeries.type==="TEMPO"?formatMetric(best,"TEMPO"):"—"}</strong><p>{primarySeries.type==="TEMPO"?"Menor tempo · "+primarySeries.title:"Melhor tempo ainda sem registros"}</p></div></div>{!errors.history&&<EvolutionCard series={{...primarySeries,points:primarySeries.points.slice(-8)}} compact/>}</aside></div>:tab==="evolution"?errors.history?<p className="workspace-error">{errors.history}</p>:<StudentEvolution sessions={sessions} metrics={allMetrics}/>:tab==="history"?errors.history?<p className="workspace-error">{errors.history}</p>:<ProfileSessions sessions={sessions} studentId={studentId} activeRoutine={active} routines={routines}/>:<div className="student-profile__routines">{errors.routines?<p className="workspace-error">{errors.routines}</p>:routines.length?routines.map(r=><ProfileRoutineCard key={r.id} routine={r} tracking={r.ativo!==false?resolveRoutineTracking(r):null} studentId={studentId} showWeek={r.ativo!==false} onUnlink={()=>setUnlinkRoutine(r)}/>):<p className="workspace-card">Nenhuma rotina vinculada.</p>}{!active&&!errors.routines&&student.status==="ATIVO"&&<Button onClick={()=>setAssign(true)}>Vincular rotina</Button>}</div>}
    <Link className="workspace-link" to="/alunos">← Voltar aos alunos</Link>
    {register&&active&&<SessionRegisterDialog student={student} routine={active} tracking={activeTracking} onClose={()=>setRegister(false)} onSaved={()=>{setRegister(false);toast.success("Sessão registrada com sucesso!");void load();void refresh();}}/>}
    {report&&<ReportDialog studentName={student.usuario.nome} modalidades={student.modalidades} onClose={()=>setReport(false)} generate={(filter,signal)=>relatorioService.gerarPeloPersonal(student.id,filter,signal)} loadAvailability={signal=>relatorioService.disponibilidadePeloPersonal(student.id,signal)}/>}
    {status&&<StudentStatusDialog student={student} action={student.status==="ATIVO"?"deactivate":"reactivate"} onClose={()=>setStatus(false)}/>}
    {assign&&<StudentRoutineDialog student={student} onClose={()=>{setAssign(false);void load();}}/>}
    {unlinkRoutine&&<RoutineStatusDialog routine={unlinkRoutine} action="desvincular" studentToUnlink={{id:student.id,nome:student.usuario.nome}} onClose={()=>setUnlinkRoutine(null)} onSuccess={(msg)=>{setUnlinkRoutine(null);toast.success(msg);void load();void refresh();}}/>}
  </div>;
}
