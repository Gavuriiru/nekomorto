import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiBase } from "@/lib/api-base";

const Login = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const error = params.get("error");
  const next = params.get("next");
  const apiBase = getApiBase();

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
    <div className="min-h-screen bg-gradient-to-b from-background via-[hsl(var(--primary)/0.12)] to-background text-foreground">
      <Header />
      <main className="pt-28">
        <section className="mx-auto w-full max-w-3xl px-6 pb-20 md:px-10">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-1 shadow-[0_40px_120px_-70px_rgba(0,0,0,0.9)]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-[-60%] animate-spin-slow bg-[conic-gradient(from_0deg,transparent_0deg,hsl(var(--primary)/0.22)_120deg,transparent_210deg,hsl(var(--accent)/0.22)_300deg,transparent_360deg)] opacity-35 blur-2xl" />
              <div className="absolute inset-6 rounded-[18px] bg-black/15" />
            </div>
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -left-16 top-8 h-56 w-56 rounded-full bg-primary/25 blur-[120px]" />
              <div className="absolute right-6 top-24 h-64 w-64 rounded-full bg-accent/20 blur-[140px]" />
            </div>
            <div className="relative rounded-[22px] border border-white/10 bg-black/25 p-8 backdrop-blur md:p-10">
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-white/10 text-muted-foreground">Acesso restrito</Badge>
                  <Badge className="bg-primary/20 text-primary">Discord</Badge>
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
                  <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {errorMessage}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4">
                  <Button
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
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
      <Footer />
    </div>
  );
};

export default Login;
