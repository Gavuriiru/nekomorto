import { AppProviders } from "@/components/AppProviders";
import ScrollToTop from "@/components/ScrollToTop";
import { GlobalShortcutsProvider } from "@/hooks/global-shortcuts-provider";
import { useReveal } from "@/hooks/use-reveal";
import PublicSsrRoutes from "@/routes/PublicSsrRoutes";
import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";

const PublicSsrRouteShell = () => {
  useReveal();

  return (
    <GlobalShortcutsProvider>
      <ScrollToTop />
      <PublicSsrRoutes />
    </GlobalShortcutsProvider>
  );
};

export const renderPublicApp = ({
  initialCurrentUser,
  initialPublicBootstrap,
  initialPublicRoutePayload,
  pathname,
}: {
  initialCurrentUser?: unknown;
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  pathname: string;
}) =>
  renderToString(
    <AppProviders
      initialCurrentUser={initialCurrentUser}
      initialPublicBootstrap={initialPublicBootstrap}
      initialPublicRoutePayload={initialPublicRoutePayload}
      initialSettings={initialPublicBootstrap?.settings}
      initiallyLoaded={Boolean(initialPublicBootstrap?.settings)}
    >
      <StaticRouter location={pathname}>
        <PublicSsrRouteShell />
      </StaticRouter>
    </AppProviders>,
  );

export default renderPublicApp;
