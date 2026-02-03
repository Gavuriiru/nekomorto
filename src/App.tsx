import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SiteSettingsProvider } from "@/hooks/site-settings-provider";
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
import DashboardPages from "./pages/DashboardPages";
import DashboardSettings from "./pages/DashboardSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SiteSettingsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
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
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard/usuarios"
              element={
                <RequireAuth>
                  <DashboardUsers />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard/posts"
              element={
                <RequireAuth>
                  <DashboardPosts />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard/projetos"
              element={
                <RequireAuth>
                  <DashboardProjectsEditor />
                </RequireAuth>
              }
            />
            <Route
              path="/dashboard/comentarios"
              element={
                <RequireAuth>
                  <DashboardComments />
                </RequireAuth>
              }
            />
          <Route
            path="/dashboard/paginas"
            element={
              <RequireAuth>
                <DashboardPages />
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/configuracoes"
            element={
              <RequireAuth>
                <DashboardSettings />
              </RequireAuth>
            }
          />
            <Route path="/login" element={<Login />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SiteSettingsProvider>
  </QueryClientProvider>
);

export default App;
