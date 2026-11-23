import React from 'react';
import { getMetricStudentCount, MetricaResponseDTO } from '../../types/metric';
import { normalizeTipo, stripDuplicateUnitSuffix } from '../../utils/metricValueFormat';
import './MetricCard.css';

interface MetricCardProps {
  metrica: MetricaResponseDTO;
  onEdit: () => void;
  onDelete: () => void;
}

function metricTypeLabel(tipo: string): string {
  switch (normalizeTipo(tipo)) {
    case 'TEMPO':
      return 'Tempo / Ritmo';
    case 'FREQUENCIA_CARDIACA':
      return 'Frequência cardíaca';
    case 'TEXTO':
      return 'Texto';
    default:
      return 'Numérico';
  }
}

export const MetricCard: React.FC<MetricCardProps> = ({ metrica, onEdit, onDelete }) => {
  const descontinuada = !metrica.ativo;
  const studentCount = getMetricStudentCount(metrica);
  const cleanTitle = stripDuplicateUnitSuffix(metrica.titulo, metrica.unidade);
  const typeSummary = metrica.unidade
    ? `${metricTypeLabel(metrica.tipo)} · ${metrica.unidade}`
    : metricTypeLabel(metrica.tipo);

  return (
    <article className={`metric-card${descontinuada ? ' metric-card--discontinued' : ''}`}>
      <span className="metric-card__sport">{metrica.nomeModalidade}</span>
      <h3>{cleanTitle}</h3>
      <p>{typeSummary}</p>
      <p className="metric-card__count">
        {studentCount}{' '}
        {studentCount === 1 ? 'aluno com registros' : 'alunos com registros'}
      </p>

      {descontinuada ? (
        <span className="metric-card__archived">Métrica descontinuada · Histórico preservado</span>
      ) : (
        <div className="metric-card__actions">
          <button type="button" onClick={onEdit} aria-label={`Editar ${metrica.titulo}`}>
            Editar
          </button>
          <button type="button" onClick={onDelete} aria-label={`Excluir ${metrica.titulo}`}>
            Excluir
          </button>
        </div>
      )}
    </article>
  );
};

export default MetricCard;