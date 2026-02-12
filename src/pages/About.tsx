import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Heart,
  Sparkles,
  Users,
  Wand2,
  Flame,
  Zap,
  HeartHandshake,
  QrCode,
  PiggyBank,
  Server,
  HelpCircle,
  Info,
  Rocket,
  Shield,
} from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { usePageMeta } from "@/hooks/use-page-meta";

const iconMap: Record<string, typeof Heart> = {
  Heart,
  Sparkles,
  Users,
  Wand2,
  Flame,
  Zap,
  HeartHandshake,
  QrCode,
  PiggyBank,
  Server,
  HelpCircle,
  Info,
  Rocket,
  Shield,
};

const defaultAbout = {
  heroBadge: "Sobre",
  heroTitle: "Uma fansub com identidade própria",
  heroSubtitle:
    "A Nekomata nasceu para entregar traduções naturais, visual marcante e um fluxo de trabalho que respeita a obra e o público. Cada etapa é feita com cuidado editorial e atenção aos detalhes.",
  heroBadges: ["Legendado com carinho", "Sem propaganda", "Gratuito"],
  highlights: [
    {
      label: "Somos movidos por histórias",
      icon: "Sparkles",
      text:
        "Trabalhamos em equipe para traduzir, adaptar e manter a identidade de cada obra com cuidado editorial.",
    },
    {
      label: "Processo claro e constante",
      icon: "Sparkles",
      text: "Fluxo colaborativo, revisão dupla e ajustes finos fazem parte da nossa rotina.",
    },
    {
      label: "Respeito à obra",
      icon: "Sparkles",
      text:
        "Apoiamos o consumo legal e preservamos a experiência original, com o toque da comunidade.",
    },
  ],
  manifestoTitle: "Manifesto",
  manifestoIcon: "Flame",
  manifestoParagraphs: [
    "Fazemos tudo por paixão, sem fins lucrativos, priorizando qualidade e uma entrega que dê orgulho à comunidade. Cada projeto é um convite para sentir a obra como ela merece.",
    "Nossas escolhas são orientadas por clareza, estilo e consistência. O resultado precisa ser bonito, legível e fiel ao tom da história.",
  ],
  pillars: [
    {
      title: "Pipeline",
      description: "Tradução → Revisão → Timing → Typesetting → Qualidade → Encode.",
      icon: "Zap",
    },
    {
      title: "Comunidade",
      description: "Feedbacks ajudam a evoluir o padrão e manter a identidade da equipe.",
      icon: "Users",
    },
    {
      title: "Estilo",
      description: "Tipografia, ritmo e efeitos visuais criam uma experiência memorável.",
      icon: "Sparkles",
    },
  ],
  values: [
    {
      title: "Paixão pelo que fazemos",
      description:
        "Cada projeto é tratado com carinho e respeito à obra original, sempre buscando a melhor experiência possível.",
      icon: "Heart",
    },
    {
      title: "Qualidade em cada etapa",
      description: "Do timing ao encode, mantemos um fluxo cuidadoso para entregar consistência e leitura confortável.",
      icon: "Sparkles",
    },
    {
      title: "Comunidade em primeiro lugar",
      description:
        "A equipe cresce junto da comunidade. Feedbacks ajudam a lapidar escolhas e manter a identidade do grupo.",
      icon: "Users",
    },
    {
      title: "Criatividade e estilo",
      description: "Tipografia, efeitos e ritmo contam história. O typesetting é parte essencial da narrativa visual.",
      icon: "Wand2",
    },
  ],
};

type HighlightItem = {
  label: string;
  text: string;
  icon?: string;
};

