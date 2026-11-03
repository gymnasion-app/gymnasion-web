import SportTag from "../SportTag/SportTag";
import "./Sports.css";
const sports = [
  { title: "Natação", text: "Ritmo por 100m, distância, braçadas", base: "imgFrame" },
  { title: "Tênis", text: "% de saque, duração do rally, sets", base: "imgFrame1" },
  { title: "Academia", text: "Cargas, séries, repetições", base: "imgPhoto" },
];
export default function Sports() {
  return <section className="institutional-section institutional-sports" id="modalidades" aria-labelledby="sports-title"><span id="esportes" />
    <div className="institutional-container">
      <div className="institutional-sports__heading"><div><p className="institutional-eyebrow">Modalidades</p><h2 id="sports-title">Feito para qualquer esporte</h2></div><p>Natação, tênis e academia são só o começo — cadastre corrida, ciclismo, funcional ou qualquer outro esporte.</p></div>
      <div className="institutional-sports__grid">
        {sports.map(sport => <article className="institutional-sports__card" key={sport.title}>
          <picture>
            <source type="image/webp" srcSet={`/institutional/${sport.base}.webp`} />
            <img src={`/institutional/${sport.base}.png`} alt="" loading="lazy" decoding="async" width={400} height={420} />
          </picture>
          <div><h3>{sport.title}</h3><p>{sport.text}</p></div>
        </article>)}
        <article className="institutional-sports__more"><div><SportTag sport="corrida" /><SportTag sport="ciclismo" /><SportTag sport="funcional" /></div><h3>E muito mais</h3><p>Cadastre qualquer modalidade com ícone, cor e métricas próprias.</p></article>
      </div>
    </div>
  </section>;
}
