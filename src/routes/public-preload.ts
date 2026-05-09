type RoutePreloadMap = Record<string, () => Promise<{ default: React.ComponentType<any> }>>;

const routePreloadMap: RoutePreloadMap = {
  "/": () => import("@/pages/Index"),
  "/postagem": () => import("@/pages/Post"),
  "/equipe": () => import("@/pages/Team"),
  "/sobre": () => import("@/pages/About"),
  "/doacoes": () => import("@/pages/Donations"),
  "/faq": () => import("@/pages/FAQ"),
  "/projetos": () => import("@/pages/Projects"),
  "/projeto": () => import("@/pages/Project"),
  "/recrutamento": () => import("@/pages/Recruitment"),
  "/termos-de-uso": () => import("@/pages/TermsOfService"),
  "/politica-de-privacidade": () => import("@/pages/PrivacyPolicy"),
  "/login": () => import("@/pages/Login"),
};

export const preloadPublicRoute = (path: string) => {
  const sortedKeys = Object.keys(routePreloadMap).sort((a, b) => b.length - a.length);
  const matchedKey = sortedKeys.find((key) => path === key || path.startsWith(key + "/"));
  if (matchedKey) {
    routePreloadMap[matchedKey]().catch(() => {});
  }
};