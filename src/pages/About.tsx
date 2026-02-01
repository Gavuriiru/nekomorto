import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Sparkles, Users, Wand2, Flame, Zap } from "lucide-react";

const values = [
  {
    title: "Paixão pelo que fazemos",
    description:
      "Cada projeto é tratado com carinho e respeito à obra original, sempre buscando a melhor experiência possível.",
    icon: Heart,
  },
  {
    title: "Qualidade em cada etapa",
    description:
      "Do timing ao encode, mantemos um fluxo cuidadoso para entregar consistência e leitura confortável.",
    icon: Sparkles,
  },
  {
    title: "Comunidade em primeiro lugar",
    description:
      "A equipe cresce junto da comunidade. Feedbacks ajudam a lapidar escolhas e manter a identidade do grupo.",
    icon: Users,
  },
  {
    title: "Criatividade e estilo",
    description:
      "Tipografia, efeitos e ritmo contam história. O typesetting é parte essencial da narrativa visual.",
    icon: Wand2,
  },
];

const highlights = [
  {
    label: "Somos movidos por histórias",
    text:
      "Trabalhamos em equipe para traduzir, adaptar e manter a identidade de cada obra com cuidado editorial.",
  },
  {
    label: "Processo claro e constante",
    text:
      "Fluxo colaborativo, revisão dupla e ajustes finos fazem parte da nossa rotina.",
  },
  {
    label: "Respeito à obra",
    text:
      "Apoiamos o consumo legal e preservamos a experiência original, com o toque da comunidade.",
  },
];

const About = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="pt-20">
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />
          <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-accent/20 blur-[120px]" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-6 pb-16 pt-12 md:grid-cols-[1.2fr_0.8fr] md:px-10">
            <div className="space-y-5">
              <Badge variant="secondary" className="text-xs uppercase tracking-widest">
                Sobre
              </Badge>
              <h1 className="text-3xl font-semibold text-foreground md:text-5xl">
                Uma fansub com identidade própria
              </h1>
              <p className="text-sm text-muted-foreground md:text-base">
                A Nekomata nasceu para entregar traduções naturais, visual marcante e um fluxo de
                trabalho que respeita a obra e o público. Cada etapa é feita com cuidado editorial
                e atenção aos detalhes.
              </p>
              <div className="flex flex-wrap gap-3">
                <Badge className="bg-primary text-primary-foreground">Legendado com carinho</Badge>
                <Badge variant="secondary" className="text-xs uppercase tracking-widest">
                  Sem propaganda
                </Badge>
                <Badge variant="secondary" className="text-xs uppercase tracking-widest">
                  Gratuito
                </Badge>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10 md:px-10">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              {highlights.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border/60 bg-background/60 p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
            <Card className="border-border/60 bg-card/80 shadow-lg">
              <CardContent className="space-y-5 p-6 md:p-8">
                <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  <Flame className="h-4 w-4 text-primary" />
                  Manifesto
                </div>
                <p className="text-sm text-muted-foreground md:text-base">
                  Fazemos tudo por paixão, sem fins lucrativos, priorizando qualidade e uma
                  entrega que dê orgulho à comunidade. Cada projeto é um convite para sentir a
                  obra como ela merece.
                </p>
                <p className="text-sm text-muted-foreground md:text-base">
                  Nossas escolhas são orientadas por clareza, estilo e consistência. O resultado
                  precisa ser bonito, legível e fiel ao tom da história.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-2 md:px-10">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-border/60 bg-card/80 shadow-lg">
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  <Zap className="h-4 w-4 text-primary" />
                  Pipeline
                </div>
                <p className="text-sm text-muted-foreground">
                  Tradução → Revisão → Timing → Typesetting → Qualidade → Encode.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-lg">
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  Comunidade
                </div>
                <p className="text-sm text-muted-foreground">
                  Feedbacks ajudam a evoluir o padrão e manter a identidade da equipe.
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-card/80 shadow-lg">
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Estilo
                </div>
                <p className="text-sm text-muted-foreground">
                  Tipografia, ritmo e efeitos visuais criam uma experiência memorável.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-4 md:px-10">
          <div className="grid gap-6 md:grid-cols-2">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <Card
                  key={value.title}
                  className="border-border/60 bg-card/80 shadow-lg transition hover:border-primary/40"
                >
                  <CardContent className="space-y-3 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                      {value.title}
                    </div>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
