import { useEffect, useMemo } from "react";
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
  const apiBase = getApiBase();

  useEffect(() => {
    let isActive = true;
    const checkSession = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/me", { auth: true });
        if (!response.ok) {
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

  return (
    <div className="login-shell text-foreground">
      <div aria-hidden className="login-backdrop" />
      <main className="relative pt-28">
        <section className="mx-auto w-full max-w-3xl px-6 pb-20 md:px-10">
          <div className="login-card motion-item">
            <div className="login-card-content motion-item">
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
                  <h1 className="text-3xl font-semibold lg:text-4xl">
                    Autorização Necessária
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Faça o seu login para acessar a plataforma.
                  </p>
                </div>

                {errorMessage && (
                  <div role="alert" aria-live="polite" className="login-alert">
                    {errorMessage}
                  </div>
                )}

                <div className="login-actions">
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




