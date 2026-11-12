import { useRef, useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "../../components/AuthLayout/AuthLayout";
import AuthCaptcha, { type AuthCaptchaHandle } from "../../components/AuthCaptcha/AuthCaptcha";
import PasswordRules from "../../components/PasswordRules/PasswordRules";
import TermsModal from "../../components/TermsModal/TermsModal";
import Toast from "../../components/Toast/Toast";
import Button from "../../components/Button/Button";
import Checkbox from "../../components/Checkbox/Checkbox";
import FormField from "../../components/FormField/FormField";
import { formatPhone, validateSignUp, type SignUpValues, type SignUpErrors } from "./validation";
import { modalidadeService } from "../../services/modalidadeService";
import { authService } from "../../services/authService";
import { authError } from "../../utils/authError";
import "./SignUp.css";

function formatCpf(value: string) {
  return value.replace(/\D/g, "").slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3}\.\d{3})(\d)/, "$1.$2").replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, "$1-$2");
}

export default function SignUp() {
  const navigate = useNavigate();
  const [values, setValues] = useState<SignUpValues>({ name: "", email: "", password: "", confirmPassword: "", cpf: "", phone: "", modality: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof SignUpValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [serverErrors, setServerErrors] = useState<SignUpErrors>({});
  const [notice, setNotice] = useState("");
  const [modalitiesOptions, setModalitiesOptions] = useState<{ value: string; label: string }[]>([]);
  const [loadingModalities, setLoadingModalities] = useState(true);
  const [modalityError, setModalityError] = useState("");
  const [retry, setRetry] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<AuthCaptchaHandle>(null);
  const errors = validateSignUp(values);

  useEffect(() => {
    let active = true;
    setLoadingModalities(true);
    setModalityError("");
    modalidadeService.listarTodas().then(modalidades => {
      if (!active) return;
      setModalitiesOptions(modalidades.map(m => ({ value: String(m.id), label: m.nome })));
      if (!modalidades.length) setModalityError("Nenhuma modalidade disponível para cadastro.");
    }).catch(err => {
      if (active) setModalityError(authError(err, "Não foi possível carregar as modalidades.").message);
    }).finally(() => { if (active) setLoadingModalities(false); });
    return () => { active = false; };
  }, [retry]);

  function fieldProps(name: keyof SignUpValues) {
    return {
      value: values[name],
      error: serverErrors[name] || (touched[name] || submitted ? errors[name] : undefined),
      onBlur: () => setTouched(previous => ({ ...previous, [name]: true })),
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let value = event.target.value;
        if (name === "cpf") value = formatCpf(value);
        if (name === "phone") value = formatPhone(value);
        setValues(previous => ({ ...previous, [name]: value }));
        setServerErrors(previous => ({ ...previous, [name]: undefined }));
        setNotice("");
      },
      disabled: isSubmitting,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setSubmitted(true);
    setNotice("");
    setServerErrors({});
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      const field = event.currentTarget.elements.namedItem(firstInvalid);
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    if (!accepted) {
      setNotice("É obrigatório aceitar os Termos de Uso e Política de Privacidade para criar sua conta");
      const field = event.currentTarget.elements.namedItem("terms");
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    if (loadingModalities || modalityError || !captchaToken) return;
    setIsSubmitting(true);
    try {
      await authService.registroPersonal({
        nome: values.name.trim(), email: values.email.trim().toLowerCase(),
        password: values.password, cpf: values.cpf.replace(/\D/g, ""),
        celular: values.phone.replace(/\D/g, ""), modalidade: Number(values.modality),
        aceitouTermos: true, captchaToken,
      });
      navigate("/login", { replace: true, state: { registered: true, email: values.email.trim().toLowerCase() } });
    } catch (err) {
      const result = authError(err, "Não foi possível realizar o cadastro.");
      setNotice(result.message);
      setServerErrors(result.fields);
      captchaRef.current?.reset();
    } finally {
      setIsSubmitting(false);
    }
  }

  return <AuthLayout variant="signup">
    {notice && <div className="auth-form__toast"><Toast tone="error" title="Não foi possível concluir o cadastro" message={notice} onClose={() => setNotice("")} /></div>}
    <form className="auth-form personal-signup" onSubmit={handleSubmit} noValidate aria-labelledby="signup-title">
      <div className="auth-form__heading"><h1 id="signup-title">Crie sua conta de personal</h1><p>Comece a gerenciar seus alunos e treinos em poucos minutos.</p></div>
      <div className="personal-signup__grid">
        <FormField id="signup-name" name="name" {...fieldProps("name")} label="Nome completo" autoComplete="name" placeholder="Seu nome completo" maxLength={150} required />
        <FormField id="signup-cpf" name="cpf" {...fieldProps("cpf")} label="CPF" inputMode="numeric" placeholder="000.000.000-00" required />
        <FormField id="signup-email" name="email" {...fieldProps("email")} label="E-mail" type="email" autoComplete="email" placeholder="seu@email.com" maxLength={100} required />
        <FormField id="signup-modality" name="modality" {...fieldProps("modality")} label="Modalidade principal" options={modalitiesOptions} selectPlaceholder={loadingModalities ? "Carregando..." : "Selecionar modalidade"} disabled={isSubmitting || loadingModalities || Boolean(modalityError)} required />
        <div className="personal-signup__phone"><FormField id="signup-phone" name="phone" {...fieldProps("phone")} label="Celular" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(00) 00000-0000" maxLength={15} required /></div>
        <FormField id="signup-password" name="password" {...fieldProps("password")} label="Senha" type="password" autoComplete="new-password" placeholder="Crie sua senha" maxLength={255} required />
        <FormField id="signup-confirm-password" name="confirmPassword" {...fieldProps("confirmPassword")} label="Confirmar senha" type="password" autoComplete="new-password" placeholder="Repita sua senha" maxLength={255} required />
      </div>
      {modalityError && <div className="auth-form__error" role="alert">{modalityError} <button type="button" className="auth-form__link" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></div>}
      <PasswordRules password={values.password} />
      <AuthCaptcha ref={captchaRef} onChange={setCaptchaToken} />
      <div className={`personal-signup__terms${submitted && !accepted ? " personal-signup__terms--invalid" : ""}`}>
        <Checkbox name="terms" label="Li e aceito os" checked={accepted} onChange={event => setAccepted(event.target.checked)} aria-invalid={submitted && !accepted || undefined} aria-describedby={submitted && !accepted ? "terms-error" : undefined} disabled={isSubmitting} />
        <button type="button" className="auth-form__link" onClick={() => setTermsOpen(true)}>Termos de Uso e Política de Privacidade</button>
      </div>
      {submitted && !accepted && <p className="personal-signup__terms-error" id="terms-error" role="alert">Aceite os termos para continuar.</p>}
      <Button type="submit" className="auth-form__submit" loading={isSubmitting} disabled={loadingModalities || Boolean(modalityError) || !captchaToken}>{isSubmitting ? "Cadastrando..." : "Finalizar cadastro"}</Button>
      <p className="auth-form__switch">Já tem uma conta? <Link className="auth-form__link" to="/login">Entrar</Link></p>
    </form>
    {termsOpen && <TermsModal onClose={() => setTermsOpen(false)} onAccept={() => { setAccepted(true); setTermsOpen(false); setNotice(""); }} />}
  </AuthLayout>;
}
