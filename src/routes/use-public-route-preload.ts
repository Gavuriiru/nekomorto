import { useCallback, useEffect, useState } from "react";

import {
  getPublicRoutePreloadHandlers,
  preloadPublicRoute,
  schedulePublicRouteIdlePreload,
} from "@/routes/public-preload";

type UsePublicRoutePreloadOptions = {
  enableIdle?: boolean;
  enableViewport?: boolean;
  idleDelayMs?: number;
  rootMargin?: string;
};

export const usePublicRoutePreload = (
  path: string,
  {
    enableIdle = false,
    enableViewport = false,
    idleDelayMs = 600,
    rootMargin = "320px 0px",
  }: UsePublicRoutePreloadOptions = {},
) => {
  const [targetNode, setTargetNode] = useState<Element | null>(null);
  const preloadHandlers = getPublicRoutePreloadHandlers(path);

  const viewportRef = useCallback((node: Element | null) => {
    setTargetNode(node);
  }, []);

  useEffect(() => {
    if (!enableIdle) {
      return;
    }
    return schedulePublicRouteIdlePreload([path], { delayMs: idleDelayMs });
  }, [enableIdle, idleDelayMs, path]);

  useEffect(() => {
    if (!enableViewport || !targetNode) {
      return;
    }
    if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") {
      void preloadPublicRoute(path);
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        void preloadPublicRoute(path);
        observer.disconnect();
      },
      {
        rootMargin,
        threshold: 0,
      },
    );

    observer.observe(targetNode);
    return () => {
      observer.disconnect();
    };
  }, [enableViewport, path, rootMargin, targetNode]);

  return {
    preloadHandlers,
    viewportRef,
  };
};
