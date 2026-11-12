import { useEffect, useMemo, useRef, useState } from "react";
import WorkspaceDialog from "../WorkspaceDialog/WorkspaceDialog";
import Button from "../Button/Button";
import ModalityMultiSelect, { type ModalityOptionItem } from "../ModalityMultiSelect/ModalityMultiSelect";
import { modalidadeService } from "../../services/modalidadeService";
import { personalTrainerService } from "../../services/personalTrainerService";
import { isRoutineActive } from "../../features/routines/routineModel";
import { authError } from "../../utils/authError";
import type { AlunoResponse } from "../../types/student";
import type { Modalidade } from "../../types/modalidade";
import type { RotinaResponse } from "../../types/rotina";
import type { TurmaResponse } from "../../types/turma";
import "./StudentModalitiesDialog.css";

const MAX_MODALITIES = 3;

interface Props {
  student: AlunoResponse;
  routines: RotinaResponse[];
  groups: TurmaResponse[];
  onClose: () => void;
  onSaved: (updated: AlunoResponse) => void;
}

export default function StudentModalitiesDialog({
  student,
  routines,
  groups,
  onClose,
  onSaved,
}: Props) {
  const [catalog, setCatalog] = useState<Modalidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    (student.modalidades || []).map((m) => m.id)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(false);

  async function loadCatalog() {
    setLoading(true);
    setError("");
    try {
      const data = await modalidadeService.listarTodas();
      if (mounted.current) setCatalog(data || []);
    } catch (err) {
      if (mounted.current) {
        setError(authError(err, "Não foi possível carregar as modalidades.").message);
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    void loadCatalog();
    return () => {
      mounted.current = false;
    };
  }, []);

  const linkedIds = useMemo(
    () => new Set((student.modalidades || []).map((m) => m.id)),
    [student.modalidades]
  );

  const lockReasons = useMemo(() => {
    const reasons = new Map<number, string>();
    for (const r of routines) {
      if (!isRoutineActive(r)) continue;
      if (!r.alunos?.some((a) => a.id === student.id)) continue;
      const modId = r.modalidadeId ?? r.modalidade?.id;
      if (modId != null && !reasons.has(modId)) {
        reasons.set(modId, "Possui rotina ativa");
      }
    }
    for (const g of groups) {
      if (!g.alunos?.some((a) => a.id === student.id)) continue;
      if (!reasons.has(g.modalidadeId)) {
        reasons.set(g.modalidadeId, "Vinculado a turma");
      }
    }
    return reasons;
  }, [routines, groups, student.id]);

  const displayedModalities = useMemo(() => {
    const map = new Map<number, Modalidade>();
    for (const m of student.modalidades || []) {
      map.set(m.id, m);
    }
    for (const m of catalog) {
      if (m.ativo !== false || linkedIds.has(m.id)) {
        map.set(m.id, m);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );
  }, [catalog, student.modalidades, linkedIds]);

  const selectedChips = useMemo(
    () =>
      selectedIds
        .map((id) => displayedModalities.find((m) => m.id === id))
        .filter((m): m is Modalidade => Boolean(m))
        .map((m) => ({
          id: m.id,
          nome: m.nome,
          lockedReason: lockReasons.get(m.id)
            ? `${lockReasons.get(m.id)}: desvincule antes de remover.`
            : undefined,
        })),
    [displayedModalities, selectedIds, lockReasons]
  );

  const modalityOptions: ModalityOptionItem[] = useMemo(
    () =>
      displayedModalities.map((mod) => {
        const checked = selectedIds.includes(mod.id);
        const lockReason = lockReasons.get(mod.id);
        const isInactiveUnlinked = !checked && mod.ativo === false;
        const isMaxBlocked = !checked && selectedIds.length >= MAX_MODALITIES;
        const isDisabled =
          busy ||
          (checked && Boolean(lockReason)) ||
          isInactiveUnlinked ||
          isMaxBlocked;

        return {
          modalidade: mod,
          checked,
          disabled: isDisabled,
          badgeText: checked && lockReason ? lockReason : mod.ativo === false ? "Desativada" : undefined,
          badgeTone: checked && lockReason ? "lock" : "neutral",
          tooltip:
            checked && lockReason
              ? "Não é possível remover enquanto houver rotina ativa ou turma vinculada."
              : undefined,
        };
      }),
    [displayedModalities, selectedIds, lockReasons, busy]
  );

  function toggleModality(id: number) {
    setError("");
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (lockReasons.has(id)) return prev;
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= MAX_MODALITIES) return prev;
      return [...prev, id];
    });
  }

  async function handleSave() {
    if (busy || selectedIds.length === 0 || selectedIds.length > MAX_MODALITIES) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = await personalTrainerService.atualizarModalidades(
        student.id,
        selectedIds
      );
      if (mounted.current) {
        onSaved(updated);
      }
    } catch (err) {
      if (mounted.current) {
        setError(
          authError(err, "Não foi possível atualizar as modalidades do aluno.").message
        );
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <WorkspaceDialog
      title="Editar modalidades do aluno"
      description={`Gerencie os esportes vinculados a ${student.usuario.nome} (de 1 até 3 modalidades).`}
      icon="/student-profile/imgIconActivity2.svg"
      wide
      className="student-modalities-wrapper"
      busy={busy}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={busy}
            disabled={loading || selectedIds.length === 0 || selectedIds.length > MAX_MODALITIES}
            onClick={() => void handleSave()}
          >
            Salvar alterações
          </Button>
        </>
      }
    >
      <div className="student-modalities-dialog">
        <ModalityMultiSelect
          label="Modalidades selecionadas"
          searchId="edit-modality-search"
          options={modalityOptions}
          selectedModalities={selectedChips}
          maxCount={MAX_MODALITIES}
          loading={loading}
          disabled={busy}
          onToggle={toggleModality}
          onRetry={() => void loadCatalog()}
          scrollMaxHeight="min(260px, 38dvh)"
        />

        <p className="student-modalities-dialog__note">
          O aluno precisa manter pelo menos 1 modalidade e pode praticar até 3 esportes simultaneamente. Modalidades com rotina ativa ou turma vinculada permanecem bloqueadas para remoção até serem desvinculadas.
        </p>

        {selectedIds.length === 0 && (
          <p className="workspace-dialog__error" role="alert">
            Selecione pelo menos 1 modalidade esportiva para salvar.
          </p>
        )}

        {error && (
          <p className="workspace-dialog__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </WorkspaceDialog>
  );
}
