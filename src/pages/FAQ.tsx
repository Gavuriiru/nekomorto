import { useMemo } from "react";
import PublicPageHero from "@/components/PublicPageHero";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, Info, Users, Rocket, Shield, Sparkles } from "lucide-react";
import { publicPageLayoutTokens } from "@/components/public-page-tokens";
import { usePageMeta } from "@/hooks/use-page-meta";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";
import {
  buildInstitutionalOgImageAlt,
  buildInstitutionalOgRevision,
  buildVersionedInstitutionalOgImagePath,
} from "../../shared/institutional-og-seo.js";

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

const defaultFaq = {
  shareImage: "",
  shareImageAlt: "",
  heroTitle: "Perguntas frequentes",
  heroSubtitle: "Respostas rápidas para dúvidas comuns sobre projetos, lançamentos e equipe.",
  introCards: [
    {
      title: "Antes de perguntar",
      icon: "HelpCircle",
      text: "Se sua dúvida não estiver aqui, fale com a equipe no Discord. Responderemos assim que possível.",
      note: "A equipe é pequena e trabalha no tempo livre. Obrigado pela compreensão!",
    },
    {
      title: "Dica rápida",
      icon: "Sparkles",
      text: "Para melhor experiência, use players como MPV ou VLC e mantenha o arquivo na mesma pasta da legenda.",
      note: "Sugestões de projetos são bem-vindas, mas dependem de disponibilidade.",
    },
  ],
  groups: [
    {
      title: "Detalhes gerais",
      icon: "Info",
      items: [
        {
          question: "O que é a Nekomata Fansub?",
          answer:
            "Somos um grupo de fãs que traduz e adapta conteúdos com foco em qualidade, estilo e respeito à obra.",
        },
        {
          question: "Vocês cobram pelos lançamentos?",
          answer: "Não. Nosso trabalho é feito por paixão e sem fins lucrativos.",
        },
        {
          question: "Qual a prioridade da equipe?",
          answer: "Entregar algo bonito, legível e consistente, mesmo que isso leve mais tempo.",
        },
      ],
    },
    {
      title: "Recrutamento",
      icon: "Users",
      items: [
        {
          question: "Posso entrar para a equipe?",
          answer: "Sim! Sempre buscamos pessoas comprometidas. Entre em contato pelo Discord.",
        },
        {
          question: "Preciso ter experiência?",
          answer: "Ajuda, mas não é obrigatório. O principal é vontade de aprender e consistência.",
        },
      ],
    },
    {
      title: "Projetos e lançamentos",
      icon: "Rocket",
      items: [
        {
          question: "Quando sai o próximo episódio?",
          answer: "Quando estiver pronto. Evitamos datas exatas para priorizar qualidade.",
        },
        {
          question: "Posso sugerir um projeto?",
          answer: "Pode sim! Levamos em conta a demanda e a capacidade da equipe.",
        },
      ],
    },
    {
      title: "Qualidade e suporte",
      icon: "Shield",
      items: [
        {
          question: "Como reporto um erro?",
          answer: "Fale com a equipe pelo Discord. Quanto mais detalhes, melhor.",
        },
        {
          question: "A legenda não aparece. O que faço?",
          answer: "Verifique o player e o arquivo. Recomendamos players como MPV e VLC.",
        },
      ],
    },
  ],
};

const FAQ = () => {
  const bootstrap = readWindowPublicBootstrap();
  const faq = useMemo(() => ({ ...defaultFaq, ...(bootstrap?.pages.faq || {}) }), [bootstrap]);
  const pageMediaVariants = bootstrap?.mediaVariants || {};
  usePageMeta({
    title: "FAQ",
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
                  className="group bg-card/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-card/90 hover:shadow-lg"
                >
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground transition-colors duration-300 group-hover:text-primary">
                      <Icon className="h-4 w-4 text-primary/80 transition-colors duration-300 group-hover:text-primary" />
                      {card.title}
                    </div>
                    <p className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                      {card.text}
                    </p>
                    <Separator className="bg-border/60" />
                    <p className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                      {card.note}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section
          className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pb-24 pt-2 reveal`}
          data-reveal
        >
          <div className="grid gap-6">
            {faq.groups.map((group) => {
              const Icon = resolveFaqIcon(group.icon, HelpCircle);
              return (
                <Card key={group.title} className="border-border/60 bg-card/80 shadow-lg">
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
                          <p className="mt-2 text-sm text-muted-foreground transition-colors duration-300 group-hover/item:text-foreground/80">
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
      </main>
    </div>
  );
};

export default FAQ;
