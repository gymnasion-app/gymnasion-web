import { stravaService } from "../../services/stravaService";
import type { StravaConectarRequest } from "../../types/strava";
import { authError } from "../../utils/authError";

export const STRAVA_STATUS_CHANGED = "gymnasion:strava-status-changed";
const POPUP_CALLBACK = "gymnasion:strava-popup-callback";

export function sendStravaPopupCallback(search: string): boolean {
  if (!window.opener || sessionStorage.getItem(POPUP_CALLBACK) !== "1") return false;
  window.opener.postMessage({ type: POPUP_CALLBACK, search }, window.location.origin);
  return true;
}

function waitForCallback(popup: Window, authUrl: string): Promise<StravaConectarRequest> {
  return new Promise((resolve, reject) => {
    function cleanup() {
      window.removeEventListener("message", receiveCallback);
      window.clearInterval(closeCheck);
    }

    function receiveCallback(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.type !== POPUP_CALLBACK ||
        typeof event.data.search !== "string"
      ) return;

      cleanup();
      const params = new URLSearchParams(event.data.search);
      const code = params.get("code");
      if (params.has("error") || !code) {
        reject(new Error(params.get("error") === "access_denied"
          ? "A autorização foi cancelada no Strava."
          : "O Strava não retornou uma autorização válida."));
        return;
      }

      resolve({
        code,
        scope: params.get("scope") || undefined,
        state: params.get("state") || undefined,
      });
    }

    const closeCheck = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("A janela do Strava foi fechada antes de concluir a autorização."));
    }, 500);

    window.addEventListener("message", receiveCallback);
    try {
      popup.location.replace(authUrl);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export async function connectStravaWithPopup(): Promise<void> {
  // A janela precisa ser aberta no clique, antes de consultar a API.
  const popup = window.open("", "_blank", "popup,width=600,height=760");
  if (!popup) {
    throw new Error("Permita popups para o Gymnasion e tente conectar ao Strava novamente.");
  }

  try {
    popup.document.title = "Conectar ao Strava";
    popup.document.body.textContent = "Abrindo a autorização do Strava…";
    popup.sessionStorage.setItem(POPUP_CALLBACK, "1");
    const { authUrl } = await stravaService.obterAuthUrl().catch((error: unknown) => {
      throw new Error(authError(error, "Não foi possível iniciar a conexão com o Strava.").message);
    });
    if (popup.closed) throw new Error("A janela do Strava foi fechada antes de abrir a autorização.");
    if (!authUrl) throw new Error("O servidor não retornou a URL de autorização do Strava.");
    const authorizationUrl = new URL(authUrl, window.location.origin);
    const redirect = authorizationUrl.searchParams.get("redirect_uri");
    const callbackOrigin = redirect ? new URL(redirect).origin : authorizationUrl.origin;
    if (callbackOrigin !== window.location.origin) {
      throw new Error("Abra o Gymnasion em " + callbackOrigin + " para conectar ao Strava.");
    }

    const authorization = await waitForCallback(popup, authorizationUrl.href);
    popup.close();
    const status = await stravaService.conectar(authorization).catch((error: unknown) => {
      throw new Error(authError(error, "Não foi possível concluir a conexão com o Strava.").message);
    });
    if (!status.conectado || status.expirado) {
      throw new Error("O servidor não confirmou a conexão com o Strava.");
    }
    window.dispatchEvent(new Event(STRAVA_STATUS_CHANGED));
  } finally {
    popup.close();
  }
}
