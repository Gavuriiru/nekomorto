import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Post from "./pages/Post";
import Project from "./pages/Project";
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
import DashboardProjects from "./pages/DashboardProjects";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
          <Route path="/projetos/:slug" element={<Project />} />
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
                <DashboardProjects />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<Login />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
