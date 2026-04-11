import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useLayoutEffect, useState } from "react";
import { SiteSettingsProvider } from "@/hooks/site-settings-provider";
import { ThemeModeProvider } from "@/hooks/theme-mode-provider";
import { GlobalShortcutsProvider } from "@/hooks/global-shortcuts-provider";
import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";
import { useReveal } from "@/hooks/use-reveal";
import { scheduleOnBrowserLoadIdle } from "@/lib/browser-idle";

import PublicRoutes from "./routes/PublicRoutes";
const DashboardRoutes = lazy(() => import("./routes/DashboardRoutes"));
const DeferredSonner = lazy(() =>
  import("@/components/ui/sonner").then((module) => ({ default: module.Toaster })),
);

const RouteLoadingFallback = () => <div aria-hidden="true" className="min-h-[55vh] w-full" />;

export const ScrollToTop = () => {
  const location = useLocation();

  useLayoutEffect(() => {
    const locationState =
      typeof location.state === "object" && location.state !== null
        ? (location.state as { preserveScroll?: boolean })
        : null;
    const shouldPreserveScroll = locationState?.preserveScroll === true;
    const normalizedHash = String(location.hash || "")
      .replace(/^#/, "")
      .trim();
    if (!normalizedHash) {
      if (!shouldPreserveScroll) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      return;
    }

    const findTarget = () => {
      if (!normalizedHash) {
        return null;
      }
      const byId = document.getElementById(normalizedHash);
      if (byId) {
        return byId;
      }
      const decoded = decodeURIComponent(normalizedHash);
      return document.getElementById(decoded);
    };

    const scrollToHash = () => {
      const target = findTarget();
      if (!target) {
        return false;
      }
      const scrollBlock = target.getAttribute("data-scroll-block") === "center" ? "center" : "start";
      target.scrollIntoView({ behavior: "auto", block: scrollBlock });
      return true;
    };

    if (scrollToHash()) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      if (!scrollToHash()) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [location.hash, location.pathname, location.search, location.state]);

  return null;
};

const RouterShell = () => {
  const location = useLocation();
  useReveal();
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes location={location}>
        <Route path="/dashboard/*" element={<DashboardRoutes />} />
        <Route path="*" element={<PublicRoutes />} />
      </Routes>
    </Suspense>
  );
};

const DeferredToaster = () => {
  const [shouldRenderToaster, setShouldRenderToaster] = useState(false);

  useEffect(() => {
    const cancelIdle = scheduleOnBrowserLoadIdle(
      () => {
        setShouldRenderToaster(true);
      },
      { delayMs: 4000 },
    );
    return cancelIdle;
  }, []);

  if (!shouldRenderToaster) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <DeferredSonner />
    </Suspense>
  );
};

const App = ({
  initialSettings,
  initiallyLoaded,
}: {
  initialSettings?: Parameters<typeof SiteSettingsProvider>[0]["initialSettings"];
  initiallyLoaded?: boolean;
}) => (
  <SiteSettingsProvider initialSettings={initialSettings} initiallyLoaded={initiallyLoaded}>
    <ThemeModeProvider>
      <AccessibilityAnnouncerProvider>
        <DeferredToaster />
        <BrowserRouter>
          <GlobalShortcutsProvider>
            <ScrollToTop />
            <RouterShell />
          </GlobalShortcutsProvider>
        </BrowserRouter>
      </AccessibilityAnnouncerProvider>
    </ThemeModeProvider>
  </SiteSettingsProvider>
);

export default App;
