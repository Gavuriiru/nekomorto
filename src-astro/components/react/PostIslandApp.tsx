import { AppProviders } from "@/components/AppProviders";
import Post from "@/pages/Post";
import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import type { SiteSettings } from "@/types/site-settings";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, StaticRouter, useLocation } from "react-router-dom";

const FullReloadFallback = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const target = `${location.pathname}${location.search}${location.hash}`;
    window.location.assign(target);
  }, [location.hash, location.pathname, location.search]);

  return null;
};

const PostRoutes = () => (
  <Routes>
    <Route path="/postagem/:slug" element={<Post />} />
    <Route path="*" element={<FullReloadFallback />} />
  </Routes>
);

interface PostIslandAppProps {
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  initialSettings?: SiteSettings | null;
  location: string;
}

const PostIslandApp = ({
  initialPublicBootstrap,
  initialPublicRoutePayload,
  initialSettings,
  location,
}: PostIslandAppProps) => {
  const content = (
    <AppProviders
      initialPublicBootstrap={initialPublicBootstrap}
      initialPublicRoutePayload={initialPublicRoutePayload}
      initialSettings={initialSettings ?? initialPublicBootstrap?.settings}
      initiallyLoaded={Boolean(initialSettings ?? initialPublicBootstrap?.settings)}
    >
      <PostRoutes />
    </AppProviders>
  );

  if (typeof window === "undefined") {
    return <StaticRouter location={location}>{content}</StaticRouter>;
  }

  return <BrowserRouter>{content}</BrowserRouter>;
};

export default PostIslandApp;
