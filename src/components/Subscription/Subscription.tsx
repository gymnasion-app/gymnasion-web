import { Link } from "react-router-dom";
import "../Button/Button.css";
import "./Subscription.css";
const benefits = ["Alunos, turmas e rotinas ilimitados", "Métricas personalizadas por modalidade", "Dashboards, RPE e relatórios em PDF", "Integração com Strava"];
export default function Subscription() {
  return <section className="institutional-subscription" id="assinatura" aria-labelledby="subscription-title"><div className="institutional-container">
    <div className="institutional-subscription__card"><div className="institutional-subscription__copy">
      <p className="institutional-subscription__label">Assinatura Gymnasion</p><h2 id="subscription-title">Leve seu método para o próximo nível.</h2>
      <ul>{benefits.map(text => <li key={text}><span><img src="/institutional/imgIconCheck1.svg" alt="" /></span>{text}</li>)}</ul>
      <Link to="/cadastro" className="button button--secondary">Assinar agora</Link>
    </div>
    <picture>
      <source type="image/webp" srcSet="/institutional/imgFrame2.webp" />
      <img
        className="institutional-subscription__photo"
        src="/institutional/imgFrame2.png"
        alt="Halteres organizados em uma academia"
        loading="lazy"
        decoding="async"
        width={440}
        height={380}
      />
    </picture>
  </div>
  </div></section>;
}
