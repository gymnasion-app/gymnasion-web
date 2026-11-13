import { useId, useState } from "react";
import UnavailableAction from "../UnavailableAction/UnavailableAction";
import { evolutionSeries, formatMetric, metricLabels, type MetricSeries, type RoutineMetric } from "../../features/studentProfile/profileModel";
import { displayDate, localDateKey } from "../../features/personal/dashboardModel";
import { stripDuplicateUnitSuffix } from "../../utils/metricValueFormat";
import type { TrainingSession } from "../../types/personalDashboard";
import "./StudentEvolution.css";

export function EvolutionCard({ series, color = "blue", compact = false }: { series: MetricSeries; color?: string; compact?: boolean }) {
  const gradient = useId().replace(/:/g,"");
  const values=series.points.map(point=>point.value);
  const low=Math.min(...values), high=Math.max(...values);
  const firstDate=series.points[0]?.date, lastDate=series.points.at(-1)?.date;
  const start=firstDate ? new Date(firstDate+"T12:00:00").getTime() : 0;
  const end=lastDate ? new Date(lastDate+"T12:00:00").getTime() : start;
  const points=series.points.map(point=>({...point,x:end===start?250:10+(new Date(point.date+"T12:00:00").getTime()-start)/(end-start)*480,y:high===low?75:135-(point.value-low)/(high-low)*120}));
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
  return <section className={`workspace-card evolution-card evolution-card--${color}${compact?" evolution-card--compact":""}`}>
    <header><div><h2>{cleanTitle}{series.unidade ? ` (${series.unidade})` : ""}</h2><p>{compact?"Últimas 8 sessões":series.type==="RPE"?"Escala de Borg CR-10":series.unidade || metricLabels[series.type]}</p></div>{delta!==null && <span className="evolution-card__change" title="Variação entre o primeiro e o último registro do período">{delta>0?"+":""}{formatMetric(delta,"NUMERICO")}%</span>}</header>
    {!compact && <strong className="evolution-card__value">{average===null?"—":formatMetric(average,series.type)} <small>{avgSuffix}</small></strong>}
    {!points.length ? <p className="evolution-card__empty">Sem registros para esta métrica no período.</p> : <>
      <svg viewBox="0 0 500 165" role="img" aria-label={cleanTitle+". Valores disponíveis abaixo."}>
        <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--chart-color)" stopOpacity=".16"/><stop offset="100%" stopColor="var(--chart-color)" stopOpacity="0"/></linearGradient></defs>
        {[15,55,95,135].map(y=><line key={y} x1="10" x2="490" y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="3 5"/>)}
        {points.length>1 && <><polygon points={`${points[0].x},140 ${points.map(p=>p.x+","+p.y).join(" ")} ${points.at(-1)!.x},140`} fill={`url(#${gradient})`}/><polyline points={points.map(p=>p.x+","+p.y).join(" ")} fill="none" stroke="var(--chart-color)" strokeWidth="2.5"/></>}
        {points.map((p,index)=><circle key={index} cx={p.x} cy={p.y} r="4" fill="white" stroke="var(--chart-color)" strokeWidth="2"><title>{displayDate(p.date)+": "+formatMetric(p.value,series.type)+(series.unidade ? ` ${series.unidade}` : "")}</title></circle>)}
        <text x="10" y="161">{displayDate(firstDate!)}</text><text x="490" y="161" textAnchor="end">{displayDate(lastDate!)}</text>
      </svg>
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
    {!valid?<p className="workspace-error" role="alert">Informe um período válido, com início anterior ou igual ao fim.</p>:<div className="student-evolution__grid">{series.map((item,index)=><EvolutionCard key={item.id} series={item} color={item.type==="RPE"?"purple":["blue","orange","red"][index%3]}/>)}</div>}
  </div>;
}
