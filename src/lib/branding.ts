import type { SiteSettings } from "@/types/site-settings";

type NavbarBrandMode = SiteSettings["branding"]["display"]["navbar"];
type FooterBrandMode = SiteSettings["branding"]["display"]["footer"];
type LegacyWordmarkPlacement = SiteSettings["branding"]["wordmarkPlacement"];

const NAVBAR_BRAND_MODES: readonly NavbarBrandMode[] = ["wordmark", "symbol-text", "symbol", "text"];
const FOOTER_BRAND_MODES: readonly FooterBrandMode[] = ["wordmark", "symbol-text", "text"];
const LEGACY_WORDMARK_PLACEMENTS: readonly LegacyWordmarkPlacement[] = ["navbar", "footer", "both"];

const trimValue = (value: unknown) => String(value || "").trim();

const isNavbarBrandMode = (value: string): value is NavbarBrandMode =>
  NAVBAR_BRAND_MODES.includes(value as NavbarBrandMode);

const isFooterBrandMode = (value: string): value is FooterBrandMode =>
  FOOTER_BRAND_MODES.includes(value as FooterBrandMode);

const normalizeLegacyPlacement = (value: string): LegacyWordmarkPlacement =>
  LEGACY_WORDMARK_PLACEMENTS.includes(value as LegacyWordmarkPlacement)
    ? (value as LegacyWordmarkPlacement)
    : "both";

export type BrandingResolution = {
  direct: {
    symbolAssetUrl: string;
    wordmarkAssetUrl: string;
    navbarSymbolOverrideUrl: string;
    footerSymbolOverrideUrl: string;
    navbarWordmarkOverrideUrl: string;
    footerWordmarkOverrideUrl: string;
  };
  legacy: {
    siteSymbolUrl: string;
    footerSymbolUrl: string;
    wordmarkUrl: string;
    navbarWordmarkUrl: string;
    footerWordmarkUrl: string;
    wordmarkEnabled: boolean;
    wordmarkPlacement: LegacyWordmarkPlacement;
  };
  assets: {
    symbolUrl: string;
    wordmarkUrl: string;
  };
  overrides: {
    navbarSymbolUrl: string;
    footerSymbolUrl: string;
    navbarWordmarkUrl: string;
    footerWordmarkUrl: string;
  };
  display: {
    navbar: NavbarBrandMode;
    footer: FooterBrandMode;
  };
  navbar: {
    mode: NavbarBrandMode;
    symbolUrl: string;
    wordmarkUrl: string;
    showWordmark: boolean;
  };
  footer: {
    mode: FooterBrandMode;
    symbolUrl: string;
    wordmarkUrl: string;
    showWordmark: boolean;
  };
};

