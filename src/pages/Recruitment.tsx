import { useMemo } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSiteSettings } from "@/hooks/use-site-settings";
import PublicPageHero from "@/components/PublicPageHero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { publicPageLayoutTokens } from "@/components/public-page-tokens";
import {
  Languages,
  ScanText,
  PenTool,
  Sparkles,
  Video,
  Paintbrush,
  Layers,
  Timer,
  ShieldCheck,
} from "lucide-react";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";
import {
  buildInstitutionalOgImageAlt,
  buildInstitutionalOgRevision,
  buildVersionedInstitutionalOgImagePath,
} from "../../shared/institutional-og-seo.js";

const iconMap = {
  Languages,
  ScanText,
  PenTool,
  Sparkles,
  Video,
  Paintbrush,
  Layers,
  Timer,
  ShieldCheck,
};

type RecruitmentRole = {
  title: string;
  description: string;
  icon?: keyof typeof iconMap;
};

type RecruitmentPageRole = Omit<RecruitmentRole, "icon"> & {
  icon?: string;
};

const isRecruitmentIconKey = (value: string | undefined): value is keyof typeof iconMap =>
  typeof value === "string" && value in iconMap;

const defaultRecruitment = {
  shareImage: "",
  shareImageAlt: "",
  heroBadge: "Recrutamento",
  heroTitle: "Venha fazer parte da equipe",
  heroSubtitle:
    "Buscamos pessoas comprometidas e curiosas. Se você gosta de traduções, edição ou produção visual, há um lugar para você aqui.",
  roles: [
    {
      title: "Tradutor",
      description: "Adapta o texto original para português mantendo tom, contexto e naturalidade.",
      icon: "Languages",
    },
    {
      title: "Revisor",
      description: "Garante coerência, gramática e fluidez do texto antes da etapa visual.",
      icon: "ScanText",
    },
    {
      title: "Typesetter",
      description: "Integra o texto à arte, ajustando tipografia, efeitos e legibilidade.",
      icon: "PenTool",
    },
    {
      title: "Quality Check",
      description: "Revisa o resultado final buscando erros visuais, timing e consistência.",
      icon: "ShieldCheck",
    },
    {
      title: "Encoder",
      description: "Responsável por exportação e ajustes finais de qualidade do vídeo/arquivo.",
      icon: "Video",
    },
    {
      title: "Cleaner",
      description: "Remove textos da arte original preparando o material para o typesetting.",
      icon: "Paintbrush",
    },
    {
      title: "Redrawer",
      description: "Reconstrói partes da arte removidas pelo cleaning para preservar o visual.",
      icon: "Layers",
    },
    {
      title: "Timer",
      description: "Sincroniza falas com o tempo, garantindo leitura confortável e precisa.",
      icon: "Timer",
    },
    {
      title: "Karaoke/FX",
      description: "Cria efeitos especiais e animações para openings/endings quando necessário.",
      icon: "Sparkles",
    },
  ] as RecruitmentRole[],
  ctaTitle: "Pronto para participar?",
  ctaSubtitle: "Entre no nosso servidor e fale com a equipe.",
  ctaButtonLabel: "Entrar no Discord",
};

const Recruitment = () => {
  const { settings } = useSiteSettings();
  const discordUrl = settings.community.discordUrl || "#";
  const bootstrap = readWindowPublicBootstrap();
  const recruitment = useMemo(() => {
    const incoming = bootstrap?.pages.recruitment;
    if (!incoming) {
      return defaultRecruitment;
    }
    const roles = (incoming.roles || defaultRecruitment.roles).map((role: RecruitmentPageRole) => ({
      title: role.title,
      description: role.description,
      icon: isRecruitmentIconKey(role.icon) ? role.icon : "Sparkles",
    }));
    return {
      ...defaultRecruitment,
      ...incoming,
      roles,
    };
  }, [bootstrap]);
  const pageMediaVariants = bootstrap?.mediaVariants || {};
  usePageMeta({
    title: "Recrutamento",
    image: buildVersionedInstitutionalOgImagePath({
      pageKey: "recruitment",
      revision: buildInstitutionalOgRevision({
        pageKey: "recruitment",
        pages: bootstrap?.pages,
        settings: bootstrap?.settings,
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

        <section
          className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pt-10 reveal`}
          data-reveal
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recruitment.roles.map((role, index) => {
              const Icon = isRecruitmentIconKey(role.icon) ? iconMap[role.icon] : Sparkles;
              return (
                <Card
                  key={role.title}
                  className="group bg-card/70 animate-fade-in opacity-0 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-card/90 hover:shadow-lg"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/80 text-primary transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/15">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h2 className="text-base font-semibold text-foreground transition-colors duration-300 group-hover:text-primary">
                        {role.title}
                      </h2>
                    </div>
                    <p className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                      {role.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section
          className={`${publicPageLayoutTokens.sectionBase} mt-12 max-w-6xl reveal`}
          data-reveal
        >
          <Card
            className="group bg-card/70 animate-fade-in opacity-0 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-card/90 hover:shadow-lg"
            style={{ animationDelay: "0.4s" }}
          >
            <CardContent className="flex flex-col items-stretch justify-between gap-4 p-6 md:flex-row md:items-center">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground transition-colors duration-300 group-hover:text-primary">
                  {recruitment.ctaTitle}
                </h2>
                <p className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                  {recruitment.ctaSubtitle}
                </p>
              </div>
              <Button
                asChild
                className="w-full bg-primary text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md md:w-auto"
              >
                <a href={discordUrl} target="_blank" rel="noreferrer">
                  {recruitment.ctaButtonLabel}
                </a>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Recruitment;
