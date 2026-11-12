import { useState, type FormEvent } from "react";
import WorkspaceDialog from "../WorkspaceDialog/WorkspaceDialog";
import Button from "../Button/Button";
import FormField from "../FormField/FormField";
import Avatar from "../Avatar/Avatar";
import Checkbox from "../Checkbox/Checkbox";
import { rotinaService } from "../../services/rotinaService";
import { authError } from "../../utils/authError";
import {
  eligibleStudentsForRoutine,
  validateCreateRoutinePayload,
  WEEK_DAYS,
} from "../../features/routines/routineModel";
import type { AlunoResponse } from "../../types/student";
import type { RotinaResponse } from "../../types/rotina";
import "./RoutineFormModal.css";

interface Props {
  modalities: { id: number; nome: string; descricao?: string }[];
  students: AlunoResponse[];
  routines: RotinaResponse[];
  initialStudentId?: string;
  onClose: () => void;
  onSaved: (routine: RotinaResponse) => void;
}

export default function RoutineFormModal({
  modalities,
  students,
  routines,
  initialStudentId,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [modalityId, setModalityId] = useState<number | null>(modalities[0]?.id || null);
  const [frequency, setFrequency] = useState<number>(3);
  const [goal, setGoal] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(
    () => new Set(initialStudentId ? [initialStudentId] : [])
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const candidateStudents = eligibleStudentsForRoutine(students, routines);

  function toggleStudent(id: string) {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = {
      titulo: title.trim(),
      modalidadeId: modalityId || 0,
      frequenciaSemanal: frequency,
      objetivos: goal.trim(),
      alunosIds: Array.from(selectedStudents),
    };

    const clientErrors = validateCreateRoutinePayload(payload);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSaving(true);
    setServerError("");
    try {
      const created = await rotinaService.criar(payload);
      onSaved(created);
    } catch (err: unknown) {
      setServerError(
        authError(
          err,
          "Não foi possível salvar a rotina. Verifique se o aluno já possui rotina ativa."
        ).message
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceDialog
      title="Nova rotina de treino"
      description="Configure título, modalidade, frequência semanal e alunos. As métricas são escolhidas por sessão no planejamento."
      icon="/design-system/imgIconDumbbell.svg"
      busy={saving}
      wide
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="routine-form"
            loading={saving}
            disabled={saving}
          >
            Criar rotina
          </Button>
        </>
      }
    >
      <form id="routine-form" onSubmit={handleSubmit} className="routine-form-v2">
        <FormField
          id="routine-title"
          label="Título da rotina"
          placeholder="Ex: Treino de Força e Resistência"
          value={title}
          maxLength={150}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.titulo}
          disabled={saving}
          autoFocus
        />

        <div className="routine-form-v2__field">
          <label className="routine-form-v2__label">Modalidade</label>
          <div className="routine-form-v2__chips">
            {modalities.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`routine-form-v2__chip ${modalityId === item.id ? "routine-form-v2__chip--active" : ""}`}
                onClick={() => setModalityId(item.id)}
                disabled={saving}
              >
                {item.nome}
              </button>
            ))}
          </div>
          {errors.modalidadeId && (
            <p className="routine-form-v2__error">{errors.modalidadeId}</p>
          )}
        </div>

        <div className="routine-form-v2__field">
          <label className="routine-form-v2__label">
            Frequência semanal <span>(dias por semana)</span>
          </label>
          <div className="routine-form-v2__chips routine-form-v2__chips--days">
            {WEEK_DAYS.map((day) => (
              <button
                key={day}
                type="button"
                className={`routine-form-v2__chip ${frequency === day ? "routine-form-v2__chip--active" : ""}`}
                onClick={() => setFrequency(day)}
                disabled={saving}
              >
                {day}x
              </button>
            ))}
          </div>
          {errors.frequenciaSemanal && (
            <p className="routine-form-v2__error">{errors.frequenciaSemanal}</p>
          )}
        </div>

        <div className="routine-form-v2__field">
          <label htmlFor="routine-goal" className="routine-form-v2__label">
            Objetivos do treinamento
          </label>
          <textarea
            id="routine-goal"
            className="routine-form-v2__textarea"
            rows={2}
            placeholder="Ex: Aumento da capacidade cardiorrespiratória e ritmo."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={saving}
          />
          {errors.objetivos && (
            <p className="routine-form-v2__error">{errors.objetivos}</p>
          )}
        </div>

        <div className="routine-form-v2__field">
          <div className="routine-form-v2__section-header">
            <label className="routine-form-v2__label">
              Alunos vinculados ({selectedStudents.size}{" "}
              {selectedStudents.size === 1 ? "selecionado" : "selecionados"})
            </label>
            <span className="routine-form-v2__subnote">
              Apenas alunos ativos sem outra rotina ativa
            </span>
          </div>

          {candidateStudents.length === 0 ? (
            <p className="routine-form-v2__empty">
              Nenhum aluno ativo sem rotina disponível. Cadastre novos alunos ou encerre rotinas anteriores.
            </p>
          ) : (
            <ul className="routine-form-v2__items-list" aria-label="Alunos disponíveis">
              {candidateStudents.map((aluno) => {
                const checked = selectedStudents.has(aluno.id);
                return (
                  <li key={aluno.id} className="routine-form-v2__item">
                    <Checkbox
                      checked={checked}
                      onChange={() => toggleStudent(aluno.id)}
                      disabled={saving}
                      label={
                        <div className="routine-form-v2__item-content">
                          <Avatar name={aluno.usuario.nome} tone="info" />
                          <div className="routine-form-v2__item-info">
                            <strong>{aluno.usuario.nome}</strong>
                            <small>
                              {aluno.modalidades.map((m) => m.nome).join(", ") || "Geral"}
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
          {errors.alunosIds && (
            <p className="routine-form-v2__error">{errors.alunosIds}</p>
          )}
        </div>

        {serverError && (
          <p className="workspace-dialog__error" role="alert">
            {serverError}
          </p>
        )}
      </form>
    </WorkspaceDialog>
  );
}
