import { useContext, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Badge from "../Badge/Badge";
import Button from "../Button/Button";
import { StudentContext, type StudentExecutionConfirmDetails } from "../../features/studentArea/StudentContext";
import { getBorgInfo } from "../../features/studentArea/studentAreaModel";
import { localDateKey } from "../../features/personal/dashboardModel";
import { alunoService } from "../../services/alunoService";
import { stravaService } from "../../services/stravaService";
import { authError } from "../../utils/authError";
import type { StudentExecutionMetricDTO, StudentSessionMetricResult } from "../../types/studentArea";
import type { StravaAtividade } from "../../types/strava";
import "./StudentRpeModal.css";

interface StudentRpeModalProps {
  sessionId?: string | null;
  initialRpe?: number | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (rpe: number | null, details?: StudentExecutionConfirmDetails) => void;
}

function normalizeMetricType(raw?: string): "NUMERICO" | "TEMPO" | "FREQUENCIA_CARDIACA" | "TEXTO" {
  const up = (raw || "").toUpperCase();
  if (up.includes("TEMPO")) return "TEMPO";
  if (up.includes("FREQ") || up.includes("CARD")) return "FREQUENCIA_CARDIACA";
  if (up.includes("TEXT") || up.includes("OBS")) return "TEXTO";
  return "NUMERICO";
}

function metricTypeLabel(raw?: string): string {
  const norm = normalizeMetricType(raw);
  switch (norm) {
    case "TEMPO":
      return "Tempo (mm:ss ou hh:mm:ss)";
    case "FREQUENCIA_CARDIACA":
      return "Frequência cardíaca (bpm)";
    case "TEXTO":
      return "Texto / Observação";
    default:
      return "Numérico";
  }
}

function metricPlaceholder(raw?: string): string {
  const norm = normalizeMetricType(raw);
  switch (norm) {
    case "TEMPO":
      return "Ex.: 01:42 ou 01:15:30";
    case "FREQUENCIA_CARDIACA":
      return "Ex.: 152 (entre 30 e 250)";
    case "TEXTO":
      return "Descreva o resultado ou observação...";
    default:
      return "Ex.: 60 ou 12,5";
  }
}

function validateStudentMetricValue(metric: StudentExecutionMetricDTO, rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    if (metric.obrigatoria) {
      return `A métrica '${metric.titulo}' é obrigatória e deve ser preenchida.`;
    }
    return null;
  }

  if (trimmed.length > 255) {
    return `Valor inválido para a métrica ${metric.titulo}. Verifique o formato esperado (máx. 255 caracteres).`;
  }

  const norm = normalizeMetricType(metric.tipo);
  if (norm === "NUMERICO") {
    const validNum =
      /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed) &&
      Number.isFinite(Number(trimmed.replace(",", ".")));
    if (!validNum) {
      return `Valor inválido para a métrica ${metric.titulo}. Verifique o formato esperado: deve ser numérico.`;
    }
  } else if (norm === "TEMPO") {
    if (!/^(?:\d+:[0-5]\d:[0-5]\d|\d+:[0-5]\d)$/.test(trimmed)) {
      return `Valor inválido para a métrica ${metric.titulo}. Verifique o formato esperado: mm:ss ou hh:mm:ss (ex.: 01:42 ou 01:15:30).`;
    }
  } else if (norm === "FREQUENCIA_CARDIACA") {
    const bpm = Number(trimmed);
    if (!/^\d+$/.test(trimmed) || bpm < 30 || bpm > 250) {
      return `Valor inválido para a métrica ${metric.titulo}. Verifique o formato esperado: entre 30 e 250 bpm.`;
    }
  }

  return null;
}

function serializeStudentMetricValue(rawType: string, rawValue: string): string {
  const trimmed = rawValue.trim();
  const norm = normalizeMetricType(rawType);
  if (norm === "TEMPO") {
    const parts = trimmed.split(":");
    if (parts.length === 3) {
      const [h, m, s] = parts;
      return `${(h || "0").padStart(2, "0")}:${(m || "0").padStart(2, "0")}:${s || "00"}`;
    }
    const [min, sec] = parts;
    return `${(min || "0").padStart(2, "0")}:${sec || "00"}`;
  }
  if (norm === "NUMERICO") {
    return trimmed.replace(",", ".");
  }
  return trimmed;
}

