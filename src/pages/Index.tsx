import { Suspense, lazy, useEffect, useRef, useState } from "react";
import HeroSection from "@/components/HeroSection";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useIsMobile } from "@/hooks/use-mobile";
import { readWindowPublicBootstrap } from "@/lib/public-bootstrap-global";

const ReleasesSection = lazy(() => import("@/components/ReleasesSection"));

const hasLancamentosHash = () => {
  if (typeof window === "undefined") {
    return false;
  }
  const hash = String(window.location.hash || "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
  return hash === "lancamentos";
};

const isMobileViewportOnEntry = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(max-width: 767px)").matches;
};

const shouldRenderReleasesOnEntry = () => {
  if (typeof window === "undefined") {
    return true;
  }
  if (hasLancamentosHash()) {
    return true;
  }
  return !isMobileViewportOnEntry();
};

const hasPassedReleasesScrollThresholdOnEntry = () => {
  if (typeof window === "undefined") {
    return true;
  }
  return window.scrollY > 24;
};

const Index = () => {
  const bootstrap = readWindowPublicBootstrap();
  const shareImage = bootstrap?.pages.home.shareImage || "";
  const shareImageAlt = bootstrap?.pages.home.shareImageAlt || "";
  const pageMediaVariants = bootstrap?.mediaVariants || {};
  const isMobile = useIsMobile();
  const releasesSentinelRef = useRef<HTMLDivElement | null>(null);
  const [shouldRenderReleases, setShouldRenderReleases] = useState(shouldRenderReleasesOnEntry);
  const [hasPassedReleasesScrollThreshold, setHasPassedReleasesScrollThreshold] = useState(
    hasPassedReleasesScrollThresholdOnEntry,
  );

  useEffect(() => {
    if (!isMobile || shouldRenderReleases || hasPassedReleasesScrollThreshold) {
      return;
    }

    const updateThreshold = () => {
      if (window.scrollY <= 24) {
        return;
      }
      setHasPassedReleasesScrollThreshold(true);
    };

    updateThreshold();
    window.addEventListener("scroll", updateThreshold, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateThreshold);
    };
  }, [hasPassedReleasesScrollThreshold, isMobile, shouldRenderReleases]);

  useEffect(() => {
    if (isMobile || shouldRenderReleases) {
      return;
    }
    setShouldRenderReleases(true);
  }, [isMobile, shouldRenderReleases]);

  useEffect(() => {
    if (!isMobile || shouldRenderReleases || !hasPassedReleasesScrollThreshold) {
      return;
    }

    const sentinel = releasesSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver !== "function") {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }
      setShouldRenderReleases(true);
    }, { rootMargin: "0px 0px -35% 0px" });
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasPassedReleasesScrollThreshold, isMobile, shouldRenderReleases]);

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
