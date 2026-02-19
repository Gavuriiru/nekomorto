import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { LogOut, Menu } from "lucide-react";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import ThemeModeSwitcher from "@/components/ThemeModeSwitcher";
import { dashboardMenuItems } from "@/components/dashboard-menu";
import type { Project } from "@/data/projects";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { getNavbarIcon } from "@/lib/navbar-icons";
import { resolveBranding } from "@/lib/branding";
import { rankPosts, rankProjects, selectVisibleTags, sortAlphabeticallyPtBr } from "@/lib/search-ranking";
import { useDynamicSynopsisClamp } from "@/hooks/use-dynamic-synopsis-clamp";
import { buildDashboardMenuFromGrants, resolveGrants } from "@/lib/access-control";
import { sanitizePublicHref } from "@/lib/url-safety";

type HeaderProps = {
  variant?: "fixed" | "static";
  leading?: ReactNode;
  className?: string;
};

const Header = ({ variant = "fixed", leading, className }: HeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
    accessRole?: string;
    permissions?: string[];
    ownerIds?: string[];
    primaryOwnerId?: string | null;
    grants?: Partial<Record<string, boolean>>;
  } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [posts, setPosts] = useState<
    Array<{
      title: string;
      slug: string;
      excerpt?: string | null;
    }>
  >([]);
  const [tagTranslations, setTagTranslations] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const apiBase = getApiBase();
  const { settings } = useSiteSettings();

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

  const projectItems = useMemo(
    () =>
      projects.map((project) => ({
        label: project.title,
        href: `/projeto/${project.id}`,
        image: project.cover,
        synopsis: project.synopsis,
        tags: selectVisibleTags(sortAlphabeticallyPtBr(project.tags.map((tag) => tagTranslations[tag] || tag)), 2, 18),
      })),
    [projects, tagTranslations],
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
        const response = await apiFetch(apiBase, "/api/public/tag-translations", { cache: "no-store" });
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

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await apiFetch(apiBase, "/api/public/me", { auth: true });
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }
        const data = await response.json();
        setCurrentUser(data?.user ?? null);
      } catch {
        setCurrentUser(null);
      }
    };

    loadUser();
  }, [apiBase]);

  const dashboardMenuForUser = useMemo(() => {
    if (!currentUser) {
      return [];
    }
    const grants = resolveGrants(currentUser);
    return buildDashboardMenuFromGrants(dashboardMenuItems, grants);
  }, [currentUser]);

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
          title: "Não foi possível sair",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
        return;
      }
      window.location.href = "/";
    } catch {
      toast({
        title: "Não foi possível sair",
        description: "Ocorreu um erro inesperado ao encerrar a sessão.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header
      className={cn(
        "left-0 right-0 px-6 py-4 text-foreground transition-all duration-300 md:px-12 after:pointer-events-none after:absolute after:inset-0 after:bg-linear-to-b after:from-background/70 after:via-background/25 after:to-transparent",
        variant === "fixed" ? "fixed top-0" : "relative",
        isScrolled && variant === "fixed" ? "bg-background/70 backdrop-blur-xl" : "bg-transparent",
        leading ? "z-10" : "z-50",
        leading ? "md:pl-(--sidebar-offset)" : "",
        className,
      )}
    >
      <nav className="relative flex items-center justify-between gap-3">
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
          <Link to="/" className="flex items-center gap-3 text-2xl md:text-3xl font-black tracking-wider text-foreground">
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
                isActive ? "text-foreground font-semibold" : "text-foreground/80 hover:text-foreground"
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
              className={`flex items-center gap-2 rounded-full border border-transparent bg-secondary/30 px-3 py-2 transition-all duration-300 ${
                isSearchOpen ? "w-full border-border bg-secondary/70 md:w-72" : "w-11"
              }`}
            >
              <button
                type="button"
                aria-label="Abrir pesquisa"
                onClick={() => setIsSearchOpen((prev) => !prev)}
                className="text-foreground transition-colors hover:text-primary"
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
              </button>
              {isSearchOpen && (
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pesquisar projetos e posts"
                  className="w-full bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground"
                />
              )}
            </div>

            {showResults && (
              <div
                ref={synopsisRootRef}
                data-testid="public-header-results"
                className="search-popover-enter absolute top-12 left-0 right-0 mx-auto max-h-[78vh] w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-border/60 bg-background/95 p-4 shadow-lg backdrop-blur-sm md:left-auto md:right-0 md:mx-0 md:w-80"
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
                            <div data-synopsis-role="column" data-synopsis-key={item.href} className="min-w-0 h-full flex flex-col">
                              <p data-synopsis-role="title" className="line-clamp-1 shrink-0 text-sm font-semibold text-foreground group-hover:text-primary">
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
                                <div data-synopsis-role="badges" className="mt-auto pt-2 flex min-w-0 flex-wrap gap-1.5">
                                  {item.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-[9px] uppercase whitespace-nowrap">
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
                  <p className="text-sm text-muted-foreground">
                    Nenhum resultado encontrado para a sua pesquisa.
                  </p>
                )}
              </div>
            )}
          </div>

          <div
            data-testid="public-header-actions-cluster"
            className={cn(
              "flex shrink-0 items-center gap-3 transition-all duration-300 md:gap-6",
              isSearchOpen
                ? "opacity-0 invisible pointer-events-none md:opacity-100 md:visible md:pointer-events-auto"
                : "opacity-100 visible pointer-events-auto",
            )}
          >

            <ThemeModeSwitcher />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden h-10 w-10 rounded-full border border-border/60 bg-card/50 text-foreground/85 hover:bg-accent hover:text-accent-foreground"
                  aria-label="Abrir menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={`w-48 ${headerMenuContentClass}`}>
                {navbarLinks.map((item) => {
                  const ItemIcon = getNavbarIcon(item.icon);
                  return (
                    <DropdownMenuItem key={`${item.label}-${item.href}`} asChild className={headerMenuItemClass}>
                      {isInternalHref(item.href) ? (
                        <Link to={item.href} className="flex items-center gap-2">
                          <ItemIcon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      ) : (
                        <a href={item.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                          <ItemIcon className="h-4 w-4" />
                          {item.label}
                        </a>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {currentUser && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-11 gap-2 rounded-full px-2">
                    <Avatar className="h-8 w-8 border border-border/70 shadow-[0_10px_24px_-18px_hsl(var(--foreground)/0.65)]">
                      {currentUser.avatarUrl ? (
                        <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                      ) : null}
                      <AvatarFallback className="bg-secondary text-xs text-foreground">
                        {(currentUser.name || "").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium text-foreground lg:inline">
                      {currentUser.name || ""}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={`w-56 ${headerMenuContentClass}`}>
                  {dashboardMenuForUser
                    .map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <DropdownMenuItem key={item.href} asChild className={headerMenuItemClass}>
                          <Link to={item.href} className="flex items-center gap-2">
                            <ItemIcon className="h-4 w-4" />
                            {item.label}
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  <DropdownMenuSeparator className="bg-border/70" />
                  <DropdownMenuItem
                    className={headerMenuItemClass}
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    <LogOut className="h-4 w-4" />
                    {isLoggingOut ? "Saindo..." : "Sair"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;







