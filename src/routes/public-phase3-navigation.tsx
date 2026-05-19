import type {
  AnchorHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type Phase3PublicNavigationApi = {
  getCurrentPath: () => string;
  navigate: (href: string) => void;
  replace: (href: string) => void;
};

type Phase3PublicNavigationWindow = Window &
  typeof globalThis & {
    __NEKOMATA_PHASE3_NAV__?: Phase3PublicNavigationApi;
  };

export const PHASE3_PUBLIC_ROUTE_CHANGE_EVENT = "nekomata:phase3-route-change";

const PHASE3_PUBLIC_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/projetos(?:\/|$)/,
  /^\/projeto\/[^/]+(?:\/|$)/,
  /^\/postagem\/[^/]+(?:\/|$)/,
];

const normalizePathFromLocation = (locationLike: {
  hash?: string;
  pathname?: string;
  search?: string;
}) => `${locationLike.pathname || "/"}${locationLike.search || ""}${locationLike.hash || ""}`;

export const normalizePublicPathname = (value: string) => {
  const pathname = String(value || "").trim().split(/[?#]/, 1)[0] || "/";
  const withoutTrailingSlash = pathname.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
};

export const isPhase3PublicPath = (href: string) => {
  const normalizedHref = String(href || "").trim();
  if (!normalizedHref.startsWith("/") || normalizedHref.startsWith("//")) {
    return false;
  }
  const pathname = normalizePublicPathname(normalizedHref);
  return PHASE3_PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
};

export const emitPhase3PublicRouteChange = (target?: string) => {
  if (typeof window === "undefined") {
    return;
  }
  const detail = String(target || normalizePathFromLocation(window.location)).trim();
  window.dispatchEvent(new CustomEvent(PHASE3_PUBLIC_ROUTE_CHANGE_EVENT, { detail }));
};

export const getPhase3PublicNavigation = () => {
  if (typeof window === "undefined") {
    return null;
  }
  return (window as Phase3PublicNavigationWindow).__NEKOMATA_PHASE3_NAV__ || null;
};

const supportsModifiedNavigation = (event: ReactMouseEvent<HTMLAnchorElement>) =>
  event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;

export const PublicChromePhase3Link = ({
  href,
  onClick,
  target,
  download,
  rel,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) => {
  const safeHref = String(href || "").trim();

  return (
    <a
      {...props}
      href={safeHref}
      target={target}
      download={download}
      rel={rel}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) {
          return;
        }
        if (!safeHref || !isPhase3PublicPath(safeHref) || target || download) {
          return;
        }
        if (supportsModifiedNavigation(event)) {
          return;
        }
        const navigation = getPhase3PublicNavigation();
        if (!navigation) {
          return;
        }
        event.preventDefault();
        navigation.navigate(safeHref);
      }}
    >
      {children}
    </a>
  );
};

export const Phase3PublicNavigationBridge = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const browserWindow = window as Phase3PublicNavigationWindow;
    const api: Phase3PublicNavigationApi = {
      getCurrentPath: () => normalizePathFromLocation(window.location),
      navigate: (href) => navigate(href),
      replace: (href) => navigate(href, { replace: true }),
    };
    browserWindow.__NEKOMATA_PHASE3_NAV__ = api;
    return () => {
      if (browserWindow.__NEKOMATA_PHASE3_NAV__ === api) {
        delete browserWindow.__NEKOMATA_PHASE3_NAV__;
      }
    };
  }, [navigate]);

  useEffect(() => {
    emitPhase3PublicRouteChange(normalizePathFromLocation(location));
  }, [location]);

  return null;
};

const readBrowserPhase3Path = () => {
  if (typeof window === "undefined") {
    return "/";
  }
  return normalizePathFromLocation(window.location);
};

export const usePublicChromeLocation = (initialPath = "/") => {
  const [path, setPath] = useState(() =>
    typeof window === "undefined" ? initialPath : readBrowserPhase3Path(),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const sync = (event?: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "string" && event.detail.trim()) {
        setPath(event.detail.trim());
        return;
      }
      setPath(readBrowserPhase3Path());
    };

    window.addEventListener("popstate", sync);
    window.addEventListener("pageshow", sync);
    window.addEventListener(PHASE3_PUBLIC_ROUTE_CHANGE_EVENT, sync as EventListener);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("pageshow", sync);
      window.removeEventListener(PHASE3_PUBLIC_ROUTE_CHANGE_EVENT, sync as EventListener);
    };
  }, []);

  return useMemo(() => {
    const parsed = new URL(path, "http://localhost");
    return {
      fullPath: path,
      pathname: parsed.pathname || "/",
      search: parsed.search || "",
      hash: parsed.hash || "",
    };
  }, [path]);
};

export const Phase3PublicNavigationProvider = ({ children }: { children: ReactNode }) => (
  <>
    <Phase3PublicNavigationBridge />
    {children}
  </>
);
