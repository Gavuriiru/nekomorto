import { getPublicRoutePreloadHandlers } from "@/routes/public-preload";
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";

type PublicLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
  preload?: boolean;
};

const isPreloadableInternalHref = (href: string) => href.startsWith("/") && !href.startsWith("//");

const PublicLink = forwardRef<HTMLAnchorElement, PublicLinkProps>(
  ({ children, href, preload = true, ...props }, ref) => {
    const safeHref = String(href || "").trim() || "#";
    const preloadHandlers =
      preload && isPreloadableInternalHref(safeHref)
        ? getPublicRoutePreloadHandlers(safeHref)
        : {};

    return (
      <a ref={ref} {...preloadHandlers} {...props} href={safeHref}>
        {children}
      </a>
    );
  },
);

PublicLink.displayName = "PublicLink";

export default PublicLink;
