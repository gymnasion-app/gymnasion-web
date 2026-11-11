// src/components/SessionCorrectionModal/SessionCorrectionModal.tsx
import { useState } from "react";
import toast from "react-hot-toast";
import { Wrench, Shield, X } from "lucide-react";
import Button from "../Button/Button";
import FormField from "../FormField/FormField";
import { sessionDetailService } from "../../services/sessionDetailService";
import { authError } from "../../utils/authError";
import type { DesempenhoDetalheResponse } from "../../types/sessionDetail";
import "./SessionCorrectionModal.css";

interface SessionCorrectionModalProps {
  session: DesempenhoDetalheResponse;
  studentName: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function SessionCorrectionModal({
  session,
  studentName,
  onClose,
  onSaved,
}: SessionCorrectionModalProps) {
  const [dataReal, setDataReal] = useState(session.dataReal || session.dataPlanejada);
  const [observacoes, setObservacoes] = useState(session.observacoes || "");
  const [metricValues, setMetricValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    session.metricas.forEach((m) => {
      initial[m.metricaId] = m.valor || "";
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const metricasPayload = session.metricas
        .filter((m) => m.correcaoPermitida || m.inclusaoPermitida)
        .map((m) => ({
          metricaId: m.metricaId,
          valor: (metricValues[m.metricaId] || "").trim(),
        }))
        .filter((m) => m.valor.length > 0);

      await sessionDetailService.corrigirDesempenho(session.sessaoId, {
        dataReal: dataReal || undefined,
        observacoes: observacoes.trim() || undefined,
        metricas: metricasPayload,
      });

      toast.success("Registro de desempenho corrigido com sucesso!");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(authError(err, "Erro ao salvar a correção do registro.").message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="correction-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="correction-modal" onClick={(e) => e.stopPropagation()}>
        <header className="correction-modal__header">
          <div className="correction-modal__icon">
            <Wrench size={22} color="#ea580c" />
          </div>
          <div className="correction-modal__title-group">
            <h2>Corrigir registro de desempenho</h2>
            <p>
              {studentName} · Sessão {session.semana} · Auditoria de alterações
            </p>
          </div>
          <button className="correction-modal__close" onClick={onClose} aria-label="Fechar modal">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSave}>
          <div className="correction-modal__body">
            <div className="correction-modal__field-group">
              <FormField
                id="corr-data-real"
                label="Data real de execução"
                type="date"
                value={dataReal}
                onChange={(e) => setDataReal(e.target.value)}
                hint={`Data planejada original: ${session.dataPlanejada} (preservada)`}
                required
              />
            </div>

            <div className="correction-modal__metrics-section">
              <h3>Métricas e resultados</h3>
              <p className="correction-modal__subtitle">
                Corrija os valores registrados ou preencha as métricas pendentes do personal.
              </p>

              <div className="correction-modal__metrics-list">
                {session.metricas.map((m) => (
                  <div key={m.metricaId} className="correction-modal__metric-item">
                    <FormField
                      id={`metric-${m.metricaId}`}
                      label={`${m.titulo}${m.obrigatoria ? " *" : " (Opcional)"}`}
                      hint={`Tipo: ${m.tipo} · ${m.obrigatoria ? "Obrigatória" : "Opcional"} · ${
                        m.quemPreenche === "PERSONAL"
                          ? "Exclusiva do personal"
                          : m.quemPreenche === "ALUNO"
                          ? "Preenchimento do aluno"
                          : "Ambos preenchem"
                      }${
                        !m.correcaoPermitida && !m.inclusaoPermitida
                          ? " (métrica opcional não preenchida pelo aluno)"
                          : ""
                      }`}
                      value={metricValues[m.metricaId] ?? ""}
                      onChange={(e) =>
                        setMetricValues((prev) => ({
                          ...prev,
                          [m.metricaId]: e.target.value,
                        }))
                      }
                      placeholder={
                        m.tipo === "TEMPO"
                          ? "mm:ss ou hh:mm:ss (ex.: 01:42 ou 01:15:30)"
                          : m.tipo === "FREQUENCIA_CARDIACA"
                          ? "Entre 30 e 250 bpm"
                          : "Informe o valor"
                      }
                      disabled={!m.correcaoPermitida && !m.inclusaoPermitida}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="correction-modal__field-group">
              <label htmlFor="corr-obs" className="correction-modal__label">
                Observações do desempenho
              </label>
              <textarea
                id="corr-obs"
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Insira correções ou novas observações técnicas..."
                className="correction-modal__textarea"
              />
            </div>
          </div>

          <footer className="correction-modal__footer">
            <div className="correction-modal__compliance">
              <Shield size={16} />
              <span>
                Todas as alterações geram histórico de auditoria com valor anterior e novo valor.
              </span>
            </div>
            <div className="correction-modal__actions">
              <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" loading={loading}>
                Salvar correção
              </Button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
