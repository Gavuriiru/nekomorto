import { lazy } from "react";
import type { ReactNode } from "react";
import { Route, Routes } from "react-router-dom";

const RequireAuth = lazy(() => import("@/components/RequireAuth"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const DashboardUsers = lazy(() => import("@/pages/DashboardUsers"));
const DashboardPosts = lazy(() => import("@/pages/DashboardPosts"));
const DashboardProjectsEditor = lazy(() => import("@/pages/DashboardProjectsEditor"));
const DashboardProjectChapterEditor = lazy(() => import("@/pages/DashboardProjectChapterEditor"));
const DashboardComments = lazy(() => import("@/pages/DashboardComments"));
const DashboardUploads = lazy(() => import("@/pages/DashboardUploads"));
const DashboardAuditLog = lazy(() => import("@/pages/DashboardAuditLog"));
const DashboardAnalytics = lazy(() => import("@/pages/DashboardAnalytics"));
const DashboardPages = lazy(() => import("@/pages/DashboardPages"));
const DashboardSettings = lazy(() => import("@/pages/DashboardSettings"));
const DashboardRedirects = lazy(() => import("@/pages/DashboardRedirects"));
const DashboardWebhooks = lazy(() => import("@/pages/DashboardWebhooks"));
const DashboardSecurity = lazy(() => import("@/pages/DashboardSecurity"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const PageTransition = ({ children }: { children: ReactNode }) => (
  <div className="page-transition">{children}</div>
);

const withAuth = (page: ReactNode) => (
  <PageTransition>
    <RequireAuth>{page}</RequireAuth>
  </PageTransition>
);

const DashboardRoutes = () => (
  <Routes>
    <Route index element={withAuth(<Dashboard />)} />
    <Route path="usuarios" element={withAuth(<DashboardUsers />)} />
    <Route path="posts" element={withAuth(<DashboardPosts />)} />
    <Route path="projetos" element={withAuth(<DashboardProjectsEditor />)} />
    <Route
      path="projetos/:projectId/capitulos"
      element={withAuth(<DashboardProjectChapterEditor />)}
    />
    <Route
      path="projetos/:projectId/capitulos/:chapterNumber"
      element={withAuth(<DashboardProjectChapterEditor />)}
    />
    <Route path="comentarios" element={withAuth(<DashboardComments />)} />
    <Route path="uploads" element={withAuth(<DashboardUploads />)} />
    <Route path="analytics" element={withAuth(<DashboardAnalytics />)} />
    <Route path="audit-log" element={withAuth(<DashboardAuditLog />)} />
    <Route path="paginas" element={withAuth(<DashboardPages />)} />
    <Route path="configuracoes" element={withAuth(<DashboardSettings />)} />
    <Route path="redirecionamentos" element={withAuth(<DashboardRedirects />)} />
    <Route path="webhooks" element={withAuth(<DashboardWebhooks />)} />
    <Route path="seguranca" element={withAuth(<DashboardSecurity />)} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

export default DashboardRoutes;
