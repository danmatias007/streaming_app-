import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser, LoginRequest } from "@netflix/shared-types";
import * as api from "./api";
import { useI18n } from "./I18nContext";

interface AuthState { accessToken: string | null; user: AuthUser | null; loading: boolean; signIn(input: LoginRequest): Promise<void>; signOut(): Promise<void>; }
const Context = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [transition, setTransition] = useState<"idle" | "closing" | "opening">("idle");

  const accept = useCallback((session: Awaited<ReturnType<typeof api.login>>) => { setAccessToken(session.accessToken); setUser(session.user); }, []);
  useEffect(() => { api.refreshSession().then(accept).catch(() => {}).finally(() => setLoading(false)); }, [accept]);
  const signIn = useCallback(async (input: LoginRequest) => {
    const session = await api.login(input);
    setTransition("closing");
    await delay(950);
    window.history.replaceState({}, "", "/");
    accept(session);
    setTransition("opening");
    await delay(1000);
    setTransition("idle");
  }, [accept]);
  const signOut = useCallback(async () => { try { await api.logout(); } finally { setAccessToken(null); setUser(null); } }, []);
  const value = useMemo(() => ({ accessToken, user, loading, signIn, signOut }), [accessToken, user, loading, signIn, signOut]);
  return <Context.Provider value={value}>{children}<div className={`cinema-transition cinema-transition--${transition}`} aria-hidden="true"><div className="cinema-curtain cinema-curtain--left"/><div className="cinema-curtain cinema-curtain--right"/><div className="cinema-splash"><span>C</span><strong>CINEVAULT</strong><small>{t("splash.welcome")}</small></div></div></Context.Provider>;
}

export function useAuth() { const value = useContext(Context); if (!value) throw new Error("useAuth must be used inside AuthProvider"); return value; }
function delay(milliseconds: number) { return new Promise<void>(resolve => window.setTimeout(resolve, milliseconds)); }
