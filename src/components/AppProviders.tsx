import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";
import { PublicBootstrapProvider } from "@/hooks/public-bootstrap-provider";
import { SiteSettingsProvider } from "@/hooks/site-settings-provider";
import { ThemeModeProvider } from "@/hooks/theme-mode-provider";
import type { ReactNode } from "react";

export const AppProviders = ({
  children,
  initialCurrentUser,
  initialPublicBootstrap,
  initialPublicRoutePayload,
  initialSettings,
  initiallyLoaded,
}: {
  children: ReactNode;
  initialCurrentUser?: unknown;
  initialPublicBootstrap?: unknown;
  initialPublicRoutePayload?: unknown;
  initialSettings?: Parameters<typeof SiteSettingsProvider>[0]["initialSettings"];
  initiallyLoaded?: boolean;
}) => (
  <PublicBootstrapProvider
    initialCurrentUser={initialCurrentUser}
    initialPublicBootstrap={initialPublicBootstrap}
    initialPublicRoutePayload={initialPublicRoutePayload}
  >
    <SiteSettingsProvider initialSettings={initialSettings} initiallyLoaded={initiallyLoaded}>
      <ThemeModeProvider>
        <AccessibilityAnnouncerProvider>{children}</AccessibilityAnnouncerProvider>
      </ThemeModeProvider>
    </SiteSettingsProvider>
  </PublicBootstrapProvider>
);
