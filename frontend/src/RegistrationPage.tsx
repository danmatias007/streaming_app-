import { useEffect, useState, type FormEvent } from "react";
import { completeRegistration, verifyRegistration } from "./api";
import { LanguageSelector, useI18n } from "./I18nContext";

export function RegistrationPage({ token }: { token: string }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"checking" | "form" | "invalid" | "success">("checking");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => { verifyRegistration(token).then(result => { setEmail(result.email); setStatus("form"); }).catch(() => setStatus("invalid")); }, [token]);
  useEffect(() => { if (status !== "success") return; const interval = window.setInterval(() => setCountdown(value => Math.max(0, value - 1)), 1000); const redirect = window.setTimeout(() => { window.location.href = "/"; }, 5000); return () => { clearInterval(interval); clearTimeout(redirect); }; }, [status]);
  async function submit(event: FormEvent) { event.preventDefault(); setError(""); if (password !== confirm) { setError(t("register.mismatch")); return; } try { await completeRegistration({ token, name, password }); setStatus("success"); } catch { setError(t("register.error")); } }

  return <main className="login-page"><div className="login-page__image"/><div className="login-page__shade"/><a className="brand login-brand" href="/"><span>C</span>INEVAULT</a><div className="login-language"><LanguageSelector/></div><section className="login-card registration-card">
    {status === "checking" && <div className="registration-state"><div className="spinner"/><h1>{t("register.validating")}</h1></div>}
    {status === "invalid" && <div className="registration-state"><i className="error-mark">×</i><h1>{t("register.invalid")}</h1><p>{t("register.invalidText")}</p><a className="button login-submit" href="/">{t("register.newLink")}</a></div>}
    {status === "success" && <div className="registration-state"><i>✓</i><h1>{t("register.success")}</h1><p>{t("register.successText", { seconds: countdown })}</p><a className="text-button" href="/">{t("register.now")}</a></div>}
    {status === "form" && <form onSubmit={submit}><p className="eyebrow"><span>V</span> {t("register.finish")}</p><h1>{t("register.create")}</h1><p>{t("register.confirmed")}</p>
      <label>{t("login.email")}<input value={email} readOnly /></label><label>{t("register.name")}<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" minLength={2} maxLength={80} required /></label>
      <label>{t("login.password")}<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" minLength={10} required /><small>{t("register.requirements")}</small></label>
      <label>{t("register.confirm")}<input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required /></label>
      {error && <div className="login-error" role="alert">{error}</div>}<button className="button login-submit">{t("register.action")}</button></form>}
  </section></main>;
}
