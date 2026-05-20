import { useEffect } from "react";

import About from "@/pages/About";
import Donations from "@/pages/Donations";
import FAQ from "@/pages/FAQ";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Post from "@/pages/Post";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import Project from "@/pages/Project";
import Projects from "@/pages/Projects";
import Recruitment from "@/pages/Recruitment";
import Team from "@/pages/Team";
import TermsOfService from "@/pages/TermsOfService";
import { usePublicDocumentLocation } from "@/lib/public-document-navigation";
import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import type { SiteSettings } from "@/types/site-settings";
import {
  PUBLIC_ROUTE_KIND_ABOUT,
  PUBLIC_ROUTE_KIND_DONATIONS,
  PUBLIC_ROUTE_KIND_FAQ,
  PUBLIC_ROUTE_KIND_HOME,
  PUBLIC_ROUTE_KIND_LOGIN,
  PUBLIC_ROUTE_KIND_POST,
  PUBLIC_ROUTE_KIND_PRIVACY,
  PUBLIC_ROUTE_KIND_PROJECT_DETAIL,
  PUBLIC_ROUTE_KIND_PROJECTS_LIST,
  PUBLIC_ROUTE_KIND_RECRUITMENT,
  PUBLIC_ROUTE_KIND_TEAM,
  PUBLIC_ROUTE_KIND_TERMS,
  resolvePublicRouteKind,
} from "../../../shared/public-route-registry.js";
import PublicHydratedPage from "./PublicHydratedPage";

interface PublicSiteIslandAppProps {
  initialCurrentUser?: unknown;
  initialPath?: string;
  initialProjectSlug?: string;
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  initialSettings?: SiteSettings | null;
  staticProjectHeroId?: string;
}

const resolveProjectSlugFromPath = (pathname: string) => {
  const match = String(pathname || "").match(/^\/projeto(?:s)?\/([^/]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
};

const PublicSiteIslandApp = ({
  initialCurrentUser,
  initialPath = "/",
  initialProjectSlug = "",
  initialPublicBootstrap,
  initialPublicRoutePayload,
  initialSettings,
  staticProjectHeroId = "",
}: PublicSiteIslandAppProps) => {
  const location = usePublicDocumentLocation(initialPath);
  const pathname = location.pathname || "/";
  const routeKind = resolvePublicRouteKind(pathname);
  const currentProjectSlug = resolveProjectSlugFromPath(pathname);
  const shouldUseStaticProjectHero = Boolean(
    staticProjectHeroId &&
      initialProjectSlug &&
      currentProjectSlug &&
      currentProjectSlug === initialProjectSlug,
  );

  useEffect(() => {
    document.documentElement.dataset.clientRouteMeta = "public-site";
    return () => {
      delete document.documentElement.dataset.clientRouteMeta;
    };
  }, []);

  useEffect(() => {
    if (!staticProjectHeroId) {
      return;
    }
    const heroRoot = document.getElementById(staticProjectHeroId);
    if (!heroRoot) {
      return;
    }
    heroRoot.hidden = !shouldUseStaticProjectHero;
    return () => {
      heroRoot.hidden = false;
    };
  }, [shouldUseStaticProjectHero, staticProjectHeroId]);

  return (
    <PublicHydratedPage
      initialCurrentUser={initialCurrentUser}
      initialPublicBootstrap={initialPublicBootstrap}
      initialPublicRoutePayload={initialPublicRoutePayload}
      initialSettings={initialSettings}
    >
      {routeKind === PUBLIC_ROUTE_KIND_HOME ? (
        <Index />
      ) : routeKind === PUBLIC_ROUTE_KIND_PROJECTS_LIST ? (
        <Projects />
      ) : routeKind === PUBLIC_ROUTE_KIND_PROJECT_DETAIL ? (
        <Project renderHero={!shouldUseStaticProjectHero} slug={currentProjectSlug} />
      ) : routeKind === PUBLIC_ROUTE_KIND_POST ? (
        <Post />
      ) : routeKind === PUBLIC_ROUTE_KIND_TEAM ? (
        <Team />
      ) : routeKind === PUBLIC_ROUTE_KIND_ABOUT ? (
        <About />
      ) : routeKind === PUBLIC_ROUTE_KIND_DONATIONS ? (
        <Donations />
      ) : routeKind === PUBLIC_ROUTE_KIND_FAQ ? (
        <FAQ />
      ) : routeKind === PUBLIC_ROUTE_KIND_RECRUITMENT ? (
        <Recruitment />
      ) : routeKind === PUBLIC_ROUTE_KIND_TERMS ? (
        <TermsOfService />
      ) : routeKind === PUBLIC_ROUTE_KIND_PRIVACY ? (
        <PrivacyPolicy />
      ) : routeKind === PUBLIC_ROUTE_KIND_LOGIN ? (
        <Login />
      ) : null}
    </PublicHydratedPage>
  );
};

export default PublicSiteIslandApp;
