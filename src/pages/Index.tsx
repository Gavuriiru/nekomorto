import { Suspense, lazy, useEffect, useRef, useState } from "react";
import HeroSection from "@/components/HeroSection";
import { usePageMeta } from "@/hooks/use-page-meta";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";

const ReleasesSection = lazy(() => import("@/components/ReleasesSection"));

const shouldRenderReleasesOnEntry = () => {
  if (typeof window === "undefined") {
    return true;
  }
  const hash = String(window.location.hash || "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
  return hash === "lancamentos";
};

const Index = () => {
  const bootstrap = readWindowPublicBootstrap();
  const shareImage = bootstrap?.pages.home.shareImage || "";
  const shareImageAlt = bootstrap?.pages.home.shareImageAlt || "";
  const pageMediaVariants = bootstrap?.mediaVariants || {};
  const releasesSentinelRef = useRef<HTMLDivElement | null>(null);
  const [shouldRenderReleases, setShouldRenderReleases] = useState(shouldRenderReleasesOnEntry);

  useEffect(() => {
    if (shouldRenderReleases) {
      return;
    }

    const sentinel = releasesSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver !== "function") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        setShouldRenderReleases(true);
      },
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [shouldRenderReleases]);

  usePageMeta({
    title: "Início",
    image: shareImage || undefined,
    imageAlt: shareImageAlt || undefined,
    mediaVariants: pageMediaVariants,
  });

  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <div ref={releasesSentinelRef} aria-hidden="true" className="h-px w-full" />
      {shouldRenderReleases ? (
        <Suspense fallback={null}>
          <ReleasesSection />
        </Suspense>
      ) : null}
    </div>
  );
};

export default Index;
