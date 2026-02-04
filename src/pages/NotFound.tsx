import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/use-page-meta";

const NotFound = () => {
  const location = useLocation();
  const requestedPath = `${location.pathname}${location.search}${location.hash}`;

  usePageMeta({ title: "PÃ¡gina nÃ£o encontrada", noIndex: true });

  return (
    <div className="min-h-screen bg-background text-foreground">

      <main>
        <section className="relative min-h-screen overflow-hidden border-b border-border/60">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-background to-background" />
          <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-accent/20 blur-[120px]" />

          <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-6 pb-16 pt-24 md:grid-cols-[1.2fr_0.8fr] md:px-10 md:pt-28">
            <div className="space-y-5">
              <Badge variant="secondary" className="text-xs uppercase tracking-widest">
                Erro 404
              </Badge>
              <h1 className="text-3xl font-semibold text-foreground md:text-5xl">
                PÃ¡gina nÃ£o encontrada
              </h1>
              <p className="text-sm text-muted-foreground md:text-base">
                NÃ£o conseguimos localizar o endereÃ§o solicitado. Verifique se o link estÃ¡ correto ou
                volte para a pÃ¡gina inicial.
              </p>
              <div className="w-fit rounded-full border border-border/60 bg-background/70 px-4 py-2 text-xs text-muted-foreground">
                {requestedPath || "/"}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/">Voltar para a pÃ¡gina inicial</Link>
                </Button>
                <Button variant="outline" onClick={() => window.history.back()}>
                  Voltar para a pÃ¡gina anterior
                </Button>
              </div>
            </div>

            <Card className="border-border/60 bg-card/80 shadow-lg">
              <CardContent className="space-y-4 p-6 md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  SugestÃµes rÃ¡pidas
                </p>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>Confira os projetos e lanÃ§amentos mais recentes.</p>
                  <p>ConheÃ§a a equipe e o nosso manifesto.</p>
                  <p>Acompanhe novidades e atualizaÃ§Ãµes no site.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="secondary">
                    <Link to="/projetos">Explorar projetos</Link>
                  </Button>
                  <Button asChild variant="ghost">
                    <Link to="/sobre">Sobre a equipe</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

export default NotFound;


