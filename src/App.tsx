import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
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
import DashboardPages from "./pages/DashboardPages";
import DashboardSettings from "./pages/DashboardSettings";

const queryClient = new QueryClient();

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    variants={pageTransition}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

const RouterShell = () => {
  const location = useLocation();
  useReveal();
  const wrap = (node: React.ReactNode) => <PageTransition>{node}</PageTransition>;
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={wrap(<Index />)} />
        <Route path="/postagem/:slug" element={wrap(<Post />)} />
        <Route path="/equipe" element={wrap(<Team />)} />
        <Route path="/sobre" element={wrap(<About />)} />
        <Route path="/doacoes" element={wrap(<Donations />)} />
        <Route path="/faq" element={wrap(<FAQ />)} />
        <Route path="/projetos" element={wrap(<Projects />)} />
        <Route path="/projeto/:slug" element={wrap(<Project />)} />
        <Route path="/projeto/:slug/leitura/:chapter" element={wrap(<ProjectReading />)} />
        <Route path="/projetos/:slug" element={wrap(<Project />)} />
        <Route path="/projetos/:slug/leitura/:chapter" element={wrap(<ProjectReading />)} />
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
        <Route path="/login" element={wrap(<Login />)} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={wrap(<NotFound />)} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SiteSettingsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <RouterShell />
        </BrowserRouter>
      </TooltipProvider>
    </SiteSettingsProvider>
  </QueryClientProvider>
);

export default App;
