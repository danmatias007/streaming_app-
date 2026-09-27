import { useState, type FormEvent } from "react";
import { requestRegistration } from "./api";
import { useAuth } from "./AuthContext";
import { LanguageSelector, useI18n } from "./I18nContext";

type Mode = "login" | "register";

export function LoginPage() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("demo@cinevault.local");
  const [password, setPassword] = useState("cinevault123");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [developmentLink, setDevelopmentLink] = useState<string>();

  function changeMode(next: Mode) { if (next === mode) return; setMode(next); setError(""); setSent(false); setDevelopmentLink(undefined); setEmail(next === "login" ? "demo@cinevault.local" : ""); setPassword(next === "login" ? "cinevault123" : ""); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSubmitting(true);
    try { if (mode === "login") await signIn({ email, password }); else { const result = await requestRegistration(email); setSent(true); setDevelopmentLink(result.developmentLink); } }
    catch { setError(mode === "login" ? t("login.invalid") : t("login.registerError")); }
    finally { setSubmitting(false); }
  }

  return <main className="login-page"><div className="login-page__image"/><div className="login-page__shade"/><a className="brand login-brand" href="/"><span>C</span>INEVAULT</a><div className="login-language"><LanguageSelector/></div>
    <section className="login-card">
      <div className={`auth-tabs auth-tabs--${mode}`} role="tablist" aria-label="Acesso à conta" onKeyDown={event=>{if(event.key==="ArrowLeft")changeMode("login");if(event.key==="ArrowRight")changeMode("register");}}><button type="button" role="tab" id="auth-login-tab" aria-controls="auth-panel" aria-selected={mode==="login"} className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>{t("login.in")}</button><button type="button" role="tab" id="auth-register-tab" aria-controls="auth-panel" aria-selected={mode==="register"} className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>{t("login.register")}</button></div>
      {sent ? <div className="mail-sent"><i>✓</i><h1>{t("login.checkEmail")}</h1><p>{t("login.sent", { email })}</p><small>{t("login.spam")}</small>{developmentLink && <a className="development-link" href={developmentLink}>{t("login.devLink")}</a>}<button className="text-button" onClick={() => setSent(false)}>{t("login.other")}</button></div>
      : <form key={mode} id="auth-panel" className={`auth-form auth-form--${mode}`} role="tabpanel" aria-labelledby={`auth-${mode}-tab`} onSubmit={submit}><p className="eyebrow"><span>V</span> {t(mode === "login" ? "login.welcome" : "login.next")}</p><h1>{t(mode === "login" ? "login.in" : "login.register")}</h1><p>{t(mode === "login" ? "login.access" : "login.instructions")}</p>
        <label>{t("login.email")}<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required /></label>
        {mode === "login" && <label>{t("login.password")}<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" minLength={8} required /></label>}
        {error && <div className="login-error" role="alert">{error}</div>}<button className="button login-submit" disabled={submitting}>{submitting ? t("login.wait") : t(mode === "login" ? "login.in" : "login.send")}</button>
        {mode === "login" && <small>{t("login.demo")}</small>}
      </form>}
    </section></main>;
}
