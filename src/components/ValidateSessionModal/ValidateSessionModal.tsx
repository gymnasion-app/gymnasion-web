// src/components/ValidateSessionModal/ValidateSessionModal.tsx
import { useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Shield, AlertCircle, X } from "lucide-react";
import Button from "../Button/Button";
import Checkbox from "../Checkbox/Checkbox";
import Badge from "../Badge/Badge";
import { sessionDetailService } from "../../services/sessionDetailService";
import { authError } from "../../utils/authError";
import { formatMetricDisplayValue } from "../../utils/metricValueFormat";
import type { DesempenhoDetalheResponse } from "../../types/sessionDetail";
import "./ValidateSessionModal.css";

interface ValidateSessionModalProps {
  session: DesempenhoDetalheResponse;
  studentName: string;
  onClose: () => void;
  onValidated: () => void;
}

export default function ValidateSessionModal({
  session,
  studentName,
  onClose,
  onValidated,
}: ValidateSessionModalProps) {
  const [feedback, setFeedback] = useState("");
  const [notifyStudent, setNotifyStudent] = useState(true);
  const [loading, setLoading] = useState(false);

  const pendingCount = session.metricas.filter(
    (m) => m.inclusaoPermitida && !m.valor && (m.quemPreenche === "PERSONAL" || m.obrigatoria)
  ).length;

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    if (!d) return iso;
    return `${d}/${m}/${y}`;
  };

  const handleValidate = async () => {
    setLoading(true);
    try {
      // 1. Valida a execução
      await sessionDetailService.validarExecucao(session.sessaoId);

      // 2. Se houver feedback digitado, registra na US-26
      if (feedback.trim()) {
        try {
          await sessionDetailService.enviarFeedback(session.alunoId, feedback.trim());
        } catch {
          // O feedback é opcional, a validação principal ocorreu com sucesso
        }
      }

      toast.success(
        `Execução validada · A sessão de ${studentName} foi validada${notifyStudent ? " e a notificação foi enviada" : ""}.`
      );
      onValidated();
      onClose();
    } catch (err) {
      toast.error(authError(err, "Não foi possível validar a execução.").message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="validate-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="validate-modal" onClick={(e) => e.stopPropagation()}>
        <header className="validate-modal__header">
          <div className="validate-modal__icon">
            <CheckCircle2 size={24} color="#EA580C" />
          </div>
          <div className="validate-modal__title-group">
            <h2>Validar execução da sessão</h2>
            <p>
              {studentName} · Sessão {session.semana} · {session.rotinaTitulo || "Treino"}
            </p>
          </div>
          <button className="validate-modal__close" onClick={onClose} aria-label="Fechar modal">
            <X size={20} />
          </button>
        </header>

        <div className="validate-modal__body">
          <div className="validate-modal__summary-table">
            <div className="validate-modal__row">
              <span className="validate-modal__label">Data planejada</span>
              <strong className="validate-modal__value">{formatDate(session.dataPlanejada)}</strong>
            </div>
            <div className="validate-modal__row">
              <span className="validate-modal__label">Data real da execução</span>
              <strong className="validate-modal__value">{formatDate(session.dataReal)}</strong>
            </div>

            {session.metricas.map((m) => {
              const isPersonalPending =
                m.inclusaoPermitida && !m.valor && (m.quemPreenche === "PERSONAL" || m.obrigatoria);
              return (
                <div key={m.metricaId} className="validate-modal__row">
                  <span className="validate-modal__label">
                    {m.titulo} ({m.obrigatoria ? "Obrigatória" : "Opcional"})
                  </span>
                  {m.valor ? (
                    <strong className="validate-modal__value">
                      {formatMetricDisplayValue(m.valor, m.tipo, m.unidade)}
                    </strong>
                  ) : isPersonalPending ? (
                    <Badge tone="warning">Pendente · personal</Badge>
                  ) : (
                    <Badge tone="neutral">Não informada (opcional)</Badge>
                  )}
                </div>
              );
            })}

            {session.nivelCansaco !== null && session.nivelCansaco !== undefined && (
              <div className="validate-modal__row">
                <span className="validate-modal__label">Esforço percebido (RPE)</span>
                <strong className="validate-modal__value">{session.nivelCansaco} /10</strong>
              </div>
            )}
          </div>

          {pendingCount > 0 && (
            <div className="validate-modal__alert" role="status">
              <AlertCircle size={20} className="validate-modal__alert-icon" />
              <p>
                Há {pendingCount} métrica sua pendente. Você pode validar agora e preenchê-la depois — a
                pendência continua no perfil e nas notificações.
              </p>
            </div>
          )}

          <div className="validate-modal__feedback-group">
            <label htmlFor="validate-feedback">Feedback (opcional)</label>
            <textarea
              id="validate-feedback"
              rows={3}
              placeholder="Ótimo ritmo na série principal! Vamos observar o ombro na próxima sessão."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
            <span className="validate-modal__hint">Fica registrado nas observações e feedbacks do treino</span>
          </div>

          <div className="validate-modal__notify">
            <Checkbox
              label="Enviar notificação sobre a validação"
              checked={notifyStudent}
              onChange={(e) => setNotifyStudent(e.target.checked)}
            />
          </div>
        </div>

        <footer className="validate-modal__footer">
          <div className="validate-modal__footer-compliance">
            <Shield size={16} />
            <span>
              Registrado em seu nome, com data e hora. O registro original do aluno não é alterado.
            </span>
          </div>
          <div className="validate-modal__footer-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={handleValidate} loading={loading}>
              Validar execução
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
