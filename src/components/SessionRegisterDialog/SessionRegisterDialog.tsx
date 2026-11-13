import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import axios from "axios";
import WorkspaceDialog from "../WorkspaceDialog/WorkspaceDialog";
import FormField from "../FormField/FormField";
import Button from "../Button/Button";
import MetricValueInput from "../MetricValueInput/MetricValueInput";
import UnavailableAction from "../UnavailableAction/UnavailableAction";
import { StudentSports } from "../StudentIdentity/StudentIdentity";
import { localDateKey } from "../../features/personal/dashboardModel";
import { sessionCandidates } from "../../features/studentProfile/profileModel";
import { studentProfileService } from "../../services/studentProfileService";
import { stravaService } from "../../services/stravaService";
import { authError } from "../../utils/authError";
import { parseAtividades } from "../../utils/activityParser";
import {
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
  type StravaMappableMetric,
  type StravaMetaBaseline,
  type StravaMetaFilled,
} from "../../utils/stravaMapping";
import type { AlunoResponse } from "../../types/student";
import type { RotinaResponse } from "../../types/rotina";
import type { StudentTracking } from "../../types/studentProfile";
import type { StravaAtividade, StravaStatusResponse } from "../../types/strava";
import "./SessionRegisterDialog.css";

function formatCandidateOption(
  s: { dataPlanejada: string; semana: number; atividades: string },
  idx: number
) {
  const parsed = parseAtividades(s.atividades);
  const title = parsed.sessionName || parsed.activities[0]?.title || `Sessão ${idx + 1}`;
  const count = parsed.activities.length;
  return `${s.dataPlanejada.split("-").reverse().join("/")} · Semana ${s.semana} · ${title}${
    count ? ` (${count} ativ.)` : ""
  }`;
}

