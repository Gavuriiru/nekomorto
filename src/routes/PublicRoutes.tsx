import { lazy } from "react";

import Index from "@/pages/Index";

import { publicRouteLoaders } from "./public-route-registry";
import { renderPublicRouteTree } from "./public-route-tree";

const About = lazy(publicRouteLoaders.about);
const Donations = lazy(publicRouteLoaders.donations);
const FAQ = lazy(publicRouteLoaders.faq);
const Login = lazy(publicRouteLoaders.login);
const NotFound = lazy(publicRouteLoaders["not-found"]);
const Post = lazy(publicRouteLoaders.post);
const PrivacyPolicy = lazy(publicRouteLoaders.privacy);
const Project = lazy(publicRouteLoaders["project-detail"]);
const ProjectReading = lazy(publicRouteLoaders["project-reading"]);
const Projects = lazy(publicRouteLoaders["projects-list"]);
const Recruitment = lazy(publicRouteLoaders.recruitment);
const Team = lazy(publicRouteLoaders.team);
const TermsOfService = lazy(publicRouteLoaders.terms);

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
