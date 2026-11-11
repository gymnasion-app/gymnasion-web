import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { personalTrainerService } from "../../services/personalTrainerService";
import { personalDashboardService } from "../../services/personalDashboardService";
import { rotinaService } from "../../services/rotinaService";
import { turmaService } from "../../services/turmaService";
import { authError } from "../../utils/authError";
import { isSessionError } from "../../services/api";
import Toast, { type ToastProps } from "../../components/Toast/Toast";
import { PersonalContext, type Activity, type Resource } from "./PersonalContext";
import { applyStudentMutation, type StudentMutation } from "./studentModel";
import { normalizeNotification, sortNotificationsByPriority } from "../notifications/notificationModel";
import type { AlunoResponse } from "../../types/student";
import type { RotinaResponse } from "../../types/rotina";
import type { TurmaResponse } from "../../types/turma";
import type { PersonalNotification, StudentHistory } from "../../types/personalDashboard";

import { unpackPage, type PageResponse } from "../../types/api";

const empty = <T,>(): Resource<T> => ({data:[],loading:true,error:""});
function resultState<T>(result: PromiseSettledResult<T[] | PageResponse<T>>, previous: Resource<T>, fallback: string): Resource<T> {
  return result.status === "fulfilled" ? {data:unpackPage(result.value),loading:false,error:""} : {...previous,loading:false,error:authError(result.reason,fallback).message};
}
export default function PersonalProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<Resource<AlunoResponse>>(empty);
  const [routines, setRoutines] = useState<Resource<RotinaResponse>>(empty);
  const [groups, setGroups] = useState<Resource<TurmaResponse>>(empty);
  const [notifications, setNotifications] = useState<Resource<PersonalNotification>>(empty);
  const [histories, setHistories] = useState<Resource<StudentHistory>>(empty);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState<ToastProps | null>(null);
  const busy = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(false);
  const refreshing = useRef(false);
  const queuedRefresh = useRef(false);

  const refresh = useCallback(async function load(): Promise<void> {
    if (!mounted.current) return;
    if (busy.current || refreshing.current) { queuedRefresh.current = true; return; }
    refreshing.current = true;
    queuedRefresh.current = false;
    const version = revision.current;
    const results = await Promise.allSettled([
      personalTrainerService.listarTodos(), rotinaService.listar(),
      turmaService.listar(), personalDashboardService.notifications(),
    ]);
    if (mounted.current && version === revision.current) {
      const [alunos,rotinas,turmas,alerts] = results;
      setStudents(previous => resultState(alunos,previous,"Não foi possível carregar os alunos."));
      setRoutines(previous => resultState(rotinas,previous,"Não foi possível carregar as rotinas."));
      setGroups(previous => resultState(turmas,previous,"Não foi possível carregar as turmas."));
      setNotifications(previous => {
        const res = resultState(alerts, previous, "Não foi possível carregar as notificações.");
        return {
          ...res,
          data: sortNotificationsByPriority(res.data.map(item => normalizeNotification(item))),
        };
      });
      if (alunos.status === "fulfilled") {
        try {
          const alunoList = unpackPage(alunos.value);
          const data = await personalDashboardService.histories(alunoList.filter(item => item.status !== "PENDENTE").map(item=>item.id));
          if (mounted.current && version === revision.current) setHistories({data,loading:false,error:""});
        } catch (error) {
          if (mounted.current && version === revision.current) setHistories(previous=>({...previous,loading:false,error:authError(error,"Não foi possível consultar o histórico de sessões.").message}));
        }
      } else setHistories(previous=>({...previous,loading:false,error:"Carregue os alunos para consultar as sessões."}));
    }
    refreshing.current = false;
    if (mounted.current && queuedRefresh.current && !busy.current) void load();
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    const interval = window.setInterval(onFocus,30000);
    window.addEventListener("focus",onFocus);
    document.addEventListener("visibilitychange",onFocus);
    return () => { mounted.current = false; window.clearInterval(interval); window.removeEventListener("focus",onFocus); document.removeEventListener("visibilitychange",onFocus); };
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(()=>setNotice(null),6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function showError(error: unknown) {
    if (mounted.current && !isSessionError(error)) {
      const message = authError(error,"Tente novamente.").message;
      setActionError(message);
      setNotice({title:"Não foi possível salvar",message,tone:"error"});
    }
  }
  async function mutate(student: AlunoResponse, action: StudentMutation) {
    if (busy.current) return false;
    busy.current = true; revision.current += 1; setBusyId(student.id); setActionError("");
    const title = {approve:"Aluno aprovado",reject:"Solicitação recusada",deactivate:"Aluno desativado",reactivate:"Aluno reativado"}[action];
    try {
      const methods = {approve:personalTrainerService.aprovarAtleta,reject:personalTrainerService.recusarAtleta,deactivate:personalTrainerService.desativarAtleta,reactivate:personalTrainerService.reativarAtleta};
      await methods[action](student.id);
      if (!mounted.current) return true;
      setStudents(previous=>({...previous,data:applyStudentMutation(previous.data,student.id,action)}));
      setActivities(previous=>[{id:crypto.randomUUID(),title,message:student.usuario.nome,studentId:student.id,time:Date.now(),kind:action},...previous].slice(0,50));
      setNotice({title,message:student.usuario.nome+": alteração salva com sucesso.",tone:action==="reject"?"error":"success",iconSrc:action==="reject"?"/workspace/402-2031-imgIconX.svg":undefined});
      return true;
    } catch (error) { showError(error); return false; }
    finally { busy.current=false; if(mounted.current) {setBusyId(null); void refresh();} }
  }
  async function readNotification(id?: string) {
    if (busy.current) return false;
    busy.current = true; revision.current += 1; setNotificationBusy(true);
    try {
      if (id) {
        const updated = await personalDashboardService.readNotification(id);
        if (mounted.current) {
          setNotifications(previous => ({
            ...previous,
            data: sortNotificationsByPriority(
              previous.data.map(item => (item.id === id ? { ...item, ...updated, lida: true } : item))
            ),
          }));
        }
      } else {
        await personalDashboardService.readAllNotifications();
        if (mounted.current) {
          setNotifications(previous => ({
            ...previous,
            data: sortNotificationsByPriority(previous.data.map(item => ({ ...item, lida: true }))),
          }));
        }
      }
      return true;
    } catch(error) {showError(error);return false;}
    finally {busy.current=false;if(mounted.current){setNotificationBusy(false);void refresh();}}
  }
  async function linkRoutine(student: AlunoResponse, routineId: string) {
    if (busy.current) return false;
    busy.current=true;revision.current+=1;setBusyId(student.id);setActionError("");
    try {
      const updated = await rotinaService.vincularAlunos(routineId,[student.id]);
      if (mounted.current) {
        setRoutines(previous=>({...previous,data:previous.data.map(item=>item.id===updated.id?updated:item)}));
        setNotice({title:"Rotina vinculada",message:student.usuario.nome+" já pode começar os treinos.",tone:"success"});
      }
      return true;
    } catch(error) {showError(error);return false;}
    finally {busy.current=false;if(mounted.current){setBusyId(null);void refresh();}}
  }
  const syncRoutine = useCallback((updated: RotinaResponse) => {
    setRoutines(previous => ({
      ...previous,
      data: previous.data.some(item => item.id === updated.id)
        ? previous.data.map(item => item.id === updated.id ? updated : item)
        : [updated, ...previous.data],
    }));
  }, []);
  const syncStudent = useCallback((updated: AlunoResponse) => {
    setStudents(previous => ({
      ...previous,
      data: previous.data.some(item => item.id === updated.id)
        ? previous.data.map(item => item.id === updated.id ? updated : item)
        : [updated, ...previous.data],
    }));
  }, []);
  return <PersonalContext.Provider value={{students,routines,groups,activities,busyId,refresh,mutate,notifications,histories,notificationBusy,readNotification,linkRoutine,syncRoutine,syncStudent,actionError}}>
    {children}
    {notice && <div className="personal-notice"><Toast {...notice} onClose={()=>setNotice(null)}/></div>}
  </PersonalContext.Provider>;
}