function formatStravaDate(isoDate?: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

function metricUnitOrTypeLabel(tipo: string, unidade?: string | null): string {
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

export interface RegisterRoutineOption {
  routine: RotinaResponse;
  tracking: StudentTracking | null;
}

export default function SessionRegisterDialog({
  student,
  routine,
  tracking,
  routineOptions,
  onClose,
  onSaved,
}: {
  student: AlunoResponse;
  routine: RotinaResponse;
  tracking: StudentTracking | null;
  routineOptions?: RegisterRoutineOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const todayIso = useMemo(() => localDateKey(new Date()), []);
  const [selectedRoutineId, setSelectedRoutineId] = useState(routine.id);
  const currentEntry = routineOptions?.find((opt) => opt.routine.id === selectedRoutineId);
  const currentRoutine = currentEntry?.routine ?? routine;
  const currentTracking = currentEntry ? currentEntry.tracking : tracking;
  const candidates = useMemo(
    () => sessionCandidates(currentTracking, student.id),
    [currentTracking, student.id]
  );

  const [sessionId, setSessionId] = useState(candidates[0]?.sessaoId || "");
  const [date, setDate] = useState(todayIso);
  const [duration, setDuration] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rpe, setRpe] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");

  const [stravaStatus, setStravaStatus] = useState<StravaStatusResponse | null>(null);
  const [stravaActivities, setStravaActivities] = useState<StravaAtividade[]>([]);
  const [loadingStrava, setLoadingStrava] = useState(false);
  const [stravaLoadError, setStravaLoadError] = useState("");
  const [selectedStravaId, setSelectedStravaId] = useState<string | null>(null);
  const [stravaFilledMap, setStravaFilledMap] = useState<Record<string, string>>({});
  const [metaFilled, setMetaFilled] = useState<StravaMetaFilled>({});
  const [loadingCaloriesDetail, setLoadingCaloriesDetail] = useState(false);
  const [stravaDetailWarning, setStravaDetailWarning] = useState("");

  const baselineRef = useRef<StravaMetaBaseline>({ dataReal: todayIso, duracao: "" });
  const detailRequestedIdsRef = useRef<Set<string>>(new Set());

  const selected = candidates.find((s) => s.sessaoId === sessionId);
  const selectedParsed = selected ? parseAtividades(selected.atividades) : null;
  const sessionMetrics = useMemo(() => selected?.metricas || [], [selected]);
  const allowed = useMemo(
    () => sessionMetrics.filter((metric) => metric.quemPreenche !== "ALUNO"),
    [sessionMetrics]
  );
  const mappableAllowed = useMemo<StravaMappableMetric[]>(
    () =>
      allowed.map((m) => ({
        id: m.id,
        tipo: m.tipo,
        unidade: m.unidade,
        campoStrava: m.campoStrava,
        quemPreenche: m.quemPreenche,
      })),
    [allowed]
  );
  const blocked = !candidates.length
    ? "Não há sessão planejada disponível nesta rotina. Cadastre o planejamento antes de registrar os resultados."
    : "";

  const valuesRef = useRef(values);
  valuesRef.current = values;
  const stravaFilledRef = useRef(stravaFilledMap);
  stravaFilledRef.current = stravaFilledMap;
  const metaFilledRef = useRef(metaFilled);
  metaFilledRef.current = metaFilled;
  const dateRef = useRef(date);
  dateRef.current = date;
  const durationRef = useRef(duration);
  durationRef.current = duration;

  function applyStravaForSession(
    act: StravaAtividade | null,
    targetMetrics: StravaMappableMetric[],
    resetPreviousState = false
  ) {
    const result = applyStravaSelection({
      newActivity: act,
      metrics: targetMetrics,
      actorRole: "PERSONAL",
      currentMetricValues: resetPreviousState ? {} : valuesRef.current,
      prevStravaFilledMap: resetPreviousState ? {} : stravaFilledRef.current,
      currentDataReal: resetPreviousState ? todayIso : dateRef.current,
      currentDuracao: resetPreviousState ? "" : durationRef.current,
      prevMetaFilled: resetPreviousState ? {} : metaFilledRef.current,
      baseline: baselineRef.current,
    });

    setValues(result.nextMetricValues);
    setStravaFilledMap(result.nextStravaFilledMap);
    setDate(result.nextDataReal);
    setDuration(result.nextDuracao);
    setMetaFilled(result.nextMetaFilled);
    setSelectedStravaId(result.selectedStravaActivityId);
    setStravaDetailWarning("");
    setErrors((prev) => {
      const next = { ...prev };
      delete next.date;
      delete next.duration;
      delete next.results;
      for (const id of Object.keys(result.nextStravaFilledMap)) {
        delete next[id];
      }
      return next;
    });
  }

  function resetAndMaybeApplyStrava(nextSessionMetrics: typeof sessionMetrics, keepManualChoice = false) {
    const nextAllowed: StravaMappableMetric[] = nextSessionMetrics
      .filter((m) => m.quemPreenche !== "ALUNO")
      .map((m) => ({
        id: m.id,
        tipo: m.tipo,
        unidade: m.unidade,
        campoStrava: m.campoStrava,
        quemPreenche: m.quemPreenche,
      }));

    setValues({});
    setErrors({});
    setError("");
    setDate(todayIso);
    setDuration("");
    setStravaFilledMap({});
    setMetaFilled({});
    setStravaDetailWarning("");
    setSelectedStravaId(null);

    const activityToApply = keepManualChoice
      ? stravaActivities.find((a) => a.id === selectedStravaId) ?? null
      : stravaActivities[0] ?? null;

    if (activityToApply) {
      applyStravaForSession(activityToApply, nextAllowed, true);
    }
  }

  function handleRoutineChange(nextId: string) {
    setSelectedRoutineId(nextId);
    const nextEntry = routineOptions?.find((opt) => opt.routine.id === nextId);
    const nextCandidates = sessionCandidates(nextEntry?.tracking ?? null, student.id);
    const nextSess = nextCandidates[0];
    setSessionId(nextSess?.sessaoId || "");
    resetAndMaybeApplyStrava(nextSess?.metricas || [], false);
  }

  function handleSessionChange(nextSessionId: string) {
    setSessionId(nextSessionId);
    const nextSess = candidates.find((s) => s.sessaoId === nextSessionId);
    resetAndMaybeApplyStrava(nextSess?.metricas || [], true);
  }

  useEffect(() => {
    if (!student.id) return;
    let active = true;

    async function loadStudentStrava() {
      try {
        setLoadingStrava(true);
        setStravaLoadError("");
        const status = await stravaService.obterStatusAluno(student.id);
        if (!active) return;
        setStravaStatus(status);
        if (status.conectado && !status.expirado) {
          const acts = await stravaService.listarAtividadesAluno(student.id, 10);
          if (!active) return;
          setStravaActivities(acts);
          if (acts.length > 0) {
            applyStravaForSession(acts[0], mappableAllowed, false);
          }
        } else {
          setStravaActivities([]);
          setSelectedStravaId(null);
        }
      } catch (err) {
        if (active) {
          setStravaLoadError(
            authError(err, "Não foi possível carregar as atividades Strava do aluno.").message
          );
        }
      } finally {
        if (active) setLoadingStrava(false);
      }
    }

    void loadStudentStrava();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

  const selectedActivity = useMemo(
    () => stravaActivities.find((a) => a.id === selectedStravaId) ?? null,
    [stravaActivities, selectedStravaId]
  );

  // Enriquecimento on-demand de CALORIAS para o personal via endpoint do aluno (OQ1 + fallback 429)
  useEffect(() => {
    if (!student.id || !selectedActivity || mappableAllowed.length === 0) return;
    if (!activityNeedsCaloriesDetail(selectedActivity, mappableAllowed, "PERSONAL")) return;
    if (detailRequestedIdsRef.current.has(selectedActivity.id)) return;

    let active = true;
    detailRequestedIdsRef.current.add(selectedActivity.id);
    setLoadingCaloriesDetail(true);
    setStravaDetailWarning("");

    stravaService
      .obterDetalheAtividadeAluno(student.id, selectedActivity.id)
      .then((detail) => {
        if (!active) return;
        setStravaActivities((prev) =>
          prev.map((item) => (item.id === detail.id ? { ...item, ...detail } : item))
        );
        if (detail.calorias != null) {
          const updates: Record<string, string> = {};
          const filledAdditions: Record<string, string> = {};
          for (const m of mappableAllowed) {
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
            "Limite de requisições do Strava atingido ao consultar calorias. Demais campos importados foram mantidos; informe calorias manualmente se necessário."
          );
        } else {
          setStravaDetailWarning(
            "Não foi possível consultar calorias detalhadas no Strava agora. Você pode preencher manualmente."
          );
        }
      })
      .finally(() => {
        if (active) setLoadingCaloriesDetail(false);
      });

    return () => {
      active = false;
    };
  }, [student.id, selectedActivity, mappableAllowed]);

  function handleSelectStrava(actId: string) {
    if (!actId) {
      applyStravaForSession(null, mappableAllowed, false);
      return;
    }
    const act = stravaActivities.find((a) => a.id === actId) ?? null;
    applyStravaForSession(act, mappableAllowed, false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || busy) return;

    const invalid: Record<string, string> = {};
    if (!selected) invalid.session = "Selecione uma sessão planejada.";
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(new Date(date + "T12:00:00").getTime()) ||
      date > localDateKey(new Date())
    ) {
      invalid.date = "Informe uma data válida, até hoje.";
    }
    if (duration.trim()) {
      const durNum = Number(duration.trim());
      if (!/^\d+$/.test(duration.trim()) || durNum < 1 || durNum > 1440) {
        invalid.duration = "Informe a duração em minutos inteiros entre 1 e 1440.";
      }
    }

    for (const metric of allowed) {
      const rawVal = values[metric.id] || "";
      if (!rawVal.trim()) continue;
      const msg = validateMetricValue(metric.tipo, rawVal, metric.unidade, metric.campoStrava);
      if (msg) invalid[metric.id] = msg;
    }

    if (
      allowed.some((metric) => metric.obrigatoria !== false) &&
      !allowed.some((metric) => (values[metric.id] || "").trim())
    ) {
      invalid.results = "Preencha pelo menos uma métrica obrigatória da sessão.";
    }

    setErrors(invalid);
    if (Object.keys(invalid).length || blocked || !selected) return;

    const stravaAtividadeIdToSubmit = resolveStravaAtividadeIdToSubmit({
      selectedActivityId: selectedStravaId,
      metrics: mappableAllowed,
      currentMetricValues: values,
      stravaFilledMap,
      currentDataReal: date,
      currentDuracao: duration,
      metaFilled,
      baseline: baselineRef.current,
    });

    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await studentProfileService.execute(sessionId, {
        alunoId: student.id,
        dataReal: date,
        duracao: duration.trim() ? Number(duration.trim()) : null,
        nivelCansaco: rpe,
        stravaAtividadeId: stravaAtividadeIdToSubmit,
        resultados: allowed
          .filter((metric) => (values[metric.id] || "").trim())
          .map((metric) => ({
            metricaId: metric.id,
            valor: normalizeMetricInput(
              metric.tipo,
              values[metric.id],
              metric.unidade,
              metric.campoStrava
            ),
          })),
      });
      onSaved();
    } catch (err) {
      setError(authError(err, "Não foi possível salvar a sessão. Tente novamente.").message);
      if (axios.isAxiosError(err) && err.response?.data?.invalidFields) {
        setErrors(err.response.data.invalidFields);
      }
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <WorkspaceDialog
      className="session-register-dialog"
      title="Registrar sessão"
      description={`${student.usuario.nome} · ${currentRoutine.titulo}`}
      icon="/student-profile/imgIconActivity2.svg"
      onClose={onClose}
      busy={busy}
    >
      {error && (
        <p className="workspace-dialog__error" role="alert">
          {error}
        </p>
      )}
      <form className="session-register__form" onSubmit={save} noValidate>
        {routineOptions && routineOptions.length > 1 && (
          <FormField
            id="session-routine"
            label="Rotina / modalidade"
            value={currentRoutine.id}
            options={routineOptions.map((opt) => ({
              value: opt.routine.id,
              label: `${opt.routine.nomeModalidade || opt.routine.modalidade?.nome || "Rotina"} · ${
                opt.routine.titulo
              }`,
            }))}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => handleRoutineChange(e.target.value)}
          />
        )}

        <FormField
          id="session-choice"
          label="Sessão planejada (priorizando não realizadas)"
          value={sessionId}
          options={candidates.map((s, idx) => ({
            value: s.sessaoId,
            label: formatCandidateOption(s, idx),
          }))}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => handleSessionChange(e.target.value)}
          error={errors.session}
          disabled={!candidates.length}
          required
        />

        {/* Sincronização com Strava do aluno */}
        {loadingStrava ? (
          <div className="session-register__strava-box">
            <p className="session-register__strava-muted">
              Consultando atividades Strava do aluno...
            </p>
          </div>
        ) : stravaLoadError ? (
          <div className="session-register__strava-box session-register__strava-box--warn" role="alert">
            {stravaLoadError}
          </div>
        ) : stravaStatus?.conectado && stravaStatus.expirado ? (
          <div className="session-register__strava-box session-register__strava-box--warn" role="status">
            Conexão Strava do aluno expirada — peça para o aluno reconectar a conta para liberar a
            importação automática.
          </div>
        ) : stravaStatus?.conectado && stravaActivities.length > 0 ? (
          <div className="session-register__strava-box">
            <div className="session-register__strava-head">
              <label htmlFor="personal-strava-select">Preencher com dados do Strava do aluno</label>
              {selectedStravaId && (
                <span className="session-register__strava-badge">Atividade vinculada</span>
              )}
            </div>
            <select
              id="personal-strava-select"
              value={selectedStravaId || ""}
              disabled={busy}
              onChange={(e) => handleSelectStrava(e.target.value)}
            >
              {stravaActivities.map((act) => (
                <option key={act.id} value={act.id}>
                  {act.esporte || act.tipo}: {act.nome} — {formatStravaDate(act.data)} (
                  {act.distanciaFormatada || (act.distanciaKm ? `${act.distanciaKm} km` : "")}
                  {act.tempoFormatado ? ` · ${act.tempoFormatado}` : ""})
                </option>
              ))}
              <option value="">Não importar do Strava (preencher manualmente)</option>
            </select>
            {loadingCaloriesDetail && (
              <p className="session-register__strava-muted">
                Buscando calorias detalhadas no Strava...
              </p>
            )}
            {stravaDetailWarning && (
              <p className="session-register__strava-warn" role="status">
                {stravaDetailWarning}
              </p>
            )}
          </div>
        ) : stravaStatus?.conectado ? (
          <div className="session-register__strava-box">
            <p className="session-register__strava-muted">
              Nenhuma atividade Strava recente encontrada para este aluno.
            </p>
          </div>
        ) : null}

        {selectedParsed && selectedParsed.activities.length > 0 && (
          <div className="session-register__preview" aria-label="Atividades da sessão selecionada">
            <strong>{selectedParsed.sessionName || "Atividades planejadas nesta sessão"}</strong>
            <ul>
              {selectedParsed.activities.map((act, idx) => (
                <li key={act.id}>
                  <span>
                    {idx + 1}. {act.title}
                  </span>
                  {act.description && <small> · {act.description}</small>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="session-register__grid">
          <FormField
            id="session-date"
            label="Data da sessão"
            type="date"
            value={date}
            max={todayIso}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setDate(e.target.value);
              setErrors((prev) => ({ ...prev, date: "" }));
            }}
            error={errors.date}
            required
          />
          <FormField
            id="session-duration"
            label="Duração (minutos)"
            type="number"
            min="1"
            max="1440"
            step="1"
            value={duration}
            placeholder="Ex.: 52"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setDuration(e.target.value);
              setErrors((prev) => ({ ...prev, duration: "" }));
            }}
            error={errors.duration}
          />
        </div>

        <div className="session-register__metrics-title">
          <strong>Métricas da sessão</strong>
          <StudentSports
            student={{
              ...student,
              modalidades: student.modalidades.filter((m) => m.id === currentRoutine.modalidadeId),
            }}
          />
        </div>

        {sessionMetrics.length === 0 ? (
          <p className="session-register__empty-metrics">
            Esta sessão não possui métricas customizadas — registre data, duração e RPE.
          </p>
        ) : (
          <div className="session-register__metrics-grid">
            {sessionMetrics.map((metric) => {
              const isStudentOnly = metric.quemPreenche === "ALUNO";
              const fieldId = `session-metric-${metric.id}`;
              const isFromStrava =
                !isStudentOnly &&
                Boolean(
                  stravaFilledMap[metric.id] &&
                    valuesMatchForStrava(values[metric.id], stravaFilledMap[metric.id], metric)
                );

              return (
                <div
                  key={metric.id}
                  className={`session-register__metric-card ${
                    isStudentOnly ? "is-blocked" : ""
                  }`}
                >
                  <div className="session-register__metric-head">
                    <label htmlFor={fieldId}>
                      {metric.titulo}
                      {metric.obrigatoria !== false ? " *" : ""}
                    </label>
                    <span className="session-register__metric-unit">
                      {metricUnitOrTypeLabel(metric.tipo, metric.unidade)}
                    </span>
                  </div>
                  <MetricValueInput
                    id={fieldId}
                    ariaLabel={metric.titulo}
                    value={isStudentOnly ? "" : values[metric.id] || ""}
                    tipo={metric.tipo}
                    unidade={metric.unidade}
                    campoStrava={metric.campoStrava}
                    disabled={busy || isStudentOnly}
                    error={isStudentOnly ? undefined : errors[metric.id]}
                    fromStrava={isFromStrava}
                    placeholder={isStudentOnly ? "Exclusivo do aluno" : undefined}
                    onChange={(nextVal) => {
                      if (isStudentOnly) return;
                      setValues((previous) => ({ ...previous, [metric.id]: nextVal }));
                      setErrors((previous) => ({ ...previous, [metric.id]: "", results: "" }));
                    }}
                  />
                  {isStudentOnly && (
                    <span className="session-register__metric-hint">
                      Preenchimento exclusivo do aluno.
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {errors.results && (
          <p className="workspace-dialog__error" role="alert">
            {errors.results}
          </p>
        )}

        {/* Percepção de esforço inline (opcional) */}
        <div className="session-register__rpe-block">
          <div className="session-register__rpe-header">
            <strong>Esforço percebido — Escala de Borg CR-10 (opcional)</strong>
            <span>Clique no valor relatado ou deixe sem seleção para pular</span>
          </div>
          <div className="session-register__rpe" role="group" aria-label="Nível de esforço">
            {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
              <button
                key={value}
                type="button"
                data-level={value}
                aria-pressed={rpe === value}
                disabled={busy}
                onClick={() => setRpe(rpe === value ? null : value)}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="session-register__scale">
            <span>Muito leve</span>
            <span>Moderado</span>
            <span>Máximo</span>
          </div>
          <div className="session-register__effort" role="status">
            <strong>{rpe ?? "—"}</strong>
            <div>
              <b>
                {rpe === null
                  ? "Esforço não informado"
                  : rpe <= 2
                  ? "Muito leve"
                  : rpe <= 4
                  ? "Leve"
                  : rpe <= 6
                  ? "Moderado"
                  : rpe <= 8
                  ? "Muito intenso"
                  : "Esforço máximo"}
              </b>
              <p>
                {rpe === null
                  ? "Você pode salvar sem informar o RPE."
                  : "Percepção de esforço relatada pelo aluno."}
              </p>
            </div>
          </div>
        </div>

        <p className="session-register__info">
          <img src="/student-profile/imgIconZap2.svg" alt="" />
          Os resultados serão registrados para este aluno. A data planejada será preservada.
        </p>
        {blocked && <p className="workspace-dialog__error">{blocked}</p>}

        <footer className="workspace-dialog__actions">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          {blocked ? (
            <UnavailableAction reason={blocked}>Salvar sessão</UnavailableAction>
          ) : (
            <Button type="submit" loading={busy}>
              Salvar sessão
            </Button>
          )}
        </footer>
      </form>
    </WorkspaceDialog>
  );
}
