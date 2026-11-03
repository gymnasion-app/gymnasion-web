import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Activity, ArrowRight, CheckCircle2, Info } from "lucide-react";
import Avatar from "../../components/Avatar/Avatar";
import Badge from "../../components/Badge/Badge";
import Button from "../../components/Button/Button";
import SportTag from "../../components/SportTag/SportTag";
import StudentSmoothChart from "../../components/StudentSmoothChart/StudentSmoothChart";
import { useStudentArea } from "../../features/studentArea/StudentContext";
import { stravaService } from "../../services/stravaService";
import type { StravaStatusResponse } from "../../types/strava";
import { parseAtividades } from "../../utils/activityParser";
import "./AccountHome.css";

function parseMetricNumericValue(raw: string): number | null {
  const trimmed = raw.trim();
  // Tempo hh:mm:ss -> segundos
  const hmsMatch = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(trimmed);
  if (hmsMatch) {
    return Number(hmsMatch[1]) * 3600 + Number(hmsMatch[2]) * 60 + Number(hmsMatch[3]);
  }
  // Tempo mm:ss -> segundos
  const timeMatch = /^(\d{1,3}):([0-5]\d)$/.exec(trimmed);
  if (timeMatch) {
    return Number(timeMatch[1]) * 60 + Number(timeMatch[2]);
  }
  const numMatch = /-?\d+(?:[.,]\d+)?/.exec(trimmed);
  if (numMatch) {
    const n = Number(numMatch[0].replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export default function AccountHome() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    student,
    activeRoutine,
    weeks,
    weekDays,
    feedbacks,
    monthlySessionsCount,
    averageRpe,
    openRpeModal,
    setSelectedWeekNum,
    setStravaModalOpen,
  } = useStudentArea();

  const [stravaStatus, setStravaStatus] = useState<StravaStatusResponse | null>(null);

  useEffect(() => {
    stravaService
      .obterStatus()
      .then(setStravaStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
    }
  }, [location.hash]);

  const currentWeek = weeks.find((w) => w.estado === "atual") || weeks[0];

  // Apenas sessões pendentes ("PLANEJADA") entram como próxima sessão a finalizar
  const nextSession =
    currentWeek?.sessoes.find((s) => s.destaque && s.status === "PLANEJADA") ||
    currentWeek?.sessoes.find((s) => s.status === "PLANEJADA") ||
    weeks
      .filter((w) => w.estado !== "bloqueada")
      .flatMap((w) => w.sessoes)
      .find((s) => s.status === "PLANEJADA");

  const nextSessionParsed = useMemo(
    () => (nextSession ? parseAtividades(nextSession.descricao) : null),
    [nextSession]
  );

  const newFeedbacksCount = feedbacks.filter((f) => f.novo).length;
  const completedDaysInWeek = currentWeek
    ? currentWeek.sessoes.filter((s) => s.status !== "PLANEJADA").length
    : 0;
  const totalDaysInWeek = currentWeek ? currentWeek.sessoes.length : 0;

  const studentMetrics = useMemo(
    () => (activeRoutine?.metricas || []).filter((m) => m.quemPreenche !== "PERSONAL"),
    [activeRoutine]
  );

  // Calcula dados reais para o card "Minha evolução" a partir das sessões finalizadas
  const evolutionSummary = useMemo(() => {
    const completedSessions = weeks
      .flatMap((w) => w.sessoes)
      .filter((s) => s.status === "CONCLUIDA" || s.status === "VALIDADA");

    const primaryMetric = studentMetrics[0];

    if (primaryMetric) {
      const entries = completedSessions
        .map((s) => {
          const found = s.resultados?.find(
            (r) =>
              r.metricaId === primaryMetric.id ||
              r.titulo.toLowerCase() === primaryMetric.titulo.toLowerCase()
          );
          if (!found) return null;
          return {
            label: `S${s.semana}·${s.numero}`,
            raw: found.valor,
            num: parseMetricNumericValue(found.valor),
          };
        })
        .filter((item): item is { label: string; raw: string; num: number | null } => Boolean(item));

      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        const numericPoints = entries
          .map((e) => e.num)
          .filter((v): v is number => typeof v === "number");

        let chartValues = [45, 65];
        if (numericPoints.length >= 2) {
          const min = Math.min(...numericPoints);
          const max = Math.max(...numericPoints);
          const span = max - min || 1;
          chartValues = numericPoints.map((v) => Math.round(20 + ((v - min) / span) * 68));
        } else if (numericPoints.length === 1) {
          chartValues = [50, 68];
        }

        const chartLabels =
          entries.length >= 2
            ? entries.map((e) => e.label)
            : ["Início", lastEntry.label];

        return {
          hasData: true,
          title: primaryMetric.titulo,
          subtitle: `${entries.length} ${
            entries.length === 1 ? "sessão registrada" : "sessões registradas"
          } na rotina`,
          latestValue: lastEntry.raw,
          unit: primaryMetric.unidade || "",
          badgeText: "Atualizado",
          values: chartValues,
          labels: chartLabels,
        };
      }
    }

    // Fallback para RPE das sessões finalizadas caso ainda não haja métrica numérica
    const rpeSessions = completedSessions.filter((s) => typeof s.rpe === "number");
    if (rpeSessions.length > 0) {
      const lastRpe = rpeSessions[rpeSessions.length - 1];
      const values =
        rpeSessions.length >= 2
          ? rpeSessions.map((s) => Math.round(((s.rpe || 5) / 10) * 85 + 10))
          : [50, Math.round(((lastRpe.rpe || 5) / 10) * 85 + 10)];
      const labels =
        rpeSessions.length >= 2
          ? rpeSessions.map((s) => `S${s.semana}·${s.numero}`)
          : ["Início", `S${lastRpe.semana}·${lastRpe.numero}`];

      return {
        hasData: true,
        title: "Esforço percebido (RPE)",
        subtitle: `Escala de Borg CR-10 · ${rpeSessions.length} ${
          rpeSessions.length === 1 ? "sessão" : "sessões"
        }`,
        latestValue: `${lastRpe.rpe}/10`,
        unit: `média ${averageRpe}`,
        badgeText: "Registrado",
        values,
        labels,
      };
    }

    return {
      hasData: false,
      title: primaryMetric ? primaryMetric.titulo : "Acompanhamento de métricas",
      subtitle: activeRoutine
        ? "Finalize sua primeira sessão para visualizar o gráfico de evolução"
        : "Nenhuma rotina ativa vinculada",
      latestValue: "—",
      unit: primaryMetric?.unidade || "",
      badgeText: "Aguardando registros",
      values: [],
      labels: [],
    };
  }, [weeks, studentMetrics, averageRpe, activeRoutine]);

  const sportKey: "natacao" | "tenis" | "academia" | "corrida" | "ciclismo" | "funcional" =
    activeRoutine?.modalidade?.toLowerCase().includes("tenis")
      ? "tenis"
      : activeRoutine?.modalidade?.toLowerCase().includes("corr")
      ? "corrida"
      : activeRoutine?.modalidade?.toLowerCase().includes("acad") ||
        activeRoutine?.modalidade?.toLowerCase().includes("musc")
      ? "academia"
      : activeRoutine?.modalidade?.toLowerCase().includes("cicl")
      ? "ciclismo"
      : activeRoutine?.modalidade?.toLowerCase().includes("func")
      ? "funcional"
      : "natacao";

  return (
    <div className="student-panel">
      {/* Row 1: 4 KPI Cards */}
      <section className="student-panel__stats" aria-label="Indicadores do aluno">
        <article className="student-panel__stat-card">
          <div className="student-panel__stat-top">
            <span className="student-panel__stat-icon student-panel__stat-icon--orange">
              <img src="/student-profile/imgIconActivity2.svg" alt="" />
            </span>
            <Badge tone="success">Rotina atual</Badge>
          </div>
          <strong className="student-panel__stat-value">{monthlySessionsCount}</strong>
          <span className="student-panel__stat-label">Sessões finalizadas</span>
        </article>

        <article className="student-panel__stat-card">
          <div className="student-panel__stat-top">
            <span className="student-panel__stat-icon student-panel__stat-icon--amber">
              <img src="/student-profile/imgIconFlame.svg" alt="" />
            </span>
            <Badge tone="warning">Meta</Badge>
          </div>
          <strong className="student-panel__stat-value">
            {activeRoutine ? `${activeRoutine.frequenciaSemanal}x` : "—"}
          </strong>
          <span className="student-panel__stat-label">Frequência semanal</span>
        </article>

        <article className="student-panel__stat-card">
          <div className="student-panel__stat-top">
            <span className="student-panel__stat-icon student-panel__stat-icon--red">
              <img src="/institutional/imgIconHeart.svg" alt="" />
            </span>
            <Badge tone="neutral">Borg CR-10</Badge>
          </div>
          <strong className="student-panel__stat-value">{averageRpe}</strong>
          <span className="student-panel__stat-label">RPE médio</span>
        </article>

        <article className="student-panel__stat-card">
          <div className="student-panel__stat-top">
            <span className="student-panel__stat-icon student-panel__stat-icon--blue">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2e90fa"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </span>
            <Badge tone="info">{activeRoutine ? activeRoutine.modalidade : "Geral"}</Badge>
          </div>
          <strong className="student-panel__stat-value">
            {activeRoutine ? `${activeRoutine.semanaAtual}/${activeRoutine.totalSemanas}` : "—"}
          </strong>
          <span className="student-panel__stat-label">Semana da rotina ativa</span>
        </article>
      </section>

      {/* Row 2: Próxima Sessão + Minha Semana */}
      <div className="student-panel__middle">
        <section className="student-panel__card student-panel__next" aria-label="Próxima sessão">
          {nextSession ? (
            <>
              <div className="student-panel__next-date" aria-hidden="true">
                <span className="student-panel__next-weekday">{nextSession.diaSemana}</span>
                <strong className="student-panel__next-day">{nextSession.dataPlanejada}</strong>
                <span className="student-panel__next-time">
                  {nextSession.duracaoPlanejada ? `${nextSession.duracaoPlanejada} min` : "Treino"}
                </span>
              </div>

              <div className="student-panel__next-body">
                <span className="student-panel__next-eyebrow">
                  PRÓXIMA SESSÃO · SEMANA {nextSession.semana}
                </span>
                <div className="student-panel__next-title-row">
                  <h2>{nextSession.titulo}</h2>
                  {activeRoutine && <SportTag sport={sportKey} />}
                </div>
                <p className="student-panel__next-subtitle">
                  {activeRoutine ? `${activeRoutine.titulo} · ` : ""}
                  Planejado por {student.personal.name}
                </p>

                {/* Preview estruturado das atividades planejadas */}
                {nextSessionParsed && nextSessionParsed.activities.length > 0 && (
                  <div className="student-panel__next-activities">
                    {nextSessionParsed.activities.slice(0, 3).map((act, idx) => (
                      <div key={act.id} className="student-panel__next-activity-pill">
                        <span className="student-panel__next-activity-num">{idx + 1}</span>
                        <span className="student-panel__next-activity-text">
                          <strong>{act.title}</strong>
                          {act.description ? ` · ${act.description}` : ""}
                        </span>
                      </div>
                    ))}
                    {nextSessionParsed.activities.length > 3 && (
                      <span className="student-panel__next-activity-more">
                        +{nextSessionParsed.activities.length - 3} atividade(s)
                      </span>
                    )}
                  </div>
                )}

                {nextSessionParsed?.orientations && (
                  <div className="student-panel__next-orientation">
                    <Info size={14} aria-hidden="true" />
                    <span>{nextSessionParsed.orientations}</span>
                  </div>
                )}

                <div className="student-panel__next-actions">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedWeekNum(nextSession.semana);
                      navigate(
                        `/conta/treinos?semana=${nextSession.semana}&sessao=${encodeURIComponent(
                          nextSession.id
                        )}`
                      );
                    }}
                  >
                    Ver sessão
                  </Button>
                  <Button onClick={() => openRpeModal(nextSession.id)}>
                    Finalizar sessão
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="student-panel__next-body student-panel__next-empty">
              <span className="student-panel__next-eyebrow">PRÓXIMA SESSÃO</span>
              <div className="student-panel__next-title-row">
                <h2>
                  {activeRoutine && totalDaysInWeek > 0
                    ? "Todas as sessões da semana foram finalizadas!"
                    : "Nenhum treino pendente para esta semana"}
                </h2>
                {activeRoutine && totalDaysInWeek > 0 && (
                  <Badge tone="success">
                    <CheckCircle2 size={13} style={{ marginRight: 4 }} aria-hidden="true" />
                    Semana concluída
                  </Badge>
                )}
              </div>
              <p className="student-panel__next-subtitle">
                {activeRoutine
                  ? "Você concluiu todos os treinos planejados para a semana atual. Você pode revisar os detalhes e métricas enviadas em Meus treinos."
                  : "Aguardando novo planejamento de treino do seu personal."}
              </p>
              {activeRoutine && (
                <div className="student-panel__next-actions">
                  <Button variant="secondary" onClick={() => navigate("/conta/treinos")}>
                    Ver sessões em Meus treinos
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="student-panel__card student-panel__week" aria-label="Minha semana">
          <header className="student-panel__card-header student-panel__card-header--split">
            <div>
              <h2>Minha semana</h2>
              <p>
                {totalDaysInWeek > 0
                  ? `${completedDaysInWeek} de ${totalDaysInWeek} sessões finalizadas`
                  : "Sem sessões agendadas para esta semana"}
              </p>
            </div>
            <button
              type="button"
              className="student-panel__link-btn"
              onClick={() => navigate("/conta/treinos")}
            >
              <span>Meus treinos</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </header>

          <div className="student-panel__week-days">
            {weekDays.map((day) => (
              <div
                key={day.id}
                className={`student-panel__week-day student-panel__week-day--${day.status}`}
              >
                <span className="student-panel__week-day-label">{day.label}</span>
                {day.status === "completed" ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2e90fa"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-label="Concluída"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span
                    className={`student-panel__week-dot${
                      day.status === "rest" ? " student-panel__week-dot--muted" : ""
                    }`}
                    aria-label={day.status === "rest" ? "Descanso" : "Planejada"}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="student-panel__week-legend-row">
            <div className="student-panel__week-legend">
              <span className="student-panel__week-dot" aria-hidden="true" />
              <span>{activeRoutine ? activeRoutine.modalidade : "Planejada"}</span>
            </div>
            <div className="student-panel__week-legend">
              <span className="student-panel__week-dot student-panel__week-dot--muted" aria-hidden="true" />
              <span>Descanso</span>
            </div>
          </div>
        </section>
      </div>

      {/* Row 3: Minha Evolução + Feedbacks do Personal */}
      <div className="student-panel__bottom">
        <section className="student-panel__card student-panel__evolution" aria-label="Minha evolução">
          <header className="student-panel__card-header student-panel__card-header--split">
            <div>
              <h2>Minha evolução</h2>
              <p>
                {evolutionSummary.title} · {evolutionSummary.subtitle}
              </p>
            </div>
            <button
              type="button"
              className="student-panel__link-btn"
              onClick={() => navigate("/conta/evolucao")}
            >
              <span>Ver completo</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </header>

          {evolutionSummary.hasData ? (
            <>
              <div className="student-panel__evolution-metric">
                <strong>{evolutionSummary.latestValue}</strong>
                {evolutionSummary.unit && (
                  <span className="student-panel__evolution-unit">{evolutionSummary.unit}</span>
                )}
                <Badge tone="success">{evolutionSummary.badgeText}</Badge>
              </div>

              <div className="student-panel__evolution-chart">
                <StudentSmoothChart
                  values={evolutionSummary.values}
                  labels={evolutionSummary.labels}
                  color="blue"
                  ariaLabel={`Gráfico de evolução de ${evolutionSummary.title}`}
                />
              </div>
            </>
          ) : (
            <div className="student-panel__evolution-empty">
              <Activity size={24} aria-hidden="true" />
              <p>
                Ainda não há métricas registradas nesta rotina. Ao concluir um treino e clicar em{" "}
                <strong>“Finalizar sessão”</strong>, seus resultados aparecerão aqui.
              </p>
            </div>
          )}
        </section>

        <section
          id="feedbacks"
          className="student-panel__card student-panel__feedbacks"
          aria-label="Feedbacks do personal"
        >
          <header className="student-panel__feedbacks-header">
            <h2>Feedbacks do personal</h2>
            <Badge tone="primary">{newFeedbacksCount} novos</Badge>
          </header>

          <div className="student-panel__feedbacks-list">
            {feedbacks.length === 0 ? (
              <p style={{ color: "var(--color-neutral-500, #64748b)", fontSize: "0.875rem", margin: "0.75rem 0" }}>
                Nenhum feedback registrado pelo seu personal ainda.
              </p>
            ) : (
              feedbacks.map((fb) => (
                <article key={fb.id} className="student-panel__feedback-item">
                  <Avatar name={fb.autorNome} initials={fb.autorIniciais} tone="primary" />
                  <div className="student-panel__feedback-content">
                    <div className="student-panel__feedback-meta">
                      <strong>{fb.autorNome}</strong>
                      <span>{fb.tempoRelativo}</span>
                    </div>
                    <p>{fb.conteudo}</p>
                  </div>
                </article>
              ))
            )}
          </div>

          {studentMetrics.length > 0 && (
            <div className="student-panel__metrics-banner">
              <div className="student-panel__metrics-banner-header">
                <Activity size={14} aria-hidden="true" />
                <strong>Métricas solicitadas ao finalizar sessão</strong>
              </div>
              <div className="student-panel__metrics-tags">
                {studentMetrics.map((m) => (
                  <span key={m.id} className="student-panel__metric-tag">
                    {m.titulo}
                    {m.obrigatoria ? " *" : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Card de Integração Strava (US-14) */}
          <div
            className="student-panel__strava-widget"
            onClick={() => setStravaModalOpen?.(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setStravaModalOpen?.(true);
              }
            }}
          >
            <div className="student-panel__strava-widget-left">
              <span className="student-panel__strava-widget-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#fc5200">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
                </svg>
              </span>
              <div className="student-panel__strava-widget-info">
                <strong>
                  {stravaStatus?.conectado
                    ? `Strava sincronizado (${stravaStatus.nomeAtleta || "Atleta"})`
                    : "Conectar com o Strava"}
                </strong>
                <p>
                  {stravaStatus?.conectado
                    ? stravaStatus.expirado
                      ? "Conexão expirada. Clique para reconectar."
                      : "Treinos recentes preenchem suas métricas automaticamente."
                    : "Importe distâncias, tempos e FC dos seus treinos gravados."}
                </p>
              </div>
            </div>
            <Badge
              tone={
                stravaStatus?.conectado
                  ? stravaStatus.expirado
                    ? "warning"
                    : "success"
                  : "neutral"
              }
            >
              {stravaStatus?.conectado
                ? stravaStatus.expirado
                  ? "Expirado"
                  : "Conectado"
                : "Conectar"}
            </Badge>
          </div>
        </section>
      </div>
    </div>
  );
}
