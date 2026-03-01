import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const getInitialIsMobile = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
};

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(getInitialIsMobile);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = (event?: MediaQueryListEvent) => {
      setIsMobile(event?.matches ?? mql.matches);
    };

    onChange();

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }

    if (typeof mql.addListener === "function") {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }

    return undefined;
  }, []);

  return isMobile;
}
