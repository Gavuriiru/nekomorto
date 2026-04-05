import { useEffect, useMemo, useRef, useState } from "react";
import PublicPageHero from "@/components/PublicPageHero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  Copy,
  ExternalLink,
  Coins,
  Wallet,
  BadgeDollarSign,
  Landmark,
  Banknote,
  CircleDollarSign,
  Bitcoin,
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
import { publicPageLayoutTokens } from "@/components/public-page-tokens";
import { usePageMeta } from "@/hooks/use-page-meta";
import { usePixQrCode } from "@/hooks/use-pix-qr-code";
import { useTextQrCode } from "@/hooks/use-text-qr-code";
import { useSiteSettings } from "@/hooks/use-site-settings";
import {
  DEFAULT_DONATIONS_CRYPTO_SECTION_TITLE,
  getDonationsCryptoActionLabel,
  getDonationsCryptoMeta,
  getDonationsCryptoQrValue,
  isRenderableDonationsCryptoService,
  normalizeDonationsCryptoService,
  normalizeDonationsCryptoServices,
} from "@/lib/donations-crypto";
import {
  MONTHLY_GOAL_MILESTONES,
  buildMonthlyGoalSummary,
} from "@/lib/donations-monthly-goal";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";
import type { DonationsCryptoService } from "@/types/public-pages";
import {
  buildInstitutionalOgImageAlt,
  buildInstitutionalOgRevision,
  buildVersionedInstitutionalOgImagePath,
} from "../../shared/institutional-og-seo.js";

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
  Coins,
  Wallet,
  BadgeDollarSign,
  Landmark,
  Banknote,
  CircleDollarSign,
  Bitcoin,
};

const resolveDonationsIcon = (iconName: string | undefined, fallback: typeof Server) =>
  (iconName ? iconMap[iconName] : undefined) || fallback;

const emptyDonations = {
  shareImage: "",
  shareImageAlt: "",
  heroTitle: "",
  heroSubtitle: "",
  costs: [],
  reasonTitle: "",
  reasonIcon: "HeartHandshake",
  reasonText: "",
  reasonNote: "",
  monthlyGoalRaised: "",
  monthlyGoalTarget: "",
  monthlyGoalSupporters: "",
  monthlyGoalNote: "",
  cryptoTitle: "",
  cryptoSubtitle: "",
  cryptoServices: [],
  pixKey: "",
  pixNote: "",
  pixCity: "",
  qrCustomUrl: "",
  pixIcon: "QrCode",
  donorsIcon: "PiggyBank",
  donors: [],
};

const defaultDonations = emptyDonations;

const buildCryptoTabAriaLabel = (service: DonationsCryptoService) => {
  const metaLabel = getDonationsCryptoMeta(service);
  return metaLabel ? `${service.name} (${metaLabel})` : service.name;
};