function formatStravaDate(isoDate?: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

function mapStravaActivityToMetrics(
  act: StravaAtividade,
  allMetrics: StudentExecutionMetricDTO[]
): {
  dateReal: string;
  duration: string;
  metricValues: Record<string, string>;
  stravaFilled: Record<string, boolean>;
} {
  const metricValues: Record<string, string> = {};
  const stravaFilled: Record<string, boolean> = {};

  for (const m of allMetrics) {
    let val: string | null = null;
    const campo = m.campoStrava;

    // 1. Prioridade: Campo Strava explícito
    if (campo && campo !== "NENHUM") {
      switch (campo) {
        case "DISTANCIA_KM":
          if (act.distanciaKm != null) val = String(act.distanciaKm);
          break;
        case "DISTANCIA_METROS":
          if (act.distanciaMetros != null) val = String(Math.round(act.distanciaMetros));
          break;
        case "TEMPO_MOVIMENTO":
          if (act.tempoFormatado) val = act.tempoFormatado;
          break;
        case "TEMPO_TOTAL":
          if (act.tempoTotalFormatado || act.tempoFormatado) val = act.tempoTotalFormatado || act.tempoFormatado || "";
          break;
        case "DURACAO_MINUTOS":
          if (act.duracaoMinutos != null) val = String(act.duracaoMinutos);
          break;
        case "FREQUENCIA_CARDIACA_MEDIA":
          if (act.frequenciaCardiacaMedia != null) val = String(act.frequenciaCardiacaMedia);
          break;
        case "FREQUENCIA_CARDIACA_MAXIMA":
          if (act.frequenciaCardiacaMaxima != null) val = String(act.frequenciaCardiacaMaxima);
          break;
        case "CADENCIA_MEDIA":
          if (act.cadenciaMedia != null) val = String(Math.round(act.cadenciaMedia));
          break;
        case "POTENCIA_MEDIA_WATTS":
          if (act.potenciaMediaWatts != null) val = String(Math.round(act.potenciaMediaWatts));
          break;
        case "POTENCIA_MAXIMA_WATTS":
          if (act.potenciaMaximaWatts != null) val = String(Math.round(act.potenciaMaximaWatts));
          break;
        case "ELEVACAO_GANHO_METROS":
          if (act.elevacaoGanhoMetros != null) val = String(Math.round(act.elevacaoGanhoMetros));
          break;
        case "VELOCIDADE_MEDIA_KMH":
          if (act.velocidadeMediaKmh != null) val = String(act.velocidadeMediaKmh);
          break;
        case "VELOCIDADE_MAXIMA_KMH":
          if (act.velocidadeMaximaKmh != null) val = String(act.velocidadeMaximaKmh);
          break;
        case "CALORIAS":
          if (act.calorias != null) val = String(Math.round(act.calorias));
          break;
        case "RITMO_MEDIO":
          if (act.ritmoMedio) val = act.ritmoMedio;
          break;
      }
    } else {
      // 2. Fallback Heurístico para métricas legadas sem campo_strava
      const norm = normalizeMetricType(m.tipo);
      const titleLower = (m.titulo || "").toLowerCase();

      if (norm === "FREQUENCIA_CARDIACA") {
        if (act.frequenciaCardiacaMedia != null) val = String(act.frequenciaCardiacaMedia);
      } else if (norm === "TEMPO") {
        if (act.tempoFormatado) val = act.tempoFormatado;
      } else if (norm === "NUMERICO") {
        if (titleLower.includes("dist") || titleLower.includes("km") || titleLower.includes("quilometr")) {
          if (act.distanciaKm != null) val = String(act.distanciaKm);
        } else if (titleLower.includes("metro") && !titleLower.includes("km")) {
          if (act.distanciaMetros != null) val = String(Math.round(act.distanciaMetros));
        } else if (titleLower.includes("cadenc") || titleLower.includes("passo") || titleLower.includes("spm")) {
          if (act.cadenciaMedia != null) val = String(Math.round(act.cadenciaMedia));
        } else if (titleLower.includes("potenc") || titleLower.includes("watt")) {
          if (act.potenciaMediaWatts != null) val = String(Math.round(act.potenciaMediaWatts));
        } else if (titleLower.includes("calori") || titleLower.includes("kcal") || titleLower.includes("gasto")) {
          if (act.calorias != null) val = String(Math.round(act.calorias));
        } else if (titleLower.includes("elevac") || titleLower.includes("altimetri")) {
          if (act.elevacaoGanhoMetros != null) val = String(Math.round(act.elevacaoGanhoMetros));
        } else if (titleLower.includes("velocidad") || titleLower.includes("km/h")) {
          if (act.velocidadeMediaKmh != null) val = String(act.velocidadeMediaKmh);
        }
      } else if (norm === "TEXTO") {
        if (titleLower.includes("ritmo") || titleLower.includes("pace")) {
          if (act.ritmoMedio) val = act.ritmoMedio;
        }
      }
    }

    if (val != null && val !== "") {
      metricValues[m.id] = val;
      stravaFilled[m.id] = true;
    }
  }

  return {
    dateReal: act.data || "",
    duration: act.duracaoMinutos != null ? String(act.duracaoMinutos) : "",
    metricValues,
    stravaFilled
  };
}

export default function StudentRpeModal({
  sessionId: propSessionId,
  initialRpe = 7,
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

  const [step, setStep] = useState<"metrics" | "rpe">("metrics");
  const [loadingForm, setLoadingForm] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<StudentExecutionMetricDTO[]>(
    () => studentCtx?.activeRoutine?.metricas || []
  );

  const todayIso = useMemo(() => localDateKey(new Date()), []);
  const [dateReal, setDateReal] = useState<string>(todayIso);
  const [duration, setDuration] = useState<string>(() =>
    String(targetSession?.duracaoPlanejada || 50)
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>("");
  const [selectedRpe, setSelectedRpe] = useState<number | null>(initialRpe);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const busy = externalBusy || submitting;

  // Abre o dialog nativo
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

  // Carrega o formulário de execução da sessão no back-end (US-22 C1)
  useEffect(() => {
    if (!resolvedSessionId) return;
    let active = true;
    setLoadingForm(true);
    alunoService
      .obterFormularioExecucao(resolvedSessionId)
      .then((form) => {
        if (!active) return;
        if (Array.isArray(form.metricas) && form.metricas.length > 0) {
          setMetrics(form.metricas);
        }
        if (form.sessao?.duracao) {
          setDuration(String(form.sessao.duracao));
        }
      })
      .catch(() => {
        // Fallback para métricas já carregadas na rotina ativa
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

  const [stravaConnected, setStravaConnected] = useState<boolean>(false);
  const [stravaActivities, setStravaActivities] = useState<StravaAtividade[]>([]);
  const [loadingStrava, setLoadingStrava] = useState<boolean>(false);
  const [selectedStravaId, setSelectedStravaId] = useState<string | null>(null);
  const [stravaFilledMap, setStravaFilledMap] = useState<Record<string, boolean>>({});
  const [connectingStrava, setConnectingStrava] = useState<boolean>(false);

  async function handleConnectStravaFromModal() {
    try {
      setConnectingStrava(true);
      const res = await stravaService.obterAuthUrl();
      if (res.authUrl) {
        window.location.href = res.authUrl;
      }
    } catch (err) {
      setConnectingStrava(false);
      const parsed = authError(err, "Não foi possível iniciar a conexão com o Strava.");
      toast.error(parsed.message);
    }
  }

  // Carrega status e atividades do Strava (US-14 / US-22)
  useEffect(() => {
    let active = true;
    async function initStrava() {
      try {
        setLoadingStrava(true);
        const status = await stravaService.obterStatus();
        if (!active) return;
        if (status.conectado && !status.expirado) {
          setStravaConnected(true);
          const acts = await stravaService.listarAtividades(10);
          if (!active) return;
          setStravaActivities(acts);
          if (acts.length > 0) {
            setSelectedStravaId(acts[0].id);
          }
        } else {
          setStravaConnected(false);
        }
      } catch {
        if (active) setStravaConnected(false);
      } finally {
        if (active) setLoadingStrava(false);
      }
    }
    initStrava();
    return () => {
      active = false;
    };
  }, []);

  // Preenche métricas quando uma atividade é selecionada ou as métricas chegam
  useEffect(() => {
    if (!selectedStravaId || stravaActivities.length === 0 || metrics.length === 0) return;
    const act = stravaActivities.find((a) => a.id === selectedStravaId);
    if (!act) return;

    const mapped = mapStravaActivityToMetrics(act, metrics);
    if (mapped.dateReal) setDateReal(mapped.dateReal);
    if (mapped.duration) setDuration(mapped.duration);
    setValues((prev) => ({ ...prev, ...mapped.metricValues }));
    setStravaFilledMap(mapped.stravaFilled);
  }, [selectedStravaId, stravaActivities, metrics]);

  function handleSelectStravaActivity(actId: string) {
    if (!actId) {
      setSelectedStravaId(null);
      setStravaFilledMap({});
      return;
    }
    setSelectedStravaId(actId);
    const act = stravaActivities.find((a) => a.id === actId);
    if (act && metrics.length > 0) {
      const mapped = mapStravaActivityToMetrics(act, metrics);
      if (mapped.dateReal) setDateReal(mapped.dateReal);
      if (mapped.duration) setDuration(mapped.duration);
      setValues((prev) => ({ ...prev, ...mapped.metricValues }));
      setStravaFilledMap(mapped.stravaFilled);
    }
  }

  function validateStepOne(): boolean {
    const nextErrors: Record<string, string> = {};

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateReal) ||
      Number.isNaN(new Date(dateReal + "T12:00:00").getTime())
    ) {
      nextErrors.dataReal = "Informe uma data de realização válida.";
    }

    if (duration.trim()) {
      const durNum = Number(duration);
      if (!/^\d+$/.test(duration.trim()) || durNum < 1) {
        nextErrors.duracao = "A duração real deve ser no mínimo 1 minuto.";
      }
    }

    for (const metric of studentMetrics) {
      const msg = validateStudentMetricValue(metric, values[metric.id] || "");
      if (msg) {
        nextErrors[metric.id] = msg;
      }
    }

    setErrors(nextErrors);
    setFormError("");
    return Object.keys(nextErrors).length === 0;
  }

  function handleContinueToRpe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateStepOne()) return;
    setStep("rpe");
  }

  async function handleFinalize(rpeToSave: number | null) {
    if (busy) return;
    if (!validateStepOne()) {
      setStep("metrics");
      return;
    }

    const duracaoNum = duration.trim() ? Number(duration.trim()) : null;
    const filledMetrics = studentMetrics.filter((m) => (values[m.id] || "").trim().length > 0);
    const filledPersonalStravaMetrics = personalOnlyMetrics.filter(
      (m) => (values[m.id] || "").trim().length > 0
    );

    const allMetricsToSave = [...filledMetrics, ...filledPersonalStravaMetrics];

    const payloadResultados = allMetricsToSave.map((m) => ({
      metricaId: m.id,
      valor: serializeStudentMetricValue(m.tipo, values[m.id]),
    }));

    const localResults: StudentSessionMetricResult[] = allMetricsToSave.map((m) => ({
      metricaId: m.id,
      titulo: m.titulo,
      tipo: m.tipo,
      valor: serializeStudentMetricValue(m.tipo, values[m.id]),
    }));

    if (!resolvedSessionId) {
      onConfirm(rpeToSave, {
        dataReal: dateReal,
        duracao: duracaoNum,
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
        nivelCansaco: rpeToSave,
        resultados: payloadResultados,
      });

      onConfirm(rpeToSave, {
        dataReal: dateReal,
        duracao: duracaoNum,
        resultados: localResults,
        alreadySavedOnBackend: true,
      });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.invalidFields) {
        const backendFields = err.response.data.invalidFields as Record<string, string>;
        setErrors(backendFields);
        setStep("metrics");
      }
      setFormError(
        authError(err, "Não foi possível finalizar a sessão. Verifique os campos informados.")
          .message
      );
    } finally {
      setSubmitting(false);
    }
  }

  const borgInfo = getBorgInfo(selectedRpe);

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
          <img
            src={
              step === "rpe"
                ? "/student-profile/imgIconFlame.svg"
                : "/student-profile/imgIconActivity2.svg"
            }
            alt=""
          />
        </span>
        <div className="student-rpe-modal__titles">
          <h2 id={titleId}>
            {step === "metrics"
              ? "Finalizar sessão e enviar métricas"
              : "Como você avalia seu nível de esforço nesta sessão?"}
          </h2>
          <p>
            {step === "metrics"
              ? targetSession
                ? `${targetSession.titulo} · Planejada para ${targetSession.dataPlanejada}`
                : "Preencha os resultados solicitados pelo seu personal trainer"
              : "Escala de Borg CR-10 (1 a 10) · campo opcional"}
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

      {step === "metrics" ? (
        <form className="student-rpe-modal__form" onSubmit={handleContinueToRpe} noValidate>
          {/* Sincronização com Strava (US-14 / US-22) */}
          {stravaConnected && (
            <div
              className="student-rpe-modal__strava-box"
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "12px 14px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#0f172a",
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="#fc5200" aria-hidden="true">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
                  </svg>
                  Sincronizar com atividade do Strava
                </span>
                {selectedStravaId && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      background: "rgba(252, 82, 0, 0.1)",
                      color: "#fc5200",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontWeight: 600,
                    }}
                  >
                    Atividade vinculada
                  </span>
                )}
              </div>

              {loadingStrava ? (
                <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: 0 }}>
                  Carregando atividades recentes do Strava...
                </p>
              ) : stravaActivities.length > 0 ? (
                <div style={{ margin: 0 }}>
                  <label
                    htmlFor="strava-activity-select"
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      color: "#64748b",
                      marginBottom: "4px",
                    }}
                  >
                    Escolha a atividade para preencher os dados automaticamente:
                  </label>
                  <select
                    id="strava-activity-select"
                    value={selectedStravaId || ""}
                    onChange={(e) => handleSelectStravaActivity(e.target.value)}
                    disabled={busy}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.875rem",
                      background: "#fff",
                      color: "#0f172a",
                    }}
                  >
                    {stravaActivities.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.esporte || act.tipo}: {act.nome} — {formatStravaDate(act.data)} ({act.distanciaFormatada || (act.distanciaKm ? `${act.distanciaKm} km` : "")} {act.tempoFormatado ? `· ${act.tempoFormatado}` : ""})
                      </option>
                    ))}
                    <option value="">Não importar do Strava (Preencher manualmente)</option>
                  </select>
                </div>
              ) : (
                <p style={{ fontSize: "0.8125rem", color: "#64748b", margin: 0 }}>
                  Nenhuma atividade recente encontrada no Strava.
                </p>
              )}
            </div>
          )}

          {!stravaConnected && !loadingStrava && (
            <div
              className="student-rpe-modal__strava-box"
              style={{
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8125rem", color: "#475569" }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="#fc5200" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
                </svg>
                <span>Conecte o <strong>Strava</strong> para preencher métricas deste treino automaticamente.</span>
              </div>
              <button
                type="button"
                disabled={connectingStrava}
                onClick={handleConnectStravaFromModal}
                style={{
                  background: "none",
                  border: "none",
                  color: "#fc5200",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  textDecoration: "underline",
                }}
              >
                {connectingStrava ? "Conectando..." : "Conectar Strava →"}
              </button>
            </div>
          )}

          {/* Data real e duração (US-22 C7) */}
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
                <span className="student-rpe-modal__field-error">{errors.dataReal}</span>
              )}
            </div>

            <div className="student-rpe-modal__field">
              <label htmlFor="student-exec-duration">Duração real (minutos)</label>
              <input
                id="student-exec-duration"
                type="number"
                min={1}
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
                <span className="student-rpe-modal__field-error">{errors.duracao}</span>
              )}
            </div>
          </div>

          {/* Métricas solicitadas pelo personal (US-13 / US-22) */}
          <div className="student-rpe-modal__metrics-section">
            <div className="student-rpe-modal__metrics-head">
              <strong>Métricas solicitadas pelo personal</strong>
              <span>Preencha os resultados alcançados no treino</span>
            </div>

            {loadingForm && metrics.length === 0 ? (
              <p className="student-rpe-modal__empty-metrics">Carregando métricas da sessão...</p>
            ) : studentMetrics.length === 0 ? (
              <p className="student-rpe-modal__empty-metrics">
                Nenhuma métrica de preenchimento do aluno para esta sessão. Clique em continuar para
                informar seu nível de esforço (RPE) e concluir.
              </p>
            ) : (
              <div className="student-rpe-modal__metrics-list">
                {studentMetrics.map((metric) => {
                  const fieldId = `student-metric-${metric.id}`;
                  const normType = normalizeMetricType(metric.tipo);
                  const errMsg = errors[metric.id];

                  return (
                    <div key={metric.id} className="student-rpe-modal__metric-item">
                      <div className="student-rpe-modal__metric-label-row">
                        <label htmlFor={fieldId}>
                          {metric.titulo}
                          {metric.obrigatoria ? " *" : ""}
                        </label>
                        <div className="student-rpe-modal__metric-badges">
                          {stravaFilledMap[metric.id] && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                background: "rgba(252, 82, 0, 0.1)",
                                color: "#fc5200",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="10" height="10" fill="#fc5200" aria-hidden="true">
                                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
                              </svg>
                              Strava
                            </span>
                          )}
                          <span className="student-rpe-modal__metric-type">
                            {metricTypeLabel(metric.tipo)}
                          </span>
                          <Badge tone={metric.obrigatoria ? "warning" : "neutral"}>
                            {metric.obrigatoria ? "Obrigatória" : "Opcional"}
                          </Badge>
                        </div>
                      </div>

                      {metric.obrigatoria && !values[metric.id] && selectedStravaId && (
                        <span style={{ fontSize: "0.75rem", color: "#d97706", display: "block", marginBottom: "6px" }}>
                          Não detectada no Strava nesta atividade — informe manualmente.
                        </span>
                      )}

                      {normType === "TEXTO" ? (
                        <textarea
                          id={fieldId}
                          rows={2}
                          maxLength={255}
                          placeholder={metricPlaceholder(metric.tipo)}
                          value={values[metric.id] || ""}
                          disabled={busy}
                          onChange={(e) => {
                            const val = e.target.value;
                            setValues((prev) => ({ ...prev, [metric.id]: val }));
                            setErrors((prev) => ({ ...prev, [metric.id]: "" }));
                          }}
                          className={errMsg ? "has-error" : ""}
                        />
                      ) : (
                        <input
                          id={fieldId}
                          type="text"
                          maxLength={255}
                          placeholder={metricPlaceholder(metric.tipo)}
                          value={values[metric.id] || ""}
                          disabled={busy}
                          onChange={(e) => {
                            const val = e.target.value;
                            setValues((prev) => ({ ...prev, [metric.id]: val }));
                            setErrors((prev) => ({ ...prev, [metric.id]: "" }));
                          }}
                          className={errMsg ? "has-error" : ""}
                        />
                      )}

                      {errMsg && (
                        <span className="student-rpe-modal__field-error" role="alert">
                          {errMsg}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {personalOnlyMetrics.length > 0 && (
              <div
                className="student-rpe-modal__personal-metrics-note"
                style={{
                  marginTop: "16px",
                  padding: "12px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <strong style={{ display: "block", marginBottom: "6px" }}>
                  Métricas avaliadas pelo Personal Trainer:
                </strong>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {personalOnlyMetrics.map((m) => {
                    const stravaVal = values[m.id];
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "0.875rem",
                        }}
                      >
                        <span>
                          {m.titulo} {m.obrigatoria ? <span style={{ color: "#ef4444" }}>*</span> : ""}
                        </span>
                        {stravaVal ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              background: "#ecfdf5",
                              color: "#065f46",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontWeight: 600,
                              fontSize: "0.8125rem",
                            }}
                          >
                            Strava: {stravaVal} (Automático)
                          </span>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "0.8125rem" }}>
                            Pendente para o personal
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <footer className="student-rpe-modal__footer">
            <button
              type="button"
              className="student-rpe-modal__skip"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <Button type="submit" disabled={busy}>
              Continuar para esforço (RPE) →
            </Button>
          </footer>
        </form>
      ) : (
        <>
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
                  onClick={() => setSelectedRpe(level)}
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

          <footer className="student-rpe-modal__footer student-rpe-modal__footer--between">
            <button
              type="button"
              className="student-rpe-modal__skip"
              disabled={busy}
              onClick={() => setStep("metrics")}
            >
              ← Voltar às métricas
            </button>

            <div className="student-rpe-modal__footer-right">
              <button
                type="button"
                className="student-rpe-modal__skip"
                disabled={busy}
                onClick={() => void handleFinalize(null)}
              >
                Pular esforço
              </button>
              <Button loading={busy} onClick={() => void handleFinalize(selectedRpe)}>
                Finalizar sessão
              </Button>
            </div>
          </footer>
        </>
      )}
    </dialog>
  );
}

