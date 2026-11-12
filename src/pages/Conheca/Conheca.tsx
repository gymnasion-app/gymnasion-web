import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bike, Check, ChevronDown, ClipboardList, Dumbbell, Footprints, Info, Link2, Plus, Smartphone, Target, Users, Volleyball, Waves } from "lucide-react";
import Logo from "../../components/Logo/Logo";
import Badge from "../../components/Badge/Badge";
import SportTag from "../../components/SportTag/SportTag";
import LeadForm from "../../components/LeadForm/LeadForm";
import "../../components/Button/Button.css";
import "../Home/Home.css";
import "./Conheca.css";

function StravaIcon({ size = 12 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.154-10.172h-3.066m-7.008-5.599l2.836 5.598h3.066L13.533 2.172 8.379 12.344h3.066" /></svg>;
}

const problems = [
  { icon: Users, title: "Informações de alunos fragmentadas", text: "Dados cadastrais em aplicativos de mensagens, históricos em cadernos e feedback em conversas que se perdem no dia a dia.", solution: "Cadastro único e seguro" },
  { icon: ClipboardList, title: "Dificuldade em gerenciar rotinas e turmas", text: "Repetir prescrições manuais para cada atleta e perder o controle de quem treina individualmente ou em grupos de modalidades diferentes.", solution: "Estruturação por modalidade" },
  { icon: Info, title: "Pouca visibilidade de esforço e frequência", text: "Incerteza sobre a adesão real do aluno, sem parâmetros consolidados de Percepção Subjetiva de Esforço (RPE) ou integração de dados Strava.", solution: "Métricas e RPE integrados" },
];

const tabs = [
  { id: "alunos", label: "Alunos" },
  { id: "rotinas", label: "Rotinas" },
  { id: "metricas", label: "Métricas" },
] as const;
type TabId = typeof tabs[number]["id"];

const sports = [
  { icon: Dumbbell, tone: "academia", title: "Musculação", text: "Cargas, repetições e intervalos" },
  { icon: Waves, tone: "natacao", title: "Natação", text: "Metragens, tiros e pausas" },
  { icon: Footprints, tone: "corrida", title: "Corrida", text: "Pace, distância e zonas de FC" },
  { icon: Bike, tone: "ciclismo", title: "Ciclismo", text: "Cadência, altimetria e potência" },
  { icon: Volleyball, tone: "tenis", title: "Tênis", text: "Volume em quadra e drills" },
  { icon: Target, tone: "funcional", title: "Funcional", text: "Circuitos, blocos e tempo" },
];

const steps = [
  { title: "Configure seu perfil profissional.", text: "Defina suas modalidades atendidas, suas preferências de rotina e organize a sua base de trabalho." },
  { title: "Convide seus alunos e organize os treinos.", text: "Compartilhe o link de convite, vincule alunos a turmas ou acompanhamentos individuais e cadastre as primeiras rotinas." },
  { title: "Acompanhe as sessões e a evolução.", text: "Receba os registros de treinos finalizados, avalie o RPE reportado e monitore dados integrados do Strava." },
];

const faq = [
  { question: "Para quem é o Gymnasion?", answer: "O Gymnasion é voltado para personal trainers, preparadores físicos, treinadores esportivos e profissionais do esporte que realizam a prescrição e o acompanhamento contínuo de alunos em modalidades como musculação, corrida, natação, ciclismo, tênis e treinamento funcional." },
  { question: "Posso acompanhar alunos de diferentes modalidades?", answer: "Sim. A plataforma foi projetada de forma multidisciplinar, permitindo organizar rotinas e métricas específicas de cada disciplina (como séries e cargas na musculação, ritmo e distância na corrida ou metros na natação) em um mesmo painel." },
  { question: "Como funciona o convite para meus alunos?", answer: "O treinador gera um link de convite na plataforma e compartilha com o aluno por aplicativo de mensagens ou e-mail. Ao acessar o link, o aluno completa seu cadastro e fica conectado à conta do treinador." },
  { question: "Consigo organizar alunos em turmas?", answer: "Sim. Você pode agrupar alunos por turmas (por exemplo, corrida matinal, grupos de treino funcional ou equipes de ciclismo) ou manter atendimentos individuais com prescrições separadas." },
  { question: "Como acompanho a evolução dos treinos?", answer: "Por meio dos registros de conclusão de sessões, da percepção subjetiva de esforço (RPE informada pelo aluno ao término do treino), de relatórios de frequência e de gráficos de volume ao longo das semanas." },
  { question: "O Gymnasion possui integração com Strava?", answer: "Sim. A plataforma integra atividades compatíveis do Strava para que dados como quilometragem, ritmo e duração fiquem visíveis no histórico de treino do aluno." },
];

// Leva ao formulário de contato e coloca o foco no primeiro campo
function goToContact() {
  window.setTimeout(() => document.getElementById("lead-nome")?.focus({ preventScroll: true }), 450);
}

function ContactButton({ children = "Quero conhecer o Gymnasion", variant = "primary" }: { children?: string; variant?: "primary" | "secondary" }) {
  return <a className={`button button--${variant} conheca-cta-button`} href="#contato" onClick={goToContact}>{children}<ArrowRight size={18} aria-hidden="true" /></a>;
}

function SectionCta({ text, label }: { text: string; label?: string }) {
  return <div className="conheca-section-cta"><p>{text}</p><ContactButton>{label}</ContactButton></div>;
}

function CheckList({ items }: { items: string[] }) {
  return <ul className="conheca-checklist">{items.map(item => <li key={item}><Check size={16} strokeWidth={2.5} aria-hidden="true" />{item}</li>)}</ul>;
}

function DemoPanel({ tab }: { tab: TabId }) {
  if (tab === "alunos") return <>
    <div className="conheca-demo__copy">
      <span className="conheca-demo__label">Gestão de alunos</span>
      <h3>Centralize perfis, grupos e acessos em um clique</h3>
      <p>Crie turmas para assessorias de corrida ou grupos de treino funcional. Cada aluno recebe seu link individual de convite para ingressar.</p>
      <span className="conheca-demo__chip"><Link2 size={16} aria-hidden="true" />Convite rápido por link</span>
    </div>
    <div className="conheca-mock conheca-demo__mock">
      <div className="conheca-mock__head"><strong>Turmas e alunos cadastrados</strong><span>Dados ilustrativos</span></div>
      <div className="conheca-mock__row conheca-mock__row--soft"><div><strong>Turma: Corrida 10k Manhã</strong><span>14 alunos ativos • Ter/Qui às 06:30</span></div><SportTag sport="corrida" /></div>
      <div className="conheca-mock__row conheca-mock__row--soft"><div><strong>Turma: Performance Triatlo</strong><span>8 alunos ativos • Multisporte</span></div><SportTag sport="natacao" /></div>
      <div className="conheca-mock__row conheca-mock__row--soft"><div><strong>Atleta individual: André Matos</strong><span>Consultoria funcional e força</span></div><SportTag sport="funcional" /></div>
    </div>
  </>;

  if (tab === "rotinas") return <>
    <div className="conheca-demo__copy">
      <span className="conheca-demo__label">Prescrição e sessões</span>
      <h3>Estruturação de treinos com especificidade por modalidade</h3>
      <p>Defina volumes, séries, cadência ou zonas de ritmo de acordo com cada esporte. Atualize treinos da turma ou de cada aluno.</p>
      <span className="conheca-demo__note"><span className="conheca-dot conheca-dot--success" />Notificação da nova sessão enviada ao aluno</span>
    </div>
    <div className="conheca-mock conheca-demo__mock">
      <div className="conheca-mock__head"><strong>Ficha de treino prescrita</strong><span>Dados ilustrativos</span></div>
      <div className="conheca-mock__panel">
        <div className="conheca-mock__title"><strong>Treino de Musculação &amp; Potência</strong><SportTag sport="academia" /></div>
        <dl className="conheca-mock__list">
          <div><dt>1. Agachamento livre</dt><dd>4 séries x 6 rep @ 80%</dd></div>
          <div><dt>2. Supino reto halteres</dt><dd>3 séries x 10 rep</dd></div>
          <div><dt>3. Puxada alta pronada</dt><dd>3 séries x 10-12 rep</dd></div>
        </dl>
      </div>
      <div className="conheca-mock__foot"><span>Status do aluno: <strong>Sessão concluída hoje às 08:15</strong></span><span className="conheca-mock__ok">Feedback registrado</span></div>
    </div>
  </>;

  return <>
    <div className="conheca-demo__copy">
      <span className="conheca-demo__label">Feedback e relatórios</span>
      <h3>Entenda o esforço real do seu aluno em cada sessão</h3>
      <p>Cruze os dados da prescrição com a Percepção de Esforço (RPE) e atividades importadas do Strava para validar se o treino surtiu o efeito desejado.</p>
      <span className="conheca-demo__note conheca-demo__note--info"><StravaIcon size={16} />Integração com o Strava</span>
    </div>
    <div className="conheca-mock conheca-demo__mock">
      <div className="conheca-mock__head"><strong>Análise de carga — Atleta: Bruno Silva</strong><span>Dados ilustrativos</span></div>
      <div className="conheca-mock__kpis">
        <div><span>RPE médio mensal</span><strong className="conheca-text--academia">7.8 / 10</strong><small className="conheca-text--success">Dentro da zona planejada</small></div>
        <div><span>Quilometragem Strava</span><strong className="conheca-text--corrida">142.5 km</strong><small>+12% vs mês anterior</small></div>
      </div>
      <div className="conheca-mock__callout"><strong>Relatório de evolução pronto para exportar</strong><span>Visualizar PDF</span></div>
    </div>
  </>;
}

export default function Conheca() {
  const [activeTab, setActiveTab] = useState<TabId>("alunos");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Conheça o Gymnasion — Gestão e acompanhamento esportivo";
    return () => { document.title = previousTitle; };
  }, []);

  // CTA fixo no mobile: aparece depois do hero e some quando o formulário está na tela
  useEffect(() => {
    const visible = { hero: true, contact: false };
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { visible[entry.target === heroRef.current ? "hero" : "contact"] = entry.isIntersecting; });
      setShowStickyCta(!visible.hero && !visible.contact);
    });
    if (heroRef.current) observer.observe(heroRef.current);
    if (contactRef.current) observer.observe(contactRef.current);
    return () => observer.disconnect();
  }, []);

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = tabs.findIndex(tab => tab.id === activeTab);
    const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    setActiveTab(next.id);
    document.getElementById(`conheca-tab-${next.id}`)?.focus();
  }

  return <div className="institutional-home conheca">
    <a className="institutional-skip" href="#conteudo">Pular para o conteúdo</a>

    <header className="conheca-nav">
      <div className="institutional-container conheca-nav__inner">
        <a href="#home" aria-label="Gymnasion — início"><Logo /></a>
        <nav aria-label="Navegação principal" className="conheca-nav__links">
          <a href="#funcionalidades">Funcionalidades</a><a href="#como-funciona">Como funciona</a><a href="#duvidas">Dúvidas</a>
        </nav>
        <div className="conheca-nav__actions">
          <Link className="button button--ghost conheca-nav__login" to="/login">Entrar</Link>
          <a className="button button--primary" href="#contato" onClick={goToContact}>Quero conhecer</a>
        </div>
      </div>
    </header>

    <main id="conteudo">
      <section className="conheca-hero" id="home" ref={heroRef} aria-labelledby="conheca-hero-title">
        <div className="institutional-container conheca-hero__inner">
          <div className="conheca-hero__copy">
            <p className="conheca-pill"><span className="conheca-pill__dot" />Gestão e acompanhamento esportivo</p>
            <h1 id="conheca-hero-title">Mais clareza para acompanhar. <em>Mais tempo para treinar.</em></h1>
            <p className="conheca-hero__description">Organize alunos, rotinas e turmas em um só lugar. Com o Gymnasion, você acompanha cada treino e visualiza a evolução dos seus alunos nas diferentes modalidades.</p>
            <div className="conheca-hero__actions">
              <a className="button button--primary" href="#contato" onClick={goToContact}>Quero conhecer o Gymnasion</a>
              <a className="button button--secondary" href="#demonstracao">Ver como funciona</a>
            </div>
            <p className="conheca-hero__audience"><Check size={16} aria-hidden="true" />Para personal trainers e treinadores de diferentes modalidades.</p>
          </div>

          <div className="conheca-mock conheca-hero__mock" aria-label="Exemplo ilustrativo do painel do treinador">
            <div className="conheca-hero__mock-bar"><span><span className="conheca-dot" />Painel Gymnasion</span><small>Dados ilustrativos</small></div>
            <div className="conheca-hero__mock-body">
              <div className="conheca-mock__head conheca-mock__head--large">
                <div><strong>Painel do treinador</strong><span>Sessões programadas para hoje</span></div>
                <span className="conheca-mock__action"><Plus size={14} aria-hidden="true" />Novo convite</span>
              </div>
              <div className="conheca-mock__stats">
                <div><span>Alunos ativos</span><strong>38</strong></div>
                <div><span>Sessões hoje</span><strong className="conheca-text--primary">12</strong></div>
                <div><span>Média RPE</span><strong className="conheca-text--academia">7.4<small>/10</small></strong></div>
              </div>
              <div>
                <div className="conheca-mock__subhead"><strong>Acompanhamento das sessões</strong><span className="conheca-text--info"><StravaIcon />Strava</span></div>
                <div className="conheca-mock__row"><div><strong>Mariana Rios</strong><span>Corrida • 8 km • RPE 8/10</span></div><Badge>Concluído</Badge></div>
                <div className="conheca-mock__row"><div><strong>Lucas Costa</strong><span>Natação • 2.200 m • RPE 7/10</span></div><Badge>Concluído</Badge></div>
              </div>
              <div className="conheca-mock__panel">
                <div className="conheca-mock__subhead"><strong>Carga semanal acumulada</strong><span>4 semanas</span></div>
                <div className="conheca-bars" aria-hidden="true">
                  {[50, 70, 80, 100].map((height, index) => <div key={height}><span style={{ height: `${height}%` }} className={index === 3 ? "conheca-bars__current" : ""} /><small>{index === 3 ? "Atual" : `S${index + 1}`}</small></div>)}
                </div>
              </div>
              <div className="conheca-mock__callout conheca-mock__callout--icon">
                <span className="conheca-mock__callout-icon"><Smartphone size={16} aria-hidden="true" /></span>
                <div><strong>Área do aluno</strong><span>Acesso ao treino e registro de RPE pelo navegador</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="conheca-section conheca-section--white" aria-labelledby="conheca-problem-title">
        <div className="institutional-container">
          <div className="institutional-heading conheca-heading">
            <p className="institutional-eyebrow">O desafio</p>
            <h2 id="conheca-problem-title">Seu acompanhamento não precisa ficar espalhado.</h2>
            <p>Profissionais do esporte perdem tempo conciliando anotações manuais, mensagens soltas e planilhas desconexas para saber como cada aluno está treinando.</p>
          </div>
          <div className="conheca-problems">
            {problems.map(({ icon: Icon, title, text, solution }) => <article className="conheca-card conheca-problems__card" key={title}>
              <div>
                <span className="conheca-icon conheca-icon--brand"><Icon size={24} strokeWidth={1.8} aria-hidden="true" /></span>
                <h3>{title}</h3><p>{text}</p>
              </div>
              <p className="conheca-problems__solution"><span className="conheca-dot" />Com Gymnasion: {solution}</p>
            </article>)}
          </div>
          <SectionCta text="Chega de planilhas e mensagens soltas. Centralize o acompanhamento dos seus alunos." />
        </div>
      </section>

      <section className="conheca-section" id="funcionalidades" aria-labelledby="conheca-pillars-title">
        <div className="institutional-container">
          <div className="conheca-heading conheca-heading--left">
            <p className="institutional-eyebrow">Pilares do produto</p>
            <h2 id="conheca-pillars-title">Construído para dar controle técnico ao treinador</h2>
          </div>
          <div className="conheca-pillars">
            <article className="conheca-pillar">
              <div className="conheca-pillar__copy">
                <span className="conheca-tag">1. Gestão e conexão</span>
                <h3>Organize seus alunos</h3>
                <p>Centralize cadastros, convites e turmas para acompanhar sua rotina de trabalho. Envie links diretos para seus alunos ingressarem sem etapas burocráticas.</p>
                <CheckList items={["Convites rápidos gerados via link de compartilhamento", "Separação por turmas, grupos de treino ou consultoria individual", "Perfil técnico com modalidades praticadas por aluno"]} />
              </div>
              <div className="conheca-mock conheca-pillar__mock">
                <div className="conheca-mock__head"><strong>Alunos vinculados</strong><span>Filtro: Todos (38)</span></div>
                <div className="conheca-mock__row"><div><strong>Gabriel Alencar</strong><span>Turma Ciclismo Masters • Ativo</span></div><SportTag sport="ciclismo" /></div>
                <div className="conheca-mock__row"><div><strong>Camila Prado</strong><span>Personal individual • Ativo</span></div><SportTag sport="tenis" /></div>
              </div>
            </article>

            <article className="conheca-pillar conheca-pillar--reverse">
              <div className="conheca-pillar__copy">
                <span className="conheca-tag">2. Estrutura técnica</span>
                <h3>Planeje os treinos</h3>
                <p>Estruture rotinas por modalidade e acompanhe as sessões dos alunos. Monte prescrições específicas respeitando a lógica de cada esporte.</p>
                <CheckList items={["Rotinas adaptadas para natação, corrida, força, bike, tênis e funcional", "Organização clara de séries, repetições, intervalos ou distâncias", "Registro e status de cada sessão do aluno"]} />
              </div>
              <div className="conheca-mock conheca-pillar__mock">
                <div className="conheca-mock__panel conheca-mock__panel--white">
                  <div className="conheca-mock__title"><div><strong>Sessão de Natação — Volume &amp; Resistência</strong><span>Piscina 25 m • Foco: limiar aeróbico</span></div><SportTag sport="natacao" /></div>
                  <dl className="conheca-mock__list conheca-mock__list--dashed">
                    <div><dt>Aquecimento: 400 m livre variado</dt><dd>RPE 5</dd></div>
                    <div><dt>Série principal: 6x 200 m (P20") palmar</dt><dd className="conheca-text--primary">RPE 8</dd></div>
                    <div><dt>Soltura: 200 m costas/peito</dt><dd>RPE 3</dd></div>
                  </dl>
                </div>
              </div>
            </article>

            <article className="conheca-pillar">
              <div className="conheca-pillar__copy">
                <span className="conheca-tag">3. Tomada de decisão</span>
                <h3>Enxergue a evolução</h3>
                <p>Consulte métricas, gráficos e percepção de esforço para apoiar seu acompanhamento. Ajuste cargas com dados reais e sem suposições.</p>
                <CheckList items={["Escala RPE registrada após a conclusão de cada treino", "Sincronização de atividades via Strava para corrida e ciclismo", "Relatórios em PDF de assiduidade e progressão"]} />
              </div>
              <div className="conheca-mock conheca-pillar__mock">
                <div className="conheca-mock__panel conheca-mock__panel--white">
                  <div className="conheca-mock__title"><strong>Histórico de carga e esforço (RPE)</strong><Badge>Evolução estável</Badge></div>
                  <div className="conheca-progress"><div><span>Percepção média (RPE)</span><strong>7.6 / 10</strong></div><span className="conheca-progress__track"><span style={{ width: "76%" }} /></span></div>
                  <div className="conheca-progress conheca-progress--success"><div><span>Assiduidade mensal</span><strong>92%</strong></div><span className="conheca-progress__track"><span style={{ width: "92%" }} /></span></div>
                </div>
              </div>
            </article>
          </div>
          <SectionCta text="Organize alunos, planeje treinos e acompanhe a evolução em um só lugar." label="Quero esses recursos" />
        </div>
      </section>

      <section className="conheca-section conheca-section--white" id="demonstracao" aria-labelledby="conheca-demo-title">
        <div className="institutional-container">
          <div className="institutional-heading conheca-heading">
            <p className="institutional-eyebrow">Demonstração</p>
            <h2 id="conheca-demo-title">Do planejamento ao acompanhamento, tudo conectado.</h2>
            <p>Navegue pelas abas e veja como a rotina do treinador ganha fluidez e rigor técnico dentro do Gymnasion.</p>
          </div>
          <div className="conheca-tabs" role="tablist" aria-label="Áreas do Gymnasion" onKeyDown={handleTabKeyDown}>
            {tabs.map(tab => <button key={tab.id} type="button" role="tab" id={`conheca-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls="conheca-tabpanel"
              tabIndex={activeTab === tab.id ? 0 : -1} className={`conheca-tabs__tab${activeTab === tab.id ? " conheca-tabs__tab--active" : ""}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
          </div>
          <div className="conheca-demo" role="tabpanel" id="conheca-tabpanel" aria-labelledby={`conheca-tab-${activeTab}`}>
            <DemoPanel tab={activeTab} />
          </div>
          <SectionCta text="Quer ver isso funcionando na sua rotina de treinos?" label="Quero uma demonstração" />
        </div>
      </section>

      <section className="conheca-section" aria-labelledby="conheca-sports-title">
        <div className="institutional-container">
          <div className="conheca-heading conheca-heading--left">
            <p className="institutional-eyebrow">Multidisciplinar</p>
            <h2 id="conheca-sports-title">Diferentes modalidades. Uma visão organizada.</h2>
            <p>Treinadores podem registrar métricas e variáveis específicas de cada esporte sem precisar de um aplicativo separado para cada disciplina.</p>
          </div>
          <div className="conheca-sports">
            {sports.map(({ icon: Icon, tone, title, text }) => <article className={`conheca-sports__card conheca-sports__card--${tone}`} key={title}>
              <span className={`conheca-icon conheca-icon--tinted conheca-text--${tone}`}><Icon size={24} aria-hidden="true" /></span>
              <h3>{title}</h3><p>{text}</p>
            </article>)}
          </div>
        </div>
      </section>

      <section className="conheca-banner-section" aria-labelledby="conheca-banner-title">
        <div className="institutional-container">
          <div className="conheca-banner">
            <div className="conheca-banner__copy">
              <p className="conheca-banner__label">Todas as modalidades</p>
              <h2 id="conheca-banner-title">Leve seu método de treino para o próximo nível.</h2>
              <p>Deixe seu contato e descubra como o Gymnasion se adapta às modalidades que você atende.</p>
            </div>
            <ContactButton variant="secondary">Quero conhecer</ContactButton>
          </div>
        </div>
      </section>

      <section className="conheca-section conheca-section--white" id="como-funciona" aria-labelledby="conheca-steps-title">
        <div className="institutional-container">
          <div className="institutional-heading conheca-heading">
            <p className="institutional-eyebrow">Fluxo simples</p>
            <h2 id="conheca-steps-title">Comece em três passos.</h2>
            <p>Sem configurações demoradas. O foco é colocar a sua rotina esportiva para rodar com eficiência.</p>
          </div>
          <ol className="conheca-steps">
            {steps.map((step, index) => <li className="conheca-card" key={step.title}>
              <span className="conheca-steps__number">{index + 1}</span>
              <h3>{step.title}</h3><p>{step.text}</p>
            </li>)}
          </ol>
          <SectionCta text="Pronto para dar o primeiro passo?" label="Começar pelo contato" />
        </div>
      </section>

      <section className="conheca-section" id="duvidas" aria-labelledby="conheca-faq-title">
        <div className="institutional-container conheca-faq">
          <div className="institutional-heading conheca-heading">
            <p className="institutional-eyebrow">Tire suas dúvidas</p>
            <h2 id="conheca-faq-title">Perguntas frequentes</h2>
            <p>Respostas diretas sobre o funcionamento e o escopo da plataforma.</p>
          </div>
          <div className="conheca-faq__list">
            {faq.map((item, index) => {
              const open = openFaq === index;
              return <div className="conheca-faq__item" key={item.question}>
                <h3><button type="button" id={`conheca-faq-${index}`} aria-expanded={open} aria-controls={`conheca-faq-answer-${index}`} onClick={() => setOpenFaq(open ? null : index)}>
                  {item.question}<ChevronDown size={20} aria-hidden="true" className={open ? "conheca-faq__chevron--open" : ""} />
                </button></h3>
                <div id={`conheca-faq-answer-${index}`} role="region" aria-labelledby={`conheca-faq-${index}`} className="conheca-faq__answer" hidden={!open}>{item.answer}</div>
              </div>;
            })}
          </div>
          <SectionCta text="Ainda ficou com alguma dúvida? Fale com a equipe Gymnasion." label="Falar com a equipe" />
        </div>
      </section>

      <section className="conheca-section conheca-section--white" id="contato" ref={contactRef} aria-labelledby="conheca-contact-title">
        <div className="institutional-container">
          <div className="institutional-heading conheca-heading">
            <p className="conheca-pill">Acompanhamento esportivo simplificado</p>
            <h2 id="conheca-contact-title">Conheça uma forma mais organizada de acompanhar seus alunos.</h2>
            <p>Deixe seu contato para saber mais sobre o Gymnasion.</p>
          </div>
          <div className="conheca-contact__card"><LeadForm /></div>
        </div>
      </section>
    </main>

    <footer className="conheca-footer">
      <div className="institutional-container">
        <div className="conheca-footer__top">
          <div className="conheca-footer__brand">
            <a href="#home" aria-label="Gymnasion — início"><Logo variant="white" /></a>
            <p>Plataforma para personal trainers e treinadores de diferentes modalidades. Organização de rotinas, acompanhamento de sessões e evolução de alunos em um só lugar.</p>
          </div>
          <nav aria-label="Rodapé" className="conheca-footer__links">
            <div><h2>Navegação</h2><a href="#funcionalidades">Funcionalidades</a><a href="#como-funciona">Como funciona</a><a href="#duvidas">Dúvidas</a><a href="#contato">Quero conhecer</a></div>
            <div><h2>Plataforma</h2><Link to="/">Página inicial</Link><Link to="/login">Entrar</Link><Link to="/cadastro">Criar conta</Link></div>
          </nav>
        </div>
        <div className="conheca-footer__bottom"><p>© {new Date().getFullYear()} Gymnasion. Todos os direitos reservados.</p><p>Acompanhamento esportivo com foco no treinador.</p></div>
      </div>
    </footer>

    <aside className={`conheca-sticky-cta${showStickyCta ? " conheca-sticky-cta--visible" : ""}`} aria-label="Ação rápida" aria-hidden={!showStickyCta}>
      <a className="button button--primary" href="#contato" onClick={goToContact} tabIndex={showStickyCta ? 0 : -1}>Quero conhecer o Gymnasion</a>
    </aside>
  </div>;
}
