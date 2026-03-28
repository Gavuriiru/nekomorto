import type { ReactNode } from "react";

import type { useDashboardSettingsMedia } from "@/components/dashboard/settings/use-dashboard-settings-media";
import type { useDashboardSettingsResource } from "@/components/dashboard/settings/use-dashboard-settings-resource";

import type {
  FooterBrandMode,
  type LogoEditorField,
  NavbarBrandMode,
} from "./shared";

type DashboardSettingsPreviewContext = {
  footerBrandNamePreview: string;
  footerBrandNameUpperPreview: string;
  footerMode: FooterBrandMode;
  navbarMode: NavbarBrandMode;
  navbarPreviewFallbackClass: string;
  navbarPreviewShellClass: string;
  renderLogoEditorCards: (fields: LogoEditorField[]) => ReactNode;
  resolvedFooterSymbolUrl: string;
  resolvedFooterWordmarkUrl: string;
  resolvedNavbarSymbolUrl: string;
  resolvedNavbarWordmarkUrl: string;
  showNavbarSymbolPreview: boolean;
  showNavbarTextPreview: boolean;
  showWordmarkInFooterPreview: boolean;
  showWordmarkInNavbarPreview: boolean;
  siteNamePreview: string;
};

export type DashboardSettingsContextValue = ReturnType<typeof useDashboardSettingsResource> &
  ReturnType<typeof useDashboardSettingsMedia> &
  DashboardSettingsPreviewContext;
