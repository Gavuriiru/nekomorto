import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { usePageMeta } from "@/hooks/use-page-meta";

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
  const [showMfaForm, setShowMfaForm] = useState(mfa === "required");
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
                setShowMfaForm(true);
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
    if (mfa === "required") {
      setShowMfaForm(true);
    }
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
          setMfaError("Sessão de login expirou. Entre com Discord novamente.");
          return;
        }
        if (errorCode === "mfa_required") {
          setMfaError("Sua sessão ainda exige MFA. Tente novamente.");
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

  return (
    <div className="login-shell text-foreground">
      <div aria-hidden className="login-backdrop" />
      <main className="relative pt-28">
        <section className="mx-auto w-full max-w-3xl px-6 pb-20 md:px-10">
          <div className="login-card animate-fade-in">
            <div className="login-card-content animate-slide-up">
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-border/65 bg-card/75 text-muted-foreground">
                    Acesso restrito
                  </Badge>
                  <Badge className="border border-primary/30 bg-primary/18 text-primary">
                    Discord
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

                {showMfaForm && (
                  <div className="space-y-3 rounded-2xl border border-border/65 bg-card/70 p-4">
                    <p className="text-sm text-muted-foreground">
                      Digite seu código TOTP ou recovery code para concluir o login.
                    </p>
                    <input
                      value={mfaCode}
                      onChange={(event) => setMfaCode(event.target.value)}
                      placeholder="000000 ou ABCDE-12345"
                      className="w-full rounded-xl border border-border/65 bg-background/70 px-3 py-2 text-sm text-foreground outline-hidden focus:border-primary/50"
                    />
                    {mfaError ? <p className="text-xs text-red-300">{mfaError}</p> : null}
                    <Button
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={isVerifyingMfa || !mfaCode.trim()}
                      onClick={handleMfaVerify}
                    >
                      {isVerifyingMfa ? "Validando..." : "Confirmar código"}
                    </Button>
                  </div>
                )}

                <div className={`login-actions ${showMfaForm ? "justify-end" : ""}`}>
                  {!showMfaForm ? (
                    <Button
                      className="w-full bg-primary text-primary-foreground shadow-[0_16px_34px_-24px_hsl(var(--primary)/0.85)] hover:bg-primary/90 sm:w-auto"
                      onClick={() => {
                        const target = next
                          ? `${apiBase}/auth/discord?next=${encodeURIComponent(next)}`
                          : `${apiBase}/auth/discord`;
                        window.location.href = target;
                      }}
                    >
                      Entrar com Discord
                    </Button>
                  ) : null}
                  <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
                    Voltar
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Login;
