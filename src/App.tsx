import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy, useLayoutEffect } from "react";
import { SiteSettingsProvider } from "@/hooks/site-settings-provider";
import { ThemeModeProvider } from "@/hooks/theme-mode-provider";
import { GlobalShortcutsProvider } from "@/hooks/global-shortcuts-provider";
import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";
import { useReveal } from "@/hooks/use-reveal";

const PublicRoutes = lazy(() => import("./routes/PublicRoutes"));
const DashboardRoutes = lazy(() => import("./routes/DashboardRoutes"));

export const queryClient = new QueryClient();

const RouteLoadingFallback = () => <div aria-hidden="true" className="min-h-[55vh] w-full" />;

const ScrollToTop = () => {
  const location = useLocation();

  useLayoutEffect(() => {
    const normalizedHash = String(location.hash || "")
      .replace(/^#/, "")
      .trim();
    if (!normalizedHash) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
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
      target.scrollIntoView({ behavior: "auto", block: "start" });
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
  }, [location.hash, location.pathname, location.search]);

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

const App = ({
  initialSettings,
  initiallyLoaded,
}: {
  initialSettings?: Parameters<typeof SiteSettingsProvider>[0]["initialSettings"];
  initiallyLoaded?: boolean;
}) => (
  <QueryClientProvider client={queryClient}>
    <SiteSettingsProvider initialSettings={initialSettings} initiallyLoaded={initiallyLoaded}>
      <ThemeModeProvider>
        <AccessibilityAnnouncerProvider>
          <TooltipProvider>
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <GlobalShortcutsProvider>
                <ScrollToTop />
                <RouterShell />
              </GlobalShortcutsProvider>
            </BrowserRouter>
          </TooltipProvider>
        </AccessibilityAnnouncerProvider>
      </ThemeModeProvider>
    </SiteSettingsProvider>
  </QueryClientProvider>
);

export default App;
