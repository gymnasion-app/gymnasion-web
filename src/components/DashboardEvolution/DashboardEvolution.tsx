import { useState } from "react";
import DashboardPanel from "../DashboardPanel/DashboardPanel";
import LineChart from "../LineChart/LineChart";
import { usePersonal } from "../../features/personal/PersonalContext";
import { displayDate, localDateKey, rpeSeries } from "../../features/personal/dashboardModel";
import { formatRpeValue } from "../../utils/metricValueFormat";
import "./DashboardEvolution.css";

export default function DashboardEvolution() {
  const {histories} = usePersonal();
  const [days,setDays] = useState(30);
  const data = rpeSeries(histories.data,days);
  const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate()-days+1);
  const today = new Date(); today.setHours(0,0,0,0);
  return <DashboardPanel title="Evolução dos alunos" subtitle="Percepção de esforço (RPE médio por dia)" className="dashboard-evolution">
    <div className="dashboard-evolution__controls" aria-label="Período da evolução">{[7,30,90].map(value=><button key={value} aria-pressed={value===days} onClick={()=>setDays(value)}>{value} dias</button>)}</div>
    {histories.loading || histories.error || !data.length ? <div className="dashboard-v2__chart"><img src="/design-system/imgIconChart.svg" alt=""/><strong>{histories.loading?"Carregando evolução":histories.error?"Evolução indisponível":"Ainda sem registros neste período"}</strong><p>{histories.error || (!histories.loading ? "As sessões concluídas com RPE informado aparecerão aqui." : "Consultando as sessões dos seus alunos.")}</p></div> : <>
      <LineChart
        points={data.map(item=>({date:item.date,value:item.value,detail:item.count+(item.count===1?" sessão":" sessões")}))}
        formatValue={formatRpeValue}
        seriesLabel="RPE médio do dia (todos os alunos)"
        unitLabel="RPE"
        yDomain={[0,10]}
        xDomain={[localDateKey(start),localDateKey(today)]}
        color="orange"
        ariaLabel={"RPE médio por dia nos últimos "+days+" dias, escala de 0 a 10. Valores disponíveis na tabela abaixo."}
      />
      <details><summary>Ver valores do gráfico</summary><table><thead><tr><th scope="col">Data</th><th scope="col">RPE médio</th><th scope="col">Sessões</th></tr></thead><tbody>{data.map(item=><tr key={item.date}><td>{displayDate(item.date)}</td><td>{item.value.toFixed(1)}</td><td>{item.count}</td></tr>)}</tbody></table></details>
    </>}
  </DashboardPanel>;
}
