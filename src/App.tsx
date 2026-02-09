import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";
import { SiteSettingsProvider } from "@/hooks/site-settings-provider";
import { useReveal } from "@/hooks/use-reveal";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Post from "./pages/Post";
import Project from "./pages/Project";
import ProjectReading from "./pages/ProjectReading";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import About from "./pages/About";
import Donations from "./pages/Donations";
import FAQ from "./pages/FAQ";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import RequireAuth from "./components/RequireAuth";
import DashboardUsers from "./pages/DashboardUsers";
import DashboardPosts from "./pages/DashboardPosts";
import DashboardProjectsEditor from "./pages/DashboardProjectsEditor";
import DashboardComments from "./pages/DashboardComments";
import DashboardAuditLog from "./pages/DashboardAuditLog";
import DashboardPages from "./pages/DashboardPages";
import DashboardSettings from "./pages/DashboardSettings";
import Recruitment from "./pages/Recruitment";
import PublicLayout from "./components/PublicLayout";

const queryClient = new QueryClient();

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <div className="page-transition">{children}</div>
);

const ScrollToTop = () => {
  const location = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.search]);

  return null;
};

const RouterShell = () => {
  const location = useLocation();
  useReveal();
  const wrap = (node: React.ReactNode) => <PageTransition>{node}</PageTransition>;
  return (
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
    </Routes>
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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <RouterShell />
        </BrowserRouter>
      </TooltipProvider>
    </SiteSettingsProvider>
  </QueryClientProvider>
);

export default App;
