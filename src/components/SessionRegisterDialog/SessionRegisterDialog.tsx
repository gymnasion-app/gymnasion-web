import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import axios from "axios";
import WorkspaceDialog from "../WorkspaceDialog/WorkspaceDialog";
import FormField from "../FormField/FormField";
import Button from "../Button/Button";
import UnavailableAction from "../UnavailableAction/UnavailableAction";
import { StudentSports } from "../StudentIdentity/StudentIdentity";
import { localDateKey } from "../../features/personal/dashboardModel";
import { metricError, serializeMetric, sessionCandidates } from "../../features/studentProfile/profileModel";
import { studentProfileService } from "../../services/studentProfileService";
import { stravaService } from "../../services/stravaService";
import { authError } from "../../utils/authError";
import { parseAtividades } from "../../utils/activityParser";
import type { AlunoResponse } from "../../types/student";
import type { RotinaResponse } from "../../types/rotina";
import type { StudentTracking } from "../../types/studentProfile";
import type { StravaAtividade } from "../../types/strava";
import "./SessionRegisterDialog.css";

function formatCandidateOption(s: { dataPlanejada: string; semana: number; atividades: string }, idx: number) {
  const parsed = parseAtividades(s.atividades);
  const title = parsed.sessionName || parsed.activities[0]?.title || `Sessão ${idx + 1}`;
  const count = parsed.activities.length;
  return `${s.dataPlanejada.split("-").reverse().join("/")} · Semana ${s.semana} · ${title}${count ? ` (${count} ativ.)` : ""}`;
}

export interface RegisterRoutineOption {
  routine: RotinaResponse;
  tracking: StudentTracking | null;
}

