import type { ComponentType } from "react";

import {
  PUBLIC_ROUTE_KIND_ABOUT,
  PUBLIC_ROUTE_KIND_DONATIONS,
  PUBLIC_ROUTE_KIND_FAQ,
  PUBLIC_ROUTE_KIND_HOME,
  PUBLIC_ROUTE_KIND_LOGIN,
  PUBLIC_ROUTE_KIND_NOT_FOUND,
  PUBLIC_ROUTE_KIND_POST,
  PUBLIC_ROUTE_KIND_PRIVACY,
  PUBLIC_ROUTE_KIND_PROJECT_DETAIL,
  PUBLIC_ROUTE_KIND_PROJECT_READING,
  PUBLIC_ROUTE_KIND_PROJECTS_LIST,
  PUBLIC_ROUTE_KIND_RECRUITMENT,
  PUBLIC_ROUTE_KIND_TEAM,
  PUBLIC_ROUTE_KIND_TERMS,
  PUBLIC_ROUTE_MODULE_IDS,
  resolvePublicRouteKind,
} from "../../shared/public-route-registry.js";

type PublicRouteModule = {
  default: ComponentType;
};

export type PublicRouteKind =
  | typeof PUBLIC_ROUTE_KIND_HOME
  | typeof PUBLIC_ROUTE_KIND_POST
  | typeof PUBLIC_ROUTE_KIND_TEAM
  | typeof PUBLIC_ROUTE_KIND_ABOUT
  | typeof PUBLIC_ROUTE_KIND_DONATIONS
  | typeof PUBLIC_ROUTE_KIND_FAQ
  | typeof PUBLIC_ROUTE_KIND_PROJECTS_LIST
  | typeof PUBLIC_ROUTE_KIND_PROJECT_DETAIL
  | typeof PUBLIC_ROUTE_KIND_PROJECT_READING
  | typeof PUBLIC_ROUTE_KIND_RECRUITMENT
  | typeof PUBLIC_ROUTE_KIND_TERMS
  | typeof PUBLIC_ROUTE_KIND_PRIVACY
  | typeof PUBLIC_ROUTE_KIND_LOGIN
  | typeof PUBLIC_ROUTE_KIND_NOT_FOUND;

export const publicRouteModuleIds = PUBLIC_ROUTE_MODULE_IDS;

export const publicRouteLoaders: Record<PublicRouteKind, () => Promise<PublicRouteModule>> = {
  [PUBLIC_ROUTE_KIND_HOME]: () => import("@/pages/Index"),
  [PUBLIC_ROUTE_KIND_POST]: () => import("@/pages/Post"),
  [PUBLIC_ROUTE_KIND_TEAM]: () => import("@/pages/Team"),
  [PUBLIC_ROUTE_KIND_ABOUT]: () => import("@/pages/About"),
  [PUBLIC_ROUTE_KIND_DONATIONS]: () => import("@/pages/Donations"),
  [PUBLIC_ROUTE_KIND_FAQ]: () => import("@/pages/FAQ"),
  [PUBLIC_ROUTE_KIND_PROJECTS_LIST]: () => import("@/pages/Projects"),
  [PUBLIC_ROUTE_KIND_PROJECT_DETAIL]: () => import("@/pages/Project"),
  [PUBLIC_ROUTE_KIND_PROJECT_READING]: () => import("@/pages/ProjectReading"),
  [PUBLIC_ROUTE_KIND_RECRUITMENT]: () => import("@/pages/Recruitment"),
  [PUBLIC_ROUTE_KIND_TERMS]: () => import("@/pages/TermsOfService"),
  [PUBLIC_ROUTE_KIND_PRIVACY]: () => import("@/pages/PrivacyPolicy"),
  [PUBLIC_ROUTE_KIND_LOGIN]: () => import("@/pages/Login"),
  [PUBLIC_ROUTE_KIND_NOT_FOUND]: () => import("@/pages/NotFound"),
};

export const resolvePublicRouteLoader = (pathname: string) => {
  const routeKind = resolvePublicRouteKind(pathname) as PublicRouteKind;
  return publicRouteLoaders[routeKind] || publicRouteLoaders[PUBLIC_ROUTE_KIND_NOT_FOUND];
};

export { resolvePublicRouteKind };
