import {
  type DashboardMenuItem,
  dashboardMenuItems as defaultMenuItems,
  isDashboardMenuItemActive,
} from "@/components/dashboard-menu";
import DashboardNotificationsPopover from "@/components/dashboard/DashboardNotificationsPopover";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import ThemeModeSwitcher from "@/components/ThemeModeSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { toast } from "@/components/ui/use-toast";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { buildAvatarRenderUrl } from "@/lib/avatar-render-url";
import { resolveBranding } from "@/lib/branding";
import { isEditableShortcutTarget } from "@/lib/keyboard-shortcuts";
import { getNavbarIcon } from "@/lib/navbar-icons";
import { uiCopy } from "@/lib/ui-copy";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import { sanitizePublicHref } from "@/lib/url-safety";
import { cn } from "@/lib/utils";
import type { SearchSuggestion } from "@/types/search-suggestion";
import { LogOut, Menu } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

type DashboardHeaderUser = {
  name?: string;
  username?: string;
  avatarUrl?: string | null;
  revision?: string | null;
};

type DashboardHeaderProps = {
  currentUser?: DashboardHeaderUser | null;
  dashboardHomeHref?: string;
  menuItems?: DashboardMenuItem[];
  className?: string;
};

const DashboardCommandPalette = lazy(
  () => import("@/components/dashboard/DashboardCommandPalette"),
);
const DashboardSearchPopover = lazy(() => import("@/components/dashboard/DashboardSearchPopover"));

