import PublicPageHero from "@/components/PublicPageHero";
import {
  publicInteractiveStackedSurfaceClassName,
  publicPageLayoutTokens,
  publicStackedSurfaceClassName,
} from "@/components/public-page-tokens";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { usePageMeta } from "@/hooks/use-page-meta";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";
import { HelpCircle, Info, Rocket, Shield, Sparkles, Users } from "lucide-react";
import { useMemo } from "react";
import {
  buildInstitutionalOgImageAlt,
  buildInstitutionalOgRevision,
  buildVersionedInstitutionalOgImagePath,
  resolveInstitutionalOgSupportText,
} from "../../shared/institutional-og-seo.js";
import { normalizeFaqPublicPage } from "../../shared/public-page-content.js";

const iconMap: Record<string, typeof HelpCircle> = {
  HelpCircle,
  Info,
  Users,
  Rocket,
  Shield,
  Sparkles,
};

const resolveFaqIcon = (iconName: string | undefined, fallback: typeof HelpCircle) =>
  (iconName ? iconMap[iconName] : undefined) || fallback;

const FAQ = () => {
  const bootstrap = readWindowPublicBootstrap();
  const faq = useMemo(() => normalizeFaqPublicPage(bootstrap?.pages.faq), [bootstrap]);
  const pageMediaVariants = bootstrap?.mediaVariants || {};
  usePageMeta({
    title: "FAQ",
    description: resolveInstitutionalOgSupportText({
      pageKey: "faq",
      pages: bootstrap?.pages,
      settings: bootstrap?.settings,
    }),
    image: buildVersionedInstitutionalOgImagePath({
      pageKey: "faq",
      revision: buildInstitutionalOgRevision({
        pageKey: "faq",
        pages: bootstrap?.pages,
        settings: bootstrap?.settings,
      }),
    }),
    imageAlt: buildInstitutionalOgImageAlt("faq"),
    mediaVariants: pageMediaVariants,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <PublicPageHero title={faq.heroTitle} subtitle={faq.heroSubtitle} />

        {faq.introCards.length > 0 ? (
          <section
            className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pb-16 pt-10 reveal`}
            data-reveal
          >
            <div className="grid gap-6 md:grid-cols-2">
              {faq.introCards.map((card) => {
                const Icon = resolveFaqIcon(card.icon, HelpCircle);
                return (
                  <Card
                    key={card.title}
                    className={`${publicInteractiveStackedSurfaceClassName} group bg-card/80 hover:border-primary/60 hover:bg-card/90`}
                  >
                    <CardContent className="space-y-4 p-6">
                      <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground transition-colors duration-300 group-hover:text-primary">
                        <Icon className="h-4 w-4 text-primary/80 transition-colors duration-300 group-hover:text-primary" />
                        {card.title}
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                        {card.text}
                      </p>
                      <Separator className="bg-border/60" />
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                        {card.note}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : null}

        {faq.groups.length > 0 ? (
          <section
            className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pb-24 pt-2 reveal`}
            data-reveal
          >
            <div className="grid gap-6">
              {faq.groups.map((group) => {
                const Icon = resolveFaqIcon(group.icon, HelpCircle);
                return (
                  <Card
                    key={group.title}
                    className={`${publicStackedSurfaceClassName} border-border/60 bg-card/80`}
                  >
                    <CardContent className="space-y-5 p-6">
                      <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                        <Icon className="h-4 w-4 text-primary/80" />
                        {group.title}
                      </div>
                      <div className="grid gap-4">
                        {group.items.map((item) => (
                          <div
                            key={item.question}
                            className="group/item rounded-2xl border border-border/60 bg-background/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-background/70"
                          >
                            <p className="text-sm font-semibold text-foreground transition-colors duration-300 group-hover/item:text-primary">
                              {item.question}
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground transition-colors duration-300 group-hover/item:text-foreground/80">
                              {item.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
};

export default FAQ;
