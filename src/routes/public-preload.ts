import { PUBLIC_ROUTE_KIND_NOT_FOUND } from "../../shared/public-route-registry.js";
import { resolvePublicRouteKind, publicRouteLoaders } from "./public-route-registry";

const normalizePublicPrefetchPath = (value: string) => {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/")) {
    return "";
  }
  return normalized;
};

const preloadedPublicRouteKinds = new Set<string>();

export const preloadPublicRoute = (path: string) => {
  const normalizedPath = normalizePublicPrefetchPath(path);
  if (!normalizedPath) {
    return;
  }
  const routeKind = resolvePublicRouteKind(normalizedPath);
  if (routeKind === PUBLIC_ROUTE_KIND_NOT_FOUND || preloadedPublicRouteKinds.has(routeKind)) {
    return;
  }
  const loadRoute = publicRouteLoaders[routeKind];
  if (typeof loadRoute !== "function") {
    return;
  }
  preloadedPublicRouteKinds.add(routeKind);
  void loadRoute().catch(() => {
    preloadedPublicRouteKinds.delete(routeKind);
  });
};
