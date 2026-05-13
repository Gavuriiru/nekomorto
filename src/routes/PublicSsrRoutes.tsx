import { Suspense } from "react";

import AppLoadingFallback from "@/components/AppLoadingFallback";
import About from "@/pages/About";
import Donations from "@/pages/Donations";
import FAQ from "@/pages/FAQ";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Post from "@/pages/Post";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import Project from "@/pages/Project";
import ProjectReading from "@/pages/ProjectReading";
import Projects from "@/pages/Projects";
import Recruitment from "@/pages/Recruitment";
import Team from "@/pages/Team";
import TermsOfService from "@/pages/TermsOfService";

import { renderPublicRouteTree } from "./public-route-tree";

const RouteLoadingFallback = () => <AppLoadingFallback label="Carregando..." />;

const PublicSsrRoutes = () => (
  <Suspense fallback={<RouteLoadingFallback />}>
    {renderPublicRouteTree({
      About,
      Donations,
      FAQ,
      Index,
      Login,
      NotFound,
      Post,
      PrivacyPolicy,
      Project,
      ProjectReading,
      Projects,
      Recruitment,
      Team,
      TermsOfService,
    })}
  </Suspense>
);

export default PublicSsrRoutes;
