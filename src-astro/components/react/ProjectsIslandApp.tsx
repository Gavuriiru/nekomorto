import { AppProviders } from "@/components/AppProviders";
import Projects from "@/pages/Projects";
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

const ProjectsRoutes = () => (
  <Routes>
    <Route path="/projetos" element={<Projects />} />
    <Route path="*" element={<FullReloadFallback />} />
  </Routes>
);

interface ProjectsIslandAppProps {
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  initialSettings?: SiteSettings | null;
  location: string;
}

const ProjectsIslandApp = ({
  initialPublicBootstrap,
  initialPublicRoutePayload,
  initialSettings,
  location,
}: ProjectsIslandAppProps) => {
  const content = (
    <AppProviders
      initialPublicBootstrap={initialPublicBootstrap}
      initialPublicRoutePayload={initialPublicRoutePayload}
      initialSettings={initialSettings ?? initialPublicBootstrap?.settings}
      initiallyLoaded={Boolean(initialSettings ?? initialPublicBootstrap?.settings)}
    >
      <ProjectsRoutes />
    </AppProviders>
  );

  if (typeof window === "undefined") {
    return <StaticRouter location={location}>{content}</StaticRouter>;
  }

  return <BrowserRouter>{content}</BrowserRouter>;
};

export default ProjectsIslandApp;