const DashboardHeader = ({
  currentUser,
  dashboardHomeHref = "/dashboard",
  menuItems = defaultMenuItems,
  className,
}: DashboardHeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const apiBase = getApiBase();
  const { settings } = useSiteSettings();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isNavbarMenuOpen, setIsNavbarMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteSuggestions, setRemoteSuggestions] = useState<SearchSuggestion[]>([]);
  const [remoteMediaVariants, setRemoteMediaVariants] = useState<UploadMediaVariantsMap>({});
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [hasSearchRequestFailed, setHasSearchRequestFailed] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const activeMenuItem = useMemo(() => {
    return (
      menuItems.find((item) => isDashboardMenuItemActive(item, location.pathname)) ??
      menuItems.find((item) => item.href === "/dashboard") ??
      null
    );
  }, [location.pathname, menuItems]);

  const siteName = (settings.site.name || "Nekomata").toUpperCase();
  const branding = resolveBranding(settings);
  const logoUrl = branding.assets.symbolUrl;
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
    "border-border/70 bg-popover/95 text-popover-foreground backdrop-blur-xs";
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
  const currentUserAvatarUrl = useMemo(
    () => buildAvatarRenderUrl(currentUser?.avatarUrl, 128, currentUser?.revision),
    [currentUser?.avatarUrl, currentUser?.revision],
  );
  const userName = currentUser?.name || currentUser?.username || uiCopy.user.account;
  const userInitials = (currentUser?.name || currentUser?.username || "??")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join("")
    .toUpperCase();
  const queryTrimmed = query.trim();
  const showResults = isSearchOpen && queryTrimmed.length > 0;
  const hasMinimumSearchQueryLength = queryTrimmed.length >= 2;

  const focusSearchInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  const openSearchFromShortcut = useCallback(() => {
    setIsSearchOpen(true);
    focusSearchInput();
  }, [focusSearchInput]);

  const resolveDashboardHomeHref = useCallback(() => dashboardHomeHref, [dashboardHomeHref]);

  useGlobalShortcuts({
    getDashboardHref: resolveDashboardHomeHref,
    onOpenSearch: openSearchFromShortcut,
  });

  useEffect(() => {
    if (!location.pathname.startsWith("/dashboard")) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target)) {
        return;
      }
      if ((event.metaKey || event.ctrlKey) && String(event.key || "").toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen((previous) => !previous);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [location.pathname]);

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
    if (!isSearchOpen || !hasMinimumSearchQueryLength) {
      setRemoteSuggestions([]);
      setRemoteMediaVariants({});
      setIsSearchLoading(false);
      setHasSearchRequestFailed(false);
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
          throw new Error(`dashboard_search_suggest_${response.status}`);
        }
        const payload = (await response.json()) as {
          suggestions?: unknown[];
          mediaVariants?: unknown;
        };
        if (!isActive) {
          return;
        }
        const suggestions = Array.isArray(payload.suggestions)
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
              .filter((item) => item !== null)
          : [];
        setRemoteSuggestions(suggestions);
        setRemoteMediaVariants(
          payload.mediaVariants && typeof payload.mediaVariants === "object"
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

  useEffect(() => {
    if (isSearchOpen) {
      void import("@/components/dashboard/DashboardSearchPopover");
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      void import("@/components/dashboard/DashboardCommandPalette");
    }
  }, [isCommandPaletteOpen]);

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
        toast({
          title: uiCopy.feedback.logoutFailedTitle,
          description: uiCopy.feedback.logoutFailedDescription,
          variant: "destructive",
        });
        return;
      }
      window.location.href = "/";
    } catch {
      toast({
        title: uiCopy.feedback.logoutFailedTitle,
        description: "Ocorreu um erro inesperado ao encerrar a sessão.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header
      style={{
        left: "var(--sidebar-header-left)",
      }}
      className={cn(
        "dashboard-scroll-lock-fixed-right fixed left-0 right-0 top-0 z-20 bg-sidebar transition-[left] duration-[var(--sidebar-desktop-transition-duration)] ease-[var(--sidebar-desktop-transition-timing)]",
        className,
      )}
    >
      <div className="relative flex h-19 items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 2xl:px-8">
        <div
          data-testid="dashboard-header-left-cluster"
          className={cn(
            "flex min-w-0 items-center gap-2 transition-all duration-300 lg:gap-3",
            isSearchOpen
              ? "opacity-0 invisible pointer-events-none xl:opacity-100 xl:visible xl:pointer-events-auto"
              : "opacity-100 visible pointer-events-auto",
          )}
        >
          <SidebarTrigger className="h-9 w-9 rounded-lg border border-border/60 bg-card/60 text-foreground/80 hover:bg-accent hover:text-accent-foreground" />
          <Link
            to="/dashboard"
            data-testid="dashboard-header-mobile-logo"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-foreground/85 transition hover:bg-accent xl:hidden"
          >
            {logoUrl ? (
              <ThemedSvgLogo
                url={logoUrl}
                label={siteName}
                className="h-6 w-6 rounded-full object-cover text-primary"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-card/70 text-[11px] font-semibold">
                {siteName.slice(0, 1)}
              </span>
            )}
            <span className="sr-only">{siteName}</span>
          </Link>
          <Link
            to="/dashboard"
            className="hidden items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-foreground/85 transition hover:bg-accent xl:flex"
          >
            {logoUrl ? (
              <ThemedSvgLogo
                url={logoUrl}
                label={siteName}
                className="h-6 w-6 rounded-full object-cover text-primary"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-card/70 text-[11px] font-semibold">
                {siteName.slice(0, 1)}
              </span>
            )}
            <span className="max-w-44 truncate text-[11px] font-semibold uppercase tracking-[0.2em]">
              {siteName}
            </span>
          </Link>
          <div className="min-w-0 hidden lg:block">
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              {uiCopy.dashboard.internal}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {activeMenuItem?.label || uiCopy.dashboard.home}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-4">
          <div className="hidden 2xl:flex items-center gap-5 text-sm font-medium text-foreground/80">
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
                  className="text-foreground/80 transition-colors hover:text-foreground"
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
            data-testid="dashboard-header-search-cluster"
            className={cn(
              "relative z-20 flex shrink-0 items-center gap-2 transition-all duration-300",
              isSearchOpen
                ? "absolute inset-x-0 top-1/2 z-30 mx-auto w-[min(22rem,calc(100vw-1rem))] -translate-y-1/2 xl:static xl:w-auto xl:translate-y-0"
                : "w-auto",
            )}
          >
            <div
              className={`flex h-10 items-center gap-2 rounded-full transition-all duration-300 ${
                isSearchOpen
                  ? "w-full bg-secondary/70 pl-3 pr-2 xl:w-52 2xl:w-64"
                  : "w-10 justify-center"
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
              <Suspense fallback={null}>
                <DashboardSearchPopover
                  hasMinimumSearchQueryLength={hasMinimumSearchQueryLength}
                  isSearchLoading={isSearchLoading}
                  hasSearchRequestFailed={hasSearchRequestFailed}
                  remoteSuggestions={remoteSuggestions}
                  remoteMediaVariants={remoteMediaVariants}
                />
              </Suspense>
            )}
          </div>

          <div
            data-testid="dashboard-header-actions-cluster"
            className={cn(
              "flex shrink-0 items-center gap-2 transition-all duration-300 sm:gap-3 lg:gap-4",
              isSearchOpen
                ? "opacity-0 invisible pointer-events-none xl:opacity-100 xl:visible xl:pointer-events-auto"
                : "opacity-100 visible pointer-events-auto",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              className="hidden h-10 items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground md:inline-flex"
              onClick={() => setIsCommandPaletteOpen(true)}
            >
              <span>Comandos</span>
              <span className="rounded-md border border-border/70 px-1.5 py-0.5 text-[10px]">
                Ctrl/Cmd+K
              </span>
            </Button>

            <DashboardNotificationsPopover
              apiBase={apiBase}
              open={isNotificationsOpen}
              onOpenChange={setIsNotificationsOpen}
            />

            <ThemeModeSwitcher />
            <DropdownMenu open={isNavbarMenuOpen} onOpenChange={setIsNavbarMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full border border-border/60 bg-card/50 text-foreground/85 hover:bg-accent hover:text-accent-foreground 2xl:hidden"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              {isNavbarMenuOpen ? (
                <DropdownMenuContent align="end" className={`w-48 ${headerMenuContentClass}`}>
                  {navbarLinks.map((item) => {
                    const ItemIcon = getNavbarIcon(item.icon);
                    return (
                      <DropdownMenuItem
                        key={`${item.label}-${item.href}`}
                        asChild
                        className={headerMenuItemClass}
                      >
                        {isInternalHref(item.href) ? (
                          <Link to={item.href} className="flex items-center gap-2">
                            <ItemIcon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        ) : (
                          <a
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2"
                          >
                            <ItemIcon className="h-4 w-4" />
                            {item.label}
                          </a>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              ) : null}
            </DropdownMenu>

            <DropdownMenu
              modal={false}
              open={isAccountMenuOpen}
              onOpenChange={setIsAccountMenuOpen}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 rounded-full border border-border/60 bg-card/50 px-2 text-foreground hover:bg-accent"
                >
                  <Avatar className="h-8 w-8 border border-border/70">
                    {currentUserAvatarUrl ? (
                      <AvatarImage src={currentUserAvatarUrl} alt={userName} />
                    ) : null}
                    <AvatarFallback className="bg-card/80 text-xs text-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-40 truncate text-sm font-medium text-foreground xl:inline">
                    {userName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              {isAccountMenuOpen ? (
                <DropdownMenuContent align="end" className={cn("w-56", headerMenuContentClass)}>
                  {menuItems
                    .filter((item) => item.enabled)
                    .map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <DropdownMenuItem
                          key={item.href}
                          asChild
                          className="focus:bg-accent focus:text-accent-foreground"
                        >
                          <Link to={item.href} className="flex items-center gap-2">
                            <ItemIcon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  <DropdownMenuSeparator className="bg-border/70" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="focus:bg-accent focus:text-accent-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                    {isLoggingOut ? uiCopy.actions.loggingOut : uiCopy.actions.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              ) : null}
            </DropdownMenu>
          </div>
        </div>
      </div>
      {isCommandPaletteOpen ? (
        <Suspense fallback={null}>
          <DashboardCommandPalette
            open={isCommandPaletteOpen}
            onOpenChange={setIsCommandPaletteOpen}
            menuItems={menuItems}
            onNavigate={(href) => {
              navigate(href);
            }}
            onOpenNotifications={() => {
              setIsNotificationsOpen(true);
            }}
          />
        </Suspense>
      ) : null}
    </header>
  );
};

export default DashboardHeader;
