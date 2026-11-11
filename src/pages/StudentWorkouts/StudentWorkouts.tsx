import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Clock,
  Info,
  Calendar,
  CheckCircle2,
  Activity,
  Search,
  X,
  Filter,
} from "lucide-react";
import Badge from "../../components/Badge/Badge";
import Button from "../../components/Button/Button";
import SportTag from "../../components/SportTag/SportTag";
import StudentModalityTabs from "../../components/StudentModalityTabs/StudentModalityTabs";
import { useStudentArea } from "../../features/studentArea/StudentContext";
import {
  filterStudentSessions,
  sportKeyFromName,
} from "../../features/studentArea/studentAreaModel";
import { parseAtividades } from "../../utils/activityParser";
import "./StudentWorkouts.css";

type SessionStatusFilter = "todas" | "pendentes" | "finalizadas";

export default function StudentWorkouts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    activeRoutine,
    activeRoutines,
    selectedModalityFilter,
    setSelectedModalityFilter,
    loading,
    selectedWeekNum,
    setSelectedWeekNum,
    weeks,
    searchQuery,
    setSearchQuery,
    openRpeModal,
  } = useStudentArea();

  const isHybrid = activeRoutines.length > 1;
  const isUnifiedCalendar = isHybrid && selectedModalityFilter === "ALL";

  const [statusFilter, setStatusFilter] = useState<SessionStatusFilter>("todas");
  const [dayFilter, setDayFilter] = useState<string>("TODOS");
  const [highlightedSessionId, setHighlightedSessionId] = useState<string | null>(null);

  // Sincroniza parâmetros da URL (?busca=..., ?semana=..., ?sessao=...)
  useEffect(() => {
    const q = searchParams.get("busca");
    if (q !== null) {
      setSearchQuery(q);
    }

    const semanaParam = searchParams.get("semana");
    if (semanaParam) {
      const parsedWeek = Number(semanaParam);
      if (Number.isFinite(parsedWeek) && parsedWeek > 0) {
        setSelectedWeekNum(parsedWeek);
      }
    }

    const sessaoParam = searchParams.get("sessao");
    if (sessaoParam) {
      setHighlightedSessionId(sessaoParam);
      setStatusFilter("todas");
      setDayFilter("TODOS");

      // Se a semana não veio na URL, descobre em qual semana a sessão está
      if (!semanaParam && weeks.length > 0) {
        const weekContainingSession = weeks.find((w) =>
          w.sessoes.some((s) => s.id === sessaoParam)
        );
        if (weekContainingSession && weekContainingSession.estado !== "bloqueada") {
          setSelectedWeekNum(weekContainingSession.numero);
        }
      }
    }
  }, [searchParams, setSearchQuery, setSelectedWeekNum, weeks]);

  // Faz scroll suave até a sessão clicada quando redirecionado do Meu painel
  useEffect(() => {
    if (!highlightedSessionId || loading) return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`sessao-${highlightedSessionId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [highlightedSessionId, selectedWeekNum, loading]);

  const activeWeek = weeks.find((w) => w.numero === selectedWeekNum) || weeks[0];
  const weekSessions = useMemo(() => activeWeek?.sessoes || [], [activeWeek]);

  const pendingInWeekCount = useMemo(
    () => weekSessions.filter((s) => s.status === "PLANEJADA").length,
    [weekSessions]
  );
  const completedInWeekCount = useMemo(
    () =>
      weekSessions.filter((s) => s.status === "CONCLUIDA" || s.status === "VALIDADA").length,
    [weekSessions]
  );

  // Dias da semana disponíveis na semana selecionada para filtro rápido
  const availableDays = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const s of weekSessions) {
      if (s.diaSemana && s.diaSemana !== "S/D" && !seen.has(s.diaSemana)) {
        seen.add(s.diaSemana);
        list.push(s.diaSemana);
      }
    }
    return list;
  }, [weekSessions]);

  // Reseta o filtro de dia caso o usuário troque para uma semana que não possui aquele dia
  useEffect(() => {
    if (dayFilter !== "TODOS" && !availableDays.includes(dayFilter)) {
      setDayFilter("TODOS");
    }
  }, [availableDays, dayFilter]);

  // Filtra e ordena colocando SEMPRE de preferência os treinos que ainda não foram realizados ("PLANEJADA") no topo
  const visibleSessions = useMemo(() => {
    const textFiltered = filterStudentSessions(weekSessions, searchQuery);

    const statusAndDayFiltered = textFiltered.filter((s) => {
      const isCompleted = s.status === "CONCLUIDA" || s.status === "VALIDADA";
      if (statusFilter === "pendentes" && isCompleted) return false;
      if (statusFilter === "finalizadas" && !isCompleted) return false;
      if (dayFilter !== "TODOS" && s.diaSemana !== dayFilter) return false;
      return true;
    });

    // Ordenação: sessões não realizadas (PLANEJADA) vêm primeiro, mantendo a ordem cronológica dentro de cada grupo
    return [...statusAndDayFiltered].sort((a, b) => {
      const aPending = a.status === "PLANEJADA" ? 0 : 1;
      const bPending = b.status === "PLANEJADA" ? 0 : 1;
      if (aPending !== bPending) {
        return aPending - bPending;
      }
      const dateDiff = (a.dataPlanejadaIso || "").localeCompare(b.dataPlanejadaIso || "");
      if (dateDiff !== 0) {
        return dateDiff;
      }
      return (a.numero || 0) - (b.numero || 0);
    });
  }, [weekSessions, searchQuery, statusFilter, dayFilter]);

  const dateCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of weekSessions) {
      const key = s.dataPlanejadaIso || s.dataPlanejada;
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [weekSessions]);

  const totalWeeklyFrequency = useMemo(
    () => activeRoutines.reduce((sum, r) => sum + (r.frequenciaSemanal || 0), 0),
    [activeRoutines]
  );

  // Identifica o ID do primeiro treino pendente da semana para destacá-lo como próximo treino
  const firstPendingSessionId = useMemo(
    () => weekSessions.find((s) => s.status === "PLANEJADA")?.id || null,
    [weekSessions]
  );

  const hasActiveFilters =
    statusFilter !== "todas" || dayFilter !== "TODOS" || Boolean(searchQuery.trim());

  const clearAllFilters = () => {
    setStatusFilter("todas");
    setDayFilter("TODOS");
    setSearchQuery("");
    if (searchParams.has("busca")) {
      const next = new URLSearchParams(searchParams);
      next.delete("busca");
      setSearchParams(next, { replace: true });
    }
  };

  const sportKey = sportKeyFromName(activeRoutine?.modalidade);

  return (
    <div className="student-workouts">
      <StudentModalityTabs
        activeRoutines={activeRoutines}
        selectedFilter={selectedModalityFilter}
        onSelect={(filter) => {
          setSelectedModalityFilter(filter);
          setHighlightedSessionId(null);
        }}
      />

      {/* Top Active Routine Banner */}
      <section className="student-workouts__banner" aria-label="Rotina ativa">
        <div className="student-workouts__banner-main">
          {isUnifiedCalendar ? (
            <>
              <div className="student-workouts__banner-badges">
                <Badge tone="success">{activeRoutines.length} rotinas ativas</Badge>
                {activeRoutines.map((r) => (
                  <SportTag key={r.id} sport={sportKeyFromName(r.modalidade)} />
                ))}
                <Badge tone="primary">{totalWeeklyFrequency}x por semana no total</Badge>
              </div>
              <h2>Calendário completo de treinos</h2>
              <p>
                Rotinas ativas:{" "}
                {activeRoutines.map((r) => `${r.modalidade} (${r.titulo})`).join(" · ")}
              </p>
            </>
          ) : (
            <>
              <div className="student-workouts__banner-badges">
                <Badge tone="success">
                  {activeRoutine ? "Rotina ativa" : "Nenhuma rotina ativa"}
                </Badge>
                {activeRoutine && <SportTag sport={sportKey} />}
                {activeRoutine && (
                  <Badge tone="primary">{activeRoutine.frequenciaSemanal}x por semana</Badge>
                )}
              </div>
              <h2>{activeRoutine ? activeRoutine.titulo : "Aguardando novo treino do seu personal"}</h2>
              <p>
                {activeRoutine
                  ? `Objetivo: ${activeRoutine.objetivos}`
                  : "Seu personal trainer ainda não vinculou uma rotina ativa à sua conta."}
              </p>
            </>
          )}
        </div>

        {(activeRoutine || isUnifiedCalendar) && activeWeek && (
          <div className="student-workouts__banner-summary">
            <span className="student-workouts__banner-week-pill">
              <Calendar size={14} aria-hidden="true" />
              Semana {activeWeek.numero} · {completedInWeekCount}/{weekSessions.length}{" "}
              {weekSessions.length === 1 ? "sessão finalizada" : "sessões finalizadas"}
            </span>
          </div>
        )}
      </section>

      {/* Full-Width Weekly Sessions Section */}
      <section className="student-workouts__sessions-card" aria-label="Sessões da semana">
        <header className="student-workouts__sessions-header">
          <div>
            <h2>Sessões da semana</h2>
            <p className="student-workouts__sessions-subtitle">
              Treinos ainda não realizados aparecem primeiro. Clique em “Finalizar sessão” para enviar suas métricas ao personal
            </p>
          </div>

          {weeks.length > 0 && (
            <div className="student-workouts__week-tabs" role="tablist" aria-label="Semanas da rotina">
              {weeks.map((week) => {
                const isSelected = week.numero === selectedWeekNum;
                const isLocked = week.estado === "bloqueada";
                return (
                  <button
                    key={week.numero}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    disabled={isLocked}
                    className={`student-workouts__week-tab${isSelected ? " is-active" : ""}${
                      isLocked ? " is-locked" : ""
                    }`}
                    onClick={() => {
                      if (!isLocked) {
                        setSelectedWeekNum(week.numero);
                        setHighlightedSessionId(null);
                      }
                    }}
                  >
                    <span className="student-workouts__week-tab-title">
                      {isLocked && (
                        <img src="/workspace/402-2299-imgIconLock.svg" alt="" aria-hidden="true" />
                      )}
                      {week.titulo}
                    </span>
                    <small>{week.periodo}</small>
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* Barra de Filtros (Status, Dia da Semana e Busca) */}
        {weekSessions.length > 0 && (
          <div className="student-workouts__filters-bar" aria-label="Filtros de sessões">
            <div className="student-workouts__filters-group">
              <span className="student-workouts__filters-label">
                <Filter size={13} aria-hidden="true" />
                Status:
              </span>
              <div className="student-workouts__filter-pills" role="group" aria-label="Filtrar por status">
                <button
                  type="button"
                  className={`student-workouts__filter-pill${
                    statusFilter === "todas" ? " is-active" : ""
                  }`}
                  onClick={() => setStatusFilter("todas")}
                >
                  Todas <span>{weekSessions.length}</span>
                </button>
                <button
                  type="button"
                  className={`student-workouts__filter-pill${
                    statusFilter === "pendentes" ? " is-active" : ""
                  }`}
                  onClick={() => setStatusFilter("pendentes")}
                >
                  Não realizadas <span>{pendingInWeekCount}</span>
                </button>
                <button
                  type="button"
                  className={`student-workouts__filter-pill${
                    statusFilter === "finalizadas" ? " is-active" : ""
                  }`}
                  onClick={() => setStatusFilter("finalizadas")}
                >
                  Finalizadas <span>{completedInWeekCount}</span>
                </button>
              </div>

              {availableDays.length > 1 && (
                <div
                  className="student-workouts__filter-pills student-workouts__filter-pills--days"
                  role="group"
                  aria-label="Filtrar por dia da semana"
                >
                  <button
                    type="button"
                    className={`student-workouts__filter-pill${
                      dayFilter === "TODOS" ? " is-active" : ""
                    }`}
                    onClick={() => setDayFilter("TODOS")}
                  >
                    Todos os dias
                  </button>
                  {availableDays.map((day) => (
                    <button
                      key={day}
                      type="button"
                      className={`student-workouts__filter-pill${
                        dayFilter === day ? " is-active" : ""
                      }`}
                      onClick={() => setDayFilter(day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="student-workouts__search-box">
              <Search size={14} className="student-workouts__search-icon" aria-hidden="true" />
              <input
                type="search"
                placeholder="Filtrar por atividade ou orientação..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Filtrar sessões por atividade ou orientação"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="student-workouts__search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpar texto da busca"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="student-workouts__session-list">
          {loading ? (
            <div className="student-workouts__empty">
              <p>Carregando treinos da sua rotina...</p>
            </div>
          ) : visibleSessions.length === 0 ? (
            <div className="student-workouts__empty">
              <p>
                {hasActiveFilters
                  ? "Nenhuma sessão encontrada para os filtros selecionados."
                  : "Nenhuma sessão planejada para esta semana."}
              </p>
              {hasActiveFilters && (
                <Button variant="secondary" onClick={clearAllFilters}>
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            visibleSessions.map((sessao, idx) => {
              const parsed = parseAtividades(sessao.descricao);
              const sessionNumber = sessao.numero || idx + 1;
              const sessionTitle = parsed.sessionName
                ? `Sessão ${sessionNumber} · ${parsed.sessionName}`
                : `Sessão ${sessionNumber}`;
              const isCompleted =
                sessao.status === "CONCLUIDA" || sessao.status === "VALIDADA";
              const isNextPending = sessao.id === firstPendingSessionId && !isCompleted;
              const isHighlighted = sessao.id === highlightedSessionId;
              const dateKey = sessao.dataPlanejadaIso || sessao.dataPlanejada;
              const daySessionCount = dateKey ? dateCounts.get(dateKey) || 0 : 0;

              return (
                <article
                  key={sessao.id}
                  id={`sessao-${sessao.id}`}
                  className={`student-workouts__session-card${
                    isCompleted ? " is-completed" : " is-pending"
                  }${isNextPending ? " is-next-pending" : ""}${
                    isHighlighted ? " is-highlighted" : ""
                  }`}
                >
                  {/* Cabeçalho do Card da Sessão */}
                  <div className="student-workouts__session-top">
                    <div className="student-workouts__session-title-group">
                      <div
                        className={`student-workouts__date-box${
                          isCompleted ? " is-completed" : ""
                        }`}
                      >
                        <span>{sessao.diaSemana}</span>
                        <strong>{sessao.dataPlanejada}</strong>
                      </div>

                      <div className="student-workouts__session-heading">
                        <div className="student-workouts__session-heading-row">
                          <h3>{sessionTitle}</h3>
                          {isHybrid && sessao.modalidadeNome && (
                            <SportTag sport={sportKeyFromName(sessao.modalidadeNome)} />
                          )}
                          {isUnifiedCalendar && daySessionCount > 1 && (
                            <Badge tone="info">{daySessionCount} treinos no dia</Badge>
                          )}
                          {isNextPending && (
                            <Badge tone="primary">Próximo treino</Badge>
                          )}
                          {!isCompleted && !isNextPending && (
                            <Badge tone="warning">Não realizado</Badge>
                          )}
                        </div>
                        <span className="student-workouts__session-week-tag">
                          {isUnifiedCalendar && sessao.rotinaTitulo
                            ? `${sessao.rotinaTitulo} · `
                            : ""}
                          Semana {sessao.semana}
                          {sessao.dataReal ? ` · Realizada em ${sessao.dataReal}` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="student-workouts__session-actions">
                      {sessao.duracaoPlanejada && (
                        <div className="student-workouts__duration-badge" title="Duração estimada">
                          <Clock size={14} aria-hidden="true" />
                          <span>{sessao.duracaoPlanejada} min</span>
                        </div>
                      )}

                      {isCompleted ? (
                        <Badge tone={sessao.status === "VALIDADA" ? "info" : "success"}>
                          <CheckCircle2 size={13} style={{ marginRight: 4 }} aria-hidden="true" />
                          {sessao.status === "VALIDADA"
                            ? "Validada pelo personal"
                            : "Sessão finalizada"}
                        </Badge>
                      ) : (
                        <Button onClick={() => openRpeModal(sessao.id)}>
                          Finalizar sessão
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Blocos Numerados de Atividades */}
                  {parsed.activities.length > 0 ? (
                    <div className="student-workouts__activities-list" aria-label="Atividades da sessão">
                      {parsed.activities.map((act, actIdx) => (
                        <div key={act.id} className="student-workouts__activity-item">
                          <span className="student-workouts__activity-num" aria-hidden="true">
                            {actIdx + 1}
                          </span>
                          <div className="student-workouts__activity-body">
                            <strong>{act.title}</strong>
                            {act.description && <p>{act.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !parsed.orientations &&
                    sessao.descricao && (
                      <p className="student-workouts__fallback-desc">{sessao.descricao}</p>
                    )
                  )}

                  {/* Caixa de Orientações em Destaque */}
                  {parsed.orientations && (
                    <div className="student-workouts__orientations-box">
                      <Info size={16} className="student-workouts__orientations-icon" aria-hidden="true" />
                      <div>
                        <strong>Orientações do personal</strong>
                        <p>{parsed.orientations}</p>
                      </div>
                    </div>
                  )}

                  {/* Resumo de Métricas e RPE enviados após finalizar a sessão */}
                  {isCompleted &&
                    ((sessao.resultados && sessao.resultados.length > 0) ||
                      typeof sessao.rpe === "number" ||
                      typeof sessao.duracaoReal === "number") && (
                      <div className="student-workouts__results-box" aria-label="Métricas enviadas">
                        <div className="student-workouts__results-header">
                          <Activity size={14} aria-hidden="true" />
                          <span>Métricas e execução enviadas</span>
                        </div>
                        <div className="student-workouts__results-grid">
                          {typeof sessao.duracaoReal === "number" && (
                            <div className="student-workouts__result-pill">
                              <span>Duração real</span>
                              <strong>{sessao.duracaoReal} min</strong>
                            </div>
                          )}
                          {typeof sessao.rpe === "number" && (
                            <div className="student-workouts__result-pill">
                              <span>Esforço (RPE Borg)</span>
                              <strong>{sessao.rpe}/10</strong>
                            </div>
                          )}
                          {sessao.resultados?.map((res) => (
                            <div key={res.metricaId} className="student-workouts__result-pill">
                              <span>{res.titulo}</span>
                              <strong>
                                {res.valor}
                                {res.unidade ? ` ${res.unidade}` : ""}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </article>
              );
            })
          )}
        </div>

        <footer className="student-workouts__readonly-note">
          <img src="/workspace/402-2299-imgIconLock.svg" alt="" aria-hidden="true" />
          <span>
            O planejamento é definido pelo seu personal. Ao concluir um treino, clique em “Finalizar sessão” para registrar suas métricas e esforço percebido.
          </span>
        </footer>
      </section>
    </div>
  );
}

