import PublicLink from "@/components/PublicLink";
import { publicPageLayoutTokens } from "@/components/public-page-tokens";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/use-page-meta";
import { usePublicDocumentLocation } from "@/lib/public-document-navigation";

const NotFound = () => {
  const location = usePublicDocumentLocation();
  const requestedPath = `${location.pathname}${location.search}${location.hash}`;

  usePageMeta({ title: "P\u00e1gina n\u00e3o encontrada", noIndex: true });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <section className="relative min-h-screen overflow-hidden border-b border-border/60">
          <div className="absolute inset-0 bg-linear-to-b from-primary/15 via-background to-background" />
          <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-accent/20 blur-[120px]" />

          <div
            className={`${publicPageLayoutTokens.sectionBase} relative grid min-h-screen max-w-6xl items-center gap-8 pb-16 pt-24 md:grid-cols-[1.2fr_0.8fr] md:pt-28`}
          >
            <div className="space-y-5">
              <Badge variant="secondary" className="text-xs uppercase tracking-widest">
                Erro 404
              </Badge>
              <h1 className="text-3xl font-semibold text-foreground md:text-5xl">
                P\u00e1gina n\u00e3o encontrada
              </h1>
              <p className="text-sm text-muted-foreground md:text-base">
                N\u00e3o conseguimos localizar o endere\u00e7o solicitado. Verifique se o link est\u00e1
                correto ou volte para a p\u00e1gina inicial.
              </p>
              <div className="w-fit rounded-full border border-border/60 bg-background/70 px-4 py-2 text-xs text-muted-foreground">
                {requestedPath || "/"}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <PublicLink href="/">Voltar para a p\u00e1gina inicial</PublicLink>
                </Button>
                <Button variant="outline" onClick={() => window.history.back()}>
                  Voltar para a p\u00e1gina anterior
                </Button>
              </div>
            </div>

            <Card className="bg-card/80 shadow-lg">
              <CardContent className="space-y-4 p-6 md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Sugest\u00f5es r\u00e1pidas
                </p>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>Confira os projetos e lan\u00e7amentos mais recentes.</p>
                  <p>Conhe\u00e7a a equipe e o nosso manifesto.</p>
                  <p>Acompanhe novidades e atualiza\u00e7\u00f5es no site.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="secondary">
                    <PublicLink href="/projetos">Explorar projetos</PublicLink>
                  </Button>
                  <Button asChild variant="ghost">
                    <PublicLink href="/recrutamento">Ir para recrutamento</PublicLink>
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
