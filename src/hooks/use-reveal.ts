import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const DEFAULT_SELECTOR = "[data-reveal]";

export const useReveal = (selector = DEFAULT_SELECTOR) => {
  const location = useLocation();

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tracked = new Set<HTMLElement>();
    const fallbackTimers = new Map<HTMLElement, number>();
    let observer: IntersectionObserver | null = null;

    const clearFallbackTimer = (el: HTMLElement) => {
      const handle = fallbackTimers.get(el);
      if (typeof handle === "number") {
        window.clearTimeout(handle);
        fallbackTimers.delete(el);
      }
    };

    const showElement = (el: HTMLElement) => {
      clearFallbackTimer(el);
      el.classList.add("reveal-visible");
      el.classList.remove("reveal-hidden");
      observer?.unobserve(el);
    };

    observer =
      typeof window.IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                  return;
                }
                showElement(entry.target as HTMLElement);
              });
            },
            { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
          )
        : null;

    const registerElements = (elements: HTMLElement[]) => {
      if (!elements.length) {
        return;
      }
      elements.forEach((el) => {
        if (tracked.has(el)) {
          return;
        }
        tracked.add(el);
        if (prefersReducedMotion) {
          showElement(el);
          return;
        }
        if (!observer) {
          showElement(el);
          return;
        }
        el.classList.add("reveal-hidden");
        observer.observe(el);
        clearFallbackTimer(el);
        const handle = window.setTimeout(() => {
          showElement(el);
        }, 700);
        fallbackTimers.set(el, handle);
      });
    };

    const collectElements = (root: ParentNode) =>
      Array.from(root.querySelectorAll<HTMLElement>(selector));

    registerElements(collectElements(document));

    const mutationObserver = new MutationObserver((mutations) => {
      const added: HTMLElement[] = [];
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }
          if (node.matches(selector)) {
            added.push(node);
          }
          node.querySelectorAll?.(selector).forEach((child) => {
            if (child instanceof HTMLElement) {
              added.push(child);
            }
          });
        });
      });
      registerElements(added);
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      fallbackTimers.forEach((handle) => {
        window.clearTimeout(handle);
      });
      fallbackTimers.clear();
      mutationObserver.disconnect();
      observer?.disconnect();
    };
  }, [location.pathname, selector]);
};