const CryptoDonationPanel = ({
  service,
  index,
  copiedKey,
  onCopy,
}: {
  service: DonationsCryptoService;
  index: number;
  copiedKey: string | null;
  onCopy: (value: string, key: string) => Promise<void>;
}) => {
  const qrUrl = useTextQrCode({
    value: getDonationsCryptoQrValue(service),
  });
  const metaLabel = getDonationsCryptoMeta(service);
  const actionUrl = String(service.actionUrl || "").trim();
  const actionLabel = getDonationsCryptoActionLabel(service);
  const logoUrl = normalizeAssetUrl(service.iconUrl);
  const Icon = resolveDonationsIcon(service.icon, Coins);
  const copyKey = `crypto-${index}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,188px)_minmax(0,1fr)] md:items-start">
        <div className="space-y-3">
          <div className="mx-auto w-full max-w-[188px] rounded-[1.5rem] bg-linear-to-br from-primary/12 via-background to-background p-3 shadow-[0_16px_36px_-24px_hsl(var(--primary))] md:mx-0">
            <div className="overflow-hidden rounded-[1.2rem] bg-white p-2 shadow-[0_1px_1px_rgba(15,23,42,0.08)]">
              <img
                src={qrUrl}
                alt={`QR Code ${service.name}`}
                className="aspect-square w-full rounded-lg object-cover"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Button
              className="w-full gap-2"
              onClick={() => void onCopy(service.address, copyKey)}
              disabled={!service.address}
            >
              {copiedKey === copyKey ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copiedKey === copyKey ? "Copiado" : "Copiar endereço"}
            </Button>
            {actionUrl ? (
              <Button asChild variant="outline" className="w-full gap-2">
                <a href={actionUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="h-4 w-4" />
                  {actionLabel}
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-start gap-3 rounded-[1.25rem] bg-background/75 px-3.5 py-3 shadow-xs">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] bg-primary/10">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`Logo ${service.name}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Icon className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-base font-semibold text-foreground md:text-lg">
                {service.name}
              </div>
              {metaLabel ? (
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {metaLabel}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Endereço
            </div>
            <div className="rounded-[1.2rem] bg-background/70 px-4 py-3 font-mono text-sm text-primary shadow-xs break-all">
              {service.address}
            </div>
          </div>

          {service.note ? (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Observações
              </div>
              <div className="rounded-[1.2rem] bg-background/45 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                {service.note}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const Donations = () => {
  const { settings } = useSiteSettings();
  const bootstrap = readWindowPublicBootstrap();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeCryptoIndex, setActiveCryptoIndex] = useState(0);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const donations = useMemo(() => {
    const incoming = bootstrap?.pages.donations;
    if (!incoming) {
      return defaultDonations;
    }
    return {
      ...defaultDonations,
      ...incoming,
      reasonIcon: incoming.reasonIcon || defaultDonations.reasonIcon,
      pixIcon: incoming.pixIcon || defaultDonations.pixIcon,
      donorsIcon: incoming.donorsIcon || defaultDonations.donorsIcon,
      cryptoServices: normalizeDonationsCryptoServices(incoming.cryptoServices),
    };
  }, [bootstrap]);
  const pageMediaVariants = bootstrap?.mediaVariants || {};
  const merchantName =
    String(settings.site.name || settings.footer.brandName || "NEKOMATA").trim() || "NEKOMATA";
  usePageMeta({
    title: "Doações",
    image: buildVersionedInstitutionalOgImagePath({
      pageKey: "donations",
      revision: buildInstitutionalOgRevision({
        pageKey: "donations",
        pages: bootstrap?.pages,
        settings: bootstrap?.settings,
      }),
    }),
    imageAlt: buildInstitutionalOgImageAlt("donations"),
    mediaVariants: pageMediaVariants,
  });

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async (value: string, key: string) => {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) {
      setCopiedKey(null);
      return;
    }

    try {
      await navigator.clipboard.writeText(normalizedValue);
      setCopiedKey(key);
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopiedKey((currentKey) => (currentKey === key ? null : currentKey));
      }, 2000);
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = normalizedValue;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copiedWithFallback = document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedKey(copiedWithFallback ? key : null);
        if (copiedWithFallback) {
          if (copyResetTimeoutRef.current !== null) {
            window.clearTimeout(copyResetTimeoutRef.current);
          }
          copyResetTimeoutRef.current = window.setTimeout(() => {
            setCopiedKey((currentKey) => (currentKey === key ? null : currentKey));
          }, 2000);
        }
      } catch {
        setCopiedKey(null);
      }
    }
  };

  const qrUrl = usePixQrCode({
    pixKey: donations.pixKey,
    pixNote: donations.pixNote,
    pixCity: donations.pixCity?.trim() || "CIDADE",
    qrCustomUrl: donations.qrCustomUrl,
    merchantName,
  });
  const monthlyGoal = useMemo(
    () =>
      buildMonthlyGoalSummary({
        raised: donations.monthlyGoalRaised,
        target: donations.monthlyGoalTarget,
        supporters: donations.monthlyGoalSupporters,
        note: donations.monthlyGoalNote,
      }),
    [
      donations.monthlyGoalNote,
      donations.monthlyGoalRaised,
      donations.monthlyGoalSupporters,
      donations.monthlyGoalTarget,
    ],
  );
  const visibleCryptoServices = useMemo(
    () =>
      normalizeDonationsCryptoServices(donations.cryptoServices).filter((service) =>
        isRenderableDonationsCryptoService(service),
      ),
    [donations.cryptoServices],
  );
  const cryptoSectionTitle = DEFAULT_DONATIONS_CRYPTO_SECTION_TITLE;
  const hasMultipleCryptoServices = visibleCryptoServices.length > 1;
  const activeCryptoService =
    visibleCryptoServices[activeCryptoIndex] || visibleCryptoServices[0] || null;

  useEffect(() => {
    if (visibleCryptoServices.length === 0) {
      if (activeCryptoIndex !== 0) {
        setActiveCryptoIndex(0);
      }
      return;
    }
    if (activeCryptoIndex >= visibleCryptoServices.length) {
      setActiveCryptoIndex(0);
    }
  }, [activeCryptoIndex, visibleCryptoServices.length]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <PublicPageHero title={donations.heroTitle} subtitle={donations.heroSubtitle} />

        <section
          className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pb-12 pt-10 reveal`}
          data-reveal
        >
          <div className="grid gap-6 md:grid-cols-3">
            {donations.costs.map((item) => {
              const Icon = resolveDonationsIcon(item.icon, Sparkles);
              return (
                <Card
                  key={item.title}
                  className="group bg-card/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-card/90 hover:shadow-lg"
                >
                  <CardContent className="space-y-3 p-6">
                    <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground transition-colors duration-300 group-hover:text-primary">
                      <Icon className="h-4 w-4 text-primary/80 transition-colors duration-300 group-hover:text-primary" />
                      {item.title}
                    </div>
                    <p className="text-sm text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {monthlyGoal ? (
          <section
            className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pb-8 pt-2 reveal`}
            data-reveal
          >
            <Card
              className={`group/goal shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                monthlyGoal.isComplete
                  ? "border-primary/30 bg-primary/5 hover:border-primary/50"
                  : "border-border/60 bg-card/90 hover:border-primary/60"
              }`}
            >
              <CardContent className="space-y-5 p-6 md:p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className={`text-sm font-semibold uppercase tracking-widest transition-colors duration-300 ${
                          monthlyGoal.isComplete
                            ? "text-primary"
                            : "text-muted-foreground group-hover/goal:text-primary"
                        }`}
                      >
                        {monthlyGoal.title}
                      </div>
                      {monthlyGoal.isComplete ? (
                        <Badge className="border border-primary/15 bg-primary/10 text-primary hover:bg-primary/10">
                          Concluída
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-lg font-semibold text-foreground md:text-xl">
                      {monthlyGoal.raisedLabel}
                      <span className="ml-2 font-medium text-muted-foreground">
                        de {monthlyGoal.targetLabel}
                      </span>
                    </p>
                    <p
                      className={`text-sm ${
                        monthlyGoal.isComplete ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {monthlyGoal.statusText}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <span
                      className={`text-3xl font-semibold ${
                        monthlyGoal.isComplete ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {monthlyGoal.percentage}%
                    </span>
                    {monthlyGoal.supportersLabel ? (
                      <div className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                        {monthlyGoal.supportersLabel}
                      </div>
                    ) : null}
                  </div>
                </div>
                {monthlyGoal.note ? (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      monthlyGoal.isComplete
                        ? "border-primary/15 bg-background/80 text-foreground/80"
                        : "border-border/60 bg-background/60 text-muted-foreground"
                    }`}
                  >
                    {monthlyGoal.note}
                  </div>
                ) : null}
                <Progress
                  value={monthlyGoal.percentage}
                  className={`h-3 ${monthlyGoal.isComplete ? "bg-primary/20" : "bg-primary/15"}`}
                  indicatorClassName={
                    monthlyGoal.isComplete
                      ? "bg-primary shadow-[0_0_24px_-10px_hsl(var(--primary))]"
                      : undefined
                  }
                  aria-label={monthlyGoal.title}
                  aria-valuetext={monthlyGoal.progressLabel}
                />
                <div className="grid gap-2 sm:grid-cols-4">
                  {MONTHLY_GOAL_MILESTONES.map((milestone) => {
                    const reached = monthlyGoal.percentage >= milestone;
                    return (
                      <div
                        key={milestone}
                        data-testid={`monthly-goal-milestone-${milestone}`}
                        data-reached={reached ? "true" : "false"}
                        className={`rounded-full border px-3 py-2 text-center text-xs font-semibold transition-colors duration-300 ${
                          reached
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border/60 bg-background/70 text-muted-foreground"
                        }`}
                      >
                        {milestone}%
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  <Button asChild className="w-full sm:w-auto">
                    <a href="#pix-doacoes">Apoiar agora</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section
          className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pb-12 pt-0 reveal`}
          data-reveal
        >
          <Card className="border-border/60 bg-card/90 shadow-xl">
            <CardContent className="grid gap-6 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-8">
              <div className="group/reason space-y-4 rounded-2xl p-2 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60">
                <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground transition-colors duration-300 group-hover/reason:text-primary">
                  {(() => {
                    const ReasonIcon = resolveDonationsIcon(
                      donations.reasonIcon,
                      HeartHandshake,
                    );
                    return (
                      <ReasonIcon className="h-4 w-4 text-primary/80 transition-colors duration-300 group-hover/reason:text-primary" />
                    );
                  })()}
                  {donations.reasonTitle}
                </div>
                <p className="text-sm text-muted-foreground transition-colors duration-300 group-hover/reason:text-foreground/80 md:text-base">
                  {donations.reasonText}
                </p>
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4 text-sm text-muted-foreground transition-all duration-300 group-hover/reason:border-primary/60 group-hover/reason:bg-background/70 group-hover/reason:text-foreground/80">
                  {donations.reasonNote}
                </div>
              </div>
              <div
                id="pix-doacoes"
                className="group/pix rounded-2xl border border-border/60 bg-background/50 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-background/70 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground transition-colors duration-300 group-hover/pix:text-primary">
                    {(() => {
                      const PixIcon = resolveDonationsIcon(donations.pixIcon, QrCode);
                      return (
                        <PixIcon className="h-4 w-4 text-primary/80 transition-colors duration-300 group-hover/pix:text-primary" />
                      );
                    })()}
                    Pix
                  </div>
                  <span className="text-xs text-muted-foreground">Chave e QR Code</span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[0.8fr_1.2fr] md:items-center">
                  <div className="mx-auto w-full max-w-[220px] rounded-3xl border border-primary/20 bg-linear-to-br from-primary/10 via-background to-background p-3 shadow-[0_12px_40px_-20px_hsl(var(--primary))] md:mx-0">
                    <div className="overflow-hidden rounded-2xl border border-border/60 bg-white p-2">
                      <img
                        src={qrUrl}
                        alt="QR Code PIX"
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-center font-mono text-sm text-primary shadow-xs">
                      {donations.pixKey}
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-3 md:justify-center">
                      <Button
                        className="w-full gap-2 md:w-auto"
                        onClick={() => void handleCopy(donations.pixKey, "pix")}
                        disabled={!donations.pixKey?.trim()}
                      >
                        {copiedKey === "pix" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {copiedKey === "pix" ? "Copiado" : "Copiar chave PIX"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {visibleCryptoServices.length > 0 ? (
          <section
            className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pb-8 pt-0 reveal`}
            data-reveal
            data-testid="donations-crypto-section"
          >
            <Card
              data-testid="donations-crypto-card"
              className="border-border/60 bg-card/90 shadow-lg transition-all duration-300 hover:border-primary/60 hover:bg-card/95 hover:shadow-xl"
            >
              <CardContent className="space-y-4 p-5 md:space-y-5 md:p-6">
                <div
                  className={
                    hasMultipleCryptoServices
                      ? "grid gap-4 md:grid-cols-[60px_minmax(0,1fr)] lg:grid-cols-[64px_minmax(0,1fr)]"
                      : "grid gap-4"
                  }
                >
                  {hasMultipleCryptoServices ? (
                    <div className="min-w-0">
                      <div
                        role="tablist"
                        aria-label={cryptoSectionTitle}
                        data-testid="donations-crypto-tablist"
                        className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5 md:flex-col md:gap-1.5 md:overflow-visible md:pb-0"
                      >
                        {visibleCryptoServices.map((service, index) => {
                          const normalizedService = normalizeDonationsCryptoService(service);
                          const isActive = index === activeCryptoIndex;
                          const tabLogoUrl = normalizeAssetUrl(normalizedService.iconUrl);
                          const TabIcon = resolveDonationsIcon(normalizedService.icon, Coins);

                          return (
                            <button
                              key={`${normalizedService.name}-${normalizedService.address}-${index}`}
                              type="button"
                              role="tab"
                              id={`donations-crypto-tab-${index}`}
                              aria-controls={`donations-crypto-panel-${index}`}
                              aria-selected={isActive}
                              aria-label={buildCryptoTabAriaLabel(normalizedService)}
                              tabIndex={isActive ? 0 : -1}
                              data-testid={`donations-crypto-tab-${index}`}
                              onClick={() => setActiveCryptoIndex(index)}
                              className={`group/tab relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[1.1rem] border transition-all duration-300 md:h-[3.25rem] md:w-[3.25rem] ${
                                isActive
                                  ? "border-primary/50 bg-primary/10 text-primary shadow-[0_12px_28px_-20px_hsl(var(--primary))]"
                                  : "border-border/60 bg-background/70 text-muted-foreground hover:border-primary/40 hover:bg-background"
                              }`}
                            >
                              <span
                                className={`absolute inset-y-3 left-0 hidden w-1 rounded-full bg-primary transition-opacity md:block ${
                                  isActive ? "opacity-100" : "opacity-0"
                                }`}
                                aria-hidden="true"
                              />
                              {tabLogoUrl ? (
                                <img
                                  src={tabLogoUrl}
                                  alt=""
                                  aria-hidden="true"
                                  data-testid={`donations-crypto-tab-logo-${index}`}
                                  className="h-[1.375rem] w-[1.375rem] rounded-md object-cover"
                                />
                              ) : (
                                <TabIcon
                                  aria-hidden="true"
                                  data-testid={`donations-crypto-tab-icon-${index}`}
                                  className={`h-4 w-4 transition-transform duration-300 ${
                                    isActive ? "scale-105 text-primary" : "text-muted-foreground group-hover/tab:text-primary"
                                  }`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {activeCryptoService ? (
                    <div
                      role={hasMultipleCryptoServices ? "tabpanel" : undefined}
                      id={`donations-crypto-panel-${activeCryptoIndex}`}
                      aria-labelledby={
                        hasMultipleCryptoServices ? `donations-crypto-tab-${activeCryptoIndex}` : undefined
                      }
                      data-testid="donations-crypto-panel"
                      className="rounded-[1.5rem] border border-border/60 bg-background/55 p-4 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.9)] md:p-5"
                    >
                      <CryptoDonationPanel
                        service={normalizeDonationsCryptoService(activeCryptoService)}
                        index={activeCryptoIndex}
                        copiedKey={copiedKey}
                        onCopy={handleCopy}
                      />
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </section>
        ) : null}

        <section
          className={`${publicPageLayoutTokens.sectionBase} max-w-6xl pb-24 pt-4 reveal`}
          data-reveal
        >
          <Card className="group bg-card/80 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:bg-card/90 hover:shadow-lg">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-3 text-xl font-semibold text-foreground transition-colors duration-300 group-hover:text-primary">
                {(() => {
                  const DonorsIcon = iconMap[donations.donorsIcon] || PiggyBank;
                  return (
                    <DonorsIcon className="h-5 w-5 text-primary/80 transition-colors duration-300 group-hover:text-primary" />
                  );
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
                      <th className="pb-3">Mês/Ano</th>
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
    </div>
  );
};

export default Donations;
