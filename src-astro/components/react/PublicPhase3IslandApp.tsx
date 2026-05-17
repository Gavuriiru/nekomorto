import { AppProviders } from "@/components/AppProviders";
import ScrollToTop from "@/components/ScrollToTop";
import { GlobalShortcutsProvider } from "@/hooks/global-shortcuts-provider";
import { useReveal } from "@/hooks/use-reveal";
import Index from "@/pages/Index";
import Post from "@/pages/Post";
import Project from "@/pages/Project";
import Projects from "@/pages/Projects";
import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
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

const Phase3Routes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/projetos" element={<Projects />} />
    <Route path="/projeto/:slug" element={<Project />} />
    <Route path="/postagem/:slug" element={<Post />} />
    <Route path="*" element={<FullReloadFallback />} />
  </Routes>
);

const Phase3RouteShell = () => {
  useReveal();

  return (
    <GlobalShortcutsProvider>
      <ScrollToTop />
      <Phase3Routes />
    </GlobalShortcutsProvider>
  );
};

interface PublicPhase3IslandAppProps {
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  location: string;
}

const PublicPhase3IslandApp = ({
  initialPublicBootstrap,
  initialPublicRoutePayload,
  location,
}: PublicPhase3IslandAppProps) => {
  const content = (
    <AppProviders
      initialPublicBootstrap={initialPublicBootstrap}
      initialPublicRoutePayload={initialPublicRoutePayload}
      initialSettings={initialPublicBootstrap?.settings}
      initiallyLoaded={Boolean(initialPublicBootstrap?.settings)}
    >
      <Phase3RouteShell />
    </AppProviders>
  );

  if (typeof window === "undefined") {
    return <StaticRouter location={location}>{content}</StaticRouter>;
  }

  return <BrowserRouter>{content}</BrowserRouter>;
};

export default PublicPhase3IslandApp;
