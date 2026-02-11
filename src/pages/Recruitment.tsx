import { useEffect, useState } from "react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";

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

const defaultRecruitment = {
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
  usePageMeta({ title: "Recrutamento" });
  const { settings } = useSiteSettings();
  const discordUrl = settings.community.discordUrl || "#";
  const apiBase = getApiBase();
  const [recruitment, setRecruitment] = useState(defaultRecruitment);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/pages");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (!isActive || !data.pages?.recruitment) {
          return;
        }
        const incoming = data.pages.recruitment;
        const roles = (incoming.roles || defaultRecruitment.roles).map((role: RecruitmentRole) => ({
          icon: role.icon || "Sparkles",
          ...role,
        }));
        setRecruitment({
          ...defaultRecruitment,
          ...incoming,
          roles,
        });
      } catch {
        // ignore
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [apiBase]);

  return (
    <div className="min-h-screen bg-background">
      <main className="px-6 pb-20 pt-14 md:px-12">
        <section className="mx-auto w-full max-w-6xl pb-10 pt-6">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground animate-fade-in">
              {recruitment.heroBadge}
            </p>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl animate-slide-up">
              {recruitment.heroTitle}
            </h1>
            <p
              className="max-w-2xl text-sm text-muted-foreground animate-slide-up opacity-0"
              style={{ animationDelay: "0.2s" }}
            >
              {recruitment.heroSubtitle}
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recruitment.roles.map((role, index) => {
              const Icon = iconMap[role.icon || "Sparkles"] || Sparkles;
              return (
                <Card
                  key={role.title}
                  className="group bg-card/70 animate-fade-in opacity-0 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-primary transition-all duration-300 group-hover:scale-105 group-hover:bg-primary/15">
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

        <section className="mx-auto mt-12 w-full max-w-6xl">
          <Card
            className="group bg-card/70 animate-fade-in opacity-0 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg"
            style={{ animationDelay: "0.4s" }}
          >
            <CardContent className="flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
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
                className="bg-primary text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-md"
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




