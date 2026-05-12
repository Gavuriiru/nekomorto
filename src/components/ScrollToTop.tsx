import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export const ScrollToTop = () => {
  const location = useLocation();

  useLayoutEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useLayoutEffect(() => {
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
  }, [location.hash, location.pathname, location.search, location.state]);

  useEffect(() => {
    const locationState =
      typeof location.state === "object" && location.state !== null
        ? (location.state as { preserveScroll?: boolean })
        : null;
    const shouldPreserveScroll = locationState?.preserveScroll === true;
    if (shouldPreserveScroll || location.hash) {
      return;
    }
    let raf = window.requestAnimationFrame(() => {
      raf = window.requestAnimationFrame(() => {
        if (window.scrollY > 0) {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [location.hash, location.pathname, location.search, location.state]);

  return null;
};

export default ScrollToTop;
