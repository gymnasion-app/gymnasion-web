// Valida o reCAPTCHA v2 (login, cadastro de personal e formulário da landing page),
// a landing page /conheca (CTAs e identidade visual) e o menu mobile da Home.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { createElement, forwardRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsx from "react/jsx-runtime";
import * as lucide from "lucide-react";
import ts from "typescript";

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

// Transpila TS/TSX para CommonJS e injeta as dependências; .css vira módulo vazio.
function load(path, dependencies = {}, globals = {}) {
  const source = read(path).replace(/import\.meta\.env/g, "__importMetaEnv");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  const deps = { react: React, "react/jsx-runtime": jsx, "lucide-react": lucide, ...dependencies };
  runInNewContext(outputText, { exports, __importMetaEnv: {}, ...globals, require: name => {
    if (name in deps) return deps[name];
    if (name.endsWith(".css")) return {};
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}

const Button = load("components/Button/Button.tsx").default;
const Link = ({ to, children, ...props }) => createElement("a", { href: to, ...props }, children);
const Passthrough = ({ children }) => createElement("div", null, children);
const Field = ({ id, name, label }) => createElement("label", { htmlFor: id }, label, createElement("input", { id, name }));
const CaptchaStub = forwardRef(function CaptchaStub({ onChange }, _ref) {
  return createElement("div", { "data-testid": "captcha", "data-has-onchange": typeof onChange === "function" });
});
const submitButton = html => html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";

// ---------------------------------------------------------------- reCAPTCHA (serviço)

function recaptchaFixture(env = { VITE_RECAPTCHA_SITE_KEY: "site-key-test" }) {
  const appended = [];
  const window = {};
  const document = {
    createElement: () => ({ remove() { this.removed = true; } }),
    head: { appendChild: script => appended.push(script) },
  };
  const module = load("services/recaptcha.ts", {}, { window, document, __importMetaEnv: env });
  return { module, window, appended };
}

test("recaptcha: lê a site key pública do ambiente do Vite", () => {
  assert.equal(recaptchaFixture().module.recaptchaSiteKey, "site-key-test");
  assert.equal(recaptchaFixture({}).module.recaptchaSiteKey, "");
});

test("recaptcha: carrega o script v2 explícito uma única vez e resolve no callback do Google", async () => {
  const { module, window, appended } = recaptchaFixture();
  const first = module.loadRecaptcha();
  const second = module.loadRecaptcha();
  assert.equal(first, second, "chamadas simultâneas reutilizam o mesmo carregamento");
  assert.equal(appended.length, 1);
  const src = new URL(appended[0].src);
  assert.equal(src.origin + src.pathname, "https://www.google.com/recaptcha/api.js");
  assert.equal(src.searchParams.get("render"), "explicit");
  assert.equal(src.searchParams.get("hl"), "pt-BR");
  const callback = src.searchParams.get("onload");
  const grecaptcha = { render: () => 1, reset: () => {} };
  window.grecaptcha = grecaptcha;
  window[callback]();
  assert.equal(await first, grecaptcha);
});

test("recaptcha: falha de rede rejeita e permite nova tentativa", async () => {
  const { module, appended } = recaptchaFixture();
  const attempt = module.loadRecaptcha();
  appended[0].onerror();
  await assert.rejects(attempt, /Falha ao carregar o reCAPTCHA/);
  assert.equal(appended[0].removed, true);
  module.loadRecaptcha();
  assert.equal(appended.length, 2, "uma nova tag de script é criada na próxima tentativa");
});

// ---------------------------------------------------------------- reCAPTCHA (componente)

function loadAuthCaptcha(siteKey) {
  return load("components/AuthCaptcha/AuthCaptcha.tsx", {
    "../../services/recaptcha": { recaptchaSiteKey: siteKey, loadRecaptcha: () => new Promise(() => {}) },
  }).default;
}

test("AuthCaptcha: com site key renderiza o contêiner do widget do Google", () => {
  const html = renderToStaticMarkup(createElement(loadAuthCaptcha("site-key-test"), { onChange: () => {} }));
  assert.match(html, /^<div class="auth-captcha"><div><\/div><\/div>$/);
});

test("AuthCaptcha: sem site key informa o erro em vez de simular a verificação", () => {
  const html = renderToStaticMarkup(createElement(loadAuthCaptcha(""), { onChange: () => {} }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Não foi possível carregar a verificação CAPTCHA/);
  assert.doesNotMatch(html, /Verificação indisponível nesta versão/, "o placeholder antigo foi removido");
});

// ---------------------------------------------------------------- Login e cadastro

test("US-02 C5: no login o botão Entrar começa desabilitado até concluir o CAPTCHA", () => {
  const SignIn = load("pages/SignIn/SignIn.tsx", {
    "react-router-dom": { useNavigate: () => () => {}, useLocation: () => ({ state: null }), useSearchParams: () => [new URLSearchParams()], Link },
    "../../components/AuthLayout/AuthLayout": { default: Passthrough },
    "../../components/AuthCaptcha/AuthCaptcha": { default: CaptchaStub },
    "../../components/Button/Button": { default: Button },
    "../../components/FormField/FormField": { default: Field },
    "../../components/Checkbox/Checkbox": { default: Field },
    "../../components/Toast/Toast": { default: () => null },
    "../../services/authService": { authService: {} },
    "../../services/session": { session: { getRememberedEmail: () => null }, homeForRole: () => "/" },
    "../../utils/authError": { authError: () => ({ message: "" }) },
    "../../features/studentArea/studentAreaModel": { formatLoginToast: () => null },
  }).default;
  const html = renderToStaticMarkup(createElement(SignIn));
  assert.match(html, /data-testid="captcha" data-has-onchange="true"/);
  assert.match(submitButton(html), /disabled=""/);
  assert.ok(html.indexOf('data-testid="captcha"') < html.indexOf('type="submit"'), "o CAPTCHA fica antes do botão");
});

test("US-01: no cadastro de personal o CAPTCHA é exibido e bloqueia o envio sem token", () => {
  const SignUp = load("pages/SignUp/SignUp.tsx", {
    "react-router-dom": { useNavigate: () => () => {}, Link },
    "../../components/AuthLayout/AuthLayout": { default: Passthrough },
    "../../components/AuthCaptcha/AuthCaptcha": { default: CaptchaStub },
    "../../components/PasswordRules/PasswordRules": { default: () => null },
    "../../components/TermsModal/TermsModal": { default: () => null },
    "../../components/Toast/Toast": { default: () => null },
    "../../components/Button/Button": { default: Button },
    "../../components/Checkbox/Checkbox": { default: Field },
    "../../components/FormField/FormField": { default: Field },
    "./validation": { formatPhone: value => value, validateSignUp: () => ({}) },
    "../../services/modalidadeService": { modalidadeService: {} },
    "../../services/authService": { authService: {} },
    "../../utils/authError": { authError: () => ({ message: "", fields: {} }) },
  }).default;
  const html = renderToStaticMarkup(createElement(SignUp));
  assert.match(html, /data-testid="captcha" data-has-onchange="true"/);
  assert.match(submitButton(html), /disabled=""/);
  // O carregamento de modalidades também desabilita o botão; garante que o token entra na regra
  assert.match(read("pages/SignUp/SignUp.tsx"), /disabled=\{[^}]*!captchaToken\}/);
});

test("authService envia o token: login web e cadastro de personal", async () => {
  const calls = [];
  const { authService } = load("services/authService.ts", {
    "./api": { api: { post: async (...args) => { calls.push(args); return { data: { token: "t", id: "1", role: "PERSONAL_TRAINER" } }; } } },
    "./session": { session: { save: () => {} } },
  });
  await authService.login({ email: "a@a.com", password: "x", captchaToken: "tk-login" });
  await authService.registroPersonal({ nome: "A", email: "a@a.com", password: "x", cpf: "1", celular: "1", modalidade: 1, aceitouTermos: true, captchaToken: "tk-cad" });
  assert.equal(calls[0][0], "/api/auth/login-web");
  assert.equal(calls[0][1].captchaToken, "tk-login");
  assert.equal(calls[1][0], "/api/auth/registro-personal");
  assert.equal(calls[1][1].captchaToken, "tk-cad");
});

// ---------------------------------------------------------------- Formulário de leads

function loadLeadForm(leadService = {}) {
  return load("components/LeadForm/LeadForm.tsx", {
    "../Button/Button": { default: Button },
    "../FormField/FormField": { default: Field },
    "../Checkbox/Checkbox": { default: Field },
    "../AuthCaptcha/AuthCaptcha": { default: CaptchaStub },
    "../../services/leadService": { leadService },
    "../../utils/handleApiError": { handleApiError: () => {} },
  }).default;
}

test("LeadForm: exibe o reCAPTCHA e mantém o envio desabilitado até concluir a verificação", () => {
  const html = renderToStaticMarkup(createElement(loadLeadForm()));
  assert.match(html, /data-testid="captcha" data-has-onchange="true"/);
  assert.match(submitButton(html), /disabled=""/);
  assert.match(html, /Quero conhecer o Gymnasion/);
  assert.match(html, /conforme a LGPD/);
});

test("leadService envia o lead com o token do CAPTCHA para /api/leads", async () => {
  let request;
  const { leadService } = load("services/leadService.ts", { "./api": { api: { post: async (...args) => { request = args; } } } });
  const payload = { nome: "Ana", email: "ana@exemplo.com", modalidade: "natacao", aceitaNovidades: true, captchaToken: "tk-lead" };
  await leadService.registrar(payload);
  assert.equal(request[0], "/api/leads");
  assert.deepEqual(request[1], payload);
});

// ---------------------------------------------------------------- Landing page /conheca

function renderConheca() {
  const Conheca = load("pages/Conheca/Conheca.tsx", {
    "react-router-dom": { Link },
    "../../components/Logo/Logo": { default: () => createElement("span", null, "logo") },
    "../../components/Badge/Badge": { default: ({ children }) => createElement("span", null, children) },
    "../../components/SportTag/SportTag": { default: ({ sport }) => createElement("span", null, sport) },
    "../../components/LeadForm/LeadForm": { default: () => createElement("form", { "data-testid": "lead-form" }) },
  }).default;
  return renderToStaticMarkup(createElement(Conheca));
}

test("/conheca: há botões entre as seções que levam ao formulário", () => {
  const html = renderConheca();
  const ctas = html.match(/<a class="button button--(primary|secondary) conheca-cta-button" href="#contato">/g) ?? [];
  assert.equal(ctas.length, 6, "5 CTAs de seção + 1 no banner");
  assert.equal((html.match(/class="conheca-section-cta"/g) ?? []).length, 5);
  for (const label of ["Quero esses recursos", "Quero uma demonstração", "Começar pelo contato", "Falar com a equipe"]) assert.ok(html.includes(label), label);
  assert.match(html, /id="contato"/);
  assert.match(html, /data-testid="lead-form"/);
});

test("/conheca: cada CTA fica depois do conteúdo da seção e antes da próxima", () => {
  const html = renderConheca();
  const order = ["conheca-problem-title", "conheca-pillars-title", "conheca-demo-title", "conheca-banner-title", "conheca-steps-title", "conheca-faq-title", "conheca-contact-title"];
  const positions = order.map(id => html.indexOf(`id="${id}"`));
  assert.ok(positions.every((pos, i) => pos > 0 && (i === 0 || pos > positions[i - 1])), "seções na ordem esperada");
  const ctaPositions = [...html.matchAll(/conheca-cta-button/g)].map(m => m.index);
  // um CTA entre cada par de seções consecutivas (o banner contém o seu próprio)
  for (let i = 0; i < order.length - 1; i++) {
    assert.ok(ctaPositions.some(pos => pos > positions[i] && pos < positions[i + 1]), `CTA entre ${order[i]} e ${order[i + 1]}`);
  }
});

test("/conheca: identidade visual alinhada à Home", () => {
  const html = renderConheca();
  const css = read("pages/Conheca/Conheca.css");
  assert.match(html, /<h1 id="conheca-hero-title">Mais clareza para acompanhar\. <em>Mais tempo para treinar\.<\/em><\/h1>/, "destaque laranja no título, como a Home");
  assert.equal((html.match(/conheca-icon conheca-icon--brand/g) ?? []).length, 3, "ícones dos problemas na cor da marca");
  assert.doesNotMatch(html, /conheca-steps__number--primary/, "todos os passos com o mesmo estilo");
  assert.match(html, /<p class="institutional-eyebrow">O desafio<\/p>/);
  assert.match(css, /\.conheca-hero \{[^}]*linear-gradient\(180deg, var\(--color-surface\), var\(--color-primary-50\)\)/, "mesmo gradiente do hero da Home");
  assert.match(css, /\.conheca-steps__number \{[^}]*border-radius: var\(--radius-pill\);[^}]*background: var\(--color-primary-500\)/);
  assert.match(css, /\.conheca-banner \{[^}]*linear-gradient\(90deg, #ff8a3d, #e5391b\)/, "mesmo gradiente da seção de assinatura da Home");
  assert.match(css, /\.conheca-icon--brand \{[^}]*var\(--color-primary-50\)[^}]*var\(--color-primary-500\)/);
});

// ---------------------------------------------------------------- Menu da Home no celular

function mediaBlock(css, maxWidth) {
  const start = css.indexOf(`@media (max-width: ${maxWidth}px) {`);
  assert.ok(start >= 0, `bloco @media ${maxWidth}px`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  return "";
}

test("Home mobile: o botão Entrar fica fora do menu recolhido", () => {
  const Navbar = load("components/InstitutionalNavbar/InstitutionalNavbar.tsx", {
    "react-router-dom": { Link },
    "../Logo/Logo": { default: () => createElement("span", null, "logo") },
    "../Button/Button": { default: Button },
  }).default;
  const html = renderToStaticMarkup(createElement(Navbar));
  const navStart = html.indexOf("<nav");
  const outsideLogin = html.search(/<a (?=[^>]*href="\/login")(?=[^>]*class="button button--secondary institutional-nav__login")[^>]*>Entrar<\/a>/);
  assert.ok(outsideLogin > 0 && outsideLogin < navStart, "Entrar visível antes/fora do <nav> recolhível");
  assert.match(html.slice(navStart), /<a (?=[^>]*href="\/login")(?=[^>]*institutional-nav__menu-login)[^>]*>Entrar<\/a>/, "versão desktop do Entrar continua no menu");
  assert.match(html, /aria-expanded="false"[^>]*aria-label="Abrir menu"/);
  assert.match(html, /lucide-menu/, "ícone ☰ no lugar do texto Menu");
});

test("Home mobile: CSS mostra o Entrar compacto, esconde a cópia do menu e reduz a logo", () => {
  const css = read("components/InstitutionalNavbar/InstitutionalNavbar.css");
  assert.match(css, /^\.institutional-nav__compact \{ display: none;/m, "no desktop o grupo compacto fica oculto");
  const tablet = mediaBlock(css, 1150);
  assert.match(tablet, /\.institutional-nav__compact \{ display: flex; \}/);
  assert.match(tablet, /\.institutional-nav__menu-login \{ display: none; \}/);
  assert.match(tablet, /\.institutional-nav__login \{[^}]*min-height: 44px/, "alvo de toque de 44px");
  const phone = mediaBlock(css, 700);
  assert.match(phone, /\.ds-logo img \{ width: 32px; height: 32px; \}/);
  assert.match(phone, /\.ds-logo \{[^}]*font-size: 19px/);
  const narrow = mediaBlock(css, 360);
  assert.match(narrow, /\.ds-logo img \{ width: 28px; height: 28px; \}/);
});
