import { useState } from "react";
import toast from "react-hot-toast";
import { metricaService } from "../../services/metricaService";
import type { MetricaResponseDTO } from "../../types/metric";
import { getMetricStudentCount } from "../../features/metrics/metricModel";
import WorkspaceDialog from "../WorkspaceDialog/WorkspaceDialog";
import Button from "../Button/Button";

interface MetricDeleteModalProps {
  metric: MetricaResponseDTO;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (deletedId: string) => void;
}

export default function MetricDeleteModal({
  metric,
  isOpen,
  onClose,
  onSuccess,
}: MetricDeleteModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const studentCount = getMetricStudentCount(metric);
  const hasHistory = metric.possuiHistorico ?? (studentCount > 0);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const res = await metricaService.excluirMetrica(metric.id);
      toast.success(res.mensagem || (hasHistory ? "Métrica descontinuada com sucesso." : "Métrica excluída com sucesso."));
      onSuccess(metric.id);
      onClose();
    } catch {
      toast.error("Ocorreu um erro ao excluir/descontinuar a métrica.");
    } finally {
      setSubmitting(false);
    }
  }

  const description = hasHistory
    ? "Esta métrica possui registros. Ela deixará de aparecer em novas sessões e será marcada como “métrica descontinuada”. O histórico permanece visível no dashboard do aluno."
    : "Esta métrica não possui registros e será excluída permanentemente. Deseja continuar?";

  return (
    <WorkspaceDialog
      title={hasHistory ? `Descontinuar “${metric.titulo}”?` : `Excluir “${metric.titulo}”?`}
      description={description}
      tone="danger"
      busy={submitting}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" loading={submitting} onClick={handleConfirm}>
            {submitting ? "Processando..." : hasHistory ? "Descontinuar métrica" : "Excluir métrica"}
          </Button>
        </>
      }
    />
  );
}
