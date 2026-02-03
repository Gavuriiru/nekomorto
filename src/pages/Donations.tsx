import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  Copy,
  HeartHandshake,
  PiggyBank,
  QrCode,
  Server,
  Sparkles,
  Heart,
  Users,
  Wand2,
  Flame,
  Zap,
  HelpCircle,
  Info,
  Rocket,
  Shield,
} from "lucide-react";
import { getApiBase } from "@/lib/api-base";
import { usePageMeta } from "@/hooks/use-page-meta";

const iconMap: Record<string, typeof Server> = {
  Server,
  PiggyBank,
  Sparkles,
  HeartHandshake,
  QrCode,
  Heart,
  Users,
  Wand2,
  Flame,
  Zap,
  HelpCircle,
  Info,
  Rocket,
  Shield,
};

const defaultDonations = {
  heroTitle: "Ajude a Nekomata a seguir no ar",
  heroSubtitle:
    "Cada doação mantém o site vivo, fortalece nossos lançamentos e garante qualidade no que entregamos. Se quiser apoiar, qualquer valor faz diferença.",
  costs: [
    { title: "Hospedagem e domínio", description: "Manter o site no ar com estabilidade.", icon: "Server" },
    { title: "Armazenamento", description: "Arquivos, backups e infraestrutura dos projetos.", icon: "PiggyBank" },
    { title: "Incentivo por projeto", description: "Apoio pontual para demandas específicas.", icon: "Sparkles" },
  ],
  reasonTitle: "Por que doar?",
  reasonIcon: "HeartHandshake",
  reasonText:
    "Somos um projeto feito por fãs, sem fins lucrativos. Doações ajudam com custos reais e permitem que a equipe invista tempo e cuidado em cada etapa.",
  reasonNote: "Toda ajuda é bem-vinda. Se quiser apoiar, faça isso por gostar do nosso trabalho.",
  pixKey: "707e9869-0160-4a88-8332-31eac7cee73f",
  pixNote: "Cole a chave no app do seu banco.",
  qrCustomUrl: "",
  pixIcon: "QrCode",
  donorsIcon: "PiggyBank",
  donors: [
    { name: "IgorBKRY", amount: "R$ 10,00", goal: "Fansub Geral", tier: "Sem patente", date: "Mar/2024" },
    { name: "Anônimo", amount: "R$ 25,00", goal: "Fansub Geral", tier: "Bronze", date: "Mar/2024" },
    { name: "Anônimo", amount: "R$ 60,00", goal: "Fansub Geral", tier: "Prata", date: "Mar/2024" },
    { name: "Fabiana A.", amount: "R$ 40,00", goal: "Fansub Geral", tier: "Ouro", date: "Abr/2024" },
    { name: "Rafa Chaves", amount: "R$ 120,00", goal: "Projeto especial", tier: "Master", date: "Mai/2024" },
  ],
};

const Donations = () => {
  usePageMeta({ title: "Doações" });

  const apiBase = getApiBase();
  const [copied, setCopied] = useState(false);
  const [donations, setDonations] = useState(defaultDonations);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const response = await fetch(`${apiBase}/api/public/pages`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (isActive && data.pages?.donations) {
          const incoming = data.pages.donations;
          setDonations({
            ...defaultDonations,
            ...incoming,
            reasonIcon: incoming.reasonIcon || defaultDonations.reasonIcon,
            pixIcon: incoming.pixIcon || defaultDonations.pixIcon,
            donorsIcon: incoming.donorsIcon || defaultDonations.donorsIcon,
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(donations.pixKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const qrUrl = donations.qrCustomUrl
    ? donations.qrCustomUrl
    : donations.pixKey
      ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(donations.pixKey)}`
      : "/placeholder.svg";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main>
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/15 via-background to-background" />
          <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/20 blur-[120px]" />
          <div className="absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-accent/20 blur-[120px]" />
          <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-16 pt-20 md:px-10">
            <div className="max-w-3xl space-y-4">
              <h1 className="text-3xl font-semibold text-foreground md:text-5xl">{donations.heroTitle}</h1>
              <p className="text-sm text-muted-foreground md:text-base">{donations.heroSubtitle}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-10 md:px-10">
          <div className="grid gap-6 md:grid-cols-3">
            {donations.costs.map((item) => {
              const Icon = iconMap[item.icon] || Sparkles;
              return (
                <Card
                  key={item.title}
                  className="border-border/60 bg-card/80 shadow-lg transition hover:border-primary/40"
                >
                  <CardContent className="space-y-3 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                      {item.title}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-12 pt-2 md:px-10">
          <Card className="border-border/60 bg-card/90 shadow-xl">
            <CardContent className="grid gap-6 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  {(() => {
                    const ReasonIcon = iconMap[donations.reasonIcon] || HeartHandshake;
                    return <ReasonIcon className="h-4 w-4 text-primary" />;
                  })()}
                  {donations.reasonTitle}
                </div>
                <p className="text-sm text-muted-foreground md:text-base">{donations.reasonText}</p>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                  {donations.reasonNote}
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/50 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    {(() => {
                      const PixIcon = iconMap[donations.pixIcon] || QrCode;
                      return <PixIcon className="h-4 w-4 text-primary" />;
                    })()}
                    Pix
                  </div>
                  <span className="text-xs text-muted-foreground">Chave e QR</span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[0.8fr_1.2fr] md:items-center">
                  <div className="mx-auto w-full max-w-[200px] overflow-hidden rounded-2xl border border-border/60 bg-background/60 p-2 md:mx-0">
                    <img src={qrUrl} alt="QR Code PIX" className="aspect-square w-full rounded-md object-cover" />
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-center font-mono text-sm text-primary">
                      {donations.pixKey}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 md:justify-center">
                      <Button className="gap-2" onClick={handleCopy}>
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Copiado" : "Copiar chave PIX"}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">{donations.pixNote}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-24 pt-4 md:px-10">
          <Card className="border-border/60 bg-card/80 shadow-lg">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-3 text-xl font-semibold text-foreground">
                {(() => {
                  const DonorsIcon = iconMap[donations.donorsIcon] || PiggyBank;
                  return <DonorsIcon className="h-5 w-5 text-primary" />;
                })()}
                Lista de doadores
              </div>
              <Separator className="my-6 bg-border/60" />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <colgroup>
                    <col className="w-[34%]" />
                    <col className="w-[22%]" />
                    <col className="w-[28%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="pb-3">Doador</th>
                      <th className="pb-3">Valor</th>
                      <th className="pb-3">Objetivo</th>
                      <th className="pb-3">M�s/Ano</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {donations.donors.map((donor, index) => (
                      <tr key={`${donor.name}-${donor.date}-${index}`}>
                        <td className="py-3 font-medium text-foreground">{donor.name}</td>
                        <td className="py-3 text-muted-foreground">{donor.amount}</td>
                        <td className="py-3 text-muted-foreground">{donor.goal}</td>
                        <td className="py-3 text-muted-foreground">{donor.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Donations;

