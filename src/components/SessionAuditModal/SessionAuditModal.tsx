// src/components/SessionAuditModal/SessionAuditModal.tsx
import { useEffect, useState } from "react";
import { History, X } from "lucide-react";
import Button from "../Button/Button";
import Badge from "../Badge/Badge";
import { sessionDetailService } from "../../services/sessionDetailService";
import type { AuditoriaDesempenhoItem } from "../../types/sessionDetail";
import "./SessionAuditModal.css";

interface SessionAuditModalProps {
  sessionId: string;
  onClose: () => void;
}

export default function SessionAuditModal({ sessionId, onClose }: SessionAuditModalProps) {
  const [items, setItems] = useState<AuditoriaDesempenhoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await sessionDetailService.consultarAuditoria(sessionId);
        if (active) setItems(data);
      } catch {
        if (active) setError("Não foi possível carregar o histórico de alterações.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [sessionId]);

  const formatDateTime = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="audit-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="audit-modal" onClick={(e) => e.stopPropagation()}>
        <header className="audit-modal__header">
          <div className="audit-modal__icon">
            <History size={22} color="#0284c7" />
          </div>
          <div className="audit-modal__title-group">
            <h2>Histórico de alterações</h2>
            <p>Registro de auditoria e correções de desempenho (US-23 C5)</p>
          </div>
          <button className="audit-modal__close" onClick={onClose} aria-label="Fechar modal">
            <X size={20} />
          </button>
        </header>

        <div className="audit-modal__body">
          {loading ? (
            <div className="audit-modal__loading">Carregando auditoria...</div>
          ) : error ? (
            <div className="audit-modal__empty error">{error}</div>
          ) : items.length === 0 ? (
            <div className="audit-modal__empty">
              Nenhuma alteração ou correção registrada para este treino.
            </div>
          ) : (
            <div className="audit-modal__timeline">
              {items.map((item) => (
                <div key={item.id} className="audit-modal__card">
                  <div className="audit-modal__card-top">
                    <Badge tone={(item.tipoAlteracao || item.tipoOperacao) === "INCLUSAO" ? "success" : "warning"}>
                      {(item.tipoAlteracao || item.tipoOperacao) === "INCLUSAO" ? "Inclusão" : "Correção"}
                    </Badge>
                    <span className="audit-modal__date">{formatDateTime(item.dataHoraAlteracao || item.dataHora)}</span>
                  </div>

                  <div className="audit-modal__card-field">
                    <strong>Campo: </strong>
                    <span>
                      {item.campo === "METRICA"
                        ? item.metricaTitulo || item.tituloMetrica || "Métrica"
                        : item.campo === "DATA_REAL"
                        ? "Data real de execução"
                        : "Observações"}
                    </span>
                  </div>

                  <div className="audit-modal__diff">
                    {item.valorAnterior && (
                      <div className="audit-modal__diff-prev">
                        <span>Valor anterior:</span>
                        <code>{item.valorAnterior}</code>
                      </div>
                    )}
                    <div className="audit-modal__diff-next">
                      <span>{item.valorAnterior ? "Novo valor:" : "Valor informado:"}</span>
                      <code>{item.valorNovo}</code>
                    </div>
                  </div>

                  <div className="audit-modal__author">
                    <span>Alterado por: </span>
                    <strong>{item.responsavelNome || item.nomeUsuario}</strong>
                    {item.responsavelRole && (
                      <span className="audit-modal__role" style={{ marginLeft: "6px", color: "var(--color-text-muted, #64748b)", fontSize: "0.8125rem" }}>
                        ({item.responsavelRole.includes("PERSONAL") ? "Personal Trainer" : "Aluno"})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="audit-modal__footer">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </footer>
      </div>
    </div>
  );
}
