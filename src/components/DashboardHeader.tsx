import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import ThemeModeSwitcher from "@/components/ThemeModeSwitcher";
import {
  dashboardMenuItems as defaultMenuItems,
  type DashboardMenuItem,
} from "@/components/dashboard-menu";
import DashboardCommandPalette from "@/components/dashboard/DashboardCommandPalette";
import DashboardNotificationsPopover from "@/components/dashboard/DashboardNotificationsPopover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Project } from "@/data/projects";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { getNavbarIcon } from "@/lib/navbar-icons";
import { resolveBranding } from "@/lib/branding";
import {
  rankPosts,
  rankProjects,
  selectVisibleTags,
  sortAlphabeticallyPtBr,
} from "@/lib/search-ranking";
import { buildTranslationMap, translateTag } from "@/lib/project-taxonomy";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { isEditableShortcutTarget } from "@/lib/keyboard-shortcuts";
import { sanitizePublicHref } from "@/lib/url-safety";
import { uiCopy } from "@/lib/ui-copy";

type DashboardHeaderUser = {
  name?: string;
  username?: string;
  avatarUrl?: string | null;
};

type DashboardHeaderProps = {
  currentUser?: DashboardHeaderUser | null;
  dashboardHomeHref?: string;
  menuItems?: DashboardMenuItem[];
  className?: string;
};

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
  const isMobile = useIsMobile();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [posts, setPosts] = useState<
    Array<{
      title: string;
      slug: string;
      excerpt?: string | null;
    }>
  >([]);
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>({});
  const tagTranslationMap = useMemo(() => buildTranslationMap(tagTranslations), [tagTranslations]);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const activeMenuItem = useMemo(() => {
    const exactMatch = menuItems.find((item) => item.href === location.pathname);
    if (exactMatch) {
      return exactMatch;
    }
    const prefixedMatch = menuItems.find(
      (item) => item.href !== "/dashboard" && location.pathname.startsWith(`${item.href}/`),
    );
    return prefixedMatch ?? menuItems.find((item) => item.href === "/dashboard") ?? null;
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
  const userName = currentUser?.name || currentUser?.username || uiCopy.user.account;
  const userInitials = (currentUser?.name || currentUser?.username || "??")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join("")
    .toUpperCase();

  const projectItems = useMemo(
    () =>
      projects.map((project) => ({
        label: project.title,
        href: `/projeto/${project.id}`,
        image: project.cover,
        synopsis: project.synopsis,
        tags: selectVisibleTags(
          sortAlphabeticallyPtBr(project.tags.map((tag) => translateTag(tag, tagTranslationMap))),
          2,
          18,
        ),
      })),
    [projects, tagTranslationMap],
  );

  const postItems = useMemo(
    () =>
      posts.map((post) => ({
        label: post.title,
        href: `/postagem/${post.slug}`,
        excerpt: post.excerpt || "",
      })),
    [posts],
  );

  const filteredProjects = useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    return rankProjects(projectItems, query);
  }, [projectItems, query]);

  const filteredPosts = useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    return rankPosts(postItems, query);
  }, [postItems, query]);
  const showResults = isSearchOpen && query.trim().length > 0;
  const hasResults = filteredProjects.length > 0 || filteredPosts.length > 0;
  const synopsisKeys = useMemo(() => filteredProjects.map((item) => item.href), [filteredProjects]);
  const { rootRef: synopsisRootRef, lineByKey: synopsisLineByKey } = useDynamicSynopsisClamp({
    enabled: showResults,
    keys: synopsisKeys,
    maxLines: 4,
  });
  const getSynopsisClampClass = (key: string) => {
    const lines = synopsisLineByKey[key] ?? 2;
    if (lines <= 0) {
      return "hidden";
    }
    if (lines === 1) {
      return "line-clamp-1";
    }
    if (lines === 2) {
      return "line-clamp-2";
    }
    if (lines === 3) {
      return "line-clamp-3";
    }
    return "line-clamp-4";
  };

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
    const loadProjects = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/projects");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        setProjects(Array.isArray(data.projects) ? data.projects : []);
      } catch {
        setProjects([]);
      }
    };

    loadProjects();
  }, [apiBase]);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/posts");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        setPosts(Array.isArray(data.posts) ? data.posts : []);
      } catch {
        setPosts([]);
      }
    };

    loadPosts();
  }, [apiBase]);

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/tag-translations", {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        setTagTranslations(data.tags || {});
      } catch {
        setTagTranslations({});
      }
    };

    loadTranslations();
  }, [apiBase]);

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
        left: isMobile
          ? "0px"
          : "calc(var(--sidebar-offset) - (0.3125rem + min(0.1875rem, max(0rem, calc(var(--sidebar-width-current) - var(--sidebar-width-icon))))))",
      }}
      className={cn("fixed left-0 right-0 top-0 z-40 bg-sidebar", className)}
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
              <div
                ref={synopsisRootRef}
                data-testid="dashboard-header-results"
                className="search-popover-enter absolute top-12 left-0 right-0 mx-auto max-h-[78vh] w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-border/60 bg-background/95 p-4 shadow-lg backdrop-blur-sm xl:left-auto xl:right-0 xl:mx-0 xl:w-80"
              >
                {filteredProjects.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Projetos
                    </p>
                    <ul className="no-scrollbar mt-3 max-h-[44vh] space-y-3 overflow-y-auto overscroll-contain pr-1">
                      {filteredProjects.map((item) => (
                        <li key={item.href}>
                          <Link
                            to={item.href}
                            className="group flex h-36 items-start gap-4 overflow-hidden rounded-xl border border-border/60 bg-gradient-card p-4 transition hover:border-primary/40 hover:bg-primary/5"
                          >
                            <div
                              className="w-20 shrink-0 self-start overflow-hidden rounded-lg bg-secondary"
                              style={{ aspectRatio: "46 / 65" }}
                            >
                              <img
                                src={item.image}
                                alt={item.label}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            </div>
                            <div
                              data-synopsis-role="column"
                              data-synopsis-key={item.href}
                              className="min-w-0 h-full flex flex-col"
                            >
                              <p
                                data-synopsis-role="title"
                                className="line-clamp-1 shrink-0 text-sm font-semibold text-foreground group-hover:text-primary"
                              >
                                {item.label}
                              </p>
                              <p
                                className={cn(
                                  "mt-1 overflow-hidden text-xs leading-snug text-muted-foreground",
                                  getSynopsisClampClass(item.href),
                                )}
                                data-synopsis-role="synopsis"
                              >
                                {item.synopsis}
                              </p>
                              {item.tags.length > 0 && (
                                <div
                                  data-synopsis-role="badges"
                                  className="mt-auto pt-2 flex min-w-0 flex-wrap gap-1.5"
                                >
                                  {item.tags.map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="secondary"
                                      className="text-[9px] uppercase whitespace-nowrap"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {filteredPosts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Posts
                    </p>
                    <ul className="no-scrollbar mt-2 max-h-[26vh] space-y-2 overflow-y-auto overscroll-contain pr-1">
                      {filteredPosts.map((item) => (
                        <li key={item.href}>
                          <Link
                            to={item.href}
                            className="text-sm text-foreground transition-colors hover:text-primary"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!hasResults && (
                  <p className="text-sm text-muted-foreground">{uiCopy.search.noResults}</p>
                )}
              </div>
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
            <DropdownMenu>
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
            </DropdownMenu>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 rounded-full border border-border/60 bg-card/50 px-2 text-foreground hover:bg-accent"
                >
                  <Avatar className="h-8 w-8 border border-border/70">
                    {currentUser?.avatarUrl ? (
                      <AvatarImage src={currentUser.avatarUrl} alt={userName} />
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
              <DropdownMenuContent
                align="end"
                className="w-56 border-border/70 bg-popover/95 text-popover-foreground shadow-xl backdrop-blur-xs"
              >
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
            </DropdownMenu>
          </div>
        </div>
      </div>
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
    </header>
  );
};

export default DashboardHeader;
