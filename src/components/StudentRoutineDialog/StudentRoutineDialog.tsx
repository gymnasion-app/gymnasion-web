import { useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import WorkspaceDialog from "../WorkspaceDialog/WorkspaceDialog";
import FormField from "../FormField/FormField";
import Button from "../Button/Button";
import { usePersonal } from "../../features/personal/PersonalContext";
import type { AlunoResponse } from "../../types/student";
import "./StudentRoutineDialog.css";

export default function StudentRoutineDialog({student,onClose}:{student:AlunoResponse;onClose:()=>void}) {
  const {routines,busyId,notificationBusy,linkRoutine,refresh,actionError} = usePersonal();
  const [selected,setSelected] = useState("");
  const [failed,setFailed] = useState(false);
  const studentModIds = new Set(student.modalidades.map(m => m.id));
  const activeModIdsForStudent = new Set(
    routines.data
      .filter(item => item.ativo !== false && item.alunos.some(aluno => aluno.id === student.id))
      .map(item => item.modalidadeId ?? item.modalidade?.id)
      .filter((id): id is number => id != null)
  );
  const available = routines.data.filter(item => {
    if (item.ativo === false || item.alunos.some(aluno => aluno.id === student.id)) return false;
    const modId = item.modalidadeId ?? item.modalidade?.id;
    if (!modId) return true;
    if (studentModIds.size > 0 && !studentModIds.has(modId)) return false;
    return !activeModIdsForStudent.has(modId);
  });
  const hasFreeModality = student.modalidades.some(m => !activeModIdsForStudent.has(m.id));
  const busy = Boolean(busyId) || notificationBusy;
  return <WorkspaceDialog title="Vincular rotina" description={"Escolha uma rotina ativa para "+student.usuario.nome+"."} icon="/workspace/402-1230-imgIconLink.svg" onClose={onClose} busy={busy} actions={<><Button variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button><Button disabled={!selected || busy || Boolean(routines.error) || !available.some(item=>item.id===selected)} loading={busyId===student.id} onClick={async()=>{setFailed(false);if(await linkRoutine(student,selected))onClose();else setFailed(true);}}>Vincular rotina</Button></>}>
    <div className="student-routine-dialog">{routines.error ? <p role="alert">{routines.error}<Button variant="secondary" onClick={()=>void refresh()}>Tentar novamente</Button></p> : available.length ? <FormField id="assign-routine" label="Rotina de treino" value={selected} onChange={(event: ChangeEvent<HTMLSelectElement>)=>setSelected(event.target.value)} disabled={busy} options={available.map(item=>({value:item.id,label:item.titulo+" · "+item.nomeModalidade}))}/> : !hasFreeModality ? <p>Todas as modalidades vinculadas a este aluno já possuem uma rotina ativa.</p> : <p>Nenhuma rotina ativa disponível para as modalidades livres deste aluno. <Link to={"/rotinas/nova?aluno="+encodeURIComponent(student.id)}>Criar uma rotina</Link></p>}<p>O aluno pode ter até 1 rotina ativa por modalidade vinculada ao perfil (máx. 3 modalidades).</p>{failed && <p role="alert" className="workspace-dialog__error">{actionError || "O vínculo não foi salvo. Tente novamente."}</p>}</div>
  </WorkspaceDialog>;
}
