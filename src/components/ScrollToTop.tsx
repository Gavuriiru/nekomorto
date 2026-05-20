import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export const ScrollToTop = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const hasMountedRef = useRef(false);
  const shouldPreserveBrowserHistoryScroll = navigationType === "POP" && hasMountedRef.current;

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
    if (shouldPreserveBrowserHistoryScroll) {
      return;
    }

    const locationState =
      typeof location.state === "object" && location.state !== null
        ? (location.state as { preserveScroll?: boolean })
        : null;
    const shouldPreserveScroll = locationState?.preserveScroll === true;
    const normalizedHash = String(location.hash || "")
      .replace(/^#/, "")
      .trim();
    if (!normalizedHash) {
      if (!shouldPreserveScroll) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
      return;
    }

    const findTarget = () => {
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

    const scrollToHash = () => {
      const target = findTarget();
      if (!target) {
        return false;
      }
      const scrollBlock =
        target.getAttribute("data-scroll-block") === "center" ? "center" : "start";
      target.scrollIntoView({ behavior: "auto", block: scrollBlock });
      return true;
    };

    if (scrollToHash()) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      if (!scrollToHash()) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    location.hash,
    location.pathname,
    location.search,
    location.state,
    shouldPreserveBrowserHistoryScroll,
  ]);

  useEffect(() => {
    if (shouldPreserveBrowserHistoryScroll) {
      return;
    }
    if (!hasMountedRef.current) {
      return;
    }

    const locationState =
      typeof location.state === "object" && location.state !== null
        ? (location.state as { preserveScroll?: boolean })
        : null;
    const shouldPreserveScroll = locationState?.preserveScroll === true;
    if (shouldPreserveScroll || location.hash) {
      return;
    }
    let secondFrameId = 0;
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => {
        if (shouldPreserveBrowserHistoryScroll) {
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
  }, [
    location.hash,
    location.pathname,
    location.search,
    location.state,
    shouldPreserveBrowserHistoryScroll,
  ]);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  return null;
};

export default ScrollToTop;
