import { useState } from "react";
import LineChart from "../LineChart/LineChart";
import UnavailableAction from "../UnavailableAction/UnavailableAction";
import { evolutionSeries, formatMetric, metricLabels, type MetricSeries, type RoutineMetric } from "../../features/studentProfile/profileModel";
import { displayDate, localDateKey } from "../../features/personal/dashboardModel";
import { stripDuplicateUnitSuffix } from "../../utils/metricValueFormat";
import type { TrainingSession } from "../../types/personalDashboard";
import "./StudentEvolution.css";

export function EvolutionCard({ series, compact = false }: { series: MetricSeries; compact?: boolean }) {
  const values=series.points.map(point=>point.value);
  const isRpe = series.type === "RPE";
  const average=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
  const latest=series.points.at(-1)?.value;
  const first=series.points[0]?.value;
  const delta=first && latest!==undefined && series.points.length>1 ? (latest-first)/Math.abs(first)*100 : null;
  const cleanTitle = stripDuplicateUnitSuffix(series.title, series.unidade);
  const avgSuffix = series.unidade
    ? `${series.unidade} · média`
    : series.type === "FREQUENCIA_CARDIACA"
    ? "bpm · média"
    : series.type === "TEMPO"
    ? "mm:ss · média"
    : "média";
  const unitText = series.unidade || (isRpe ? "RPE" : series.type === "FREQUENCIA_CARDIACA" ? "bpm" : series.type === "TEMPO" ? "mm:ss" : "");
  return <section className={`workspace-card evolution-card${compact?" evolution-card--compact":""}`}>
    <header><div><h2>{cleanTitle}{series.unidade ? ` (${series.unidade})` : ""}</h2><p>{compact?"Últimas 8 sessões":series.type==="RPE"?"Escala de Borg CR-10":series.unidade || metricLabels[series.type]}</p></div>{delta!==null && <span className="evolution-card__change" title="Variação entre o primeiro e o último registro do período">{delta>0?"+":""}{formatMetric(delta,"NUMERICO")}%</span>}</header>
    {!compact && <strong className="evolution-card__value">{average===null?"—":formatMetric(average,series.type)} <small>{avgSuffix}</small></strong>}
    {!series.points.length ? <p className="evolution-card__empty">Sem registros para esta métrica no período.</p> : <>
      <LineChart
        compact={compact}
        height={compact ? 170 : 230}
        points={series.points.map(p=>({date:p.date,value:p.value}))}
        formatValue={v=>formatMetric(v,series.type)}
        seriesLabel={isRpe ? "RPE da sessão" : unitText ? `${cleanTitle} (${unitText})` : cleanTitle}
        unitLabel={unitText || undefined}
        yDomain={isRpe ? [0,10] : undefined}
        color={isRpe ? "orange" : "blue"}
        ariaLabel={cleanTitle+". Valores disponíveis abaixo."}
      />
      <details><summary>Ver valores</summary><table><thead><tr><th scope="col">Data</th><th scope="col">Valor{series.unidade ? ` (${series.unidade})` : ""}</th></tr></thead><tbody>{series.points.map((p,index)=><tr key={index}><td>{displayDate(p.date)}</td><td>{formatMetric(p.value,series.type)}{series.unidade ? ` ${series.unidade}` : ""}</td></tr>)}</tbody></table></details>
    </>}
  </section>;
}

export default function StudentEvolution({ sessions, metrics }: { sessions: TrainingSession[]; metrics: RoutineMetric[] }) {
  const today=localDateKey(new Date());
  const [period,setPeriod]=useState(90);
  const [custom,setCustom]=useState(false);
  const start=new Date();start.setDate(start.getDate()-period+1);
  const [from,setFrom]=useState(localDateKey(start));
  const [to,setTo]=useState(today);
  const startDate=custom?from:localDateKey(start), endDate=custom?to:today;
  const valid=Boolean(startDate && endDate && startDate<=endDate);
  const series=evolutionSeries(sessions,metrics,startDate,endDate);
  return <div className="student-evolution">
    <div className="student-evolution__toolbar"><div className="student-evolution__period" aria-label="Período da evolução">{[[28,"4 semanas"],[90,"3 meses"],[180,"6 meses"]].map(([days,label])=><button key={days} aria-pressed={!custom&&period===days} onClick={()=>{setPeriod(Number(days));setCustom(false);}}>{label}</button>)}<button aria-pressed={custom} onClick={()=>setCustom(true)}>Personalizado</button></div>
      <div className="student-evolution__range">{custom?<><label>De <input type="date" aria-label="Data inicial" value={from} max={to||today} onChange={e=>setFrom(e.target.value)}/></label><label>Até <input type="date" aria-label="Data final" value={to} max={today} min={from} onChange={e=>setTo(e.target.value)}/></label></>:<span>{displayDate(startDate)} – {displayDate(endDate)}</span>}<UnavailableAction variant="secondary" reason="A exportação em PDF ainda não está disponível no backend.">Exportar PDF</UnavailableAction></div>
    </div>
    {!valid?<p className="workspace-error" role="alert">Informe um período válido, com início anterior ou igual ao fim.</p>:<div className="student-evolution__grid">{series.map((item)=><EvolutionCard key={item.id} series={item}/>)}</div>}
  </div>;
}
