type RecaptchaRenderParams = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
};

export type Grecaptcha = {
  render: (container: HTMLElement, params: RecaptchaRenderParams) => number;
  reset: (widgetId?: number) => void;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
    __gymnasionRecaptchaLoaded?: () => void;
  }
}

export const recaptchaSiteKey: string = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

let loader: Promise<Grecaptcha> | null = null;

/** Carrega o script do Google reCAPTCHA v2 uma única vez (renderização explícita). */
export function loadRecaptcha(): Promise<Grecaptcha> {
  if (loader) return loader;
  loader = new Promise<Grecaptcha>((resolve, reject) => {
    if (window.grecaptcha?.render) return resolve(window.grecaptcha);
    window.__gymnasionRecaptchaLoaded = () => window.grecaptcha ? resolve(window.grecaptcha) : reject(new Error("reCAPTCHA indisponível"));
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=__gymnasionRecaptchaLoaded&render=explicit&hl=pt-BR";
    script.async = true;
    script.defer = true;
    script.onerror = () => { loader = null; script.remove(); reject(new Error("Falha ao carregar o reCAPTCHA")); };
    document.head.appendChild(script);
  });
  return loader;
}
