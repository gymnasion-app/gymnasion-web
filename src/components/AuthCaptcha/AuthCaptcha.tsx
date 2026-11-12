import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadRecaptcha, recaptchaSiteKey } from "../../services/recaptcha";
import "./AuthCaptcha.css";

export type AuthCaptchaHandle = { reset: () => void };
type AuthCaptchaProps = { onChange: (token: string | null) => void };

// Google reCAPTCHA v2 "Não sou um robô" (US-01, US-02 C1/C5). O token é validado na API.
const AuthCaptcha = forwardRef<AuthCaptchaHandle, AuthCaptchaProps>(function AuthCaptcha({ onChange }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const [loadError, setLoadError] = useState(!recaptchaSiteKey);
  onChangeRef.current = onChange;

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current !== null) window.grecaptcha?.reset(widgetId.current);
      onChangeRef.current(null);
    },
  }), []);

  useEffect(() => {
    if (!recaptchaSiteKey) return;
    let active = true;
    loadRecaptcha().then(grecaptcha => {
      if (!active || !containerRef.current || widgetId.current !== null) return;
      widgetId.current = grecaptcha.render(containerRef.current, {
        sitekey: recaptchaSiteKey,
        callback: (token: string) => onChangeRef.current(token),
        "expired-callback": () => onChangeRef.current(null),
        "error-callback": () => onChangeRef.current(null),
      });
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, []);

  if (loadError) return <div className="auth-captcha auth-captcha--error" role="alert">
    Não foi possível carregar a verificação CAPTCHA. Recarregue a página e tente novamente.
  </div>;
  return <div className="auth-captcha"><div ref={containerRef} /></div>;
});

export default AuthCaptcha;
