import { useEffect, useState } from "react";
import Badge from "../../components/Badge/Badge";
import StudentSmoothChart from "../../components/StudentSmoothChart/StudentSmoothChart";
import ReportDialog from "../../components/ReportDialog/ReportDialog";
import { useStudentArea } from "../../features/studentArea/StudentContext";
import { reportPeriodFromDays } from "../../features/report/reportModel";
import { alunoService } from "../../services/alunoService";
import { relatorioService } from "../../services/relatorioService";
import { formatMetricDisplayValue, stripDuplicateUnitSuffix } from "../../utils/metricValueFormat";
import type { EvolutionPeriodKey, StudentEvolutionResponseDTO } from "../../types/studentArea";
import "./StudentEvolutionPage.css";

const PERIOD_OPTIONS: { key: EvolutionPeriodKey; label: string; days: number }[] = [
  { key: "4w", label: "4 semanas", days: 28 },
  { key: "3m", label: "3 meses", days: 90 },
  { key: "6m", label: "6 meses", days: 180 },
];

export default function StudentEvolutionPage() {
  const [period, setPeriod] = useState<EvolutionPeriodKey>("3m");
  const [selectedModalityId, setSelectedModalityId] = useState<number | "ALL">("ALL");
  const [loading, setLoading] = useState<boolean>(true);
  const [evoData, setEvoData] = useState<StudentEvolutionResponseDTO | null>(null);
  const [report, setReport] = useState(false);
  const { student } = useStudentArea();
  const selectedPeriod = PERIOD_OPTIONS.find((p) => p.key === period) || PERIOD_OPTIONS[1];

  useEffect(() => {
    let active = true;
    setLoading(true);
    const selected = PERIOD_OPTIONS.find((p) => p.key === period) || PERIOD_OPTIONS[1];
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - selected.days);
    const fmt = (d: Date) =>
      [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");

    alunoService
      .consultarEvolucao({
        ...(selectedModalityId !== "ALL" ? { modalidadeId: selectedModalityId } : {}),
        dataInicio: fmt(start),
        dataFim: fmt(end),
      })
      .then((res) => {
        if (!active) return;
        setEvoData(res);
      })
      .catch(() => {
        if (!active) return;
        setEvoData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [period, selectedModalityId]);

  const modalidadesDisponiveis = evoData?.modalidadesDisponiveis || [];

  return (
    <div className="student-evo-page">
      <div className="student-evo-page__toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div
            className="student-evo-page__periods"
            role="group"
            aria-label="Período de análise da evolução"
          >
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  aria-pressed={active}
                  className={`student-evo-page__period-btn${active ? " is-active" : ""}`}
                  onClick={() => setPeriod(opt.key)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {modalidadesDisponiveis.length > 1 && (
            <select
              aria-label="Filtrar evolução por modalidade"
              className="student-evo-page__modality-select"
              value={selectedModalityId}
              onChange={(e) => {
                const raw = e.target.value;
                setSelectedModalityId(raw === "ALL" ? "ALL" : Number(raw));
              }}
              style={{
                height: "36px",
                padding: "0 10px",
                borderRadius: "8px",
                border: "1px solid var(--color-border, #e2e8f0)",
                background: "var(--color-surface, #ffffff)",
                fontSize: "0.875rem",
              }}
            >
              <option value="ALL">Todas as modalidades</option>
              {modalidadesDisponiveis.map((mod) => (
                <option key={mod.id} value={mod.id}>
                  {mod.nome}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          className="student-evo-page__export-btn"
          onClick={() => setReport(true)}
        >
          Gerar relatório
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-neutral-500, #64748b)" }}>
          Carregando dados de evolução...
        </div>
      ) : evoData && evoData.possuiDadosSuficientes && (evoData.metricas?.length > 0 || (evoData.evolucaoRpe?.pontos?.length ?? 0) > 0) ? (
        <>
          <div className="student-evo-page__banner" role="status">
            <img src="/student-profile/imgIconTrend.svg" alt="" aria-hidden="true" />
            <span>{evoData.mensagem || "Acompanhe abaixo seu progresso e esforço percebido ao longo dos treinos."}</span>
          </div>

          <div className="student-evo-page__grid">
            {/* Gráfico de RPE (US-20 C3) */}
            {evoData.evolucaoRpe && evoData.evolucaoRpe.pontos?.length > 0 && (
              <section className="student-evo-page__card" aria-label="Evolução do Esforço Percebido">
                <header className="student-evo-page__card-header">
                  <div>
                    <h2>Esforço Percebido (RPE)</h2>
                    <p>Escala Borg CR-10 (1 a 10)</p>
                  </div>
                  <Badge tone="primary">{evoData.evolucaoRpe.direcaoTendencia || "Estável"}</Badge>
                </header>

                <div className="student-evo-page__card-value">
                  <strong>{evoData.evolucaoRpe.mediaRpe ? evoData.evolucaoRpe.mediaRpe.toFixed(1).replace(".", ",") : "—"}</strong>
                  <span>média</span>
                </div>

                <div className="student-evo-page__card-chart">
                  <StudentSmoothChart
                    values={evoData.evolucaoRpe.pontos.map((p) => p.nivelCansaco)}
                    labels={evoData.evolucaoRpe.pontos.map((p) => p.data?.slice(5) || "")}
                    color="orange"
                    ariaLabel="Gráfico de esforço percebido ao longo do período"
                  />
                </div>
              </section>
            )}

            {/* Gráficos das métricas da modalidade (US-15 C1/C3) */}
            {(evoData.metricas || []).map((m) => {
              const numericPoints = (m.pontos || []).filter(
                (p): p is typeof p & { valorNumerico: number } => typeof p.valorNumerico === "number"
              );
              if (numericPoints.length === 0) return null;
              const lastPoint = numericPoints[numericPoints.length - 1];
              const cleanTitle = stripDuplicateUnitSuffix(m.titulo, m.unidade);
              const visual = m.tendencia?.indicadorVisual;
              const badgeTone =
                visual === "MELHORIA"
                  ? "success"
                  : visual === "REGRESSAO"
                  ? "warning"
                  : "neutral";
              const badgeLabel =
                visual === "MELHORIA"
                  ? "Melhoria"
                  : visual === "REGRESSAO"
                  ? "Regressão"
                  : m.tendencia?.direcao === "AUMENTO"
                  ? "Aumento"
                  : m.tendencia?.direcao === "REDUCAO"
                  ? "Redução"
                  : "Estável";

              return (
                <section key={m.metricaId} className="student-evo-page__card" aria-label={cleanTitle}>
                  <header className="student-evo-page__card-header">
                    <div>
                      <h2>{cleanTitle}</h2>
                      <p>
                        {m.descontinuada
                          ? "Métrica descontinuada"
                          : m.unidade
                          ? `Unidade: ${m.unidade}`
                          : "Evolução temporal"}
                      </p>
                    </div>
                    <Badge tone={badgeTone} title={m.tendencia?.resumo || undefined}>
                      {badgeLabel}
                    </Badge>
                  </header>

                  <div className="student-evo-page__card-value">
                    <strong>{formatMetricDisplayValue(lastPoint.valor, m.tipo, m.unidade)}</strong>
                    <span>{m.unidade || (m.tipo === "FREQUENCIA_CARDIACA" ? "bpm" : m.tipo === "TEMPO" ? "mm:ss" : "")}</span>
                  </div>

                  <div className="student-evo-page__card-chart">
                    <StudentSmoothChart
                      values={numericPoints.map((p) => p.valorNumerico)}
                      labels={numericPoints.map((p) => p.data?.slice(5) || "")}
                      color="blue"
                      ariaLabel={`Gráfico de evolução da métrica ${cleanTitle}`}
                    />
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "4rem 2rem", background: "var(--color-bg-card, #ffffff)", borderRadius: "12px", border: "1px solid var(--color-border, #e2e8f0)", margin: "1rem 0" }}>
          <img src="/student-profile/imgIconActivity2.svg" alt="" style={{ width: 48, height: 48, opacity: 0.5, marginBottom: "1rem" }} />
          <h3 style={{ fontSize: "1.125rem", color: "var(--color-neutral-900, #0f172a)", marginBottom: "0.5rem" }}>
            Dados de evolução em construção
          </h3>
          <p style={{ color: "var(--color-neutral-500, #64748b)", maxWidth: "480px", margin: "0 auto", fontSize: "0.875rem" }}>
            São necessárias ao menos <strong>3 sessões de treino concluídas</strong> com métricas ou RPE registrados para traçar as curvas de evolução.
          </p>
        </div>
      )}

      {report && (
        <ReportDialog
          studentName={evoData?.aluno?.nome || student.name}
          modalidades={evoData?.modalidadesDisponiveis}
          initialPeriod={reportPeriodFromDays(selectedPeriod.days)}
          onClose={() => setReport(false)}
          generate={(filter, signal) => relatorioService.gerarPeloAluno(filter, signal)}
          loadAvailability={signal => relatorioService.disponibilidadePeloAluno(signal)}
        />
      )}
    </div>
  );
}
