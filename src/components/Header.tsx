import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import ThemeModeSwitcher from "@/components/ThemeModeSwitcher";
import type { DashboardMenuItem } from "@/components/dashboard-menu";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { usePublicBootstrap } from "@/hooks/use-public-bootstrap";
import { useIsMobile } from "@/hooks/use-mobile";
import { resolveBranding } from "@/lib/branding";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { scheduleOnBrowserLoadIdle } from "@/lib/browser-idle";
import {
  buildDashboardMenuFromGrants,
  getFirstAllowedDashboardRoute,
  resolveGrants,
} from "@/lib/access-control";
import { buildAvatarRenderUrl } from "@/lib/avatar-render-url";
import { sanitizePublicHref } from "@/lib/url-safety";
import { uiCopy } from "@/lib/ui-copy";
import type { SearchSuggestion } from "@/types/search-suggestion";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import {
  asPublicBootstrapCurrentUser,
  readWindowPublicBootstrap,
  readWindowPublicBootstrapCurrentUser,
  type PublicBootstrapCurrentUser,
} from "@/lib/public-bootstrap-global";
import type { HeaderActionMenusProps } from "@/components/HeaderActionMenus";

type HeaderProps = {
  variant?: "fixed" | "static";
  leading?: ReactNode;
  className?: string;
};

type CurrentUser = PublicBootstrapCurrentUser;
type HeaderToastPayload = {
  title?: ReactNode;
  description?: ReactNode;
  variant?: "default" | "destructive";
  intent?: "success" | "error" | "info" | "warning";
  duration?: number;
};

const HeaderSearchPopover = lazy(() => import("@/components/HeaderSearchPopover"));
let headerActionMenusModulePromise: Promise<typeof import("@/components/HeaderActionMenus")> | null =
  null;
const loadHeaderActionMenusModule = () => {
  if (!headerActionMenusModulePromise) {
    headerActionMenusModulePromise = import("@/components/HeaderActionMenus");
  }
  return headerActionMenusModulePromise;
};
const HeaderActionMenus = lazy(() =>
  loadHeaderActionMenusModule().then((module) => ({ default: module.default })),
);
let toastModulePromise: Promise<typeof import("@/components/ui/use-toast")> | null = null;

const loadToastModule = () => {
  if (!toastModulePromise) {
    toastModulePromise = import("@/components/ui/use-toast");
  }
  return toastModulePromise;
};

const notifyToast = async (payload: HeaderToastPayload) => {
  const { toast } = await loadToastModule();
  toast(payload);
};

