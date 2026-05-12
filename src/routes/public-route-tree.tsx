import type { ComponentType, JSX } from "react";
import { Route, Routes } from "react-router-dom";

import PublicLayout from "@/components/PublicLayout";

export interface PublicRouteComponents {
  About: ComponentType;
  Donations: ComponentType;
  FAQ: ComponentType;
  Index: ComponentType;
  Login: ComponentType;
  NotFound: ComponentType;
  Post: ComponentType;
  PrivacyPolicy: ComponentType;
  Project: ComponentType;
  ProjectReading: ComponentType;
  Projects: ComponentType;
  Recruitment: ComponentType;
  Team: ComponentType;
  TermsOfService: ComponentType;
}

export const renderPublicRouteTree = ({
  About,
  Donations,
  FAQ,
  Index,
  Login,
  NotFound,
  Post,
  PrivacyPolicy,
  Project,
  ProjectReading,
  Projects,
  Recruitment,
  Team,
  TermsOfService,
}: PublicRouteComponents): JSX.Element => (
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
      <Route path="/recrutamento" element={<Recruitment />} />
      <Route path="/termos-de-uso" element={<TermsOfService />} />
      <Route path="/politica-de-privacidade" element={<PrivacyPolicy />} />
      <Route path="/login" element={<Login />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
);
