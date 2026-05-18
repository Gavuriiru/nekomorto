import PublicDonationsPageContent from "@/components/public-pages/PublicDonationsPageContent";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  useResolvedPublicBootstrap,
  useResolvedPublicRoutePayload,
} from "@/hooks/public-bootstrap-provider";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { normalizeDonationsCryptoServices } from "@/lib/donations-crypto";
import { useMemo } from "react";
import {
  buildInstitutionalOgImageAlt,
  buildInstitutionalOgRevision,
  buildVersionedInstitutionalOgImagePath,
  resolveInstitutionalOgSupportText,
} from "../../shared/institutional-og-seo.js";

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

const Donations = () => {
  const { settings } = useSiteSettings();
  const windowBootstrap = useResolvedPublicBootstrap();
  const routePayload = useResolvedPublicRoutePayload();
  const { data: bootstrapData, status: bootstrapStatus } = usePublicBootstrap();
  const bootstrap = bootstrapData || windowBootstrap;
  const donationsRoutePayload = routePayload?.kind === "donations" ? routePayload : null;
  const hasDonationsBootstrap = Boolean(bootstrap && bootstrap.payloadMode !== "critical-home");
  const donations = useMemo(() => {
    const incoming = hasDonationsBootstrap ? bootstrap?.pages?.donations || null : null;
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
  }, [bootstrap, hasDonationsBootstrap]);
  const pageBootstrap = hasDonationsBootstrap ? bootstrap || null : null;
  const pageMediaVariants = pageBootstrap?.mediaVariants || {};
  const shouldShowHydrationState = !pageBootstrap;
  const hasHydrationError = shouldShowHydrationState && bootstrapStatus === "error";
  const merchantName =
    String(settings.site.name || settings.footer.brandName || "Nekomata").trim() || "Nekomata";

  usePageMeta({
    title: "DoaÃ§Ãµes",
    description: resolveInstitutionalOgSupportText({
      pageKey: "donations",
      pages: pageBootstrap?.pages,
      settings: pageBootstrap?.settings,
    }),
    image: buildVersionedInstitutionalOgImagePath({
      pageKey: "donations",
      revision: buildInstitutionalOgRevision({
        pageKey: "donations",
        pages: pageBootstrap?.pages,
        settings: pageBootstrap?.settings,
      }),
    }),
    imageAlt: buildInstitutionalOgImageAlt("donations"),
    mediaVariants: pageMediaVariants,
  });

  return (
    <PublicDonationsPageContent
      donations={donations}
      hasHydrationError={hasHydrationError}
      merchantName={merchantName}
      routePayload={donationsRoutePayload}
      shouldShowHydrationState={shouldShowHydrationState}
    />
  );
};

export default Donations;
