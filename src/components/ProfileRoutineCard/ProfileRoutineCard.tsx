import { useNavigate } from "react-router-dom";
import { UserMinus } from "lucide-react";
import Button from "../Button/Button";
import Badge from "../Badge/Badge";
import { metricIcons, metricLabels, weekDays } from "../../features/studentProfile/profileModel";
import { displayDate } from "../../features/personal/dashboardModel";
import type { RotinaResponse } from "../../types/rotina";
import type { StudentTracking } from "../../types/studentProfile";
import "./ProfileRoutineCard.css";

export default function ProfileRoutineCard({
  routine,
  tracking,
  studentId,
  showWeek = true,
  onUnlink,
}: {
  routine: RotinaResponse;
  tracking: StudentTracking | null;
  studentId: string;
  showWeek?: boolean;
  onUnlink?: () => void;
}) {
  const navigate = useNavigate();
  const days = weekDays(tracking, studentId);
  const totalSessions = tracking?.rotinaAtivaId === routine.id ? tracking.sessoes.length : 0;
  const completedTotal = tracking?.rotinaAtivaId === routine.id ? tracking.sessoes.filter((s) => s.status === "CONCLUIDA").length : 0;
  const plannedTotal = totalSessions - completedTotal;
  const fillerLabel: Record<string, string> = { ALUNO: "Aluno", PERSONAL: "Personal", AMBOS: "Ambos" };
  return (
    <section className="workspace-card profile-routine">
      <header>
        <div>
          <h2>
            {showWeek ? "Rotina atual: " : ""}
            {routine.titulo}
          </h2>
          <p>{routine.objetivos ? "Objetivo: " + routine.objetivos : "Sem objetivo informado."}</p>
        </div>
        <div className="profile-routine__actions">
          <Badge tone={routine.ativo === false ? "neutral" : "primary"}>
            {routine.ativo === false ? "Encerrada" : routine.frequenciaSemanal + "x por semana"}
          </Badge>
          {routine.ativo !== false && totalSessions > 0 && (
            <Badge tone={plannedTotal > 0 ? "warning" : "success"}>
              {completedTotal}/{totalSessions} concluídas
            </Badge>
          )}
          <Button
            variant="secondary"
            className="profile-routine__edit"
            aria-label="Planejar sessões da rotina"
            title="Planejar sessões da rotina"
            onClick={() => navigate(`/rotinas/${routine.id}/planejamento`)}
          >
            <img src="/student-profile/imgIconEdit.svg" alt="" />
          </Button>
          {onUnlink && routine.ativo !== false && (
            <Button
              variant="ghost"
              className="profile-routine__unlink-btn"
              aria-label="Desvincular rotina do aluno"
              title="Desvincular rotina do aluno"
              onClick={onUnlink}
            >
              <UserMinus size={15} style={{ marginRight: "4px" }} />
              <span>Desvincular</span>
            </Button>
          )}
        </div>
      </header>
      <div className="profile-routine__metrics">
        {routine.metricas.map((metric) => {
          const filler = metric.quemPreenche ? fillerLabel[metric.quemPreenche] || metric.quemPreenche : "";
          const obrigLabel = metric.obrigatoria !== false ? "Obrigatória" : "Opcional";
          const tooltip = `${metric.titulo} (${metricLabels[metric.tipo]}) — ${obrigLabel}${filler ? ` · Preenchido por: ${filler}` : ""}`;
          return (
            <span key={metric.id} title={tooltip}>
              <img src={"/student-profile/" + metricIcons[metric.tipo] + ".svg"} alt="" />
              <strong>{metric.titulo}</strong>
              <small>· {metricLabels[metric.tipo]}</small>
            </span>
          );
        })}
      </div>
      {showWeek && Boolean(tracking && tracking.rotinaAtivaId === routine.id && tracking.sessoes.length > 0) && (
        <>
          <p className="profile-routine__week-label">
            Semana de referência · {days.reduce((sum, day) => sum + day.completed, 0)} de{" "}
            {days.reduce((sum, day) => sum + day.planned, 0)} sessões concluídas na semana
          </p>
          <div className="profile-routine__week">
            {days.map((day) => (
              <div
                key={day.date}
                className={
                  (day.completed ? "is-completed " : day.planned ? "is-planned " : "") + (day.today ? "is-today" : "")
                }
                title={
                  displayDate(day.date) +
                  " · " +
                  day.completed +
                  " concluídas / " +
                  day.planned +
                  " planejadas"
                }
              >
                <span>{day.label}</span>
                {day.completed ? (
                  <img src="/student-profile/imgIconCheck.svg" alt="Concluída" />
                ) : (
                  <span
                    className={"profile-routine__day-dot" + (day.planned ? " is-active" : "")}
                    aria-label={day.planned ? "Planejada" : "Sem sessão"}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

