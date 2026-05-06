type RoutePreloadMap = Record<string, () => Promise<{ default: React.ComponentType<any> }>>;

const routePreloadMap: RoutePreloadMap = {
  "/dashboard": () => import("@/pages/Dashboard"),
  "/dashboard/usuarios": () => import("@/pages/DashboardUsers"),
  "/dashboard/posts": () => import("@/pages/DashboardPosts"),
  "/dashboard/projetos": () => import("@/pages/DashboardProjectsEditor"),
  "/dashboard/comentarios": () => import("@/pages/DashboardComments"),
  "/dashboard/uploads": () => import("@/pages/DashboardUploads"),
  "/dashboard/analytics": () => import("@/pages/DashboardAnalytics"),
  "/dashboard/audit-log": () => import("@/pages/DashboardAuditLog"),
  "/dashboard/paginas": () => import("@/pages/DashboardPages"),
  "/dashboard/configuracoes": () => import("@/pages/DashboardSettings"),
  "/dashboard/redirecionamentos": () => import("@/pages/DashboardRedirects"),
  "/dashboard/webhooks": () => import("@/pages/DashboardWebhooks"),
  "/dashboard/seguranca": () => import("@/pages/DashboardSecurity"),
};

export const preloadRoute = (path: string) => {
  const sortedKeys = Object.keys(routePreloadMap).sort((a, b) => b.length - a.length);
  const matchedKey = sortedKeys.find((key) => path.startsWith(key));
  if (matchedKey) {
    routePreloadMap[matchedKey]().catch(() => {});
  }
};