export const resolveBranding = (settings: SiteSettings): BrandingResolution => {
  const legacySiteSymbol = trimValue(settings.site.logoUrl);
  const legacyFooterSymbol = trimValue(settings.footer.brandLogoUrl);
  const legacyWordmarkUrl = trimValue(settings.branding.wordmarkUrl);
  const legacyNavbarWordmark = trimValue(settings.branding.wordmarkUrlNavbar);
  const legacyFooterWordmark = trimValue(settings.branding.wordmarkUrlFooter);
  const legacyWordmarkEnabled = Boolean(settings.branding.wordmarkEnabled);
  const legacyWordmarkPlacement = normalizeLegacyPlacement(trimValue(settings.branding.wordmarkPlacement));

  const symbolAssetDirect = trimValue(settings.branding.assets?.symbolUrl);
  const wordmarkAssetDirect = trimValue(settings.branding.assets?.wordmarkUrl);
  const navbarSymbolOverrideDirect = trimValue(settings.branding.overrides?.navbarSymbolUrl);
  const footerSymbolOverrideDirect = trimValue(settings.branding.overrides?.footerSymbolUrl);
  const navbarWordmarkOverrideDirect = trimValue(settings.branding.overrides?.navbarWordmarkUrl);
  const footerWordmarkOverrideDirect = trimValue(settings.branding.overrides?.footerWordmarkUrl);

  const symbolAssetUrl = symbolAssetDirect || legacySiteSymbol;
  const wordmarkAssetUrl =
    wordmarkAssetDirect || legacyWordmarkUrl || legacyNavbarWordmark || legacyFooterWordmark || "";

  const navbarSymbolUrl = navbarSymbolOverrideDirect || symbolAssetUrl;
  const footerSymbolUrl = footerSymbolOverrideDirect || symbolAssetUrl || legacyFooterSymbol;

  const navbarWordmarkUrl =
    navbarWordmarkOverrideDirect ||
    legacyNavbarWordmark ||
    footerWordmarkOverrideDirect ||
    legacyFooterWordmark ||
    wordmarkAssetUrl ||
    symbolAssetUrl ||
    "";
  const footerWordmarkUrl =
    footerWordmarkOverrideDirect ||
    legacyFooterWordmark ||
    navbarWordmarkOverrideDirect ||
    legacyNavbarWordmark ||
    wordmarkAssetUrl ||
    "";

  const legacyNavbarMode: NavbarBrandMode =
    legacyWordmarkEnabled && (legacyWordmarkPlacement === "navbar" || legacyWordmarkPlacement === "both")
      ? "wordmark"
      : "symbol-text";
  const legacyFooterMode: FooterBrandMode =
    legacyWordmarkEnabled && (legacyWordmarkPlacement === "footer" || legacyWordmarkPlacement === "both")
      ? "wordmark"
      : "symbol-text";

  const navbarModeCandidate = trimValue(settings.branding.display?.navbar);
  const footerModeCandidate = trimValue(settings.branding.display?.footer);
  const navbarMode = isNavbarBrandMode(navbarModeCandidate) ? navbarModeCandidate : legacyNavbarMode;
  const footerMode = isFooterBrandMode(footerModeCandidate) ? footerModeCandidate : legacyFooterMode;

  return {
    direct: {
      symbolAssetUrl: symbolAssetDirect,
      wordmarkAssetUrl: wordmarkAssetDirect,
      navbarSymbolOverrideUrl: navbarSymbolOverrideDirect,
      footerSymbolOverrideUrl: footerSymbolOverrideDirect,
      navbarWordmarkOverrideUrl: navbarWordmarkOverrideDirect,
      footerWordmarkOverrideUrl: footerWordmarkOverrideDirect,
    },
    legacy: {
      siteSymbolUrl: legacySiteSymbol,
      footerSymbolUrl: legacyFooterSymbol,
      wordmarkUrl: legacyWordmarkUrl,
      navbarWordmarkUrl: legacyNavbarWordmark,
      footerWordmarkUrl: legacyFooterWordmark,
      wordmarkEnabled: legacyWordmarkEnabled,
      wordmarkPlacement: legacyWordmarkPlacement,
    },
    assets: {
      symbolUrl: symbolAssetUrl,
      wordmarkUrl: wordmarkAssetUrl,
    },
    overrides: {
      navbarSymbolUrl: navbarSymbolOverrideDirect,
      footerSymbolUrl: footerSymbolOverrideDirect,
      navbarWordmarkUrl: navbarWordmarkOverrideDirect,
      footerWordmarkUrl: footerWordmarkOverrideDirect,
    },
    display: {
      navbar: navbarMode,
      footer: footerMode,
    },
    navbar: {
      mode: navbarMode,
      symbolUrl: navbarSymbolUrl,
      wordmarkUrl: navbarWordmarkUrl,
      showWordmark: navbarMode === "wordmark" && Boolean(navbarWordmarkUrl),
    },
    footer: {
      mode: footerMode,
      symbolUrl: footerSymbolUrl,
      wordmarkUrl: footerWordmarkUrl,
      showWordmark: footerMode === "wordmark" && Boolean(footerWordmarkUrl),
    },
  };
};
