import { AppProviders } from "@/components/AppProviders";
import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import type { SiteSettings } from "@/types/site-settings";
import type { ReactNode } from "react";

export interface PublicHydratedPageProps {
  children: ReactNode;
  initialCurrentUser?: unknown;
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  initialSettings?: SiteSettings | null;
}

const PublicHydratedPage = ({
  children,
  initialCurrentUser,
  initialPublicBootstrap,
  initialPublicRoutePayload,
  initialSettings,
}: PublicHydratedPageProps) => (
  <AppProviders
    initialCurrentUser={initialCurrentUser}
    initialPublicBootstrap={initialPublicBootstrap}
    initialPublicRoutePayload={initialPublicRoutePayload}
    initialSettings={initialSettings ?? initialPublicBootstrap?.settings}
    initiallyLoaded={Boolean(initialSettings ?? initialPublicBootstrap?.settings)}
  >
    {children}
  </AppProviders>
);

export default PublicHydratedPage;
