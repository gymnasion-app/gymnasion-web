import { useState } from "react";
import Badge from "../Badge/Badge";
import Avatar from "../Avatar/Avatar";
import { isRoutineActive, metricIcons, metricLabels } from "../../features/routines/routineModel";
import type { RotinaResponse } from "../../types/rotina";
import "./RoutineCard.css";

const MAX_VISIBLE_METRICS = 3;

interface Props {
  routine: RotinaResponse;
  onAssign?: (routine: RotinaResponse) => void;
  onReuse?: (routine: RotinaResponse) => void;
  onEnd?: (routine: RotinaResponse) => void;
  onDelete?: (routine: RotinaResponse) => void;
  onUnlinkStudent?: (routine: RotinaResponse, student: { id: string; nome: string | null }) => void;
}

export default function RoutineCard({
  routine,
  onAssign,
  onReuse,
  onEnd,
  onDelete,
  onUnlinkStudent,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const active = isRoutineActive(routine);

  const modalityName = routine.nomeModalidade || routine.modalidade?.nome || "Modalidade";
  const students = routine.alunos || [];
  const metrics = routine.metricas || [];

  return (
    <article
      className={`workspace-card routine-card-v2 ${!active ? "routine-card-v2--ended" : ""}`}
      aria-labelledby={`routine-${routine.id}-title`}
    >
      <header className="routine-card-v2__header">
        <div className="routine-card-v2__title-group">
          <div className="routine-card-v2__badges">
            <span className="routine-card-v2__sport-tag">{modalityName}</span>
            <Badge tone="info">{routine.frequenciaSemanal}x por semana</Badge>
            <Badge tone={active ? "success" : "neutral"}>
              {active ? "Ativa" : "Encerrada"}
            </Badge>
          </div>
          <h2 id={`routine-${routine.id}-title`}>{routine.titulo}</h2>
        </div>

        <div className="routine-card-v2__menu-wrap">
          <button
            type="button"
            className="routine-card-v2__menu-trigger"
            aria-label={`Ações da rotina ${routine.titulo}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <img src="/workspace/401-744-imgIconMore.svg" alt="" />
          </button>

          {menuOpen && (
            <>
              <div
                className="routine-card-v2__backdrop"
                onClick={() => setMenuOpen(false)}
              />
              <div className="routine-card-v2__dropdown" role="menu">
                {active && onAssign && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onAssign(routine);
                    }}
                  >
                    <img src="/workspace/402-1230-imgIconLink.svg" alt="" />
                    Vincular novos alunos
                  </button>
                )}
                {onReuse && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onReuse(routine);
                    }}
                  >
                    <img src="/student-profile/imgIconTrend.svg" alt="" />
                    Reutilizar como modelo
                  </button>
                )}
                {active && onEnd && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onEnd(routine);
                    }}
                  >
                    <img src="/workspace/402-2299-imgIconPower.svg" alt="" />
                    Encerrar rotina
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    className="routine-card-v2__delete-btn"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(routine);
                    }}
                  >
                    <img src="/workspace/402-2031-imgIconX.svg" alt="" />
                    Excluir rotina
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="routine-card-v2__body">
        {routine.objetivos && (
          <p className="routine-card-v2__goal" title={routine.objetivos}>
            <strong>Objetivo:</strong> {routine.objetivos}
          </p>
        )}

        <div className="routine-card-v2__section">
          <h3>Métricas nas sessões ({metrics.length})</h3>
          <div className="routine-card-v2__metrics">
            {metrics.length === 0 ? (
              <span
                className="routine-card-v2__metric-chip"
                title="As sessões desta rotina registram apenas RPE e duração"
              >
                Apenas RPE e duração
              </span>
            ) : (
              <>
                {metrics.slice(0, MAX_VISIBLE_METRICS).map((m) => {
                  const icon = metricIcons[m.tipo] || "imgIconActivity1";
                  return (
                    <span
                      key={m.id}
                      className="routine-card-v2__metric-chip"
                      title={`${m.titulo} (${metricLabels[m.tipo] || m.tipo})`}
                    >
                      <img src={`/student-profile/${icon}.svg`} alt="" />
                      <strong>{m.titulo}</strong>
                    </span>
                  );
                })}
                {metrics.length > MAX_VISIBLE_METRICS && (
                  <span
                    className="routine-card-v2__metric-chip"
                    title={metrics
                      .slice(MAX_VISIBLE_METRICS)
                      .map((m) => m.titulo)
                      .join(", ")}
                  >
                    <strong>+{metrics.length - MAX_VISIBLE_METRICS}</strong>
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="routine-card-v2__section">
          <h3>Alunos vinculados ({students.length})</h3>
          <ul className="routine-card-v2__students">
            {students.map((student) => {
              const name = student.nome || "Aluno";
              return (
                <li key={student.id} className="routine-card-v2__student-item">
                  <div className="routine-card-v2__student-profile">
                    <Avatar name={name} tone="info" />
                    <span>{name}</span>
                  </div>
                  {active && students.length > 1 && onUnlinkStudent && (
                    <button
                      type="button"
                      className="routine-card-v2__unlink-btn"
                      title={`Desvincular ${name}`}
                      aria-label={`Desvincular ${name}`}
                      onClick={() => onUnlinkStudent(routine, student)}
                    >
                      <img src="/workspace/402-2031-imgIconX.svg" alt="" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </article>
  );
}
