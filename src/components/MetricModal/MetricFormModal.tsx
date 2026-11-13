import { useEffect, useRef, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { metricaService } from "../../services/metricaService";
import type {
  MetricaResponseDTO,
  ResponsavelPreenchimento,
  TipoMetrica,
} from "../../types/metric";
import {
  CampoStrava,
  CampoStravaGrupo,
  CAMPO_STRAVA_OPTIONS,
} from "../../types/strava";
import type { ModalidadeResponseDTO } from "../../types/modalidade";
import {
  METRIC_TYPE_OPTIONS,
  getMetricStudentCount,
  isMetricDuplicate,
  normalizeTipo,
  toBackendTipoMetrica,
} from "../../features/metrics/metricModel";
import {
  UNIT_OPTIONS_BY_TIPO,
  defaultUnidadeForTipo,
  isCampoStravaCompatible,
  isUnidadeValida,
  sugerirTipoEUnidade,
} from "../../utils/metricValueFormat";
import "./MetricFormModal.css";

const CAMPO_STRAVA_GRUPOS: CampoStravaGrupo[] = [
  "Preenchimento manual",
  "Distância e Altimetria",
  "Tempo e Duração",
  "Ritmo e Velocidade",
  "Frequência Cardíaca",
  "Cadência e Potência",
  "Energia",
];

function resolveInitialUnidade(tipoValue: string, currentUnidade?: string | null): string {
  const norm = normalizeTipo(tipoValue);
  if (norm === "TEXTO") return "";
  if (norm === "FREQUENCIA_CARDIACA") return "bpm";
  if (norm === "TEMPO") {
    return currentUnidade && isUnidadeValida("TEMPO", currentUnidade)
      ? currentUnidade
      : (defaultUnidadeForTipo("TEMPO") ?? "mm:ss");
  }
  return currentUnidade && isUnidadeValida("NUMERICO", currentUnidade) ? currentUnidade : "";
}

interface MetricFormModalProps {
  mode: "create" | "edit";
  isOpen: boolean;
  onClose: () => void;
  modalidades: ModalidadeResponseDTO[];
  defaultModalidadeId?: number | null;
  existingMetrics: MetricaResponseDTO[];
  metricToEdit?: MetricaResponseDTO | null;
  templateMetric?: MetricaResponseDTO | null;
  onSuccess: (metric: MetricaResponseDTO) => void;
}

export default function MetricFormModal({
  mode,
  isOpen,
  onClose,
  modalidades,
  defaultModalidadeId,
  existingMetrics,
  metricToEdit,
  templateMetric,
  onSuccess,
}: MetricFormModalProps) {
  const isEdit = mode === "edit" && Boolean(metricToEdit);
  const sourceMetric = isEdit ? metricToEdit : templateMetric;

  // Form states
  const [modalidadeId, setModalidadeId] = useState<number>(() => {
    if (isEdit && metricToEdit) return metricToEdit.modalidadeId;
    if (templateMetric) {
      if (templateMetric.id) {
        const otherMod = modalidades.find((m) => m.id !== templateMetric.modalidadeId);
        return otherMod?.id || templateMetric.modalidadeId;
      }
      return templateMetric.modalidadeId;
    }
    if (defaultModalidadeId) return defaultModalidadeId;
    return modalidades[0]?.id || 1;
  });

  const [titulo, setTitulo] = useState<string>(() => {
    return sourceMetric ? sourceMetric.titulo : "";
  });

  const [tipo, setTipo] = useState<TipoMetrica>(() => {
    if (sourceMetric) return normalizeTipo(sourceMetric.tipo);
    return "TEMPO";
  });

  const [unidade, setUnidade] = useState<string>(() => {
    const initialTipo = sourceMetric ? normalizeTipo(sourceMetric.tipo) : "TEMPO";
    return resolveInitialUnidade(initialTipo, sourceMetric?.unidade);
  });

  const [obrigatoria, setObrigatoria] = useState<boolean>(() => {
    if (sourceMetric) return sourceMetric.obrigatoria !== false;
    return true;
  });

  const [quemPreenche, setQuemPreenche] = useState<ResponsavelPreenchimento>(() => {
    if (sourceMetric && sourceMetric.quemPreenche) {
      return sourceMetric.quemPreenche;
    }
    return "AMBOS";
  });

  const [campoStrava, setCampoStrava] = useState<CampoStrava>(() => {
    return sourceMetric?.campoStrava ? sourceMetric.campoStrava : "NENHUM";
  });

  const [autoAppliedNotice, setAutoAppliedNotice] = useState<{
    campoLabel: string;
    tipoLabel: string;
    unidadeLabel: string;
  } | null>(null);
  const [confirmStravaChange, setConfirmStravaChange] = useState<boolean>(false);
  const [stravaConfirmError, setStravaConfirmError] = useState<string>("");

  const [titleError, setTitleError] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const unidadeSelectRef = useRef<HTMLSelectElement | null>(null);

  // Student records count / backend history flag for edit lock
  const studentCount = isEdit && metricToEdit ? getMetricStudentCount(metricToEdit) : 0;
  const isTypeLocked = isEdit && Boolean(metricToEdit?.possuiHistorico ?? (studentCount > 0));
  const originalCampoStrava: CampoStrava =
    isEdit && metricToEdit?.campoStrava ? metricToEdit.campoStrava : "NENHUM";
  const stravaChangedWithHistory = isTypeLocked && campoStrava !== originalCampoStrava;
  const normalizedTipo = normalizeTipo(tipo);
  const unitOptions = UNIT_OPTIONS_BY_TIPO[normalizedTipo];
  const selectedCampoOption = CAMPO_STRAVA_OPTIONS.find((opt) => opt.value === (campoStrava || "NENHUM"));

  // Sync state when modal opens or editing metric changes
  useEffect(() => {
    if (isOpen) {
      if (isEdit && metricToEdit) {
        const nextTipo = normalizeTipo(metricToEdit.tipo);
        setModalidadeId(metricToEdit.modalidadeId);
        setTitulo(metricToEdit.titulo);
        setTipo(nextTipo);
        setUnidade(resolveInitialUnidade(nextTipo, metricToEdit.unidade));
        setObrigatoria(metricToEdit.obrigatoria !== false);
        setQuemPreenche(metricToEdit.quemPreenche || "AMBOS");
        setCampoStrava(metricToEdit.campoStrava || "NENHUM");
      } else if (templateMetric) {
        const nextTipo = normalizeTipo(templateMetric.tipo);
        if (templateMetric.id) {
          const otherMod = modalidades.find((m) => m.id !== templateMetric.modalidadeId);
          setModalidadeId(otherMod?.id || templateMetric.modalidadeId);
        } else {
          setModalidadeId(templateMetric.modalidadeId);
        }
        setTitulo(templateMetric.titulo);
        setTipo(nextTipo);
        setUnidade(resolveInitialUnidade(nextTipo, templateMetric.unidade));
        setObrigatoria(templateMetric.obrigatoria !== false);
        setQuemPreenche(templateMetric.quemPreenche || "AMBOS");
        setCampoStrava(templateMetric.campoStrava || "NENHUM");
      } else {
        setModalidadeId(defaultModalidadeId || modalidades[0]?.id || 1);
        setTitulo("");
        setTipo("TEMPO");
        setUnidade(defaultUnidadeForTipo("TEMPO") ?? "mm:ss");
        setObrigatoria(true);
        setQuemPreenche("AMBOS");
        setCampoStrava("NENHUM");
      }
      setAutoAppliedNotice(null);
      setConfirmStravaChange(false);
      setStravaConfirmError("");
      setTitleError("");
    }
  }, [isOpen, isEdit, metricToEdit, templateMetric, defaultModalidadeId, modalidades]);

  const handleTipoChange = (newTipo: TipoMetrica) => {
    if (isTypeLocked) return;
    const nextNorm = normalizeTipo(newTipo);
    const nextUnidade = resolveInitialUnidade(nextNorm, nextNorm === normalizedTipo ? unidade : null);
    setTipo(nextNorm);
    setUnidade(nextUnidade);
    setAutoAppliedNotice(null);
    if (campoStrava !== "NENHUM" && !isCampoStravaCompatible(campoStrava, nextNorm, nextUnidade || null)) {
      setCampoStrava("NENHUM");
    }
  };

  const handleUnidadeChange = (nextUnidade: string) => {
    if (isTypeLocked) return;
    setUnidade(nextUnidade);
    setAutoAppliedNotice(null);
    if (campoStrava !== "NENHUM" && !isCampoStravaCompatible(campoStrava, normalizedTipo, nextUnidade || null)) {
      setCampoStrava("NENHUM");
    }
  };

  const handleCampoStravaChange = (nextCampo: CampoStrava) => {
    setCampoStrava(nextCampo);
    setConfirmStravaChange(false);
    setStravaConfirmError("");

    if (isTypeLocked) {
      return;
    }

    if (nextCampo === "NENHUM") {
      setAutoAppliedNotice(null);
      return;
    }

    const activeModName = modalidades.find((m) => m.id === modalidadeId)?.nome;
    const suggestion = sugerirTipoEUnidade(nextCampo, activeModName);
    if (suggestion) {
      const nextUnidade = suggestion.unidade ?? "";
      setTipo(suggestion.tipo);
      setUnidade(nextUnidade);
      const nextOpt = CAMPO_STRAVA_OPTIONS.find((opt) => opt.value === nextCampo);
      const tipoOpt = METRIC_TYPE_OPTIONS.find((opt) => opt.value === suggestion.tipo);
      setAutoAppliedNotice({
        campoLabel: nextOpt?.label ?? nextCampo,
        tipoLabel: tipoOpt?.title ?? suggestion.tipo,
        unidadeLabel: nextUnidade || "Sem unidade",
      });
    }
  };

  // Keyboard shortcut: Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !submitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const currentModalityName =
    modalidades.find((m) => m.id === modalidadeId)?.nome ||
    metricToEdit?.nomeModalidade ||
    "Modalidade";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTitleError("");

    const cleanTitle = titulo.trim();
    if (!cleanTitle) {
      setTitleError("Informe o título da métrica.");
      return;
    }

    // Client-side uniqueness check (RN-016)
    const isDup = isMetricDuplicate(
      cleanTitle,
      modalidadeId,
      existingMetrics,
      isEdit && metricToEdit ? metricToEdit.id : undefined
    );

    if (isDup) {
      setTitleError("Já existe uma métrica com esse nome nessa modalidade.");
      return;
    }

    if (stravaChangedWithHistory && !confirmStravaChange) {
      setStravaConfirmError(
        "Confirme a alteração do vínculo Strava em uma métrica com histórico antes de salvar."
      );
      return;
    }

    setSubmitting(true);
    const backendTipo = toBackendTipoMetrica(normalizedTipo);
    const normalizedUnidade =
      normalizedTipo === "TEXTO" ? null : unidade.trim() ? unidade.trim() : null;
    const campoStravaPayload: CampoStrava = campoStrava || "NENHUM";
    const resolvedCampoStrava = campoStravaPayload === "NENHUM" ? null : campoStravaPayload;
    try {
      if (isEdit && metricToEdit) {
        const updated = await metricaService.atualizarMetrica(metricToEdit.id, {
          titulo: cleanTitle,
          tipo: isTypeLocked ? toBackendTipoMetrica(metricToEdit.tipo) : backendTipo,
          unidade: isTypeLocked
            ? metricToEdit.unidade ?? undefined
            : normalizedUnidade ?? "",
          obrigatoria,
          quemPreenche,
          campoStrava: campoStravaPayload,
        });
        toast.success("Métrica atualizada com sucesso!");
        onSuccess({
          ...metricToEdit,
          ...updated,
          titulo: cleanTitle,
          tipo: isTypeLocked ? metricToEdit.tipo : backendTipo,
          unidade:
            updated.unidade !== undefined
              ? updated.unidade
              : isTypeLocked
              ? metricToEdit.unidade ?? null
              : normalizedUnidade,
          obrigatoria,
          quemPreenche,
          campoStrava: updated.campoStrava !== undefined ? updated.campoStrava : resolvedCampoStrava,
          modalidadeId,
          nomeModalidade: currentModalityName,
        });
      } else {
        const created = await metricaService.criarMetrica({
          modalidadeId,
          titulo: cleanTitle,
          tipo: backendTipo,
          unidade: normalizedUnidade,
          obrigatoria,
          quemPreenche,
          campoStrava: campoStravaPayload,
        });
        toast.success("Métrica cadastrada com sucesso!");
        onSuccess({
          ...created,
          titulo: cleanTitle,
          tipo: backendTipo,
          unidade: created.unidade !== undefined ? created.unidade : normalizedUnidade,
          obrigatoria,
          quemPreenche,
          campoStrava: created.campoStrava !== undefined ? created.campoStrava : resolvedCampoStrava,
          modalidadeId,
          nomeModalidade: currentModalityName,
          possuiHistorico: false,
          quantidadeAlunosComRegistros: 0,
          ativo: true,
        });
      }
      onClose();
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { detail?: string; invalidFields?: Record<string, string> } } };
      if (errorObj?.response?.status === 409) {
        setTitleError("Já existe uma métrica com esse nome nessa modalidade.");
      } else if (errorObj?.response?.data?.invalidFields?.titulo) {
        setTitleError(errorObj.response.data.invalidFields.titulo);
      } else if (errorObj?.response?.data?.detail) {
        setTitleError(errorObj.response.data.detail);
      } else {
        toast.error("Ocorreu um erro ao salvar a métrica.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="metric-form-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="metric-form-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="metric-form-modal">
        <button
          type="button"
          className="metric-form-modal__close"
          aria-label="Fechar"
          onClick={onClose}
          disabled={submitting}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="metric-form-modal__header">
          <div className="metric-form-modal__icon-wrap">
            {isEdit ? (
              // Pencil icon
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            ) : (
              // Activity / pulse icon
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            )}
          </div>
          <div className="metric-form-modal__title-area">
            <h3 id="metric-form-title" className="metric-form-modal__title">
              {isEdit ? "Editar métrica" : "Criar métrica"}
            </h3>
            <p className="metric-form-modal__subtitle">
              {isEdit
                ? `${metricToEdit?.titulo} · ${currentModalityName} · ${studentCount} ${
                    studentCount === 1 ? "aluno com registros" : "alunos com registros"
                  }`
                : "O campo ficará disponível no registro de desempenho dos alunos da modalidade."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* Modalidade (shown in Create mode) */}
          {!isEdit && (
            <div className="metric-form-modal__field">
              <label htmlFor="metric-modalidade-select" className="metric-form-modal__label">
                Modalidade
              </label>
              <select
                id="metric-modalidade-select"
                className="metric-form-modal__select"
                value={modalidadeId}
                onChange={(e) => {
                  setModalidadeId(Number(e.target.value));
                  setTitleError("");
                }}
                disabled={submitting}
              >
                {modalidades.map((mod) => (
                  <option key={mod.id} value={mod.id}>
                    {mod.nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Título da métrica */}
          <div className="metric-form-modal__field">
            <label htmlFor="metric-titulo-input" className="metric-form-modal__label">
              Título da métrica
            </label>
            <input
              id="metric-titulo-input"
              type="text"
              className={`metric-form-modal__input ${titleError ? "is-error" : ""}`}
              placeholder="Tempo de virada"
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                if (titleError) setTitleError("");
              }}
              disabled={submitting}
              maxLength={100}
              autoFocus
            />
            {titleError && (
              <p className="metric-form-modal__error-msg">{titleError}</p>
            )}
          </div>

          {/* Lock warning in Edit with history */}
          {isTypeLocked && (
            <div className="metric-form-modal__warning">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>
                Não é possível alterar o tipo ou a unidade de uma métrica com histórico de registros. Crie uma nova métrica.
              </span>
            </div>
          )}

          {/* Tipo de métrica (2x2 grid) */}
          <div className="metric-form-modal__field">
            <label className="metric-form-modal__label">Tipo de métrica</label>
            <div className="metric-form-modal__types-grid">
              {METRIC_TYPE_OPTIONS.map((opt) => {
                const normOpt = normalizeTipo(opt.value);
                const normCurrent = normalizeTipo(tipo);
                const isSelected = normOpt === normCurrent;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`metric-form-modal__type-card ${
                      isSelected ? "is-selected" : ""
                    } ${isTypeLocked ? "is-disabled" : ""}`}
                    onClick={() => {
                      if (!isTypeLocked) {
                        handleTipoChange(opt.value);
                      }
                    }}
                    disabled={isTypeLocked}
                  >
                    <div className="metric-form-modal__type-icon">
                      {normOpt === "NUMERICO" ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="4" y1="9" x2="20" y2="9" />
                          <line x1="4" y1="15" x2="20" y2="15" />
                          <line x1="10" y1="3" x2="8" y2="21" />
                          <line x1="16" y1="3" x2="14" y2="21" />
                        </svg>
                      ) : normOpt === "TEMPO" ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      ) : normOpt === "FREQUENCIA_CARDIACA" ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="21" y1="10" x2="3" y2="10" />
                          <line x1="21" y1="6" x2="3" y2="6" />
                          <line x1="21" y1="14" x2="3" y2="14" />
                          <line x1="21" y1="18" x2="3" y2="18" />
                        </svg>
                      )}
                    </div>
                    <div className="metric-form-modal__type-info">
                      <h4>{opt.title}</h4>
                      <p>{opt.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Obrigatoriedade */}
          <div className="metric-form-modal__field">
            <label className="metric-form-modal__label">Obrigatoriedade</label>
            <div className="metric-form-modal__segmented">
              <button
                type="button"
                className={`metric-form-modal__segment-btn ${
                  obrigatoria ? "is-selected" : ""
                }`}
                onClick={() => setObrigatoria(true)}
              >
                Obrigatória
              </button>
              <button
                type="button"
                className={`metric-form-modal__segment-btn ${
                  !obrigatoria ? "is-selected" : ""
                }`}
                onClick={() => setObrigatoria(false)}
              >
                Opcional
              </button>
            </div>
          </div>

          {/* Quem pode preencher */}
          <div className="metric-form-modal__field">
            <label className="metric-form-modal__label">Quem pode preencher</label>
            <div className="metric-form-modal__segmented">
              <button
                type="button"
                className={`metric-form-modal__segment-btn ${
                  quemPreenche === "ALUNO" ? "is-selected" : ""
                }`}
                onClick={() => setQuemPreenche("ALUNO")}
              >
                Aluno
              </button>
              <button
                type="button"
                className={`metric-form-modal__segment-btn ${
                  quemPreenche === "PERSONAL" ? "is-selected" : ""
                }`}
                onClick={() => setQuemPreenche("PERSONAL")}
              >
                Personal trainer
              </button>
              <button
                type="button"
                className={`metric-form-modal__segment-btn ${
                  quemPreenche === "AMBOS" ? "is-selected" : ""
                }`}
                onClick={() => setQuemPreenche("AMBOS")}
              >
                Aluno e personal
              </button>
            </div>
          </div>

          {/* Unidade de medida adaptativa por tipo */}
          <div className="metric-form-modal__field">
            <label htmlFor="metric-unidade-select" className="metric-form-modal__label">
              Unidade de medida
            </label>
            <select
              id="metric-unidade-select"
              ref={unidadeSelectRef}
              className="metric-form-modal__select"
              value={unidade}
              onChange={(e) => handleUnidadeChange(e.target.value)}
              disabled={isTypeLocked || submitting || unitOptions.length <= 1}
            >
              {unitOptions.map((opt) => (
                <option key={opt.value || "SEM_UNIDADE"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="metric-form-modal__helper">
              {normalizedTipo === "TEXTO"
                ? "Métricas de texto livre não utilizam unidade de medida."
                : normalizedTipo === "FREQUENCIA_CARDIACA"
                ? "Frequência cardíaca é sempre registrada em bpm."
                : normalizedTipo === "TEMPO"
                ? "Selecione cronômetro (mm:ss ou hh:mm:ss) ou formato de ritmo (pace)."
                : "Escolha a unidade ou mantenha Sem unidade para scores, escalas e RPE."}
            </p>
          </div>

          {/* Vínculo com o Strava (opcional) */}
          <div className="metric-form-modal__field">
            <label htmlFor="metric-strava-select" className="metric-form-modal__label">
              Vincular a dado do Strava (opcional)
            </label>
            <select
              id="metric-strava-select"
              className={`metric-form-modal__select ${stravaConfirmError ? "is-error" : ""}`}
              value={campoStrava || "NENHUM"}
              onChange={(e) => handleCampoStravaChange(e.target.value as CampoStrava)}
              disabled={submitting}
            >
              {CAMPO_STRAVA_GRUPOS.map((grupo) => {
                const opts = CAMPO_STRAVA_OPTIONS.filter((opt) => opt.group === grupo);
                if (opts.length === 0) return null;
                return (
                  <optgroup key={grupo} label={grupo}>
                    {opts.map((opt) => {
                      const compatible =
                        !isTypeLocked ||
                        isCampoStravaCompatible(opt.value, normalizedTipo, unidade || null);
                      return (
                        <option key={opt.value} value={opt.value} disabled={!compatible}>
                          {compatible ? opt.label : `${opt.label} (incompatível com tipo/unidade)`}
                        </option>
                      );
                    })}
                  </optgroup>
                );
              })}
            </select>
            {selectedCampoOption?.description && (
              <p className="metric-form-modal__helper">{selectedCampoOption.description}</p>
            )}
            {selectedCampoOption?.sensorWarning && (
              <div className="metric-form-modal__sensor-warning" role="note">
                {selectedCampoOption.sensorWarning}
              </div>
            )}
            {autoAppliedNotice && !isTypeLocked && (
              <div className="metric-form-modal__info-banner" role="status">
                <span>
                  Sugestão Strava aplicada para <strong>{autoAppliedNotice.campoLabel}</strong>: Tipo{" "}
                  <strong>{autoAppliedNotice.tipoLabel}</strong> e Unidade{" "}
                  <strong>{autoAppliedNotice.unidadeLabel}</strong>. Revise e confirme antes de salvar.
                </span>
                {unitOptions.length > 1 && (
                  <button
                    type="button"
                    className="metric-form-modal__info-action"
                    onClick={() => unidadeSelectRef.current?.focus()}
                  >
                    Alterar unidade manualmente
                  </button>
                )}
              </div>
            )}
            {stravaChangedWithHistory && (
              <>
                <label className="metric-form-modal__confirm-box">
                  <input
                    type="checkbox"
                    checked={confirmStravaChange}
                    onChange={(e) => {
                      setConfirmStravaChange(e.target.checked);
                      if (e.target.checked) setStravaConfirmError("");
                    }}
                  />
                  <span>
                    {campoStrava === "NENHUM"
                      ? "Confirmo que desejo desvincular esta métrica do Strava. Os registros históricos existentes serão mantidos."
                      : "Confirmo a alteração do vínculo Strava nesta métrica com histórico. Apenas futuras importações usarão o novo campo."}
                  </span>
                </label>
                {stravaConfirmError && (
                  <p className="metric-form-modal__error-msg" role="alert">
                    {stravaConfirmError}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Footer actions */}
          <div className="metric-form-modal__footer">
            <button
              type="button"
              className="metric-form-modal__btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="metric-form-modal__btn-submit"
              disabled={submitting}
            >
              {submitting
                ? "Salvando..."
                : isEdit
                ? "Salvar alterações"
                : "Salvar métrica"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
