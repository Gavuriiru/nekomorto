import PublicPageHero from "@/components/PublicPageHero";
import {
  publicInteractiveStackedSurfaceClassName,
  publicPageLayoutTokens,
} from "@/components/public-page-tokens";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useResolvedPublicBootstrap } from "@/hooks/public-bootstrap-provider";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { resolveRecruitmentIcon } from "@/lib/institutional-page-icons";
import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import {
  buildInstitutionalOgImageAlt,
  buildInstitutionalOgRevision,
  buildVersionedInstitutionalOgImagePath,
  resolveInstitutionalOgSupportText,
} from "../../shared/institutional-og-seo.js";
import { normalizeRecruitmentPublicPage } from "../../shared/public-page-content.js";

const Recruitment = () => {
  const { settings } = useSiteSettings();
  const discordUrl = settings.community.discordUrl || "#";
  const windowBootstrap = useResolvedPublicBootstrap();
  const { data: bootstrapData } = usePublicBootstrap();
  const bootstrap = windowBootstrap || bootstrapData;
  const hasFullBootstrap = Boolean(bootstrap && bootstrap.payloadMode !== "critical-home");
  const recruitment = useMemo(
    () => normalizeRecruitmentPublicPage(hasFullBootstrap ? bootstrap?.pages.recruitment : null),
    [bootstrap, hasFullBootstrap],
  );
  const pageBootstrap = hasFullBootstrap ? bootstrap : null;
  const pageMediaVariants = pageBootstrap?.mediaVariants || {};
  usePageMeta({
    title: "Recrutamento",
    description: resolveInstitutionalOgSupportText({
      pageKey: "recruitment",
      pages: pageBootstrap?.pages,
      settings: pageBootstrap?.settings,
    }),
    image: buildVersionedInstitutionalOgImagePath({
      pageKey: "recruitment",
      revision: buildInstitutionalOgRevision({
        pageKey: "recruitment",
        pages: pageBootstrap?.pages,
        settings: pageBootstrap?.settings,
      }),
    }),
    imageAlt: buildInstitutionalOgImageAlt("recruitment"),
    mediaVariants: pageMediaVariants,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="pb-20">
        <PublicPageHero
          badge={recruitment.heroBadge}
          title={recruitment.heroTitle}
          subtitle={recruitment.heroSubtitle}
        />

        {recruitment.roles.length > 0 ? (
          <section
            className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pt-10 reveal`}
            data-reveal
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recruitment.roles.map((role, index) => {
                const Icon = resolveRecruitmentIcon(role.icon, Sparkles);
                return (
                  <Card
                    key={role.title}
                    className={`${publicInteractiveStackedSurfaceClassName} group bg-card/70 animate-fade-in opacity-0 hover:border-primary/60 hover:bg-card/90`}
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-center gap-3">
                        <span className="interactive-control-transition flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/80 text-primary group-hover:scale-105 group-hover:bg-primary/15">
                          <Icon className="h-5 w-5" />
                        </span>
                        <h2 className="interactive-content-transition text-base font-semibold text-foreground group-hover:text-primary">
                          {role.title}
                        </h2>
                      </div>
                      <p className="whitespace-pre-wrap interactive-content-transition text-sm text-muted-foreground group-hover:text-foreground/80">
                        {role.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ) : null}

        {recruitment.ctaTitle || recruitment.ctaSubtitle || recruitment.ctaButtonLabel ? (
          <section
            className={`${publicPageLayoutTokens.sectionBase} mt-12 max-w-6xl reveal`}
            data-reveal
          >
            <Card
              className="bg-card/70 animate-fade-in opacity-0"
              style={{ animationDelay: "0.4s" }}
            >
              <CardContent className="flex flex-col items-stretch justify-between gap-4 p-6 md:flex-row md:items-center">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">{recruitment.ctaTitle}</h2>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {recruitment.ctaSubtitle}
                  </p>
                </div>
                {recruitment.ctaButtonLabel ? (
                  <Button asChild className="w-full md:w-auto">
                    <a href={discordUrl} target="_blank" rel="noreferrer">
                      {recruitment.ctaButtonLabel}
                    </a>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </section>
        ) : null}
      </main>
    </div>
  );
};

export default Recruitment;
