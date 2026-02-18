import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

const DEFAULT_SELECTOR = "[data-reveal]";

export const useReveal = (selector = DEFAULT_SELECTOR) => {
  const location = useLocation();

  useLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const showElement = (el: HTMLElement) => {
      el.classList.add("reveal-visible");
      el.classList.remove("reveal-hidden");
    };

    const tracked = new Set<HTMLElement>();
    const observer =
      typeof window.IntersectionObserver === "function"
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                  return;
                }
                showElement(entry.target as HTMLElement);
                observer?.unobserve(entry.target);
              });
            },
            { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
          )
        : null;

    const revealIfVisible = (el: HTMLElement) => {
      if (el.classList.contains("reveal-visible")) {
        return true;
      }
      el.classList.add("reveal-hidden");
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.9) {
        window.requestAnimationFrame(() => {
          showElement(el);
          observer?.unobserve(el);
        });
        return true;
      }
      return false;
    };

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
        if (!revealIfVisible(el)) {
          observer.observe(el);
        }
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

    const fallbackTimer = window.setTimeout(() => {
      tracked.forEach((el) => {
        showElement(el);
        observer?.unobserve(el);
      });
    }, 700);

    return () => {
      window.clearTimeout(fallbackTimer);
      mutationObserver.disconnect();
      observer?.disconnect();
    };
  }, [location.pathname, selector]);
};