const HeaderActionsFallback = ({
  currentUser,
  headerAvatarUrl,
}: Pick<HeaderActionMenusProps, "currentUser" | "headerAvatarUrl">) => (
  <>
    <ThemeModeSwitcher />
    <Button
      variant="ghost"
      size="icon"
      className="lg:hidden h-10 w-10 rounded-full border border-border/60 bg-card/50 text-foreground/85 hover:bg-accent hover:text-accent-foreground"
      aria-label="Abrir menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
    {currentUser ? (
      <Button variant="ghost" className="h-11 gap-2 rounded-full px-2">
        <Avatar className="h-8 w-8 border border-border/70 shadow-[0_10px_24px_-18px_hsl(var(--foreground)/0.65)]">
          {headerAvatarUrl ? <AvatarImage src={headerAvatarUrl} alt={currentUser.name} /> : null}
          <AvatarFallback className="bg-secondary text-xs text-foreground">
            {(currentUser.name || "").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium text-foreground lg:inline">
          {currentUser.name || ""}
        </span>
      </Button>
    ) : null}
  </>
);

const Header = ({ variant = "fixed", leading, className }: HeaderProps) => {
  const MIN_SUGGEST_QUERY_LENGTH = 2;
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteSuggestions, setRemoteSuggestions] = useState<SearchSuggestion[]>([]);
  const [remoteMediaVariants, setRemoteMediaVariants] = useState<UploadMediaVariantsMap>({});
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [hasSearchRequestFailed, setHasSearchRequestFailed] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [shouldRenderActionMenus, setShouldRenderActionMenus] = useState(false);
  const [hasInlineBootstrapSnapshot] = useState<boolean>(() => Boolean(readWindowPublicBootstrap()));
  const [initialBootstrapUser] = useState<CurrentUser | null>(() => readWindowPublicBootstrapCurrentUser());
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(initialBootstrapUser);
  const [dashboardMenuItems, setDashboardMenuItems] = useState<DashboardMenuItem[]>([]);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const actionsClusterRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const location = useLocation();
  const apiBase = getApiBase();
  const isMobile = useIsMobile();
  const { settings } = useSiteSettings();
  const { data: bootstrapData } = usePublicBootstrap();
  const projects = bootstrapData?.projects || [];
  const posts = bootstrapData?.posts || [];
  const bootstrapMediaVariants = bootstrapData?.mediaVariants || {};
  const tagTranslations = bootstrapData?.tagTranslations?.tags || {};

  const siteNameRaw = settings.site.name || "Nekomata";
  const siteName = siteNameRaw.toUpperCase();
  const branding = resolveBranding(settings);
  const navbarWordmarkUrl = branding.navbar.wordmarkUrl;
  const navbarSymbolUrl = branding.navbar.symbolUrl;
  const navbarMode = branding.navbar.mode;
  const showWordmarkInNavbar = branding.navbar.showWordmark;
  const showSymbolInNavbar = navbarMode === "symbol-text" || navbarMode === "symbol";
  const showTextInNavbar = navbarMode === "symbol-text" || navbarMode === "text";
  const navbarLinks = useMemo(() => {
    return Array.isArray(settings.navbar.links)
      ? settings.navbar.links
          .map((link) => ({
            label: String(link?.label || "").trim(),
            href: sanitizePublicHref(link?.href) || "",
            icon: String(link?.icon || "").trim(),
          }))
          .filter((link) => link.label && link.href)
      : [];
  }, [settings.navbar.links]);
  const headerMenuContentClass =
    "border-border/70 bg-popover/95 text-popover-foreground shadow-xl backdrop-blur-xs";
  const headerMenuItemClass = "focus:bg-accent focus:text-accent-foreground";
  const isInternalHref = (href: string) => href.startsWith("/") && !href.startsWith("//");
  const normalizePathname = (value: string) => {
    const pathname = value.split(/[?#]/, 1)[0] || "/";
    const withoutTrailingSlash = pathname.replace(/\/+$/, "");
    return withoutTrailingSlash || "/";
  };
  const isNavbarLinkActive = (href: string) => {
    if (!isInternalHref(href)) {
      return false;
    }
    const currentPath = normalizePathname(location.pathname);
    const targetPath = normalizePathname(href);
    if (targetPath === "/") {
      return currentPath === "/";
    }
    return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
  };
  const currentPath = normalizePathname(location.pathname);
  const isReaderAwareRoute =
    /^\/postagem\/.+/.test(currentPath) || /^\/projeto(?:s)?\/.+\/leitura\/.+/.test(currentPath);

  const queryTrimmed = query.trim();
  const hasMinimumSearchQueryLength = queryTrimmed.length >= MIN_SUGGEST_QUERY_LENGTH;

  useEffect(() => {
    if (!isSearchOpen || !hasMinimumSearchQueryLength) {
      setRemoteSuggestions([]);
      setRemoteMediaVariants({});
      setHasSearchRequestFailed(false);
      setIsSearchLoading(false);
      return;
    }

    let isActive = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearchLoading(true);
      try {
        const params = new URLSearchParams({
          q: queryTrimmed,
          scope: "all",
          limit: "8",
        });
        const response = await apiFetch(
          apiBase,
          `/api/public/search/suggest?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error(`search_suggest_${response.status}`);
        }
        const payload = (await response.json()) as {
          suggestions?: unknown[];
          mediaVariants?: unknown;
        };
        if (!isActive) {
          return;
        }
        const nextSuggestions = Array.isArray(payload?.suggestions)
          ? payload.suggestions
              .map((item) => {
                if (!item || typeof item !== "object") {
                  return null;
                }
                const candidate = item as Partial<SearchSuggestion>;
                const kind =
                  candidate.kind === "project" || candidate.kind === "post" ? candidate.kind : null;
                const id = String(candidate.id || "").trim();
                const label = String(candidate.label || "").trim();
                const href = String(candidate.href || "").trim();
                if (!kind || !id || !label || !href) {
                  return null;
                }
                return {
                  kind,
                  id,
                  label,
                  href,
                  description: String(candidate.description || "").trim(),
                  image: String(candidate.image || "").trim(),
                  tags: Array.isArray(candidate.tags)
                    ? candidate.tags
                        .map((tag) => String(tag || "").trim())
                        .filter(Boolean)
                        .slice(0, 4)
                    : [],
                  meta: String(candidate.meta || "").trim(),
                } satisfies SearchSuggestion;
              })
              .filter(Boolean)
          : [];
        setRemoteSuggestions(nextSuggestions as SearchSuggestion[]);
        setRemoteMediaVariants(
          payload?.mediaVariants && typeof payload.mediaVariants === "object"
            ? (payload.mediaVariants as UploadMediaVariantsMap)
            : {},
        );
        setHasSearchRequestFailed(false);
      } catch (error) {
        if (!isActive) {
          return;
        }
        if (
          error &&
          typeof error === "object" &&
          "name" in error &&
          String((error as { name?: string }).name) === "AbortError"
        ) {
          return;
        }
        setRemoteSuggestions([]);
        setRemoteMediaVariants({});
        setHasSearchRequestFailed(true);
      } finally {
        if (isActive) {
          setIsSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      isActive = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [apiBase, hasMinimumSearchQueryLength, isSearchOpen, queryTrimmed]);

  const showResults = isSearchOpen && queryTrimmed.length > 0;
  const shouldRevalidatePublicCurrentUserOnMount =
    Boolean(initialBootstrapUser) || !hasInlineBootstrapSnapshot;

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }
    void import("@/components/HeaderSearchPopover");
  }, [isSearchOpen]);

  useEffect(() => {
    if (isMobile || isReaderAwareRoute) {
      return;
    }
    let isActive = true;
    const preloadActionMenus = () => {
      void loadHeaderActionMenusModule()
        .catch(() => undefined)
        .finally(() => {
          if (isActive) {
            setShouldRenderActionMenus(true);
          }
        });
    };
    const cancelIdle = scheduleOnBrowserLoadIdle(
      () => {
        preloadActionMenus();
      },
      { delayMs: 1200 },
    );
    return () => {
      isActive = false;
      cancelIdle();
    };
  }, [isMobile, isReaderAwareRoute]);

  useEffect(() => {
    if (shouldRenderActionMenus) {
      return;
    }
    const node = actionsClusterRef.current;
    if (!node) {
      return;
    }
    let isActive = true;
    const handleActionClusterInteract = () => {
      void loadHeaderActionMenusModule()
        .catch(() => undefined)
        .finally(() => {
          if (isActive) {
            setShouldRenderActionMenus(true);
          }
        });
    };
    node.addEventListener("pointerenter", handleActionClusterInteract, { passive: true });
    node.addEventListener("focusin", handleActionClusterInteract);
    node.addEventListener("touchstart", handleActionClusterInteract, { passive: true });
    return () => {
      isActive = false;
      node.removeEventListener("pointerenter", handleActionClusterInteract);
      node.removeEventListener("focusin", handleActionClusterInteract);
      node.removeEventListener("touchstart", handleActionClusterInteract);
    };
  }, [shouldRenderActionMenus]);

  useEffect(() => {
    if (isMobile || isReaderAwareRoute || !currentUser || shouldRenderActionMenus) {
      return;
    }
    let isActive = true;
    void loadHeaderActionMenusModule()
      .catch(() => undefined)
      .finally(() => {
        if (isActive) {
          setShouldRenderActionMenus(true);
        }
      });
    return () => {
      isActive = false;
    };
  }, [currentUser, isMobile, isReaderAwareRoute, shouldRenderActionMenus]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
        setQuery("");
      }
    };

    if (isSearchOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isSearchOpen]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setDashboardMenuItems([]);
      return;
    }
    let isActive = true;
    void import("@/components/dashboard-menu")
      .then((module) => {
        if (!isActive) {
          return;
        }
        const items = Array.isArray(module.dashboardMenuItems) ? module.dashboardMenuItems : [];
        setDashboardMenuItems(items);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setDashboardMenuItems([]);
      });
    return () => {
      isActive = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!shouldRevalidatePublicCurrentUserOnMount) {
      return;
    }
    let isActive = true;
    const loadUser = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/me", { auth: true });
        if (!isActive) {
          return;
        }
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }
        const data = await response.json();
        if (!isActive) {
          return;
        }
        setCurrentUser(asPublicBootstrapCurrentUser(data?.user));
      } catch {
        if (!isActive) {
          return;
        }
        // Preserve bootstrap user snapshot on transient network failures.
      }
    };

    const cancelIdle = scheduleOnBrowserLoadIdle(
      () => {
        void loadUser();
      },
      { delayMs: 2500 },
    );

    return () => {
      isActive = false;
      cancelIdle();
    };
  }, [apiBase, shouldRevalidatePublicCurrentUserOnMount]);

  const dashboardMenuForUser = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    const grants = resolveGrants(currentUser);
    return buildDashboardMenuFromGrants(dashboardMenuItems, grants);
  }, [currentUser, dashboardMenuItems]);
  const dashboardHomeHref = useMemo(
    () =>
      currentUser
        ? getFirstAllowedDashboardRoute(resolveGrants(currentUser), { allowUsersForSelf: true })
        : "/dashboard",
    [currentUser],
  );
  const headerAvatarUrl = useMemo(
    () => buildAvatarRenderUrl(currentUser?.avatarUrl, 64, currentUser?.revision),
    [currentUser?.avatarUrl, currentUser?.revision],
  );

  useGlobalShortcuts({
    getDashboardHref: () => dashboardHomeHref,
    onOpenSearch: () => {
      setIsSearchOpen(true);
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    },
  });

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      const response = await apiFetch(apiBase, "/api/logout", {
        method: "POST",
        auth: true,
      });
      if (!response.ok) {
        void notifyToast({
          title: uiCopy.feedback.logoutFailedTitle,
          description: uiCopy.feedback.logoutFailedDescription,
          variant: "destructive",
        });
        return;
      }
      window.location.href = "/";
    } catch {
      void notifyToast({
        title: uiCopy.feedback.logoutFailedTitle,
        description: "Ocorreu um erro inesperado ao encerrar a sessão.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };
  const isElevated = variant === "fixed" && isScrolled;

  return (
    <header
      className={cn(
        "left-0 right-0 px-6 py-4 text-foreground transition-[background-color,backdrop-filter] duration-300 ease-in-out md:px-12",
        variant === "fixed"
          ? "fixed top-0 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-8 after:bg-linear-to-b after:from-background/70 after:via-background/25 after:to-transparent after:transition-opacity after:duration-300 after:ease-in-out"
          : "",
        variant === "fixed" ? (isElevated ? "after:opacity-100" : "after:opacity-0") : "",
        isElevated ? "bg-background/70 backdrop-blur-xl" : "bg-transparent backdrop-blur-none",
        variant === "static" ? "relative" : "",
        leading ? "z-10" : "z-50",
        leading ? "md:pl-(--sidebar-offset)" : "",
        className,
      )}
    >
      <nav className="relative z-10 flex items-center justify-between gap-3">
        <div
          data-testid="public-header-left-cluster"
          className={cn(
            "flex min-w-0 items-center gap-3 transition-all duration-300",
            isSearchOpen
              ? "opacity-0 invisible pointer-events-none md:opacity-100 md:visible md:pointer-events-auto"
              : "opacity-100 visible pointer-events-auto",
          )}
        >
          {leading}
          <Link
            to="/"
            className="flex items-center gap-3 text-2xl md:text-3xl font-black tracking-wider text-foreground"
          >
            {showWordmarkInNavbar ? (
              <>
                <img
                  src={navbarWordmarkUrl}
                  alt={siteName}
                  className="h-8 md:h-10 w-auto max-w-[200px] md:max-w-[260px] object-contain"
                />
                <span className="sr-only">{siteName}</span>
              </>
            ) : (
              <>
                {showSymbolInNavbar ? (
                  navbarSymbolUrl ? (
                    <ThemedSvgLogo
                      url={navbarSymbolUrl}
                      label={siteName}
                      className="h-9 w-9 rounded-full object-cover shadow-xs text-primary"
                    />
                  ) : (
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card/70 text-sm font-semibold">
                      {siteName.slice(0, 1)}
                    </span>
                  )
                ) : null}
                {showTextInNavbar ? <span>{siteName}</span> : null}
              </>
            )}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-3 md:gap-6">
          <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-foreground/80">
            {navbarLinks.map((item) => {
              const isInternal = isInternalHref(item.href);
              const isActive = isNavbarLinkActive(item.href);
              const className = `transition-colors ${
                isActive
                  ? "text-foreground font-semibold"
                  : "text-foreground/80 hover:text-foreground"
              }`;
              if (isInternal) {
                return (
                  <Link key={`${item.label}-${item.href}`} to={item.href} className={className}>
                    {item.label}
                  </Link>
                );
              }
              return (
                <a
                  key={`${item.label}-${item.href}`}
                  href={item.href}
                  className="text-foreground/80 hover:text-foreground transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.label}
                </a>
              );
            })}
          </div>
          <div
            ref={searchRef}
            data-testid="public-header-search-cluster"
            className={cn(
              "relative z-20 flex shrink-0 items-center gap-3 transition-all duration-300",
              isSearchOpen
                ? "absolute inset-x-0 top-1/2 z-30 mx-auto w-[min(22rem,calc(100vw-1rem))] -translate-y-1/2 md:static md:w-auto md:translate-y-0"
                : "w-auto",
            )}
          >
            <div
              className={`flex h-10 items-center gap-2 rounded-full transition-all duration-300 ${
                isSearchOpen ? "w-full bg-secondary/70 pl-3 pr-2 md:w-72" : "w-10 justify-center"
              }`}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={uiCopy.search.openAriaLabel}
                onClick={() => setIsSearchOpen((prev) => !prev)}
                className={cn(
                  "shrink-0 rounded-full text-foreground/80 hover:text-foreground",
                  isSearchOpen ? "h-8 w-8" : "h-10 w-10",
                )}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </Button>
              {isSearchOpen && (
                <input
                  autoFocus
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={uiCopy.search.inputPlaceholder}
                  className="w-full bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground"
                />
              )}
            </div>

            {showResults && (
              <Suspense
                fallback={
                  <div
                    data-testid="public-header-results"
                    className="search-popover-enter absolute top-12 left-0 right-0 mx-auto max-h-[78vh] w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-border/60 bg-background/95 p-4 shadow-lg backdrop-blur-sm md:left-auto md:right-0 md:mx-0 md:w-80"
                  >
                    <p className="text-sm text-muted-foreground">
                      {uiCopy.search.loadingSuggestions}
                    </p>
                  </div>
                }
              >
                <HeaderSearchPopover
                  queryTrimmed={queryTrimmed}
                  hasMinimumSearchQueryLength={hasMinimumSearchQueryLength}
                  isSearchLoading={isSearchLoading}
                  hasSearchRequestFailed={hasSearchRequestFailed}
                  projects={projects}
                  posts={posts}
                  tagTranslations={tagTranslations}
                  remoteSuggestions={remoteSuggestions}
                  bootstrapMediaVariants={bootstrapMediaVariants}
                  remoteMediaVariants={remoteMediaVariants}
                />
              </Suspense>
            )}
          </div>

          <div
            ref={actionsClusterRef}
            data-testid="public-header-actions-cluster"
            className={cn(
              "flex shrink-0 items-center gap-3 transition-all duration-300 md:gap-6",
              isSearchOpen
                ? "opacity-0 invisible pointer-events-none md:opacity-100 md:visible md:pointer-events-auto"
                : "opacity-100 visible pointer-events-auto",
            )}
          >
            {shouldRenderActionMenus ? (
              <Suspense
                fallback={
                  <HeaderActionsFallback
                    currentUser={currentUser}
                    headerAvatarUrl={headerAvatarUrl}
                  />
                }
              >
                <HeaderActionMenus
                  navbarLinks={navbarLinks}
                  isInternalHref={isInternalHref}
                  currentUser={currentUser}
                  headerAvatarUrl={headerAvatarUrl}
                  dashboardMenuForUser={dashboardMenuForUser}
                  headerMenuContentClass={headerMenuContentClass}
                  headerMenuItemClass={headerMenuItemClass}
                  isLoggingOut={isLoggingOut}
                  onLogout={handleLogout}
                />
              </Suspense>
            ) : (
              <HeaderActionsFallback
                currentUser={currentUser}
                headerAvatarUrl={headerAvatarUrl}
              />
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;

