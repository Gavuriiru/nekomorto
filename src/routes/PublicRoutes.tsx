import { lazy } from "react";
import { Route, Routes } from "react-router-dom";

import PublicLayout from "@/components/PublicLayout";
import Index from "@/pages/Index";

const NotFound = lazy(() => import("@/pages/NotFound"));
const Post = lazy(() => import("@/pages/Post"));
const Project = lazy(() => import("@/pages/Project"));
const ProjectReading = lazy(() => import("@/pages/ProjectReading"));
const Projects = lazy(() => import("@/pages/Projects"));
const Team = lazy(() => import("@/pages/Team"));
const About = lazy(() => import("@/pages/About"));
const Donations = lazy(() => import("@/pages/Donations"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Login = lazy(() => import("@/pages/Login"));
const Recruitment = lazy(() => import("@/pages/Recruitment"));

const PublicRoutes = () => (
  <Routes>
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
  </Routes>
);

export default PublicRoutes;
