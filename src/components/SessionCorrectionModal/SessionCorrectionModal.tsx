// src/components/SessionCorrectionModal/SessionCorrectionModal.tsx
import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Wrench, Shield, X } from "lucide-react";
import Button from "../Button/Button";
import FormField from "../FormField/FormField";
import MetricValueInput from "../MetricValueInput/MetricValueInput";
import { sessionDetailService } from "../../services/sessionDetailService";
import { authError } from "../../utils/authError";
import {
  normalizeMetricInput,
  normalizeTipo,
  validateMetricValue,
} from "../../utils/metricValueFormat";
import type { DesempenhoDetalheResponse } from "../../types/sessionDetail";
import "./SessionCorrectionModal.css";

interface SessionCorrectionModalProps {
  session: DesempenhoDetalheResponse;
  studentName: string;
  onClose: () => void;
  onSaved: () => void;
}

function metricUnitOrFallback(tipo: string, unidade?: string | null): string {
  if (unidade?.trim()) return unidade.trim();
  switch (normalizeTipo(tipo)) {
    case "TEMPO":
      return "Tempo";
    case "FREQUENCIA_CARDIACA":
      return "bpm";
    case "TEXTO":
      return "Texto";
    default:
      return "Sem unidade";
  }
}

export default function SessionCorrectionModal({
  session,
  studentName,
  onClose,
  onSaved,
}: SessionCorrectionModalProps) {
  const initialDataReal = session.dataReal || session.dataPlanejada;
  const initialDuracao = session.duracao != null && session.duracao > 0 ? String(session.duracao) : "";
  const initialObservacoes = session.observacoes || "";

  const [initialNormalizedValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const m of session.metricas) {
      if (m.valor && m.valor.trim()) {
        const parseErr = validateMetricValue(m.tipo, m.valor, m.unidade, m.campoStrava);
        if (!parseErr) {
          map[m.metricaId] = normalizeMetricInput(m.tipo, m.valor, m.unidade, m.campoStrava);
        } else {
          map[m.metricaId] = "";
        }
      } else {
        map[m.metricaId] = "";
      }
    }
    return map;
  });

  const [legacyUnparseable] = useState<Record<string, string>>(() => {
    const legacy: Record<string, string> = {};
    for (const m of session.metricas) {
      if (m.valor && m.valor.trim()) {
        const parseErr = validateMetricValue(m.tipo, m.valor, m.unidade, m.campoStrava);
        if (parseErr) {
          legacy[m.metricaId] = m.valor;
        }
      }
    }
    return legacy;
  });

  const [dataReal, setDataReal] = useState(initialDataReal);
  const [duracao, setDuracao] = useState(initialDuracao);
  const [observacoes, setObservacoes] = useState(initialObservacoes);
  const [limparObservacoes, setLimparObservacoes] = useState(false);
  const [metricValues, setMetricValues] = useState<Record<string, string>>(() => ({
    ...initialNormalizedValues,
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const nextErrors: Record<string, string> = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataReal)) {
      nextErrors.dataReal = "Informe uma data real válida.";
    }

    const duracaoTrimmed = duracao.trim();
    if (duracaoTrimmed) {
      const durNum = Number(duracaoTrimmed);
      if (!/^\d+$/.test(duracaoTrimmed) || durNum < 1 || durNum > 1440) {
        nextErrors.duracao = "A duração deve ser um número inteiro entre 1 e 1440 minutos.";
      }
    }

    const obsTrimmed = observacoes.trim();
    if (!limparObservacoes && initialObservacoes.trim() && !obsTrimmed) {
      nextErrors.observacoes =
        "Para remover as observações existentes, marque a opção 'Limpar observações'.";
    }

    const metricasPayload: Array<{ metricaId: string; valor: string }> = [];
    for (const m of session.metricas) {
      if (!m.correcaoPermitida && !m.inclusaoPermitida) continue;
      const rawVal = (metricValues[m.metricaId] || "").trim();
      if (!rawVal) continue;

      const valErr = validateMetricValue(m.tipo, rawVal, m.unidade, m.campoStrava);
      if (valErr) {
        nextErrors[m.metricaId] = valErr;
        continue;
      }

      const normalizedNew = normalizeMetricInput(m.tipo, rawVal, m.unidade, m.campoStrava);
      if (normalizedNew !== (initialNormalizedValues[m.metricaId] || "")) {
        metricasPayload.push({
          metricaId: m.metricaId,
          valor: normalizedNew,
        });
      }
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const dataRealPayload = dataReal !== session.dataReal ? dataReal : undefined;
      const duracaoPayload =
        duracaoTrimmed && duracaoTrimmed !== initialDuracao ? Number(duracaoTrimmed) : undefined;
      const observacoesPayload = limparObservacoes
        ? ""
        : obsTrimmed !== initialObservacoes.trim()
        ? obsTrimmed
        : undefined;

      await sessionDetailService.corrigirDesempenho(session.sessaoId, {
        dataReal: dataRealPayload,
        duracao: duracaoPayload,
        observacoes: observacoesPayload,
        metricas: metricasPayload,
      });

      toast.success("Registro de desempenho corrigido com sucesso!");
      onSaved();
      onClose();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.invalidFields) {
        setFieldErrors(err.response.data.invalidFields as Record<string, string>);
      }
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
          <button
            type="button"
            className="correction-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSave} noValidate>
          <div className="correction-modal__body">
            <div className="correction-modal__row-2">
              <div className="correction-modal__field-group">
                <FormField
                  id="corr-data-real"
                  label="Data real de execução"
                  type="date"
                  value={dataReal}
                  onChange={(e) => {
                    setDataReal(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, dataReal: "" }));
                  }}
                  error={fieldErrors.dataReal}
                  hint={`Data planejada original: ${session.dataPlanejada} (preservada)`}
                  required
                />
              </div>

              <div className="correction-modal__field-group">
                <FormField
                  id="corr-duracao"
                  label="Duração real (minutos)"
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  placeholder="Ex.: 45"
                  value={duracao}
                  onChange={(e) => {
                    setDuracao(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, duracao: "" }));
                  }}
                  error={fieldErrors.duracao}
                  hint="Entre 1 e 1440 minutos (deixe inalterado para manter)"
                />
              </div>
            </div>

            <div className="correction-modal__metrics-section">
              <h3>Métricas e resultados</h3>
              {session.metricas.length === 0 ? (
                <p className="correction-modal__subtitle">
                  Esta sessão foi executada sem métricas customizadas (apenas RPE e duração). Você
                  pode corrigir a data real, duração e observações abaixo.
                </p>
              ) : (
                <>
                  <p className="correction-modal__subtitle">
                    Apenas métricas modificadas ou recém-preenchidas são enviadas e auditadas.
                  </p>

                  <div className="correction-modal__metrics-list">
                    {session.metricas.map((m) => {
                      const canEdit = m.correcaoPermitida || m.inclusaoPermitida;
                      const fieldId = `corr-metric-${m.metricaId}`;
                      const fillerLabel =
                        m.quemPreenche === "PERSONAL"
                          ? "Exclusiva do personal"
                          : m.quemPreenche === "ALUNO"
                          ? "Preenchimento do aluno"
                          : "Ambos preenchem";

                      return (
                        <div key={m.metricaId} className="correction-modal__metric-item">
                          <div className="correction-modal__metric-header">
                            <label htmlFor={fieldId} className="correction-modal__metric-title">
                              {m.titulo}
                              {m.obrigatoria ? " *" : " (Opcional)"}
                            </label>
                            <span className="correction-modal__metric-unit">
                              {metricUnitOrFallback(m.tipo, m.unidade)}
                            </span>
                          </div>
                          <p className="correction-modal__metric-meta">
                            {m.obrigatoria ? "Obrigatória" : "Opcional"} · {fillerLabel}
                            {!canEdit ? " · edição bloqueada neste registro" : ""}
                          </p>

                          {legacyUnparseable[m.metricaId] && (
                            <div className="correction-modal__legacy-chip" role="note">
                              Valor legado registrado:{" "}
                              <code>{legacyUnparseable[m.metricaId]}</code> (digite no formato
                              atual abaixo se desejar corrigir)
                            </div>
                          )}

                          <MetricValueInput
                            id={fieldId}
                            ariaLabel={m.titulo}
                            value={metricValues[m.metricaId] ?? ""}
                            tipo={m.tipo}
                            unidade={m.unidade}
                            campoStrava={m.campoStrava}
                            disabled={!canEdit || loading}
                            error={fieldErrors[m.metricaId]}
                            onChange={(nextVal) => {
                              setMetricValues((prev) => ({
                                ...prev,
                                [m.metricaId]: nextVal,
                              }));
                              setFieldErrors((prev) => ({
                                ...prev,
                                [m.metricaId]: "",
                              }));
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="correction-modal__field-group">
              <div className="correction-modal__obs-head">
                <label htmlFor="corr-obs" className="correction-modal__label">
                  Observações do desempenho
                </label>
                {Boolean(initialObservacoes.trim()) && (
                  <label className="correction-modal__clear-toggle">
                    <input
                      type="checkbox"
                      checked={limparObservacoes}
                      onChange={(e) => {
                        setLimparObservacoes(e.target.checked);
                        setFieldErrors((prev) => ({ ...prev, observacoes: "" }));
                      }}
                    />
                    <span>Limpar observações</span>
                  </label>
                )}
              </div>
              <textarea
                id="corr-obs"
                rows={3}
                value={limparObservacoes ? "" : observacoes}
                disabled={limparObservacoes || loading}
                onChange={(e) => {
                  setObservacoes(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, observacoes: "" }));
                }}
                placeholder={
                  limparObservacoes
                    ? "As observações anteriores serão removidas ao salvar."
                    : "Insira correções ou novas observações técnicas..."
                }
                className="correction-modal__textarea"
              />
              {fieldErrors.observacoes && (
                <p className="correction-modal__field-error" role="alert">
                  {fieldErrors.observacoes}
                </p>
              )}
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
