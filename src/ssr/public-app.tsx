import { AppProviders } from "@/components/AppProviders";
import ScrollToTop from "@/components/ScrollToTop";
import { GlobalShortcutsProvider } from "@/hooks/global-shortcuts-provider";
import { useReveal } from "@/hooks/use-reveal";
import PublicSsrRoutes from "@/routes/PublicSsrRoutes";
import type { PublicBootstrapPayload } from "@/types/public-bootstrap";
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
  pathname,
}: {
  initialCurrentUser?: unknown;
  initialPublicBootstrap: PublicBootstrapPayload | null;
  pathname: string;
}) =>
  renderToString(
    <AppProviders
      initialCurrentUser={initialCurrentUser}
      initialPublicBootstrap={initialPublicBootstrap}
      initialSettings={initialPublicBootstrap?.settings}
      initiallyLoaded={Boolean(initialPublicBootstrap?.settings)}
    >
      <StaticRouter location={pathname}>
        <PublicSsrRouteShell />
      </StaticRouter>
    </AppProviders>,
  );

export default renderPublicApp;
