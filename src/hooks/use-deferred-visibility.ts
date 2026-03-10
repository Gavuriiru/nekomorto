import { useEffect, useRef, useState } from "react";

type UseDeferredVisibilityOptions = {
  initialVisible?: boolean;
  rootMargin?: string;
};

export const useDeferredVisibility = ({
  initialVisible = false,
  rootMargin = "400px 0px",
}: UseDeferredVisibilityOptions = {}) => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(initialVisible);

  useEffect(() => {
    if (isVisible) {
      return;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") {
      setIsVisible(true);
      return;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        setIsVisible(true);
        observer.disconnect();
      },
      {
        rootMargin,
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [isVisible, rootMargin]);

  return {
    isVisible,
    sentinelRef,
  };
};
