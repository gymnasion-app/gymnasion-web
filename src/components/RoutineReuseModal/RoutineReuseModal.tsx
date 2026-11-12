import { useState } from "react";
import WorkspaceDialog from "../WorkspaceDialog/WorkspaceDialog";
import Button from "../Button/Button";
import FormField from "../FormField/FormField";
import {
  eligibleStudentsForRoutine,
  validateReuseRoutinePayload,
} from "../../features/routines/routineModel";
import { rotinaService } from "../../services/rotinaService";
import { authError } from "../../utils/authError";
import type { AlunoResponse } from "../../types/student";
import type { RotinaResponse } from "../../types/rotina";
import "./RoutineReuseModal.css";

interface Props {
  routine: RotinaResponse;
  students: AlunoResponse[];
  routines: RotinaResponse[];
  onClose: () => void;
  onReused: (newRoutine: RotinaResponse) => void;
}

export default function RoutineReuseModal({
  routine,
  students,
  routines,
  onClose,
  onReused,
}: Props) {
  const routineModId = routine.modalidadeId ?? routine.modalidade?.id;
  const candidates = eligibleStudentsForRoutine(students, routines, undefined, routineModId);

  const today = new Date().toISOString().slice(0, 10);
  const [alunoId, setAlunoId] = useState(candidates[0]?.id || "");
  const [dataInicio, setDataInicio] = useState(today);
  const [title, setTitle] = useState(`${routine.titulo} (Ciclo 2)`);
  const [goal, setGoal] = useState(routine.objetivos || "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    const payload = {
      alunoId,
      dataInicio,
      titulo: title.trim(),
      objetivos: goal.trim(),
    };

    const clientErrors = validateReuseRoutinePayload(payload);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setBusy(true);
    setApiError("");
    try {
      const created = await rotinaService.reutilizar(routine.id, payload);
      onReused(created);
    } catch (err: unknown) {
      setApiError(
        authError(
          err,
          "Não foi possível reutilizar a rotina. Verifique se o aluno possui a modalidade vinculada e nenhuma rotina ativa nela."
        ).message
      );
    } finally {
      setBusy(false);
    }
  }

  const studentOptions = candidates.map((student) => ({
    value: student.id,
    label: `${student.usuario.nome} (${student.modalidades.map((m) => m.nome).join(", ") || "Geral"})`,
  }));

  return (
    <WorkspaceDialog
      title="Reutilizar rotina como modelo"
      description="Cria uma nova rotina independente a partir desta base de métricas e estrutura."
      icon="/student-profile/imgIconTrend.svg"
      busy={busy}
      wide
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={candidates.length === 0 || busy}
            loading={busy}
            onClick={handleSave}
          >
            Criar nova rotina
          </Button>
        </>
      }
    >
      <div className="routine-reuse">
        {candidates.length === 0 ? (
          <p className="routine-reuse__warning">
            Não há alunos ativos disponíveis com esta modalidade livre no momento.
          </p>
        ) : (
          <FormField
            id="reuse-student"
            label="Aluno que receberá a nova rotina"
            selectPlaceholder="Selecione o aluno"
            options={studentOptions}
            value={alunoId}
            onChange={(e) => setAlunoId(e.target.value)}
            error={errors.alunoId}
            disabled={busy}
          />
        )}

        <div className="routine-reuse__row">
          <FormField
            id="reuse-date"
            label="Data de início dos treinos"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            error={errors.dataInicio}
            disabled={busy}
          />
        </div>

        <FormField
          id="reuse-title"
          label="Título da nova rotina"
          value={title}
          maxLength={150}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.titulo}
          disabled={busy}
        />

        <div className="routine-reuse__field">
          <label htmlFor="reuse-goal">Objetivos do treinamento</label>
          <textarea
            id="reuse-goal"
            className="routine-reuse__textarea"
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={busy}
          />
          {errors.objetivos && (
            <p className="routine-reuse__error">{errors.objetivos}</p>
          )}
        </div>

        <div className="routine-reuse__callout">
          <img src="/workspace/402-2299-imgIconShield.svg" alt="" />
          <div>
            <strong>Independência total de histórico</strong>
            <p>
              Os resultados, datas reais e treinos anteriores desta rotina não
              são copiados. O novo aluno iniciará um ciclo em branco.
            </p>
          </div>
        </div>

        {apiError && (
          <p className="workspace-dialog__error" role="alert">
            {apiError}
          </p>
        )}
      </div>
    </WorkspaceDialog>
  );
}
