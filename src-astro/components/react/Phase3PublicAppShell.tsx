import { AppProviders } from "@/components/AppProviders";
import ScrollToTop from "@/components/ScrollToTop";
import { GlobalShortcutsProvider } from "@/hooks/global-shortcuts-provider";
import { useReveal } from "@/hooks/use-reveal";
import Index from "@/pages/Index";
import Post from "@/pages/Post";
import Project from "@/pages/Project";
import Projects from "@/pages/Projects";
import { Phase3PublicNavigationProvider } from "@/routes/public-phase3-navigation";
import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import type { SiteSettings } from "@/types/site-settings";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, StaticRouter, useLocation } from "react-router-dom";

const FullReloadFallback = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const target = `${location.pathname}${location.search}${location.hash}`;
    window.location.assign(target);
  }, [location.hash, location.pathname, location.search]);

  return null;
};

export const Phase3Routes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/projetos" element={<Projects />} />
    <Route path="/projeto/:slug" element={<Project />} />
    <Route path="/postagem/:slug" element={<Post />} />
    <Route path="*" element={<FullReloadFallback />} />
  </Routes>
);

export const Phase3RouteShell = () => {
  useReveal();

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    const previousMode = root.dataset.clientRouteMeta;
    root.dataset.clientRouteMeta = "phase3";
    return () => {
      if (previousMode) {
        root.dataset.clientRouteMeta = previousMode;
        return;
      }
      delete root.dataset.clientRouteMeta;
    };
  }, []);

  return (
    <GlobalShortcutsProvider>
      <ScrollToTop />
      <Phase3Routes />
    </GlobalShortcutsProvider>
  );
};

export interface Phase3PublicAppShellProps {
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  initialSettings?: SiteSettings | null;
  location: string;
}

const Phase3PublicAppShell = ({
  initialPublicBootstrap,
  initialPublicRoutePayload,
  initialSettings,
  location,
}: Phase3PublicAppShellProps) => {
  const content = (
    <AppProviders
      initialPublicBootstrap={initialPublicBootstrap}
      initialPublicRoutePayload={initialPublicRoutePayload}
      initialSettings={initialSettings ?? initialPublicBootstrap?.settings}
      initiallyLoaded={Boolean(initialSettings ?? initialPublicBootstrap?.settings)}
    >
      <Phase3PublicNavigationProvider>
        <Phase3RouteShell />
      </Phase3PublicNavigationProvider>
    </AppProviders>
  );

  if (typeof window === "undefined") {
    return <StaticRouter location={location}>{content}</StaticRouter>;
  }

  return <BrowserRouter>{content}</BrowserRouter>;
};

export default Phase3PublicAppShell;
