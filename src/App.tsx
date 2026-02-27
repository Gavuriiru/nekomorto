import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Suspense, lazy, useLayoutEffect } from "react";
import { SiteSettingsProvider } from "@/hooks/site-settings-provider";
import { ThemeModeProvider } from "@/hooks/theme-mode-provider";
import { useReveal } from "@/hooks/use-reveal";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Post = lazy(() => import("./pages/Post"));
const Project = lazy(() => import("./pages/Project"));
const ProjectReading = lazy(() => import("./pages/ProjectReading"));
const Projects = lazy(() => import("./pages/Projects"));
const Team = lazy(() => import("./pages/Team"));
const About = lazy(() => import("./pages/About"));
const Donations = lazy(() => import("./pages/Donations"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const RequireAuth = lazy(() => import("./components/RequireAuth"));
const DashboardUsers = lazy(() => import("./pages/DashboardUsers"));
const DashboardPosts = lazy(() => import("./pages/DashboardPosts"));
const DashboardProjectsEditor = lazy(() => import("./pages/DashboardProjectsEditor"));
const DashboardComments = lazy(() => import("./pages/DashboardComments"));
const DashboardAuditLog = lazy(() => import("./pages/DashboardAuditLog"));
const DashboardAnalytics = lazy(() => import("./pages/DashboardAnalytics"));
const DashboardPages = lazy(() => import("./pages/DashboardPages"));
const DashboardSettings = lazy(() => import("./pages/DashboardSettings"));
const DashboardWebhooks = lazy(() => import("./pages/DashboardWebhooks"));
const DashboardSecurity = lazy(() => import("./pages/DashboardSecurity"));
const Recruitment = lazy(() => import("./pages/Recruitment"));
const PublicLayout = lazy(() => import("./components/PublicLayout"));

export const queryClient = new QueryClient();

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <div className="page-transition">{children}</div>
);

const RouteLoadingFallback = () => <div aria-hidden="true" className="min-h-[55vh] w-full" />;

const ScrollToTop = () => {
  const location = useLocation();

  useLayoutEffect(() => {
    const normalizedHash = String(location.hash || "").replace(/^#/, "").trim();
    if (!normalizedHash) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    const findTarget = () => {
      if (!normalizedHash) {
        return null;
      }
      const byId = document.getElementById(normalizedHash);
      if (byId) {
        return byId;
      }
      const decoded = decodeURIComponent(normalizedHash);
      return document.getElementById(decoded);
    };

    const scrollToHash = () => {
      const target = findTarget();
      if (!target) {
        return false;
      }
      target.scrollIntoView({ behavior: "auto", block: "start" });
      return true;
    };

    if (scrollToHash()) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      if (!scrollToHash()) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [location.hash, location.pathname, location.search]);

  return null;
};

const RouterShell = () => {
  const location = useLocation();
  useReveal();
  const wrap = (node: React.ReactNode) => <PageTransition>{node}</PageTransition>;
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes location={location}>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Index />} />
          <Route path="/postagem/:slug" element={<Post />} />
          <Route path="/equipe" element={<Team />} />
          <Route path="/sobre" element={<About />} />
          <Route path="/doacoes" element={<Donations />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/projetos" element={<Projects />} />
          <Route path="/projeto/:slug" element={<Project />} />
          <Route path="/projeto/:slug/leitura/:chapter" element={<ProjectReading />} />
          <Route path="/projetos/:slug" element={<Project />} />
          <Route path="/projetos/:slug/leitura/:chapter" element={<ProjectReading />} />
          <Route path="/recrutamento" element={<Recruitment />} />
          <Route path="/login" element={<Login />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route
          path="/dashboard"
          element={wrap(
            <RequireAuth>
              <Dashboard />
            </RequireAuth>,
          )}
        />
        <Route
          path="/dashboard/usuarios"
          element={wrap(
            <RequireAuth>
              <DashboardUsers />
            </RequireAuth>,
          )}
        />
        <Route
          path="/dashboard/posts"
          element={wrap(
            <RequireAuth>
              <DashboardPosts />
            </RequireAuth>,
          )}
        />
        <Route
          path="/dashboard/projetos"
          element={wrap(
            <RequireAuth>
              <DashboardProjectsEditor />
            </RequireAuth>,
          )}
        />
        <Route
          path="/dashboard/comentarios"
          element={wrap(
            <RequireAuth>
              <DashboardComments />
            </RequireAuth>,
          )}
        />
        <Route
          path="/dashboard/analytics"
          element={wrap(
            <RequireAuth>
              <DashboardAnalytics />
            </RequireAuth>,
          )}
        />
        <Route
          path="/dashboard/audit-log"
          element={wrap(
            <RequireAuth>
              <DashboardAuditLog />
            </RequireAuth>,
          )}
        />
        <Route
          path="/dashboard/paginas"
          element={wrap(
            <RequireAuth>
              <DashboardPages />
            </RequireAuth>,
          )}
        />
        <Route
          path="/dashboard/configuracoes"
          element={wrap(
            <RequireAuth>
              <DashboardSettings />
            </RequireAuth>,
          )}
        />
        <Route
          path="/dashboard/webhooks"
          element={wrap(
            <RequireAuth>
              <DashboardWebhooks />
            </RequireAuth>,
          )}
        />
        <Route
          path="/dashboard/seguranca"
          element={wrap(
            <RequireAuth>
              <DashboardSecurity />
            </RequireAuth>,
          )}
        />
      </Routes>
    </Suspense>
  );
};

const App = ({
  initialSettings,
  initiallyLoaded,
}: {
  initialSettings?: Parameters<typeof SiteSettingsProvider>[0]["initialSettings"];
  initiallyLoaded?: boolean;
}) => (
  <QueryClientProvider client={queryClient}>
    <SiteSettingsProvider initialSettings={initialSettings} initiallyLoaded={initiallyLoaded}>
      <ThemeModeProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ScrollToTop />
            <RouterShell />
          </BrowserRouter>
        </TooltipProvider>
      </ThemeModeProvider>
    </SiteSettingsProvider>
  </QueryClientProvider>
);

export default App;
