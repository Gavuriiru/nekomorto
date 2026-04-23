import PublicPageContainer from "@/components/PublicPageContainer";
import { Input } from "@/components/public-form-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import "@/styles/login.css";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type SessionCheckState = "default" | "mfa";

const Login = () => {
  usePageMeta({ title: "Login", noIndex: true });

  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const error = params.get("error");
  const next = params.get("next");
  const mfa = params.get("mfa");
  const [mfaCode, setMfaCode] = useState("");
  const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
  const [isCancellingMfa, setIsCancellingMfa] = useState(false);
  const [sessionState, setSessionState] = useState<SessionCheckState>(() =>
    mfa === "required" ? "mfa" : "default",
  );
  const [mfaError, setMfaError] = useState("");
  const apiBase = getApiBase();

  useEffect(() => {
    let isActive = true;
    const checkSession = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/me", { auth: true });
        if (!response.ok) {
          if (response.status === 401) {
            try {
              const body = await response.json();
              if (body?.error === "mfa_required" && isActive) {
                setSessionState("mfa");
              }
            } catch {
              // ignore parse errors
            }
          }
          return;
        }
        if (isActive) {
          navigate("/dashboard", { replace: true });
        }
      } catch {
        // ignore
      }
    };
    void checkSession();
    return () => {
      isActive = false;
    };
  }, [apiBase, navigate]);

  useEffect(() => {
    setSessionState(mfa === "required" ? "mfa" : "default");
  }, [mfa]);

  const errorMessage = (() => {
    switch (error) {
      case "unauthorized":
        return "Seu usuário ainda não tem acesso liberado.";
      case "state_mismatch":
        return "Falha de segurança na autenticação. Tente novamente.";
      case "token_exchange_failed":
        return "Não foi possível concluir a autenticação.";
      case "user_fetch_failed":
        return "Não foi possível buscar seus dados.";
      case "missing_code":
        return "Autenticação cancelada ou incompleta.";
      case "server_error":
        return "Erro interno no servidor de autenticação.";
      default:
        return null;
    }
  })();

  const handleMfaVerify = async () => {
    const normalizedCode = mfaCode.trim();
    if (!normalizedCode || isVerifyingMfa) {
      return;
    }
    setIsVerifyingMfa(true);
    setMfaError("");
    try {
      const response = await apiFetch(apiBase, "/api/auth/mfa/verify", {
        method: "POST",
        auth: true,
        json: { codeOrRecoveryCode: normalizedCode },
      });
      if (!response.ok) {
        let errorCode = "";
        try {
          const body = await response.json();
          errorCode = String(body?.error || "").trim();
        } catch {
          errorCode = "";
        }
        if (errorCode === "invalid_mfa_code") {
          setMfaError("Código inválido. Tente novamente.");
          return;
        }
        if (errorCode === "mfa_not_pending" || errorCode === "unauthorized") {
          setMfaError("Sessão de login expirou. Entre novamente.");
          return;
        }
        if (errorCode === "mfa_required") {
          setMfaError("Sua sessão ainda exige V2F. Tente novamente.");
          return;
        }
        setMfaError("Não foi possível validar o código de segurança.");
        return;
      }
      const body = await response.json();
      const redirect =
        typeof body?.redirect === "string" && body.redirect ? body.redirect : "/dashboard";
      window.location.href = redirect;
    } catch {
      setMfaError("Não foi possível validar o código de segurança.");
    } finally {
      setIsVerifyingMfa(false);
    }
  };

  const handleCancelMfaLogin = async () => {
    if (isCancellingMfa) {
      return;
    }
    setIsCancellingMfa(true);
    try {
      await apiFetch(apiBase, "/api/logout", {
        method: "POST",
        auth: true,
      });
    } catch {
      // fail-open to avoid trapping the user in pending MFA state
    } finally {
      window.location.href = "/";
    }
  };

  const isOauthLoginVisible = sessionState === "default";
  const isMfaVisible = sessionState === "mfa";

  return (
    <div className="login-shell text-foreground">
      <div aria-hidden className="login-backdrop" />
      <PublicPageContainer maxWidth="3xl" mainClassName="relative pt-28" className="pb-20">
        <div className="login-card animate-fade-in">
          <div className="login-card-content animate-slide-up">
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-border/65 bg-card/75 text-muted-foreground">
                  Acesso restrito
                </Badge>
                <Badge className="border border-primary/30 bg-primary/18 text-primary">
                  Dashboard
                </Badge>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold lg:text-4xl">Autorização Necessária</h1>
                <p className="text-sm text-muted-foreground">
                  Faça o seu login para acessar a plataforma.
                </p>
              </div>

              {errorMessage && (
                <div role="alert" aria-live="polite" className="login-alert">
                  {errorMessage}
                </div>
              )}

              {isOauthLoginVisible ? (
                <div className="space-y-3 rounded-2xl border border-border/65 bg-card/70 p-4">
                  <p className="text-sm text-muted-foreground">
                    Entre com um provedor OAuth liberado para acessar a plataforma.
                  </p>
                </div>
              ) : null}

              {isMfaVisible ? (
                <div className="space-y-3 rounded-2xl border border-border/65 bg-card/70 p-4">
                  <p className="text-sm text-muted-foreground">
                    Digite seu código da V2F ou código de recuperação para concluir o login.
                  </p>
                  <Input
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                    placeholder="000000 ou ABCDE-12345"
                    className="w-full rounded-xl border-border/65 bg-background/70 text-sm text-foreground"
                  />
                  {mfaError ? <p className="text-xs text-red-300">{mfaError}</p> : null}
                  <Button
                    className="w-full"
                    disabled={isVerifyingMfa || !mfaCode.trim()}
                    onClick={handleMfaVerify}
                  >
                    {isVerifyingMfa ? "Validando..." : "Confirmar código"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isCancellingMfa || isVerifyingMfa}
                    onClick={handleCancelMfaLogin}
                  >
                    {isCancellingMfa ? "Cancelando..." : "Cancelar login"}
                  </Button>
                </div>
              ) : null}

              <div className={`login-actions ${isMfaVisible ? "justify-end" : ""}`}>
                {isOauthLoginVisible ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        const target = next
                          ? `${apiBase}/auth/discord?next=${encodeURIComponent(next)}`
                          : `${apiBase}/auth/discord`;
                        window.location.href = target;
                      }}
                    >
                      Entrar com Discord
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        const target = next
                          ? `${apiBase}/auth/google?next=${encodeURIComponent(next)}`
                          : `${apiBase}/auth/google`;
                        window.location.href = target;
                      }}
                    >
                      Entrar com Google
                    </Button>
                    <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
                      Voltar
                    </a>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </PublicPageContainer>
    </div>
  );
};

export default Login;