const About = () => {
  usePageMeta({ title: "Sobre" });

  const apiBase = getApiBase();
  const [about, setAbout] = useState(defaultAbout);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/pages");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive && data.pages?.about) {
          const incoming = data.pages.about;
          const highlights = (incoming.highlights || defaultAbout.highlights).map((item: HighlightItem) => ({
            icon: "Sparkles",
            ...item,
          }));
          setAbout({
            ...defaultAbout,
            ...incoming,
            manifestoIcon: incoming.manifestoIcon || defaultAbout.manifestoIcon,
            highlights,
          });
        }
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
    <div className="min-h-screen bg-background text-foreground">

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="absolute inset-0 bg-linear-to-b from-primary/20 via-background to-background" />
          <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-accent/20 blur-[120px]" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-6 pb-16 pt-24 md:grid-cols-[1.2fr_0.8fr] md:px-10 md:pt-28 reveal" data-reveal>
            <div className="space-y-5">
              <Badge variant="secondary" className="text-xs uppercase tracking-widest animate-fade-in">
                {about.heroBadge}
              </Badge>
              <h1 className="text-3xl font-semibold text-foreground md:text-5xl animate-slide-up">
                {about.heroTitle}
              </h1>
              <p
                className="text-sm text-muted-foreground md:text-base animate-slide-up opacity-0"
                style={{ animationDelay: "0.2s" }}
              >
                {about.heroSubtitle}
              </p>
              <div className="flex flex-wrap gap-3 animate-slide-up opacity-0" style={{ animationDelay: "0.4s" }}>
                {about.heroBadges.map((badge) => (
                  <Badge key={badge} variant="secondary" className="text-xs uppercase tracking-widest">
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10 md:px-10 reveal" data-reveal>
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              {about.highlights.map((item) => {
                const HighlightIcon = iconMap[item.icon] || Sparkles;
                return (
                  <div
                    key={item.label}
                    className="group rounded-2xl border border-border/60 bg-background/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-background/80 hover:shadow-lg"
                  >
                    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-primary/80 transition-colors duration-300 group-hover:text-primary">
                      <HighlightIcon className="h-4 w-4 text-primary/80 transition-colors duration-300 group-hover:text-primary" />
                      {item.label}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">{item.text}</p>
                  </div>
                );
              })}
            </div>
            <Card className="group border-border/60 bg-card/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg">
              <CardContent className="space-y-5 p-6 md:p-8">
                <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground transition-colors duration-300 group-hover:text-primary">
                  {(() => {
                    const ManifestoIcon = iconMap[about.manifestoIcon] || Flame;
                    return <ManifestoIcon className="h-4 w-4 text-primary/80 transition-colors duration-300 group-hover:text-primary" />;
                  })()}
                  {about.manifestoTitle}
                </div>
                {about.manifestoParagraphs.map((paragraph) => (
                  <p key={paragraph} className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80 md:text-base">
                    {paragraph}
                  </p>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-2 md:px-10 reveal" data-reveal>
          <div className="grid gap-6 md:grid-cols-3">
            {about.pillars.map((pillar) => {
              const Icon = iconMap[pillar.icon] || Sparkles;
              return (
                <Card
                  key={pillar.title}
                  className="group border-border/60 bg-card/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg"
                >
                  <CardContent className="space-y-3 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground transition-colors duration-300 group-hover:text-primary">
                      <Icon className="h-4 w-4 text-primary/80 transition-colors duration-300 group-hover:text-primary" />
                      {pillar.title}
                    </div>
                    <p className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">{pillar.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-4 md:px-10 reveal" data-reveal>
          <div className="grid gap-6 md:grid-cols-2">
            {about.values.map((value) => {
              const Icon = iconMap[value.icon] || Sparkles;
              return (
                <Card
                  key={value.title}
                  className="group border-border/60 bg-card/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/90 hover:shadow-lg"
                >
                  <CardContent className="space-y-3 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground transition-colors duration-300 group-hover:text-primary">
                      <Icon className="h-4 w-4 text-primary/80 transition-colors duration-300 group-hover:text-primary" />
                      {value.title}
                    </div>
                    <p className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">{value.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};

export default About;







