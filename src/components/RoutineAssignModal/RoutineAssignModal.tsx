import { useEffect, useRef, useState } from "react";
import WorkspaceDialog from "../WorkspaceDialog/WorkspaceDialog";
import Button from "../Button/Button";
import Avatar from "../Avatar/Avatar";
import Checkbox from "../Checkbox/Checkbox";
import {
  eligibleGroupsForRoutine,
  eligibleStudentsForRoutine,
  extractProblemDetail,
} from "../../features/routines/routineModel";
import { rotinaService } from "../../services/rotinaService";
import { turmaService } from "../../services/turmaService";
import { authError } from "../../utils/authError";
import type { AlunoResponse } from "../../types/student";
import type { RotinaResponse } from "../../types/rotina";
import type { TurmaResponse } from "../../types/turma";
import "./RoutineAssignModal.css";

interface Props {
  routine: RotinaResponse;
  students: AlunoResponse[];
  routines: RotinaResponse[];
  groups?: TurmaResponse[];
  onClose: () => void;
  onAssigned: (updated: RotinaResponse) => void;
}

export default function RoutineAssignModal({
  routine,
  students,
  routines,
  groups,
  onClose,
  onAssigned,
}: Props) {
  const [currentRoutine, setCurrentRoutine] = useState<RotinaResponse>(routine);
  const [unlinkingStudentId, setUnlinkingStudentId] = useState<string | null>(null);
  const [fetchedGroups, setFetchedGroups] = useState<TurmaResponse[]>([]);
  const [mode, setMode] = useState<"turma" | "alunos" | "vinculados">("turma");

  useEffect(() => {
    if (groups && groups.length > 0) return;
    let active = true;
    turmaService
      .listar()
      .then((data) => {
        if (active) setFetchedGroups(data);
      })
      .catch(() => {
        if (active) setFetchedGroups([]);
      });
    return () => {
      active = false;
    };
  }, [groups]);

  const allGroups = groups && groups.length > 0 ? groups : fetchedGroups;
  const eligibleGroups = eligibleGroupsForRoutine(allGroups, currentRoutine);

  const existingIds = new Set((currentRoutine.alunos || []).map((a) => a.id));
  const candidates = eligibleStudentsForRoutine(
    students,
    routines,
    currentRoutine.id,
    currentRoutine.modalidadeId ?? currentRoutine.modalidade?.id
  ).filter((student) => !existingIds.has(student.id));

  const [selectedTurmaId, setSelectedTurmaId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflictPrompt, setConflictPrompt] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (!selectedTurmaId && eligibleGroups.length > 0) {
      setSelectedTurmaId(eligibleGroups[0].id);
    }
  }, [eligibleGroups, selectedTurmaId]);

  function toggleStudent(id: string) {
    setError("");
    setConflictPrompt(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleUnlinkStudent(studentId: string) {
    if (unlinkingStudentId || busy) return;
    if ((currentRoutine.alunos || []).length <= 1) {
      setError("A rotina deve possuir pelo menos 1 aluno vinculado. Para remover todos, utilize a exclusão ou encerramento da rotina.");
      return;
    }
    setUnlinkingStudentId(studentId);
    setError("");
    setConflictPrompt(false);
    try {
      await rotinaService.desvincularAluno(currentRoutine.id, studentId);
      const updated: RotinaResponse = {
        ...currentRoutine,
        alunos: currentRoutine.alunos.filter((a) => a.id !== studentId),
      };
      setCurrentRoutine(updated);
      onAssigned(updated);
    } catch (err: unknown) {
      setError(authError(err, "Não foi possível desvincular o aluno.").message);
    } finally {
      setUnlinkingStudentId(null);
    }
  }

  async function handleAssign() {
    if (lock.current || busy) return;

    if (mode === "turma") {
      if (!selectedTurmaId) return;
      lock.current = true;
      setBusy(true);
      setError("");
      setConflictPrompt(false);
      try {
        const updated = await rotinaService.vincularTurma(routine.id, selectedTurmaId);
        onAssigned(updated);
      } catch (err: unknown) {
        const fallback = authError(
          err,
          "Não foi possível vincular a turma selecionada."
        ).message;
        let msg = extractProblemDetail(err, fallback);
        if (
          msg.toLowerCase().includes("já possui o treino vinculado") ||
          msg.toLowerCase().includes("já possuem esta rotina") ||
          msg.toLowerCase().includes("já estão vinculados")
        ) {
          msg = "Todos os alunos desta turma já possuem esta rotina de treino vinculada.";
        }
        setError(msg);
        if (
          msg.toLowerCase().includes("já possui uma rotina") ||
          msg.toLowerCase().includes("rotina atual precisa ser encerrada")
        ) {
          setConflictPrompt(true);
        }
      } finally {
        lock.current = false;
        setBusy(false);
      }
      return;
    }

    if (selectedIds.size === 0) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const allIds = [...existingIds, ...selectedIds];
      const updated = await rotinaService.vincularAlunos(routine.id, allIds);
      onAssigned(updated);
    } catch (err: unknown) {
      const fallback = authError(
        err,
        "Não foi possível vincular os alunos selecionados."
      ).message;
      setError(extractProblemDetail(err, fallback));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function handleAssignWithReplace() {
    if (lock.current || busy || !selectedTurmaId) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const updated = await rotinaService.vincularTurma(routine.id, selectedTurmaId, true);
      onAssigned(updated);
    } catch (err: unknown) {
      const fallback = authError(
        err,
        "Não foi possível vincular a turma selecionada."
      ).message;
      setError(extractProblemDetail(err, fallback));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const modalityName = routine.nomeModalidade || routine.modalidade?.nome || "mesma modalidade";
  const selectedTurma = allGroups.find((g) => g.id === selectedTurmaId);
  const isSelectedTurmaAlreadyLinked = Boolean(
    selectedTurma &&
    selectedTurma.alunos?.length > 0 &&
    selectedTurma.alunos.every((a) => existingIds.has(a.id))
  );

  const canConfirm =
    mode === "turma"
      ? Boolean(selectedTurmaId) && eligibleGroups.length > 0 && !isSelectedTurmaAlreadyLinked
      : selectedIds.size > 0;

  return (
    <WorkspaceDialog
      title="Vincular à rotina"
      description={`Envie a rotina “${routine.titulo}” (${modalityName}) para uma turma ou alunos.`}
      icon="/workspace/402-1230-imgIconLink.svg"
      busy={busy}
      onClose={onClose}
      actions={
        mode === "vinculados" ? (
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={!canConfirm || busy}
              loading={busy}
              onClick={handleAssign}
            >
              {mode === "turma"
                ? isSelectedTurmaAlreadyLinked
                  ? "Turma já vinculada à rotina"
                  : "Vincular turma"
                : `Vincular ${selectedIds.size > 0 ? `(${selectedIds.size})` : ""}`}
            </Button>
          </>
        )
      }
    >
      <div className="routine-assign">
        <div className="routine-assign__tabs" role="tablist" aria-label="Modo de vinculação">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "turma"}
            className={`routine-assign__tab ${mode === "turma" ? "is-active" : ""}`}
            disabled={busy}
            onClick={() => {
              setMode("turma");
              setError("");
            }}
          >
            Por turma ({eligibleGroups.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "alunos"}
            className={`routine-assign__tab ${mode === "alunos" ? "is-active" : ""}`}
            disabled={busy}
            onClick={() => {
              setMode("alunos");
              setError("");
            }}
          >
            Alunos individuais ({candidates.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "vinculados"}
            className={`routine-assign__tab ${mode === "vinculados" ? "is-active" : ""}`}
            disabled={busy}
            onClick={() => {
              setMode("vinculados");
              setError("");
            }}
          >
            Alunos vinculados ({currentRoutine.alunos?.length || 0})
          </button>
        </div>

        {mode === "vinculados" ? (
          (currentRoutine.alunos || []).length === 0 ? (
            <p className="routine-assign__empty">Nenhum aluno vinculado a esta rotina.</p>
          ) : (
            <ul className="routine-assign__list" aria-label="Alunos vinculados">
              {(currentRoutine.alunos || []).map((aluno) => {
                const isOnly = (currentRoutine.alunos || []).length <= 1;
                return (
                  <li
                    key={aluno.id}
                    className="routine-assign__item"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      className="routine-assign__item-content"
                      style={{ display: "flex", alignItems: "center", gap: "10px" }}
                    >
                      <Avatar name={aluno.nome || "Aluno"} tone="info" />
                      <div className="routine-assign__info">
                        <strong>{aluno.nome || "Aluno"}</strong>
                        <small style={{ color: "#64748b" }}>
                          {isOnly ? "Único aluno vinculado" : "Aluno ativo na rotina"}
                        </small>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      style={{ color: "#dc2626", fontSize: "12px", padding: "4px 8px" }}
                      disabled={busy || unlinkingStudentId === aluno.id}
                      loading={unlinkingStudentId === aluno.id}
                      title={
                        isOnly
                          ? "Mínimo de 1 aluno vinculado por rotina"
                          : "Desvincular aluno"
                      }
                      onClick={() => handleUnlinkStudent(aluno.id)}
                    >
                      Desvincular
                    </Button>
                  </li>
                );
              })}
            </ul>
          )
        ) : mode === "turma" ? (
          eligibleGroups.length === 0 ? (
            <p className="routine-assign__empty">
              Nenhuma turma cadastrada para a modalidade <strong>{modalityName}</strong>.
            </p>
          ) : (
            <ul className="routine-assign__list" aria-label={`Turmas de ${modalityName}`}>
              {eligibleGroups.map((turma) => {
                const isSelected = selectedTurmaId === turma.id;
                const count = turma.quantidadeAlunos ?? turma.alunos?.length ?? 0;
                return (
                  <li key={turma.id} className="routine-assign__item">
                    <label className={isSelected ? "is-selected" : ""}>
                      <input
                        type="radio"
                        name="assign-turma"
                        value={turma.id}
                        checked={isSelected}
                        disabled={busy}
                        onChange={() => {
                          setSelectedTurmaId(turma.id);
                          setError("");
                        }}
                      />
                      <div className="routine-assign__info">
                        <strong>{turma.nome}</strong>
                        <small>
                          {turma.nomeModalidade || modalityName} · {count}{" "}
                          {count === 1 ? "aluno" : "alunos"}
                        </small>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )
        ) : candidates.length === 0 ? (
          <p className="routine-assign__empty">
            Não há outros alunos ativos sem rotina disponível no momento.
          </p>
        ) : (
          <ul className="routine-assign__list" aria-label="Alunos disponíveis">
            {candidates.map((student) => {
              const isChecked = selectedIds.has(student.id);
              return (
                <li key={student.id} className="routine-assign__item">
                  <Checkbox
                    checked={isChecked}
                    onChange={() => toggleStudent(student.id)}
                    label={
                      <div className="routine-assign__item-content">
                        <Avatar name={student.usuario.nome} tone="info" />
                        <div className="routine-assign__info">
                          <strong>{student.usuario.nome}</strong>
                          <small>
                            {student.modalidades.map((m) => m.nome).join(", ") ||
                              "Geral"}
                          </small>
                        </div>
                      </div>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <div style={{ marginTop: "12px" }}>
            <p className="workspace-dialog__error" role="alert" style={{ margin: "0 0 8px 0" }}>
              {error}
            </p>
            {conflictPrompt && (
              <Button
                variant="primary"
                disabled={busy}
                loading={busy}
                onClick={handleAssignWithReplace}
              >
                Encerrar rotina anterior e vincular
              </Button>
            )}
          </div>
        )}
      </div>
    </WorkspaceDialog>
  );
}
