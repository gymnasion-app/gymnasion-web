import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import StudentRoutineDialog from "../../components/StudentRoutineDialog/StudentRoutineDialog";
import { lastSession, displayDate } from "../../features/personal/dashboardModel";
import Button from "../../components/Button/Button";
import Badge from "../../components/Badge/Badge";
import StudentIdentity, { StudentSports } from "../../components/StudentIdentity/StudentIdentity";
import StudentInviteModal from "../../components/StudentInviteModal/StudentInviteModal";
import StudentModalitiesDialog from "../../components/StudentModalitiesDialog/StudentModalitiesDialog";
import StudentStatusDialog from "../../components/StudentStatusDialog/StudentStatusDialog";
import { usePersonal } from "../../features/personal/PersonalContext";
import { studentCounts, studentRoutines, visibleStudents, type StudentFilter, type StudentMutation } from "../../features/personal/studentModel";
import { parseAtividades } from "../../utils/activityParser";
import type { AlunoResponse } from "../../types/student";
import "./Students.css";

export default function Students() {
  const { students, routines, groups, refresh, syncStudent, mutate, busyId, histories, notificationBusy } = usePersonal();
  const [params, setParams] = useSearchParams();
  const filter = (["all", "active", "inactive", "pending"].includes(params.get("status") || "") ? params.get("status") : "all") as StudentFilter;
  const search = params.get("busca") || "";
  const modality = params.get("modalidade") || "";
  const [page, setPage] = useState(1);
  const [assign, setAssign] = useState<AlunoResponse | null>(null);
  const [editModalities, setEditModalities] = useState<AlunoResponse | null>(null);
  const [invite, setInvite] = useState(false);
  const [action, setAction] = useState<{student: AlunoResponse; action: Exclude<StudentMutation, "approve">} | null>(null);
  const counts = studentCounts(students.data);
  const visible = visibleStudents(students.data, filter, search, modality);
  const pages = Math.max(1, Math.ceil(visible.length / 8));
  const currentPage = Math.min(page, pages);
  const displayed = visible.slice((currentPage - 1) * 8, currentPage * 8);
  const modalities = [...new Map(students.data.flatMap(student => student.modalidades).map(item => [item.id, item])).values()];
  function update(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }); setPage(1); }
  return <section className="students-v2" aria-label="Alunos">
    <div className="students-v2__toolbar">
      <div className="students-v2__tabs" aria-label="Filtrar por status">{([['all','Todos'],['active','Ativos'],['inactive','Inativos'],['pending','Pendentes']] as const).map(([key,label]) => <button key={key} aria-pressed={filter === key} onClick={() => update("status", key)}>{label}<span>{students.loading ? "—" : counts[key]}</span></button>)}</div>
      <input aria-label="Buscar aluno por nome ou e-mail" placeholder="Buscar aluno..." value={search} onChange={event => update("busca", event.target.value)} />
      <select aria-label="Filtrar modalidade" value={modality} onChange={event => update("modalidade", event.target.value)}><option value="">Todas as modalidades</option>{modalities.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
      <Button onClick={() => setInvite(true)}>+ Cadastrar aluno</Button>
    </div>
    {students.error && <div className="workspace-error" role="alert">{students.error}<Button variant="secondary" onClick={() => void refresh()}>Tentar novamente</Button></div>}
    {students.loading ? <div className="workspace-card workspace-empty" role="status">Carregando alunos...</div> : !students.error && visible.length === 0 ? <div className="workspace-card workspace-empty"><h2>{search ? 'Nenhum aluno encontrado para “' + search + '”' : "Nenhum aluno nesta lista"}</h2><p>{search || modality ? "Experimente outro nome ou modalidade." : "Os cadastros aparecerão aqui assim que estiverem disponíveis."}</p></div> : filter === "pending" ? <div className="students-v2__pending">{displayed.map(student => <article className="workspace-card students-v2__pending-card" key={student.id}>
      <StudentIdentity student={student} /><StudentSports student={student} /><Badge tone="warning">Pendente</Badge><div className="students-v2__details"><span>E-mail</span><strong>{student.usuario.email}</strong><span>Telefone</span><strong>{student.usuario.celular || "Não informado"}</strong></div>
      <div className="students-v2__actions"><Button variant="secondary" disabled={Boolean(busyId) || notificationBusy} onClick={() => setAction({student,action:"reject"})}>Recusar</Button><Button loading={busyId === student.id} disabled={Boolean(busyId) || notificationBusy} onClick={() => void mutate(student,"approve")}>Aceitar aluno</Button></div>
    </article>)}</div> : visible.length > 0 && <div className="workspace-card students-v2__table"><table><thead><tr><th scope="col">Aluno</th><th scope="col">Modalidade</th><th scope="col">Rotina ativa</th><th scope="col">Última sessão (rotina ativa)</th><th scope="col">Status</th><th scope="col"><span className="students-v2__sr">Ações</span></th></tr></thead><tbody>{displayed.map(student => {
      const activeRoutines = studentRoutines(routines.data, student.id);
      const activeIds = activeRoutines.map(item => item.id);
      const activeModIds = new Set(activeRoutines.map(item => item.modalidadeId ?? item.modalidade?.id).filter((id): id is number => id != null));
      const hasFreeModality = student.status === "ATIVO" && student.modalidades.some(item => !activeModIds.has(item.id));
      const last = activeIds.length ? lastSession(histories.data, student.id, activeIds) : undefined;
      const lastTitle = last ? (parseAtividades(last.atividades).sessionName || `Semana ${last.semana}`) : "";
      return <tr key={student.id}><td><StudentIdentity student={student} /></td><td><StudentSports student={student} /></td><td>{routines.loading ? "Carregando..." : routines.error ? "Indisponível" : activeRoutines.length ? <div className="students-v2__routine-cell"><strong>{activeRoutines.map(item => item.titulo).join(", ")}</strong><small>{activeRoutines.length === 1 ? `${activeRoutines[0].frequenciaSemanal}x/sem` : `${activeRoutines.length} rotinas ativas`}</small>{hasFreeModality && <button type="button" className="workspace-link" onClick={()=>setAssign(student)}>+ Vincular rotina</button>}</div> : (student.status === "ATIVO" ? <button type="button" className="workspace-link" onClick={()=>setAssign(student)}>Vincular rotina</button> : "Sem rotina ativa")}</td><td>{histories.loading || routines.loading ? "Carregando..." : histories.error ? <span title={histories.error}>Indisponível</span> : !activeIds.length ? <span className="students-v2__muted">Sem rotina ativa</span> : last?.dataReal ? <div className="students-v2__session-cell"><strong>{displayDate(last.dataReal)}</strong><small>{lastTitle}</small></div> : <span className="students-v2__muted">Nenhuma realizada</span>}</td><td><Badge tone={student.status === "ATIVO" ? "success" : "neutral"}>{student.status === "ATIVO" ? "Ativo" : "Inativo"}</Badge></td><td><div className="students-v2__row-actions"><button type="button" className="workspace-link students-v2__profile-link" onClick={() => setEditModalities(student)}>Modalidades</button><Link className="workspace-link students-v2__profile-link" to={`/alunos/${encodeURIComponent(student.id)}`}>Ver perfil</Link><button className="students-v2__more" aria-label={'Alterar status de ' + student.usuario.nome} title={student.status === "ATIVO" ? "Desativar aluno" : "Reativar aluno"} disabled={Boolean(busyId) || notificationBusy} onClick={() => setAction({student,action:student.status === "ATIVO" ? "deactivate" : "reactivate"})}><img src="/workspace/401-744-imgIconMore.svg" alt="" /></button></div></td></tr>;
    })}</tbody></table></div>}
    {visible.length > 0 && <nav className="students-v2__pagination" aria-label="Paginação"><span>Mostrando {(currentPage-1)*8+1}–{Math.min(currentPage*8,visible.length)} de {visible.length} alunos</span><Button variant="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}>Anterior</Button><span>{currentPage} / {pages}</span><Button variant="secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage+1)}>Próxima</Button></nav>}
    {assign && <StudentRoutineDialog student={assign} onClose={()=>setAssign(null)} />}
    {editModalities && <StudentModalitiesDialog student={editModalities} routines={routines.data} groups={groups.data} onClose={() => setEditModalities(null)} onSaved={(updated) => { syncStudent(updated); setEditModalities(null); toast.success("Modalidades atualizadas com sucesso!"); void refresh(); }} />}
    {invite && <StudentInviteModal onClose={() => setInvite(false)} />}
    {action && <StudentStatusDialog {...action} onClose={() => setAction(null)} />}
  </section>;
}