export default function SessionRegisterDialog({
  student,
  routine,
  tracking,
  routineOptions,
  onClose,
  onSaved,
}: {
  student: AlunoResponse;
  routine: RotinaResponse;
  tracking: StudentTracking | null;
  routineOptions?: RegisterRoutineOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedRoutineId, setSelectedRoutineId] = useState(routine.id);
  const currentEntry = routineOptions?.find((opt) => opt.routine.id === selectedRoutineId);
  const currentRoutine = currentEntry?.routine ?? routine;
  const currentTracking = currentEntry ? currentEntry.tracking : tracking;
  const candidates = sessionCandidates(currentTracking, student.id);
  const [sessionId,setSessionId] = useState(candidates[0]?.sessaoId || "");
  const [date,setDate] = useState(localDateKey(new Date()));
  const [duration,setDuration] = useState("");
  const [values,setValues] = useState<Record<string,string>>({});
  const [errors,setErrors] = useState<Record<string,string>>({});
  const [rpeStep,setRpeStep] = useState(false);
  const [rpe,setRpe] = useState<number | null>(null);
  const [busy,setBusy] = useState(false);
  const saving = useRef(false);
  const [error,setError] = useState("");
  const selected = candidates.find(s=>s.sessaoId===sessionId);
  const selectedParsed = selected ? parseAtividades(selected.atividades) : null;
  const sessionMetrics = selected?.metricas || [];
  const allowed = sessionMetrics.filter(metric=>metric.quemPreenche!=="ALUNO");
  const blocked = !candidates.length ? "Não há sessão planejada disponível nesta rotina. Cadastre o planejamento antes de registrar os resultados." : "";

  function handleRoutineChange(nextId: string) {
    setSelectedRoutineId(nextId);
    const nextEntry = routineOptions?.find((opt) => opt.routine.id === nextId);
    const nextCandidates = sessionCandidates(nextEntry?.tracking ?? null, student.id);
    setSessionId(nextCandidates[0]?.sessaoId || "");
    setValues({});
    setErrors({});
    setError("");
  }

  const [stravaActivities, setStravaActivities] = useState<StravaAtividade[]>([]);
  useEffect(() => {
    if (student.id) {
      stravaService.listarAtividadesAluno(student.id, 5).then(setStravaActivities).catch(() => {});
    }
  }, [student.id]);

  function handleSelectStrava(actId: string) {
    if (!actId) return;
    const act = stravaActivities.find((a) => a.id === actId);
    if (!act) return;
    if (act.data) setDate(act.data);
    if (act.duracaoMinutos) setDuration(String(act.duracaoMinutos));
    const nextValues: Record<string, string> = { ...values };
    allowed.forEach((metric) => {
      const campo = metric.campoStrava;
      let val: string | null = null;
      if (campo && campo !== "NENHUM") {
        switch (campo) {
          case "DISTANCIA_KM":
            if (act.distanciaKm != null) val = String(act.distanciaKm);
            break;
          case "DISTANCIA_METROS":
            if (act.distanciaMetros != null) val = String(Math.round(act.distanciaMetros));
            break;
          case "TEMPO_MOVIMENTO":
            if (act.tempoFormatado) val = act.tempoFormatado;
            break;
          case "TEMPO_TOTAL":
            if (act.tempoTotalFormatado || act.tempoFormatado) val = act.tempoTotalFormatado || act.tempoFormatado || "";
            break;
          case "FREQUENCIA_CARDIACA_MEDIA":
            if (act.frequenciaCardiacaMedia != null) val = String(act.frequenciaCardiacaMedia);
            break;
          case "FREQUENCIA_CARDIACA_MAXIMA":
            if (act.frequenciaCardiacaMaxima != null) val = String(act.frequenciaCardiacaMaxima);
            break;
          case "CADENCIA_MEDIA":
            if (act.cadenciaMedia != null) val = String(Math.round(act.cadenciaMedia));
            break;
          case "POTENCIA_MEDIA_WATTS":
            if (act.potenciaMediaWatts != null) val = String(Math.round(act.potenciaMediaWatts));
            break;
          case "POTENCIA_MAXIMA_WATTS":
            if (act.potenciaMaximaWatts != null) val = String(Math.round(act.potenciaMaximaWatts));
            break;
          case "ELEVACAO_GANHO_METROS":
            if (act.elevacaoGanhoMetros != null) val = String(Math.round(act.elevacaoGanhoMetros));
            break;
          case "VELOCIDADE_MEDIA_KMH":
            if (act.velocidadeMediaKmh != null) val = String(act.velocidadeMediaKmh);
            break;
          case "CALORIAS":
            if (act.calorias != null) val = String(Math.round(act.calorias));
            break;
          case "RITMO_MEDIO":
            if (act.ritmoMedio) val = act.ritmoMedio;
            break;
        }
      } else {
        const titleLower = metric.titulo.toLowerCase();
        if (metric.tipo === "FREQUENCIA_CARDIACA" && act.frequenciaCardiacaMedia) {
          val = String(act.frequenciaCardiacaMedia);
        } else if (metric.tipo === "TEMPO" && act.tempoFormatado) {
          val = act.tempoFormatado;
        } else if (titleLower.includes("dist") && act.distanciaKm) {
          val = String(act.distanciaKm);
        }
      }
      if (val != null) nextValues[metric.id] = val;
    });
    setValues(nextValues);
  }

  function continueForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid: Record<string,string> = {};
    if (!selected) invalid.session="Selecione uma sessão planejada.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(new Date(date+"T12:00:00").getTime()) || date>localDateKey(new Date())) invalid.date="Informe uma data válida, até hoje.";
    if (duration && (!/^\d+$/.test(duration) || Number(duration)<1 || Number(duration)>2147483647)) invalid.duration="Informe a duração em minutos inteiros, a partir de 1.";
    allowed.forEach(metric=>{ const message=metricError(metric.tipo,values[metric.id]||""); if(message) invalid[metric.id]=message; });
    if (allowed.some(metric => metric.obrigatoria !== false) && !allowed.some(metric=>(values[metric.id]||"").trim())) invalid.results="Preencha pelo menos uma métrica obrigatória da sessão.";
    setErrors(invalid);
    if (Object.keys(invalid).length || blocked) return;
    setError(""); setRpeStep(true);
  }
  async function save(effort: number | null) {
    if (saving.current || !selected || blocked) return;
    saving.current=true; setBusy(true); setError("");
    try {
      await studentProfileService.execute(sessionId, { alunoId:student.id, dataReal:date, duracao:duration?Number(duration):null, nivelCansaco:effort,
        resultados:allowed.filter(metric=>(values[metric.id]||"").trim()).map(metric=>({metricaId:metric.id,valor:serializeMetric(metric,values[metric.id])})),
      });
      onSaved();
    } catch (err) {
      setError(authError(err,"Não foi possível salvar a sessão. Tente novamente.").message);
      if (axios.isAxiosError(err) && err.response?.data?.invalidFields) { setErrors(err.response.data.invalidFields); setRpeStep(false); }
    } finally {saving.current=false;setBusy(false);}
  }
  return <WorkspaceDialog className="session-register-dialog" title={rpeStep?"Como o aluno avalia seu nível de esforço nesta sessão?":"Registrar sessão"} description={rpeStep?"Escala de Borg CR-10 · campo opcional":student.usuario.nome+" · "+currentRoutine.titulo} icon={"/student-profile/"+(rpeStep?"imgIconFlame":"imgIconActivity2")+".svg"} onClose={onClose} busy={busy}>
    {error && <p className="workspace-dialog__error" role="alert">{error}</p>}
    {rpeStep ? <>
      <div className="session-register__rpe" role="group" aria-label="Nível de esforço">{Array.from({length:10},(_,index)=>index+1).map(value=><button key={value} type="button" data-level={value} aria-pressed={rpe===value} disabled={busy} onClick={()=>setRpe(rpe===value?null:value)}>{value}</button>)}</div>
      <div className="session-register__scale"><span>Muito leve</span><span>Moderado</span><span>Máximo</span></div>
      <div className="session-register__effort" role="status"><strong>{rpe ?? "—"}</strong><div><b>{rpe===null?"Esforço não informado":rpe<=2?"Muito leve":rpe<=4?"Leve":rpe<=6?"Moderado":rpe<=8?"Muito intenso":"Esforço máximo"}</b><p>{rpe===null?"Você pode salvar sem informar o RPE.":"Registre a percepção de esforço relatada pelo aluno."}</p></div></div>
      <footer className="workspace-dialog__actions"><Button variant="ghost" disabled={busy} onClick={()=>setRpeStep(false)}>Voltar</Button><Button variant="ghost" disabled={busy} onClick={()=>void save(null)}>Pular</Button><Button loading={busy} onClick={()=>void save(rpe)}>Salvar sessão</Button></footer>
    </> : <form className="session-register__form" onSubmit={continueForm} noValidate>
      {routineOptions && routineOptions.length > 1 && (
        <FormField
          id="session-routine"
          label="Rotina / modalidade"
          value={currentRoutine.id}
          options={routineOptions.map((opt) => ({
            value: opt.routine.id,
            label: `${opt.routine.nomeModalidade || opt.routine.modalidade?.nome || "Rotina"} · ${opt.routine.titulo}`,
          }))}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => handleRoutineChange(e.target.value)}
        />
      )}
      <FormField id="session-choice" label="Sessão planejada (priorizando não realizadas)" value={sessionId} options={candidates.map((s,idx)=>({value:s.sessaoId,label:formatCandidateOption(s,idx)}))} onChange={(e: ChangeEvent<HTMLSelectElement>)=>{setSessionId(e.target.value);setValues({});setErrors({});setError("");}} error={errors.session} disabled={!candidates.length} required />
      {stravaActivities.length > 0 && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 12px", marginBottom: "12px" }}>
          <label htmlFor="personal-strava-select" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#fc5200", marginBottom: "4px" }}>
            Preencher com dados do Strava do aluno
          </label>
          <select
            id="personal-strava-select"
            defaultValue=""
            onChange={(e) => handleSelectStrava(e.target.value)}
            style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "0.8125rem", background: "#fff" }}
          >
            <option value="">Selecione uma atividade para preencher automaticamente...</option>
            {stravaActivities.map((act) => (
              <option key={act.id} value={act.id}>
                {act.esporte || act.tipo}: {act.nome} — {act.data} ({act.distanciaFormatada || (act.distanciaKm ? `${act.distanciaKm} km` : "")} {act.tempoFormatado ? `· ${act.tempoFormatado}` : ""})
              </option>
            ))}
          </select>
        </div>
      )}
      {selectedParsed && selectedParsed.activities.length > 0 && (
        <div className="session-register__preview" aria-label="Atividades da sessão selecionada">
          <strong>{selectedParsed.sessionName || "Atividades planejadas nesta sessão"}</strong>
          <ul>
            {selectedParsed.activities.map((act, idx) => (
              <li key={act.id}>
                <span>{idx + 1}. {act.title}</span>
                {act.description && <small> · {act.description}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="session-register__grid"><FormField id="session-date" label="Data da sessão" type="date" value={date} max={localDateKey(new Date())} onChange={(e: ChangeEvent<HTMLInputElement>)=>setDate(e.target.value)} error={errors.date} required /><FormField id="session-duration" label="Duração (minutos)" type="number" min="1" step="1" value={duration} placeholder="Ex.: 52" onChange={(e: ChangeEvent<HTMLInputElement>)=>setDuration(e.target.value)} error={errors.duration} /></div>
      <div className="session-register__metrics-title"><strong>Métricas da sessão</strong><StudentSports student={{...student,modalidades:student.modalidades.filter(m=>m.id===currentRoutine.modalidadeId)}} /></div>
      {sessionMetrics.length === 0 ? (
        <p className="session-register__empty-metrics">Esta sessão não possui métricas customizadas — registre data, duração e RPE.</p>
      ) : (
        <div className="session-register__grid">{sessionMetrics.map(metric=><FormField key={metric.id} id={"session-metric-"+metric.id} label={metric.titulo+(metric.tipo==="TEMPO"?" (mm:ss ou hh:mm:ss)":metric.tipo==="FREQUENCIA_CARDIACA"?" (bpm)":"")} value={values[metric.id]||""} maxLength={255} disabled={metric.quemPreenche==="ALUNO"} hint={metric.quemPreenche==="ALUNO"?"Preenchimento exclusivo do aluno.":undefined} placeholder={metric.tipo==="TEMPO"?"01:42 ou 01:15:30":metric.tipo==="TEXTO"?"Registre suas observações":"Informe o valor"} onChange={(e: ChangeEvent<HTMLInputElement>)=>{setValues(previous=>({...previous,[metric.id]:e.target.value}));setErrors(previous=>({...previous,[metric.id]:""}));}} error={errors[metric.id]} />)}</div>
      )}
      {errors.results && <p className="workspace-dialog__error" role="alert">{errors.results}</p>}
      <p className="session-register__info"><img src="/student-profile/imgIconZap2.svg" alt="" />Os resultados serão registrados para este aluno. A data planejada será preservada.</p>
      {blocked && <p className="workspace-dialog__error">{blocked}</p>}
      <footer className="workspace-dialog__actions"><Button variant="secondary" onClick={onClose}>Cancelar</Button>{blocked?<UnavailableAction reason={blocked}>Salvar e continuar</UnavailableAction>:<Button type="submit">Salvar e continuar</Button>}</footer>
    </form>}
  </WorkspaceDialog>;
}
