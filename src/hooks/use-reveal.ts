import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const DEFAULT_SELECTOR = "[data-reveal]";

export const useReveal = (selector = DEFAULT_SELECTOR) => {
  const location = useLocation();

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    if (!elements.length) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      elements.forEach((el) => el.classList.add("reveal-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          entry.target.classList.add("reveal-visible");
          entry.target.classList.remove("reveal-hidden");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );

    const revealIfVisible = (el: HTMLElement) => {
      el.classList.add("reveal-hidden");
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.9) {
        el.classList.add("reveal-visible");
        el.classList.remove("reveal-hidden");
        observer.unobserve(el);
        return true;
      }
      return false;
    };

    elements.forEach((el) => {
      if (!revealIfVisible(el)) {
        observer.observe(el);
      }
    });
    const fallbackTimer = window.setTimeout(() => {
      elements.forEach((el) => {
        el.classList.add("reveal-visible");
        el.classList.remove("reveal-hidden");
      });
      observer.disconnect();
    }, 700);

    return () => {
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, [location.pathname, selector]);
};
