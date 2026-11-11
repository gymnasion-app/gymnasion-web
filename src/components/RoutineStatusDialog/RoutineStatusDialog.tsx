import { useState } from "react";
import WorkspaceDialog from "../WorkspaceDialog/WorkspaceDialog";
import Button from "../Button/Button";
import { rotinaService } from "../../services/rotinaService";
import { authError } from "../../utils/authError";
import type { RotinaResponse } from "../../types/rotina";
import "./RoutineStatusDialog.css";

export type RoutineDialogAction = "encerrar" | "excluir" | "desvincular";

interface Props {
  routine: RotinaResponse;
  action: RoutineDialogAction;
  studentToUnlink?: { id: string; nome: string | null };
  onClose: () => void;
  onSuccess: (message: string, updatedRoutine?: RotinaResponse) => void;
}

export default function RoutineStatusDialog({
  routine,
  action,
  studentToUnlink,
  onClose,
  onSuccess,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [canSwitchToEnd, setCanSwitchToEnd] = useState(false);

  const isEnd = action === "encerrar";
  const isDelete = action === "excluir";
  const isUnlink = action === "desvincular";

  const title = isEnd
    ? `Encerrar rotina “${routine.titulo}”?`
    : isDelete
    ? `Excluir rotina “${routine.titulo}”?`
    : `Desvincular ${studentToUnlink?.nome || "aluno"}?`;

  const isOnlyStudent = (routine.alunos || []).length <= 1;

  const description = isEnd
    ? "Ao encerrar, sessões futuras não executadas serão removidas e os alunos ficarão liberados para iniciar uma nova rotina. O histórico de sessões executadas será integralmente preservado."
    : isDelete
    ? "A rotina será apagada permanentemente do sistema. Rotinas com sessões já realizadas não podem ser excluídas fisicamente."
    : isOnlyStudent
    ? `O aluno ${studentToUnlink?.nome || ""} será desvinculado desta rotina. Como é o único aluno vinculado, a rotina será finalizada liberando o aluno para um novo treino.`
    : `O aluno ${studentToUnlink?.nome || ""} será desvinculado desta rotina. Os demais alunos vinculados continuarão com o treino normalmente.`;

  const tone = isEnd ? "primary" : "danger";
  const icon = isEnd
    ? "/workspace/402-2299-imgIconPower.svg"
    : "/workspace/402-2031-imgIconX.svg";

  async function handleConfirm() {
    setBusy(true);
    setError("");
    setCanSwitchToEnd(false);

    try {
      if (isEnd) {
        const updated = await rotinaService.encerrar(routine.id);
        onSuccess("Rotina encerrada com sucesso! Alunos liberados para novo ciclo.", updated);
      } else if (isDelete) {
        await rotinaService.excluir(routine.id);
        onSuccess("Rotina excluída com sucesso!");
      } else if (isUnlink && studentToUnlink) {
        if (isOnlyStudent) {
          // Se só há 1 aluno na rotina, RN-012 exige excluir ou encerrar para desvincular o único aluno
          try {
            await rotinaService.excluir(routine.id);
            onSuccess(`Rotina desvinculada e excluída com sucesso!`);
          } catch {
            const updated = await rotinaService.encerrar(routine.id);
            onSuccess(`Rotina desvinculada e encerrada com sucesso! Histórico preservado.`, updated);
          }
        } else {
          try {
            await rotinaService.desvincularAluno(routine.id, studentToUnlink.id);
            const updated: RotinaResponse = {
              ...routine,
              alunos: routine.alunos.filter((a) => a.id !== studentToUnlink.id),
            };
            onSuccess(`Aluno ${studentToUnlink.nome || ""} desvinculado com sucesso.`, updated);
          } catch (unlinkErr) {
            const parsedUnlink = authError(unlinkErr, "Erro ao desvincular aluno.");
            if (
              parsedUnlink.message.includes("pelo menos um aluno") ||
              parsedUnlink.message.includes("exclua a rotina")
            ) {
              try {
                await rotinaService.excluir(routine.id);
                onSuccess(`Rotina desvinculada e excluída com sucesso!`);
              } catch {
                const updated = await rotinaService.encerrar(routine.id);
                onSuccess(
                  `Rotina desvinculada e encerrada com sucesso! Histórico preservado.`,
                  updated
                );
              }
            } else {
              throw unlinkErr;
            }
          }
        }
      }
    } catch (err: unknown) {
      const parsed = authError(err, "Não foi possível concluir a ação.");
      setError(parsed.message);

      // Se for exclusão e falhar por causa de histórico, sugere encerramento (US-12)
      if (isDelete && (parsed.message.includes("já executadas") || parsed.message.includes("sessões"))) {
        setCanSwitchToEnd(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleEncerrarEmVezDeExcluir() {
    setBusy(true);
    setError("");
    try {
      const updated = await rotinaService.encerrar(routine.id);
      onSuccess("Rotina encerrada com sucesso! Histórico preservado.", updated);
    } catch (err: unknown) {
      setError(authError(err, "Erro ao encerrar a rotina.").message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceDialog
      title={title}
      description={description}
      tone={tone}
      icon={icon}
      busy={busy}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          {canSwitchToEnd ? (
            <Button variant="primary" loading={busy} onClick={handleEncerrarEmVezDeExcluir}>
              Encerrar rotina
            </Button>
          ) : (
            <Button
              variant={isEnd ? "primary" : "danger"}
              loading={busy}
              onClick={handleConfirm}
            >
              {isEnd
                ? "Encerrar rotina"
                : isDelete
                ? "Excluir permanentemente"
                : "Desvincular aluno"}
            </Button>
          )}
        </>
      }
    >
      <div className="routine-status-dialog">
        {isEnd && (
          <div className="routine-status-dialog__info">
            <p>
              <img src="/workspace/402-2299-imgIconShield.svg" alt="" />
              Histórico de treinos e métricas concluídas continua acessível.
            </p>
            <p>
              <img src="/student-profile/imgIconCheck.svg" alt="" />
              Alunos vinculados poderão receber uma nova rotina ativa.
            </p>
          </div>
        )}

        {isDelete && (
          <div className="routine-status-dialog__warning">
            <p>
              <img src="/design-system/imgIconAlert.svg" alt="" />
              Esta ação não pode ser desfeita. Se o treino já foi iniciado, o
              sistema exigirá o encerramento para preservar os dados.
            </p>
          </div>
        )}

        {error && (
          <div className="workspace-dialog__error" role="alert">
            <p>{error}</p>
            {canSwitchToEnd && (
              <p className="routine-status-dialog__hint">
                Deseja <strong>encerrar</strong> esta rotina em vez de excluí-la? Isso mantém o histórico de treinos do aluno e desocupa o cadastro para novas rotinas.
              </p>
            )}
          </div>
        )}
      </div>
    </WorkspaceDialog>
  );
}
