import {
  PUBLIC_DOCUMENT_LOCATION_CHANGE_EVENT,
  usePublicDocumentLocation,
} from "@/lib/public-document-navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

const buildRouteKey = ({ pathname, search }: { pathname: string; search: string }) =>
  `${pathname || "/"}${search || ""}`;

const readPublicHistoryState = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return typeof window.history.state === "object" && window.history.state !== null
    ? (window.history.state as { preserveScroll?: boolean })
    : null;
};

const resolveHashTarget = (hash: string) => {
  const normalizedHash = String(hash || "")
    .replace(/^#/, "")
    .trim();
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

const scrollToHashTarget = (hash: string) => {
  const target = resolveHashTarget(hash);
  if (!target) {
    return false;
  }
  const scrollBlock = target.getAttribute("data-scroll-block") === "center" ? "center" : "start";
  target.scrollIntoView({ behavior: "auto", block: scrollBlock });
  return true;
};

const PublicScrollToTop = ({ initialPath = "/" }: { initialPath?: string }) => {
  const location = usePublicDocumentLocation(initialPath);
  const hasMountedRef = useRef(false);
  const lastNavigationKindRef = useRef<"initial" | "pop" | "soft">("initial");
  const currentRouteKey = buildRouteKey(location);
  const previousRouteKeyRef = useRef(currentRouteKey);
  const shouldPreserveBrowserHistoryScroll =
    lastNavigationKindRef.current === "pop" && hasMountedRef.current;

  useEffect(() => {
    const markSoftNavigation = () => {
      lastNavigationKindRef.current = "soft";
    };
    const markPopNavigation = () => {
      lastNavigationKindRef.current = "pop";
    };

    window.addEventListener(PUBLIC_DOCUMENT_LOCATION_CHANGE_EVENT, markSoftNavigation);
    window.addEventListener("popstate", markPopNavigation);
    window.addEventListener("pageshow", markPopNavigation);
    return () => {
      window.removeEventListener(PUBLIC_DOCUMENT_LOCATION_CHANGE_EVENT, markSoftNavigation);
      window.removeEventListener("popstate", markPopNavigation);
      window.removeEventListener("pageshow", markPopNavigation);
    };
  }, []);

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      const previousScrollRestoration = window.history.scrollRestoration;
      window.history.scrollRestoration = "auto";
      return () => {
        window.history.scrollRestoration = previousScrollRestoration;
      };
    }
  }, []);

  useLayoutEffect(() => {
    const locationState = readPublicHistoryState();
    const shouldPreserveScroll = locationState?.preserveScroll === true;
    const routeChanged = previousRouteKeyRef.current !== currentRouteKey;
    previousRouteKeyRef.current = currentRouteKey;

    if (shouldPreserveBrowserHistoryScroll) {
      return;
    }

    if (!location.hash) {
      if (!shouldPreserveScroll && (routeChanged || !hasMountedRef.current)) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      return;
    }

    if (scrollToHashTarget(location.hash)) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      if (!scrollToHashTarget(location.hash)) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [currentRouteKey, location.hash, shouldPreserveBrowserHistoryScroll]);

  useEffect(() => {
    if (shouldPreserveBrowserHistoryScroll) {
      return;
    }
    if (!hasMountedRef.current) {
      return;
    }

    const locationState = readPublicHistoryState();
    const shouldPreserveScroll = locationState?.preserveScroll === true;
    if (shouldPreserveScroll || location.hash) {
      return;
    }

    let secondFrameId = 0;
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        if (lastNavigationKindRef.current === "pop" && hasMountedRef.current) {
          return;
        }
        if (window.scrollY > 0) {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      if (secondFrameId) {
        window.cancelAnimationFrame(secondFrameId);
      }
    };
  }, [currentRouteKey, location.hash, shouldPreserveBrowserHistoryScroll]);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  return null;
};

export default PublicScrollToTop;
