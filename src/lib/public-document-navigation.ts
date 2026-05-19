import { useEffect, useMemo, useState } from "react";

export const PUBLIC_DOCUMENT_LOCATION_CHANGE_EVENT = "nekomata:public-document-location-change";

const buildBrowserLocationSnapshot = () => {
  if (typeof window === "undefined") {
    return {
      hash: "",
      href: "/",
      pathname: "/",
      search: "",
    };
  }

  return {
    hash: window.location.hash || "",
    href: `${window.location.pathname || "/"}${window.location.search || ""}${window.location.hash || ""}`,
    pathname: window.location.pathname || "/",
    search: window.location.search || "",
  };
};

const emitPublicDocumentLocationChange = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(PUBLIC_DOCUMENT_LOCATION_CHANGE_EVENT));
};

export const navigatePublicDocument = (
  href: string,
  options: { replace?: boolean; state?: unknown } = {},
) => {
  if (typeof window === "undefined") {
    return;
  }

  const targetHref = String(href || "").trim();
  if (!targetHref) {
    return;
  }

  const targetUrl = new URL(targetHref, window.location.origin);
  const currentUrl = new URL(window.location.href);
  const isSameDocumentRoute =
    targetUrl.origin === currentUrl.origin && targetUrl.pathname === currentUrl.pathname;

  if (!isSameDocumentRoute) {
    window.location.assign(targetUrl.toString());
    return;
  }

  const nextHref = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  const nextState = options.state ?? window.history.state;
  if (options.replace) {
    window.history.replaceState(nextState, "", nextHref);
  } else {
    window.history.pushState(nextState, "", nextHref);
  }
  emitPublicDocumentLocationChange();
};

const buildLocationSnapshotFromPath = (path: string) => {
  try {
    const parsed = new URL(String(path || "/"), "https://nekomata.moe");
    return {
      hash: parsed.hash || "",
      href: `${parsed.pathname || "/"}${parsed.search || ""}${parsed.hash || ""}`,
      pathname: parsed.pathname || "/",
      search: parsed.search || "",
    };
  } catch {
    return {
      hash: "",
      href: "/",
      pathname: "/",
      search: "",
    };
  }
};

export const usePublicDocumentLocation = (initialPath = "/") => {
  const [location, setLocation] = useState(() =>
    typeof window === "undefined"
      ? buildLocationSnapshotFromPath(initialPath)
      : buildBrowserLocationSnapshot(),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const sync = () => {
      setLocation(buildBrowserLocationSnapshot());
    };

    window.addEventListener("pageshow", sync);
    window.addEventListener("popstate", sync);
    window.addEventListener(PUBLIC_DOCUMENT_LOCATION_CHANGE_EVENT, sync as EventListener);
    return () => {
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("popstate", sync);
      window.removeEventListener(PUBLIC_DOCUMENT_LOCATION_CHANGE_EVENT, sync as EventListener);
    };
  }, []);

  return useMemo(() => location, [location]);
};
