import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";
import { PublicBootstrapProvider } from "@/hooks/public-bootstrap-provider";
import { SiteSettingsProvider } from "@/hooks/site-settings-provider";
import { ThemeModeProvider } from "@/hooks/theme-mode-provider";
import type { ReactNode } from "react";

export const AppProviders = ({
  children,
  initialCurrentUser,
  initialPublicBootstrap,
  initialSettings,
  initiallyLoaded,
}: {
  children: ReactNode;
  initialCurrentUser?: unknown;
  initialPublicBootstrap?: unknown;
  initialSettings?: Parameters<typeof SiteSettingsProvider>[0]["initialSettings"];
  initiallyLoaded?: boolean;
}) => (
  <PublicBootstrapProvider
    initialCurrentUser={initialCurrentUser}
    initialPublicBootstrap={initialPublicBootstrap}
  >
    <SiteSettingsProvider initialSettings={initialSettings} initiallyLoaded={initiallyLoaded}>
      <ThemeModeProvider>
        <AccessibilityAnnouncerProvider>{children}</AccessibilityAnnouncerProvider>
      </ThemeModeProvider>
    </SiteSettingsProvider>
  </PublicBootstrapProvider>
);
