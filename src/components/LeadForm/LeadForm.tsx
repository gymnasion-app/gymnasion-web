import { useRef, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import Button from "../Button/Button";
import FormField from "../FormField/FormField";
import Checkbox from "../Checkbox/Checkbox";
import AuthCaptcha, { type AuthCaptchaHandle } from "../AuthCaptcha/AuthCaptcha";
import { leadService } from "../../services/leadService";
import { handleApiError } from "../../utils/handleApiError";
import "./LeadForm.css";

const sports = [
  { value: "musculacao", label: "Musculação" },
  { value: "natacao", label: "Natação" },
  { value: "corrida", label: "Corrida" },
  { value: "ciclismo", label: "Ciclismo" },
  { value: "tenis", label: "Tênis" },
  { value: "funcional", label: "Treinamento funcional" },
  { value: "multiplas", label: "Mais de uma modalidade" },
];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Errors = { nome?: string; email?: string };

export default function LeadForm() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [aceitaNovidades, setAceitaNovidades] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<AuthCaptchaHandle>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Errors = {};
    if (!nome.trim()) nextErrors.nome = "Por favor, informe seu nome.";
    if (!emailPattern.test(email.trim())) nextErrors.email = "Por favor, insira um e-mail válido.";
    setErrors(nextErrors);
    if (nextErrors.nome || nextErrors.email) {
      document.getElementById(nextErrors.nome ? "lead-nome" : "lead-email")?.focus();
      return;
    }
    if (!captchaToken) return;

    setLoading(true);
    try {
      await leadService.registrar({ nome: nome.trim(), email: email.trim(), modalidade: modalidade || null, aceitaNovidades, captchaToken });
      setCaptchaToken(null);
      setSent(true);
    } catch (err) {
      handleApiError(err, "Não foi possível registrar seu interesse. Tente novamente.");
      // O token do reCAPTCHA vale uma única vez: exige nova verificação
      captchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setNome(""); setEmail(""); setModalidade(""); setAceitaNovidades(false); setCaptchaToken(null); setSent(false);
  }

  if (sent) return <div className="lead-form__success" role="status">
    <span className="lead-form__success-icon"><Check size={24} strokeWidth={2.5} aria-hidden="true" /></span>
    <h3>Interesse registrado</h3>
    <p>Obrigado, {nome.trim().split(" ")[0]}! Em breve a equipe Gymnasion entrará em contato pelo e-mail informado.</p>
    <button type="button" className="lead-form__again" onClick={reset}>Enviar outro contato</button>
  </div>;

  return <form className="lead-form" noValidate onSubmit={handleSubmit}>
    <FormField id="lead-nome" name="name" label="Nome *" autoComplete="name" placeholder="Seu nome completo" value={nome} error={errors.nome}
      onChange={event => { setNome(event.target.value); setErrors(current => ({ ...current, nome: undefined })); }} />
    <FormField id="lead-email" name="email" type="email" label="E-mail *" autoComplete="email" placeholder="seu.email@exemplo.com" value={email} error={errors.email}
      onChange={event => { setEmail(event.target.value); setErrors(current => ({ ...current, email: undefined })); }} />
    <FormField id="lead-modalidade" name="sport" label="Modalidade principal (opcional)" options={sports} selectPlaceholder="Selecione uma modalidade"
      value={modalidade} onChange={event => setModalidade(event.target.value)} />
    <Checkbox className="lead-form__newsletter" label="Desejo receber novidades e atualizações sobre recursos do Gymnasion por e-mail."
      checked={aceitaNovidades} onChange={event => setAceitaNovidades(event.target.checked)} />
    <AuthCaptcha ref={captchaRef} onChange={setCaptchaToken} />
    <Button type="submit" className="lead-form__submit" loading={loading} disabled={!captchaToken}>{loading ? "Enviando..." : "Quero conhecer o Gymnasion"}</Button>
    <p className="lead-form__privacy">Suas informações de contato serão utilizadas apenas para responder ao seu interesse na plataforma, conforme a LGPD.</p>
  </form>;
}
