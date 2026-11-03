import { Link } from "react-router-dom";
import Avatar from "../Avatar/Avatar";
import Badge from "../Badge/Badge";
import "../Button/Button.css";
import "./Hero.css";

export default function Hero() {
  return <section className="institutional-hero" id="home" aria-labelledby="hero-title">
    <div className="institutional-container institutional-hero__inner">
      <div className="institutional-hero__copy">
        <p className="institutional-hero__announcement"><span>Novo</span>Métricas personalizadas por modalidade</p>
        <h1 id="hero-title">Treine, meça e <em>evolua</em> junto com seus alunos.</h1>
        <p className="institutional-hero__description">O Gymnasion centraliza cadastro de alunos, rotinas de treino, turmas e dashboards de evolução para personal trainers de qualquer modalidade — natação, tênis, academia, corrida, ciclismo e muito mais.</p>
        <div className="institutional-hero__actions"><Link to="/cadastro" className="button button--primary">Começar agora</Link><a href="#como-funciona" className="button button--secondary">Ver como funciona</a></div>
        <div className="institutional-hero__community">
          <div className="institutional-hero__avatars" aria-hidden="true">
            <Avatar name="AB" initials="AB" tone="info" /><Avatar name="CL" initials="CL" className="institutional-avatar--tenis" /><Avatar name="FC" initials="FC" className="institutional-avatar--academia" /><Avatar name="JF" initials="JF" className="institutional-avatar--warning" />
          </div>
          <div><strong>Natação · Corrida · Tênis · e mais</strong><p>Uma plataforma para todas as suas modalidades</p></div>
        </div>
      </div>
      <div className="institutional-hero__visual" aria-label="Exemplo de acompanhamento de alunos">
        <picture>
          <source type="image/webp" srcSet="/institutional/imgPhoto.webp" />
          <img
            className="institutional-hero__photo"
            src="/institutional/imgPhoto.png"
            alt="Atleta treinando com halteres na academia"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width={956}
            height={1400}
          />
        </picture>
        <div className="institutional-hero__chart">
          <div><strong>Ritmo 100m</strong><Badge>−8%</Badge></div>
          <p>1:42 /100m</p><img src="/institutional/imgChart.svg" alt="Gráfico ilustrativo da evolução do ritmo" />
        </div>
        <div className="institutional-hero__request">
          <Avatar name="Fernanda Pires" className="institutional-avatar--academia" />
          <div><strong>Fernanda Pires</strong><p>quer treinar Natação com você</p></div>
          <span><img src="/institutional/imgIconCheck.svg" alt="" /></span>
        </div>
        <div className="institutional-hero__effort"><span><img src="/institutional/imgIconFlame.svg" alt="" /></span><div><p>RPE da sessão</p><strong>7 · Muito intenso</strong></div></div>
      </div>
    </div>
  </section>;
}
