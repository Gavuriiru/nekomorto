import { getPublicRoutePreloadHandlers } from "@/routes/public-preload";
import {
  canUsePublicAstroClientNavigation,
  navigatePublicDocument,
} from "@/lib/public-document-navigation";
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";

type PublicLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
  preload?: boolean;
};

const isPreloadableInternalHref = (href: string) => href.startsWith("/") && !href.startsWith("//");

const PublicLink = forwardRef<HTMLAnchorElement, PublicLinkProps>(
  ({ children, href, onClick, preload = true, target, ...props }, ref) => {
    const safeHref = String(href || "").trim() || "#";
    const preloadHandlers =
      preload && isPreloadableInternalHref(safeHref)
        ? getPublicRoutePreloadHandlers(safeHref)
        : {};
    const handleClick: AnchorHTMLAttributes<HTMLAnchorElement>["onClick"] = (event) => {
      onClick?.(event);
      if (
        event.defaultPrevented ||
        target === "_blank" ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey ||
        !isPreloadableInternalHref(safeHref)
      ) {
        return;
      }
      if (typeof window === "undefined") {
        return;
      }
      const currentPath = `${window.location.pathname || "/"}${window.location.search || ""}`;
      const shouldIntercept =
        safeHref.startsWith("#") ||
        canUsePublicAstroClientNavigation({
          currentPath,
          targetPath: safeHref,
        }) ||
        new URL(safeHref, window.location.origin).pathname === window.location.pathname;
      if (!shouldIntercept) {
        return;
      }
      event.preventDefault();
      navigatePublicDocument(safeHref);
    };

    return (
      <a
        ref={ref}
        {...preloadHandlers}
        {...props}
        href={safeHref}
        onClick={handleClick}
        target={target}
      >
        {children}
      </a>
    );
  },
);

PublicLink.displayName = "PublicLink";

export default PublicLink;
