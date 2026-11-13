import { useContext, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Badge from "../Badge/Badge";
import Button from "../Button/Button";
import MetricValueInput from "../MetricValueInput/MetricValueInput";
import { StudentContext, type StudentExecutionConfirmDetails } from "../../features/studentArea/StudentContext";
import { getBorgInfo } from "../../features/studentArea/studentAreaModel";
import { localDateKey } from "../../features/personal/dashboardModel";
import { alunoService } from "../../services/alunoService";
import { stravaService } from "../../services/stravaService";
import { connectStravaWithPopup, STRAVA_STATUS_CHANGED } from "../../features/strava/connectWithPopup";
import { authError } from "../../utils/authError";
import {
  formatMetricDisplayValue,
  normalizeMetricInput,
  normalizeTipo,
  validateMetricValue,
} from "../../utils/metricValueFormat";
import {
  activityNeedsCaloriesDetail,
  applyStravaSelection,
  extractStravaFieldValue,
  resolveStravaAtividadeIdToSubmit,
  valuesMatchForStrava,
  type StravaMetaBaseline,
  type StravaMetaFilled,
} from "../../utils/stravaMapping";
import type { StudentExecutionMetricDTO, StudentSessionMetricResult } from "../../types/studentArea";
import type { StravaAtividade, StravaStatusResponse } from "../../types/strava";
import "./StudentRpeModal.css";

interface StudentRpeModalProps {
  sessionId?: string | null;
  initialRpe?: number | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (rpe: number | null, details?: StudentExecutionConfirmDetails) => void;
}

function metricTypeFallbackLabel(tipo: string): string {
  switch (normalizeTipo(tipo)) {
    case "TEMPO":
      return "Tempo";
    case "FREQUENCIA_CARDIACA":
      return "Frequência cardíaca";
    case "TEXTO":
      return "Texto";
    default:
      return "Numérico";
  }
}

function formatStravaDate(isoDate?: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

export default function StudentRpeModal({
  sessionId: propSessionId,
  initialRpe = null,
  busy: externalBusy = false,
  onClose,
  onConfirm,
}: StudentRpeModalProps) {
  const studentCtx = useContext(StudentContext);
  const resolvedSessionId = propSessionId ?? studentCtx?.rpeModalSessionId ?? null;

  const targetSession = useMemo(() => {
    if (!resolvedSessionId || !studentCtx?.weeks) return null;
    for (const w of studentCtx.weeks) {
      const found = w.sessoes.find((s) => s.id === resolvedSessionId);
      if (found) return found;
    }
    return null;
  }, [resolvedSessionId, studentCtx?.weeks]);

  const initialPlannedDuration = targetSession?.duracaoPlanejada
    ? String(targetSession.duracaoPlanejada)
    : "";
  const todayIso = useMemo(() => localDateKey(new Date()), []);

  const [loadingForm, setLoadingForm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<StudentExecutionMetricDTO[]>(
    () => targetSession?.metricas || []
  );

  const [dateReal, setDateReal] = useState<string>(todayIso);
  const [duration, setDuration] = useState<string>(initialPlannedDuration);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>("");
  const [selectedRpe, setSelectedRpe] = useState<number | null>(initialRpe ?? null);

  const [stravaStatus, setStravaStatus] = useState<StravaStatusResponse | null>(null);
  const [stravaActivities, setStravaActivities] = useState<StravaAtividade[]>([]);
  const [loadingStrava, setLoadingStrava] = useState<boolean>(false);
  const [stravaListError, setStravaListError] = useState<string>("");
  const [selectedStravaId, setSelectedStravaId] = useState<string | null>(null);
  const [stravaFilledMap, setStravaFilledMap] = useState<Record<string, string>>({});
  const [metaFilled, setMetaFilled] = useState<StravaMetaFilled>({});
  const [loadingCaloriesDetail, setLoadingCaloriesDetail] = useState<boolean>(false);
  const [stravaDetailWarning, setStravaDetailWarning] = useState<string>("");
  const [connectingStrava, setConnectingStrava] = useState<boolean>(false);

  const baselineRef = useRef<StravaMetaBaseline>({
    dataReal: todayIso,
    duracao: initialPlannedDuration,
  });
  const detailRequestedIdsRef = useRef<Set<string>>(new Set());
  const valuesRef = useRef<Record<string, string>>(values);
  valuesRef.current = values;
  const stravaFilledRef = useRef<Record<string, string>>(stravaFilledMap);
  stravaFilledRef.current = stravaFilledMap;
  const metaFilledRef = useRef<StravaMetaFilled>(metaFilled);
  metaFilledRef.current = metaFilled;
  const dateRealRef = useRef<string>(dateReal);
  dateRealRef.current = dateReal;
  const durationRef = useRef<string>(duration);
  durationRef.current = duration;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const busy = externalBusy || submitting;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      }
    };
  }, []);

  useEffect(() => {
    if (!resolvedSessionId) return;
    let active = true;
    setLoadingForm(true);
    setFormError("");
    alunoService
      .obterFormularioExecucao(resolvedSessionId)
      .then((form) => {
        if (!active) return;
        if (Array.isArray(form.metricas)) {
          setMetrics(form.metricas);
        }
        if (form.sessao?.duracao && form.sessao.duracao > 0) {
          const nextPlanned = String(form.sessao.duracao);
          const prevBaseline = baselineRef.current.duracao;
          baselineRef.current = { ...baselineRef.current, duracao: nextPlanned };
          if (!metaFilledRef.current.duracao && (!durationRef.current.trim() || durationRef.current === prevBaseline)) {
            setDuration(nextPlanned);
          }
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
        if (axiosErr?.response?.status === 422 && axiosErr.response.data?.detail) {
          setFormError(axiosErr.response.data.detail);
        }
      })
      .finally(() => {
        if (active) setLoadingForm(false);
      });

    return () => {
      active = false;
    };
  }, [resolvedSessionId]);

  const studentMetrics = useMemo(
    () => metrics.filter((m) => m.quemPreenche !== "PERSONAL"),
    [metrics]
  );

  const personalOnlyMetrics = useMemo(
    () => metrics.filter((m) => m.quemPreenche === "PERSONAL"),
    [metrics]
  );

  async function handleConnectStravaFromModal() {
    try {
      setConnectingStrava(true);
      await connectStravaWithPopup();
      toast.success("Conta Strava conectada com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível conectar ao Strava.");
    } finally {
      setConnectingStrava(false);
    }
  }

  function applyActivitySelection(act: StravaAtividade | null) {
    const result = applyStravaSelection({
      newActivity: act,
      metrics,
      actorRole: "ALUNO",
      currentMetricValues: valuesRef.current,
      prevStravaFilledMap: stravaFilledRef.current,
      currentDataReal: dateRealRef.current,
      currentDuracao: durationRef.current,
      prevMetaFilled: metaFilledRef.current,
      baseline: baselineRef.current,
    });

    setValues(result.nextMetricValues);
    setStravaFilledMap(result.nextStravaFilledMap);
    setDateReal(result.nextDataReal);
    setDuration(result.nextDuracao);
    setMetaFilled(result.nextMetaFilled);
    setSelectedStravaId(result.selectedStravaActivityId);
    setStravaDetailWarning("");
    setErrors((prev) => {
      const next = { ...prev };
      delete next.dataReal;
      delete next.duracao;
      for (const id of Object.keys(result.nextStravaFilledMap)) {
        delete next[id];
      }
      return next;
    });
  }

  // Carrega status e atividades do Strava (limite=10, pré-seleciona acts[0])
  useEffect(() => {
    let active = true;
    async function initStrava(selectFirstActivity: boolean) {
      try {
        setLoadingStrava(true);
        setStravaListError("");
        const status = await stravaService.obterStatus();
        if (!active) return;
        setStravaStatus(status);
        if (status.conectado && !status.expirado) {
          const acts = await stravaService.listarAtividades(10);
          if (!active) return;
          setStravaActivities(acts);
          if (selectFirstActivity && acts.length > 0) {
            applyActivitySelection(acts[0]);
          }
        } else {
          setStravaActivities([]);
        }
      } catch (err) {
        if (active) {
          setStravaListError(
            authError(err, "Não foi possível consultar atividades do Strava.").message
          );
        }
      } finally {
        if (active) setLoadingStrava(false);
      }
    }
    function refreshStrava() {
      void initStrava(true);
    }
    void initStrava(true);
    window.addEventListener(STRAVA_STATUS_CHANGED, refreshStrava);
    return () => {
      active = false;
      window.removeEventListener(STRAVA_STATUS_CHANGED, refreshStrava);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedActivity = useMemo(
    () => stravaActivities.find((a) => a.id === selectedStravaId) ?? null,
    [stravaActivities, selectedStravaId]
  );

  // Sincroniza novas métricas quando o formulário chega após o Strava (ou ao enriquecer detalhes)
  useEffect(() => {
    if (!selectedActivity || metrics.length === 0) return;

    const updates: Record<string, string> = {};
    const filledAdditions: Record<string, string> = {};

    for (const m of metrics) {
      if (stravaFilledRef.current[m.id]) continue;
      if ((valuesRef.current[m.id] || "").trim()) continue;
      const extracted = extractStravaFieldValue(selectedActivity, m);
      if (extracted != null) {
        updates[m.id] = extracted;
        filledAdditions[m.id] = extracted;
      }
    }

    if (Object.keys(updates).length > 0) {
      setValues((prev) => ({ ...prev, ...updates }));
      setStravaFilledMap((prev) => ({ ...prev, ...filledAdditions }));
      setErrors((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(updates)) {
          delete next[id];
        }
        return next;
      });
    }
  }, [selectedActivity, metrics]);

  // Busca on-demand para CALORIAS quando ausente no resumo da atividade (OQ1 + fallback 429)
  useEffect(() => {
    if (!selectedActivity || metrics.length === 0) return;
    if (!activityNeedsCaloriesDetail(selectedActivity, metrics, "ALUNO")) return;
    if (detailRequestedIdsRef.current.has(selectedActivity.id)) return;

    let active = true;
    detailRequestedIdsRef.current.add(selectedActivity.id);
    setLoadingCaloriesDetail(true);
    setStravaDetailWarning("");

    stravaService
      .obterDetalheAtividade(selectedActivity.id)
      .then((detail) => {
        if (!active) return;
        setStravaActivities((prev) =>
          prev.map((item) => (item.id === detail.id ? { ...item, ...detail } : item))
        );
        if (detail.calorias != null) {
          const updates: Record<string, string> = {};
          const filledAdditions: Record<string, string> = {};
          for (const m of metrics) {
            if (m.campoStrava !== "CALORIAS") continue;
            const currentVal = valuesRef.current[m.id];
            const prevStravaVal = stravaFilledRef.current[m.id];
            if (!currentVal?.trim() || (prevStravaVal && valuesMatchForStrava(currentVal, prevStravaVal, m))) {
              const extracted = extractStravaFieldValue(detail, m);
              if (extracted != null) {
                updates[m.id] = extracted;
                filledAdditions[m.id] = extracted;
              }
            }
          }
          if (Object.keys(updates).length > 0) {
            setValues((prev) => ({ ...prev, ...updates }));
            setStravaFilledMap((prev) => ({ ...prev, ...filledAdditions }));
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        if (axios.isAxiosError(err) && err.response?.status === 429) {
          setStravaDetailWarning(
            "Limite de requisições do Strava atingido ao buscar calorias detalhadas. As demais métricas foram mantidas; informe calorias manualmente se necessário."
          );
        } else {
          setStravaDetailWarning(
            "Não foi possível obter calorias detalhadas desta atividade no Strava agora. Você pode informar manualmente."
          );
        }
      })
      .finally(() => {
        if (active) setLoadingCaloriesDetail(false);
      });

    return () => {
      active = false;
    };
  }, [selectedActivity, metrics]);

  function handleSelectStravaActivity(actId: string) {
    if (!actId) {
      applyActivitySelection(null);
      return;
    }
    const act = stravaActivities.find((a) => a.id === actId) ?? null;
    applyActivitySelection(act);
  }

  function validateForm(): boolean {
    const nextErrors: Record<string, string> = {};

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateReal) ||
      Number.isNaN(new Date(dateReal + "T12:00:00").getTime())
    ) {
      nextErrors.dataReal = "Informe uma data de realização válida.";
    }

    if (duration.trim()) {
      const durNum = Number(duration.trim());
      if (!/^\d+$/.test(duration.trim()) || durNum < 1 || durNum > 1440) {
        nextErrors.duracao = "A duração real deve estar entre 1 e 1440 minutos.";
      }
    }

    for (const metric of studentMetrics) {
      const rawVal = values[metric.id] || "";
      if (!rawVal.trim()) {
        if (metric.obrigatoria) {
          nextErrors[metric.id] = `A métrica '${metric.titulo}' é obrigatória e deve ser preenchida.`;
        }
        continue;
      }
      const msg = validateMetricValue(metric.tipo, rawVal, metric.unidade, metric.campoStrava);
      if (msg) {
        nextErrors[metric.id] = msg;
      }
    }

    setErrors(nextErrors);
    setFormError("");
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!validateForm()) return;

    const duracaoNum = duration.trim() ? Number(duration.trim()) : null;
    const filledMetrics = studentMetrics.filter((m) => (values[m.id] || "").trim().length > 0);
    const filledPersonalStravaMetrics = personalOnlyMetrics.filter(
      (m) => (values[m.id] || "").trim().length > 0
    );

    const allMetricsToSave = [...filledMetrics, ...filledPersonalStravaMetrics];

    const payloadResultados = allMetricsToSave.map((m) => ({
      metricaId: m.id,
      valor: normalizeMetricInput(m.tipo, values[m.id], m.unidade, m.campoStrava),
    }));

    const localResults: StudentSessionMetricResult[] = allMetricsToSave.map((m) => ({
      metricaId: m.id,
      titulo: m.titulo,
      tipo: m.tipo,
      unidade: m.unidade ?? null,
      valor: normalizeMetricInput(m.tipo, values[m.id], m.unidade, m.campoStrava),
    }));

    const stravaAtividadeIdToSubmit = resolveStravaAtividadeIdToSubmit({
      selectedActivityId: selectedStravaId,
      metrics,
      currentMetricValues: values,
      stravaFilledMap,
      currentDataReal: dateReal,
      currentDuracao: duration,
      metaFilled,
      baseline: baselineRef.current,
    });

    if (!resolvedSessionId) {
      onConfirm(selectedRpe, {
        dataReal: dateReal,
        duracao: duracaoNum,
        stravaAtividadeId: stravaAtividadeIdToSubmit,
        resultados: localResults,
      });
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      await alunoService.registrarExecucao(resolvedSessionId, {
        dataReal: dateReal,
        duracao: duracaoNum,
        nivelCansaco: selectedRpe,
        stravaAtividadeId: stravaAtividadeIdToSubmit,
        resultados: payloadResultados,
      });

      onConfirm(selectedRpe, {
        dataReal: dateReal,
        duracao: duracaoNum,
        stravaAtividadeId: stravaAtividadeIdToSubmit,
        resultados: localResults,
        alreadySavedOnBackend: true,
      });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.invalidFields) {
        const backendFields = err.response.data.invalidFields as Record<string, string>;
        setErrors(backendFields);
      }
      setFormError(
        authError(err, "Não foi possível finalizar a sessão. Verifique os campos informados.").message
      );
    } finally {
      setSubmitting(false);
    }
  }

  const borgInfo = getBorgInfo(selectedRpe);
  const isConnectedActive = Boolean(stravaStatus?.conectado && !stravaStatus?.expirado);
  const isExpired = Boolean(stravaStatus?.conectado && stravaStatus?.expirado);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (busy) return;
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isInside =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!isInside) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="student-rpe-modal"
      aria-labelledby={titleId}
      closedby="any"
      onClick={handleBackdropClick}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="student-rpe-modal__header">
        <span className="student-rpe-modal__icon" aria-hidden="true">
          <img src="/student-profile/imgIconActivity2.svg" alt="" />
        </span>
        <div className="student-rpe-modal__titles">
          <h2 id={titleId}>Finalizar sessão e registrar treino</h2>
          <p>
            {targetSession
              ? `${targetSession.titulo} · Planejada para ${targetSession.dataPlanejada}`
              : "Importe do Strava ou preencha métricas e esforço percebido"}
          </p>
        </div>
        <button
          type="button"
          className="student-rpe-modal__close"
          aria-label="Fechar modal"
          disabled={busy}
          onClick={onClose}
        >
          <img src="/auth/close.svg" alt="" />
        </button>
      </div>

      {formError && (
        <div className="student-rpe-modal__error-banner" role="alert">
          {formError}
        </div>
      )}

      <form className="student-rpe-modal__form" onSubmit={handleSubmit} noValidate>
        {/* 1. Strava */}
        {loadingStrava ? (
          <div className="student-rpe-modal__strava-box">
            <p className="student-rpe-modal__strava-muted">
              Consultando atividades recentes do Strava...
            </p>
          </div>
        ) : isConnectedActive ? (
          <div className="student-rpe-modal__strava-box">
            <div className="student-rpe-modal__strava-head">
              <span className="student-rpe-modal__strava-title">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#fc5200" aria-hidden="true">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
                </svg>
                Sincronizar com atividade do Strava
              </span>
              {selectedStravaId && (
                <span className="student-rpe-modal__strava-chip">Atividade vinculada</span>
              )}
            </div>

            {stravaListError ? (
              <p className="student-rpe-modal__strava-warn" role="alert">
                {stravaListError}
              </p>
            ) : stravaActivities.length > 0 ? (
              <div className="student-rpe-modal__strava-control">
                <label htmlFor="strava-activity-select">
                  Escolha a atividade para preencher os dados automaticamente:
                </label>
                <select
                  id="strava-activity-select"
                  value={selectedStravaId || ""}
                  onChange={(e) => handleSelectStravaActivity(e.target.value)}
                  disabled={busy}
                >
                  {stravaActivities.map((act) => (
                    <option key={act.id} value={act.id}>
                      {act.esporte || act.tipo}: {act.nome} — {formatStravaDate(act.data)}{" "}
                      ({act.distanciaFormatada || (act.distanciaKm ? `${act.distanciaKm} km` : "")}
                      {act.tempoFormatado ? ` · ${act.tempoFormatado}` : ""})
                    </option>
                  ))}
                  <option value="">Não importar do Strava (preencher manualmente)</option>
                </select>
                {loadingCaloriesDetail && (
                  <p className="student-rpe-modal__strava-muted">
                    Buscando calorias detalhadas no Strava...
                  </p>
                )}
                {stravaDetailWarning && (
                  <p className="student-rpe-modal__strava-warn" role="status">
                    {stravaDetailWarning}
                  </p>
                )}
              </div>
            ) : (
              <p className="student-rpe-modal__strava-muted">
                Nenhuma atividade recente encontrada no Strava.
              </p>
            )}
          </div>
        ) : isExpired ? (
          <div className="student-rpe-modal__strava-box student-rpe-modal__strava-box--expired" role="alert">
            <div className="student-rpe-modal__strava-prompt">
              <span>
                <strong>Conexão Strava expirada.</strong> Reconecte sua conta para importar
                atividades automaticamente.
              </span>
              <button
                type="button"
                className="student-rpe-modal__strava-link"
                disabled={connectingStrava}
                onClick={handleConnectStravaFromModal}
              >
                {connectingStrava ? "Aguardando autorização..." : "Reconectar Strava →"}
              </button>
            </div>
          </div>
        ) : (
          <div className="student-rpe-modal__strava-box student-rpe-modal__strava-box--dashed">
            <div className="student-rpe-modal__strava-prompt">
              <span className="student-rpe-modal__strava-invite">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#fc5200" aria-hidden="true">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
                </svg>
                <span>
                  Conecte o <strong>Strava</strong> para preencher métricas deste treino
                  automaticamente.
                </span>
              </span>
              <button
                type="button"
                className="student-rpe-modal__strava-link"
                disabled={connectingStrava}
                onClick={handleConnectStravaFromModal}
              >
                {connectingStrava ? "Aguardando autorização..." : "Conectar Strava →"}
              </button>
            </div>
          </div>
        )}

        {/* 2. Data real e duração */}
        <div className="student-rpe-modal__row-2">
          <div className="student-rpe-modal__field">
            <label htmlFor="student-exec-date">Data de realização *</label>
            <input
              id="student-exec-date"
              type="date"
              value={dateReal}
              max={todayIso}
              disabled={busy}
              onChange={(e) => {
                setDateReal(e.target.value);
                setErrors((prev) => ({ ...prev, dataReal: "" }));
              }}
              className={errors.dataReal ? "has-error" : ""}
            />
            {errors.dataReal && (
              <span className="student-rpe-modal__field-error" role="alert">
                {errors.dataReal}
              </span>
            )}
          </div>

          <div className="student-rpe-modal__field">
            <label htmlFor="student-exec-duration">Duração real (minutos)</label>
            <input
              id="student-exec-duration"
              type="number"
              min={1}
              max={1440}
              step={1}
              placeholder="Ex.: 45"
              value={duration}
              disabled={busy}
              onChange={(e) => {
                setDuration(e.target.value);
                setErrors((prev) => ({ ...prev, duracao: "" }));
              }}
              className={errors.duracao ? "has-error" : ""}
            />
            {errors.duracao && (
              <span className="student-rpe-modal__field-error" role="alert">
                {errors.duracao}
              </span>
            )}
          </div>
        </div>

        {/* 3. Métricas solicitadas pelo personal */}
        <div className="student-rpe-modal__metrics-section">
          <div className="student-rpe-modal__metrics-head">
            <strong>Métricas da sessão</strong>
            <span>Preencha os resultados alcançados no treino</span>
          </div>

          {loadingForm && metrics.length === 0 ? (
            <p className="student-rpe-modal__empty-metrics">Carregando métricas da sessão...</p>
          ) : studentMetrics.length === 0 ? (
            <p className="student-rpe-modal__empty-metrics">
              Nenhuma métrica de preenchimento do aluno para esta sessão.
            </p>
          ) : (
            <div className="student-rpe-modal__metrics-list">
              {studentMetrics.map((metric) => {
                const fieldId = `student-metric-${metric.id}`;
                const errMsg = errors[metric.id];
                const isFromStrava = Boolean(
                  stravaFilledMap[metric.id] &&
                    valuesMatchForStrava(values[metric.id], stravaFilledMap[metric.id], metric)
                );

                return (
                  <div key={metric.id} className="student-rpe-modal__metric-item">
                    <div className="student-rpe-modal__metric-label-row">
                      <label htmlFor={fieldId}>
                        {metric.titulo}
                        {metric.obrigatoria ? " *" : ""}
                      </label>
                      <div className="student-rpe-modal__metric-badges">
                        <span className="student-rpe-modal__metric-type">
                          {metric.unidade?.trim()
                            ? metric.unidade
                            : metricTypeFallbackLabel(metric.tipo)}
                        </span>
                        <Badge tone={metric.obrigatoria ? "warning" : "neutral"}>
                          {metric.obrigatoria ? "Obrigatória" : "Opcional"}
                        </Badge>
                      </div>
                    </div>

                    {metric.obrigatoria && !values[metric.id] && selectedStravaId && (
                      <span className="student-rpe-modal__strava-missing-hint">
                        Não detectada no Strava nesta atividade — informe manualmente.
                      </span>
                    )}

                    <MetricValueInput
                      id={fieldId}
                      ariaLabel={metric.titulo}
                      value={values[metric.id] || ""}
                      tipo={metric.tipo}
                      unidade={metric.unidade}
                      campoStrava={metric.campoStrava}
                      disabled={busy}
                      error={errMsg}
                      fromStrava={isFromStrava}
                      onChange={(nextVal) => {
                        setValues((prev) => ({ ...prev, [metric.id]: nextVal }));
                        setErrors((prev) => ({ ...prev, [metric.id]: "" }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {personalOnlyMetrics.length > 0 && (
            <div className="student-rpe-modal__personal-metrics-note">
              <strong>Métricas avaliadas pelo Personal Trainer:</strong>
              <div className="student-rpe-modal__personal-metrics-list">
                {personalOnlyMetrics.map((m) => {
                  const stravaVal = values[m.id];
                  const personalErr = errors[m.id];
                  return (
                    <div key={m.id} className="student-rpe-modal__personal-metric-wrapper">
                      <div className="student-rpe-modal__personal-metric-row">
                        <span>
                          {m.titulo} {m.obrigatoria ? <span className="is-required">*</span> : ""}
                        </span>
                        {stravaVal ? (
                          <span className="student-rpe-modal__personal-strava-val">
                            Strava: {formatMetricDisplayValue(stravaVal, m.tipo, m.unidade)} (Automático)
                          </span>
                        ) : (
                          <span className="student-rpe-modal__personal-pending">
                            Pendente para o personal
                          </span>
                        )}
                      </div>
                      {personalErr && (
                        <span className="student-rpe-modal__field-error" role="alert">
                          {personalErr}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 4. RPE inline (opcional) */}
        <div className="student-rpe-modal__rpe-section">
          <div className="student-rpe-modal__rpe-header">
            <strong>Percepção de esforço — Borg CR-10 (opcional)</strong>
            <span>Selecione de 1 a 10 ou deixe sem seleção para enviar sem RPE</span>
          </div>

          <div
            className="student-rpe-modal__scale-buttons"
            role="group"
            aria-label="Nível de esforço de 1 a 10"
          >
            {Array.from({ length: 10 }, (_, idx) => idx + 1).map((level) => {
              const isSelected = selectedRpe === level;
              const toneClass =
                level <= 4
                  ? "student-rpe-modal__btn--green"
                  : level <= 6
                  ? "student-rpe-modal__btn--amber"
                  : level <= 8
                  ? "student-rpe-modal__btn--orange"
                  : "student-rpe-modal__btn--red";

              return (
                <button
                  key={level}
                  type="button"
                  className={`student-rpe-modal__btn ${toneClass}${
                    isSelected ? " is-selected" : ""
                  }`}
                  aria-pressed={isSelected}
                  disabled={busy}
                  onClick={() => setSelectedRpe(isSelected ? null : level)}
                >
                  {level}
                </button>
              );
            })}
          </div>

          <div className="student-rpe-modal__scale-labels" aria-hidden="true">
            <span>Muito leve</span>
            <span>Moderado</span>
            <span>Máximo</span>
          </div>

          <div className="student-rpe-modal__callout" role="status">
            <span
              className={`student-rpe-modal__callout-badge student-rpe-modal__callout-badge--${borgInfo.tone}`}
            >
              {borgInfo.levelLabel}
            </span>
            <div className="student-rpe-modal__callout-text">
              <strong>{borgInfo.title}</strong>
              <p>{borgInfo.description}</p>
            </div>
          </div>
        </div>

        {/* 5. Envio */}
        <footer className="student-rpe-modal__footer student-rpe-modal__footer--between">
          <button
            type="button"
            className="student-rpe-modal__skip"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>

          <Button type="submit" loading={busy}>
            Finalizar sessão
          </Button>
        </footer>
      </form>
    </dialog>
  );
}
