import { lazy } from "react";

import Index from "@/pages/Index";

import { renderPublicRouteTree } from "./public-route-tree";

const About = lazy(() => import("@/pages/About"));
const Donations = lazy(() => import("@/pages/Donations"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Login = lazy(() => import("@/pages/Login"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Post = lazy(() => import("@/pages/Post"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const Project = lazy(() => import("@/pages/Project"));
const ProjectReading = lazy(() => import("@/pages/ProjectReading"));
const Projects = lazy(() => import("@/pages/Projects"));
const Recruitment = lazy(() => import("@/pages/Recruitment"));
const Team = lazy(() => import("@/pages/Team"));
const TermsOfService = lazy(() => import("@/pages/TermsOfService"));

const PublicRoutes = () =>
  renderPublicRouteTree({
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
  });

export default PublicRoutes;
