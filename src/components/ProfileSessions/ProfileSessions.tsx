import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Search, X } from "lucide-react";
import Button from "../Button/Button";
import Badge from "../Badge/Badge";
import { displayDate } from "../../features/personal/dashboardModel";
import { parseAtividades } from "../../utils/activityParser";
import type { TrainingSession } from "../../types/personalDashboard";
import type { RotinaResponse } from "../../types/rotina";
import "./ProfileSessions.css";

type RecentStatusFilter = "all" | "pending" | "completed" | "awaiting_validation";
type HistoryScopeFilter = "all_routines" | "active_only";

export default function ProfileSessions({
  sessions,
  recent = false,
  activeRoutine = null,
  routines = [],
  studentId,
  onHistory,
}: {
  sessions: TrainingSession[];
  recent?: boolean;
  activeRoutine?: RotinaResponse | null;
  routines?: RotinaResponse[];
  studentId?: string;
  onHistory?: () => void;
}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<RecentStatusFilter>("all");
  const [weekFilter, setWeekFilter] = useState<number | "ALL">("ALL");
  const [historyScope, setHistoryScope] = useState<HistoryScopeFilter>("all_routines");
  const [searchQuery, setSearchQuery] = useState("");
  const [trackedRoutineId, setTrackedRoutineId] = useState<string | undefined>(activeRoutine?.id);

  if (trackedRoutineId !== activeRoutine?.id) {
    setTrackedRoutineId(activeRoutine?.id);
    setStatusFilter("all");
    setWeekFilter("ALL");
    setPage(1);
  }

  const activeRoutineIds = useMemo(
    () => new Set(routines.filter((r) => r.ativo !== false).map((r) => r.id)),
    [routines]
  );
  const activeRoutineCount = activeRoutineIds.size;
  const isUnifiedRecent = recent && !activeRoutine && activeRoutineCount > 1;

  const routineTitleById = useMemo(
    () => new Map(routines.map((r) => [r.id, r.titulo])),
    [routines]
  );

  // Semanas disponíveis (para as sessões da rotina ativa)
  const availableWeeks = useMemo(() => {
    const set = new Set<number>();
    for (const s of sessions) {
      if (typeof s.semana === "number" && s.semana > 0) {
        set.add(s.semana);
      }
    }
    return [...set].sort((a, b) => a - b);
  }, [sessions]);

  const pendingCount = useMemo(
    () => sessions.filter((s) => s.status === "PLANEJADA").length,
    [sessions]
  );
  const completedCount = useMemo(
    () => sessions.filter((s) => s.status === "CONCLUIDA" || s.concluidaAluno).length,
    [sessions]
  );
  const awaitingValidationCount = useMemo(
    () =>
      sessions.filter(
        (s) => (s.status === "CONCLUIDA" || s.concluidaAluno) && !s.validadaPersonal
      ).length,
    [sessions]
  );

  // Filtra e ordena as sessões
  const filteredSessions = useMemo(() => {
    const q = searchQuery
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const filtered = sessions.filter((s) => {
      // No modo Visão Geral (recent), garante que apenas sessões da rotina selecionada (ou de todas ativas) entrem
      if (recent) {
        if (activeRoutine) {
          if (s.rotinaTreinoId !== activeRoutine.id) return false;
        } else if (!isUnifiedRecent || !activeRoutineIds.has(s.rotinaTreinoId)) {
          return false;
        }
      } else if (historyScope === "active_only" && activeRoutine) {
        if (s.rotinaTreinoId !== activeRoutine.id) {
          return false;
        }
      }

      const isCompleted = s.status === "CONCLUIDA" || s.concluidaAluno;
      if (statusFilter === "pending" && isCompleted) return false;
      if (statusFilter === "completed" && !isCompleted) return false;
      if (
        statusFilter === "awaiting_validation" &&
        (!isCompleted || s.validadaPersonal)
      ) {
        return false;
      }

      if (weekFilter !== "ALL" && s.semana !== weekFilter) {
        return false;
      }

      if (q) {
        const parsed = parseAtividades(s.atividades);
        const routineName = routineTitleById.get(s.rotinaTreinoId) || "";
        const haystack = `${parsed.sessionName} ${parsed.activities
          .map((a) => `${a.title} ${a.description}`)
          .join(" ")} ${parsed.orientations} ${routineName} semana ${s.semana}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    if (recent) {
      // Na visão das rotinas ativas: prioriza sessões não realizadas no topo e ordena por data planejada
      return [...filtered].sort((a, b) => {
        const aDone = a.status === "CONCLUIDA" || a.concluidaAluno ? 1 : 0;
        const bDone = b.status === "CONCLUIDA" || b.concluidaAluno ? 1 : 0;
        if (aDone !== bDone) {
          return aDone - bDone;
        }
        const dateDiff = (a.dataPlanejada || "").localeCompare(b.dataPlanejada || "");
        if (dateDiff !== 0) {
          return dateDiff;
        }
        return a.semana - b.semana;
      });
    }

    // No histórico completo: mais recentes primeiro
    return [...filtered].sort((a, b) =>
      (b.dataReal || b.dataPlanejada || "").localeCompare(
        a.dataReal || a.dataPlanejada || ""
      )
    );
  }, [
    sessions,
    recent,
    activeRoutine,
    isUnifiedRecent,
    activeRoutineIds,
    historyScope,
    statusFilter,
    weekFilter,
    searchQuery,
    routineTitleById,
  ]);

  const pageSize = recent ? 6 : 10;
  const pages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const current = Math.min(page, pages);
  const displayed = filteredSessions.slice((current - 1) * pageSize, current * pageSize);

  // Colunas de métricas (prioriza as métricas da rotina ativa quando em recent)
  const metrics = useMemo(() => {
    if (recent && activeRoutine) {
      return activeRoutine.metricas
        .filter((m) => m.tipo !== "TEXTO")
        .slice(0, 2)
        .map((m) => ({
          metricaId: m.id,
          tituloMetrica: m.titulo,
          tipoMetrica: m.tipo,
        }));
    }
    const allMetrics = [
      ...new Map(
        filteredSessions
          .flatMap((s) => s.desempenho?.metricas || [])
          .map((m) => [m.metricaId, m])
      ).values(),
    ];
    return recent
      ? allMetrics.filter((m) => m.tipoMetrica !== "TEXTO").slice(0, 2)
      : allMetrics.filter((m) => m.tipoMetrica !== "TEXTO").slice(0, 3);
  }, [recent, activeRoutine, filteredSessions]);

  const handleRowClick = (sessionId: string) => {
    if (studentId) {
      navigate(`/alunos/${studentId}/sessoes/${sessionId}`);
    }
  };

  return (
    <section className="workspace-card profile-sessions">
      <header className="profile-sessions__header">
        <div className="profile-sessions__title-group">
          <h2>
            {recent
              ? isUnifiedRecent
                ? "Calendário completo (rotinas ativas)"
                : "Sessões da rotina ativa"
              : "Histórico de sessões"}
          </h2>
          {recent && activeRoutine && (
            <Badge tone="primary">{activeRoutine.titulo}</Badge>
          )}
          {recent && isUnifiedRecent && (
            <Badge tone="primary">{activeRoutineCount} rotinas ativas</Badge>
          )}
        </div>
        {onHistory && (
          <button type="button" className="workspace-link" onClick={onHistory}>
            Ver histórico completo →
          </button>
        )}
      </header>

      {/* Barra de filtros */}
      {(recent ? Boolean((activeRoutine || isUnifiedRecent) && sessions.length > 0) : sessions.length > 0) && (
        <div className="profile-sessions__filters">
          <div className="profile-sessions__filter-group">
            <span className="profile-sessions__filter-label">
              <Filter size={13} aria-hidden="true" />
              Filtro:
            </span>

            {recent ? (
              <div className="profile-sessions__pills" role="group" aria-label="Filtrar sessões da rotina ativa">
                <button
                  type="button"
                  className={`profile-sessions__pill${statusFilter === "all" ? " is-active" : ""}`}
                  onClick={() => {
                    setStatusFilter("all");
                    setPage(1);
                  }}
                >
                  Todas <span>{sessions.length}</span>
                </button>
                <button
                  type="button"
                  className={`profile-sessions__pill${
                    statusFilter === "pending" ? " is-active" : ""
                  }`}
                  onClick={() => {
                    setStatusFilter("pending");
                    setPage(1);
                  }}
                >
                  Não realizadas <span>{pendingCount}</span>
                </button>
                <button
                  type="button"
                  className={`profile-sessions__pill${
                    statusFilter === "completed" ? " is-active" : ""
                  }`}
                  onClick={() => {
                    setStatusFilter("completed");
                    setPage(1);
                  }}
                >
                  Concluídas <span>{completedCount}</span>
                </button>
                {awaitingValidationCount > 0 && (
                  <button
                    type="button"
                    className={`profile-sessions__pill${
                      statusFilter === "awaiting_validation" ? " is-active" : ""
                    }`}
                    onClick={() => {
                      setStatusFilter("awaiting_validation");
                      setPage(1);
                    }}
                  >
                    Aguardando validação <span>{awaitingValidationCount}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="profile-sessions__pills" role="group" aria-label="Filtrar histórico">
                <button
                  type="button"
                  className={`profile-sessions__pill${
                    historyScope === "all_routines" ? " is-active" : ""
                  }`}
                  onClick={() => {
                    setHistoryScope("all_routines");
                    setPage(1);
                  }}
                >
                  Todas as rotinas
                </button>
                {activeRoutine && (
                  <button
                    type="button"
                    className={`profile-sessions__pill${
                      historyScope === "active_only" ? " is-active" : ""
                    }`}
                    onClick={() => {
                      setHistoryScope("active_only");
                      setPage(1);
                    }}
                  >
                    {activeRoutineCount > 1
                      ? `Somente: ${activeRoutine.titulo}`
                      : "Somente rotina ativa"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="profile-sessions__controls">
            {recent && availableWeeks.length > 1 && (
              <select
                className="profile-sessions__week-select"
                aria-label="Filtrar por semana"
                value={weekFilter === "ALL" ? "ALL" : String(weekFilter)}
                onChange={(e) => {
                  const val = e.target.value;
                  setWeekFilter(val === "ALL" ? "ALL" : Number(val));
                  setPage(1);
                }}
              >
                <option value="ALL">Todas as semanas ({availableWeeks.length})</option>
                {availableWeeks.map((wk) => (
                  <option key={wk} value={String(wk)}>
                    Semana {wk}
                  </option>
                ))}
              </select>
            )}

            <div className="profile-sessions__search">
              <Search size={13} className="profile-sessions__search-icon" aria-hidden="true" />
              <input
                type="search"
                placeholder="Buscar sessão ou atividade..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                aria-label="Buscar sessão ou atividade"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="profile-sessions__search-clear"
                  onClick={() => {
                    setSearchQuery("");
                    setPage(1);
                  }}
                  aria-label="Limpar busca"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {recent && !activeRoutine && !isUnifiedRecent ? (
        <p className="profile-sessions__empty">
          Nenhuma rotina ativa vinculada a este aluno no momento. As sessões de rotinas anteriores podem ser consultadas na aba <strong>Histórico</strong>.
        </p>
      ) : !filteredSessions.length ? (
        <p className="profile-sessions__empty">
          {sessions.length > 0
            ? "Nenhuma sessão encontrada para os filtros selecionados."
            : recent
            ? "Nenhuma sessão cadastrada na rotina ativa deste aluno."
            : "Nenhuma sessão registrada no histórico deste aluno."}
        </p>
      ) : (
        <>
          <div
            className="profile-sessions__scroll"
            tabIndex={0}
            role="region"
            aria-label={recent ? "Sessões da rotina ativa" : "Histórico de sessões"}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Sessão / Atividades</th>
                  <th scope="col">{recent ? "Data / Duração" : "Data"}</th>
                  {!recent && <th scope="col">Duração</th>}
                  {metrics.map((m) => (
                    <th scope="col" key={m.metricaId}>{m.tituloMetrica}</th>
                  ))}
                  <th scope="col">RPE</th>
                  <th scope="col">Status</th>
                  {!recent && <th scope="col">Fonte</th>}
                </tr>
              </thead>
              <tbody>
                {displayed.map((s) => {
                  const parsed = parseAtividades(s.atividades);
                  const sessionTitle =
                    parsed.sessionName ||
                    parsed.activities[0]?.title ||
                    `Sessão da Semana ${s.semana}`;
                  const usedFirstActivityAsTitle =
                    !parsed.sessionName && Boolean(parsed.activities[0]?.title);
                  const previewActivities = usedFirstActivityAsTitle
                    ? parsed.activities.slice(1)
                    : parsed.activities;
                  const activitiesPreview =
                    previewActivities.length > 0
                      ? previewActivities
                          .slice(0, 2)
                          .map(
                            (a, idx) =>
                              `${usedFirstActivityAsTitle ? idx + 2 : idx + 1}. ${a.title}`
                          )
                          .join(" · ") +
                        (previewActivities.length > 2
                          ? ` (+${previewActivities.length - 2})`
                          : "")
                      : "";
                  const isCompleted = s.status === "CONCLUIDA" || s.concluidaAluno;
                  const routineName =
                    !recent || isUnifiedRecent
                      ? routineTitleById.get(s.rotinaTreinoId)
                      : null;
                  const durationPrefix =
                    recent && s.duracao !== null ? `${s.duracao} min · ` : "";

                  return (
                    <tr
                      key={s.id}
                      className={studentId ? "is-clickable" : ""}
                      onClick={() => handleRowClick(s.id)}
                      title={studentId ? "Clique para ver detalhes da sessão" : undefined}
                    >
                      <td>
                        <div className="profile-sessions__session-cell">
                          <strong>
                            Semana {s.semana} · {sessionTitle}
                          </strong>
                          {activitiesPreview && (
                            <span className="profile-sessions__session-sub">
                              {activitiesPreview}
                            </span>
                          )}
                          {routineName && (
                            <span className="profile-sessions__session-routine">
                              Rotina: {routineName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="profile-sessions__date-cell">
                          {s.dataReal ? (
                            <>
                              <strong>{displayDate(s.dataReal)}</strong>
                              <span>
                                {durationPrefix}Planejada: {displayDate(s.dataPlanejada)}
                              </span>
                            </>
                          ) : (
                            <>
                              <strong>{displayDate(s.dataPlanejada)}</strong>
                              <span>{durationPrefix}Data planejada</span>
                            </>
                          )}
                        </div>
                      </td>
                      {!recent && (
                        <td>{s.duracao === null ? "—" : `${s.duracao} min`}</td>
                      )}
                      {metrics.map((m) => (
                        <td key={m.metricaId}>
                          {s.desempenho?.metricas.find((v) => v.metricaId === m.metricaId)
                            ?.valor || "—"}
                        </td>
                      ))}
                      <td>
                        <span className="profile-sessions__rpe">
                          {s.desempenho?.nivelCansaco === null ||
                          s.desempenho?.nivelCansaco === undefined
                            ? "—"
                            : `${s.desempenho.nivelCansaco}/10`}
                        </span>
                      </td>
                      <td>
                        <div className="profile-sessions__status-badges">
                          {!isCompleted ? (
                            <Badge tone="neutral">Não realizada</Badge>
                          ) : s.validadaPersonal ? (
                            <Badge tone="success">Validada</Badge>
                          ) : (
                            <Badge tone="warning">Aguardando validação</Badge>
                          )}
                          {s.temPendenciasPersonal && (
                            <Badge tone="primary">
                              {s.quantidadePendenciasPersonal || 1} métrica(s) do personal
                            </Badge>
                          )}
                        </div>
                      </td>
                      {!recent && (
                        <td>
                          <Badge tone="neutral">
                            {!isCompleted
                              ? "Planejamento"
                              : s.desempenho?.registradoPor === "PERSONAL_TRAINER"
                              ? "Personal"
                              : s.desempenho?.registradoPor === "ALUNO"
                              ? "Aluno"
                              : "Registrada"}
                          </Badge>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <footer>
              <Button
                variant="secondary"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                Anterior
              </Button>
              <span>
                {current} / {pages}
              </span>
              <Button
                variant="secondary"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                Próxima
              </Button>
            </footer>
          )}
        </>
      )}
    </section>
  );
}
