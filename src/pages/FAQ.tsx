import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { HelpCircle, Info, Users, Rocket, Shield, Sparkles } from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { usePageMeta } from "@/hooks/use-page-meta";

const iconMap: Record<string, typeof HelpCircle> = {
  HelpCircle,
  Info,
  Users,
  Rocket,
  Shield,
  Sparkles,
};

const defaultFaq = {
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
          answer: "Somos um grupo de fãs que traduz e adapta conteúdos com foco em qualidade, estilo e respeito à obra.",
        },
        { question: "Vocês cobram pelos lançamentos?", answer: "Não. Nosso trabalho é feito por paixão e sem fins lucrativos." },
        { question: "Qual a prioridade da equipe?", answer: "Entregar algo bonito, legível e consistente, mesmo que isso leve mais tempo." },
      ],
    },
    {
      title: "Recrutamento",
      icon: "Users",
      items: [
        { question: "Posso entrar para a equipe?", answer: "Sim! Sempre buscamos pessoas comprometidas. Entre em contato pelo Discord." },
        { question: "Preciso ter experiência?", answer: "Ajuda, mas não é obrigatório. O principal é vontade de aprender e consistência." },
      ],
    },
    {
      title: "Projetos e lançamentos",
      icon: "Rocket",
      items: [
        { question: "Quando sai o próximo episódio?", answer: "Quando estiver pronto. Evitamos datas exatas para priorizar qualidade." },
        { question: "Posso sugerir um projeto?", answer: "Pode sim! Levamos em conta a demanda e a capacidade da equipe." },
      ],
    },
    {
      title: "Qualidade e suporte",
      icon: "Shield",
      items: [
        { question: "Como reporto um erro?", answer: "Fale com a equipe pelo Discord. Quanto mais detalhes, melhor." },
        { question: "A legenda não aparece. O que faço?", answer: "Verifique o player e o arquivo. Recomendamos players como MPV e VLC." },
      ],
    },
  ],
};

const FAQ = () => {
  usePageMeta({ title: "FAQ" });

  const apiBase = getApiBase();
  const [faq, setFaq] = useState(defaultFaq);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/pages");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive && data.pages?.faq) {
          setFaq({ ...defaultFaq, ...data.pages.faq });
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
        <section className="relative overflow-hidden border-b border-border/60 reveal" data-reveal>
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-background to-background" />
          <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-accent/20 blur-[120px]" />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-16 pt-20 md:px-10">
            <div className="max-w-3xl space-y-4">
              <h1 className="text-3xl font-semibold text-foreground md:text-5xl">{faq.heroTitle}</h1>
              <p className="text-sm text-muted-foreground md:text-base">{faq.heroSubtitle}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-10 md:px-10 reveal" data-reveal>
          <div className="grid gap-6 md:grid-cols-2">
            {faq.introCards.map((card) => {
              const Icon = iconMap[card.icon] || HelpCircle;
              return (
                <Card key={card.title} className="border-border/60 bg-card/80 shadow-lg">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                      {card.title}
                    </div>
                    <p className="text-sm text-muted-foreground">{card.text}</p>
                    <Separator className="bg-border/60" />
                    <p className="text-sm text-muted-foreground">{card.note}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-2 md:px-10 reveal" data-reveal>
          <div className="grid gap-6">
            {faq.groups.map((group) => {
              const Icon = iconMap[group.icon] || HelpCircle;
              return (
                <Card
                  key={group.title}
                  className="border-border/60 bg-card/80 shadow-lg transition hover:border-primary/40"
                >
                  <CardContent className="space-y-5 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                      {group.title}
                    </div>
                    <div className="grid gap-4">
                      {group.items.map((item) => (
                        <div key={item.question} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                          <p className="text-sm font-semibold text-foreground">{item.question}</p>
                          <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
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




