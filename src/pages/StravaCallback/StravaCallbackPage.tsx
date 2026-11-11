import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../../components/Button/Button";
import Logo from "../../components/Logo/Logo";
import { stravaService } from "../../services/stravaService";
import { session } from "../../services/session";
import { authError } from "../../utils/authError";
import { sendStravaPopupCallback } from "../../features/strava/connectWithPopup";
import "./StravaCallbackPage.css";

export default function StravaCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const code = searchParams.get("code");
  const scope = searchParams.get("scope") || undefined;
  const state = searchParams.get("state") || undefined;
  const errorParam = searchParams.get("error");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [retrying, setRetrying] = useState(false);

  const exchangeExecuted = useRef(false);

  useEffect(() => {
    // Evita dupla chamada em React 18 StrictMode
    if (exchangeExecuted.current) return;
    exchangeExecuted.current = true;

    if (sendStravaPopupCallback(window.location.search)) return;

    async function processCallback() {
      // 1. Verifica se usuário está autenticado no Gymnasion
      const currentUser = session.getUser();
      if (!currentUser) {
        setLoading(false);
        setErrorMessage("Você precisa estar logado na sua conta Gymnasion para conectar ao Strava.");
        return;
      }

      // 2. Verifica se o usuário cancelou a autorização no Strava
      if (errorParam) {
        setLoading(false);
        if (errorParam === "access_denied") {
          setErrorMessage("A autorização foi cancelada no Strava. Sua conta não foi conectada.");
        } else {
          setErrorMessage(`O Strava retornou o seguinte erro: ${errorParam}`);
        }
        return;
      }

      // 3. Verifica presença do authorization code
      if (!code) {
        setLoading(false);
        setErrorMessage("Código de autorização não encontrado no retorno do Strava.");
        return;
      }

      // 4. Efetua a troca do code com o back-end do Gymnasion
      try {
        setLoading(true);
        const result = await stravaService.conectar({
          code,
          scope,
          state,
        });

        setSuccess(true);
        setLoading(false);
        toast.success(
          result.nomeAtleta
            ? `Strava conectado com sucesso como ${result.nomeAtleta}!`
            : "Conta Strava conectada com sucesso!",
          { id: "strava-connected", duration: 5000 }
        );

        // Redireciona automaticamente para a área do aluno após 2 segundos
        const timer = setTimeout(() => {
          navigate("/conta", { replace: true });
        }, 2000);

        return () => clearTimeout(timer);
      } catch (err) {
        setLoading(false);
        const parsed = authError(
          err,
          "Não foi possível concluir a integração com o Strava. O código pode ter expirado ou o state de segurança é inválido."
        );
        setErrorMessage(parsed.message);
      }
    }

    void processCallback();
  }, [code, scope, state, errorParam, navigate]);

  async function handleRetry() {
    try {
      setRetrying(true);
      const res = await stravaService.obterAuthUrl();
      if (res.authUrl) {
        window.location.href = res.authUrl;
      }
    } catch {
      toast.error("Não foi possível gerar nova URL de autorização.");
      setRetrying(false);
    }
  }

  return (
    <main className="strava-callback-page">
      <header className="strava-callback-page__header">
        <Link to="/" aria-label="Gymnasion — início">
          <Logo />
        </Link>
      </header>

      <div className="strava-callback-page__card" role="region" aria-live="polite">
        <div className="strava-callback-page__badge-row">
          <span className="strava-callback-page__strava-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="#fc5200">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.008 13.828h4.172" />
            </svg>
          </span>
        </div>

        {loading && (
          <div className="strava-callback-page__state">
            <div className="strava-callback-page__spinner" aria-hidden="true" />
            <h1>Conectando sua conta ao Strava</h1>
            <p>
              Estamos validando a autorização e sincronizando seus dados de atleta. Isso levará apenas
              alguns instantes...
            </p>
          </div>
        )}

        {success && (
          <div className="strava-callback-page__state">
            <div className="strava-callback-page__icon strava-callback-page__icon--success">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h1>Conexão realizada com sucesso!</h1>
            <p>
              Sua conta do Strava foi integrada ao Gymnasion. Agora você pode importar seus treinos,
              distâncias e frequências cardíacas diretamente ao finalizar sessões.
            </p>
            <div className="strava-callback-page__actions">
              <Button onClick={() => navigate("/conta", { replace: true })}>
                Ir para o meu painel
              </Button>
            </div>
          </div>
        )}

        {!loading && !success && errorMessage && (
          <div className="strava-callback-page__state">
            <div className="strava-callback-page__icon strava-callback-page__icon--error">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1>Não foi possível conectar ao Strava</h1>
            <p className="strava-callback-page__error-text">{errorMessage}</p>
            <div className="strava-callback-page__actions">
              <Button variant="secondary" onClick={() => navigate("/conta", { replace: true })}>
                Voltar ao painel
              </Button>
              <Button loading={retrying} onClick={() => void handleRetry()}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}
      </div>

      <footer className="strava-callback-page__footer">
        <p>© 2026 Gymnasion · Integração oficial com Strava API v3</p>
      </footer>
    </main>
  );
}
