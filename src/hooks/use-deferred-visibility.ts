import { useCallback, useEffect, useState } from "react";

type UseDeferredVisibilityOptions = {
  initialVisible?: boolean;
  rootMargin?: string;
};

export const useDeferredVisibility = ({
  initialVisible = false,
  rootMargin = "400px 0px",
}: UseDeferredVisibilityOptions = {}) => {
  const [sentinelNode, setSentinelNode] = useState<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(initialVisible);

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    setSentinelNode(node);
  }, []);

  useEffect(() => {
    if (!initialVisible || isVisible) {
      return;
    }
    setIsVisible(true);
  }, [initialVisible, isVisible]);

  useEffect(() => {
    if (isVisible) {
      return;
    }
    if (!sentinelNode) {
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

    observer.observe(sentinelNode);
    return () => {
      observer.disconnect();
    };
  }, [isVisible, rootMargin, sentinelNode]);

  return {
    isVisible,
    sentinelRef,
  };
};
