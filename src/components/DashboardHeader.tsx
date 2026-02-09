import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import { dashboardMenuItems as defaultMenuItems, type DashboardMenuItem } from "@/components/dashboard-menu";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Project } from "@/data/projects";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { getNavbarIcon } from "@/lib/navbar-icons";
import { resolveBranding } from "@/lib/branding";

type DashboardHeaderUser = {
  name?: string;
  username?: string;
  avatarUrl?: string | null;
};

type DashboardHeaderProps = {
  currentUser?: DashboardHeaderUser | null;
  menuItems?: DashboardMenuItem[];
  className?: string;
};

const DashboardHeader = ({
  currentUser,
  menuItems = defaultMenuItems,
  className,
}: DashboardHeaderProps) => {
  const location = useLocation();
  const apiBase = getApiBase();
  const { settings } = useSiteSettings();
  const isMobile = useIsMobile();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
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
  const searchRef = useRef<HTMLDivElement | null>(null);

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
            href: String(link?.href || "").trim(),
            icon: String(link?.icon || "").trim(),
          }))
          .filter((link) => link.label && link.href)
      : [];
  }, [settings.navbar.links]);
  const headerMenuContentClass =
    "border-white/25 bg-gradient-to-b from-black/40 via-black/25 to-black/10 text-white/90 shadow-xl backdrop-blur-sm";
  const headerMenuItemClass = "focus:bg-white/10 focus:text-white";
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
  const userName = currentUser?.name || currentUser?.username || "Conta";
  const userInitials = (currentUser?.name || currentUser?.username || "??")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0])
    .join("")
    .toUpperCase();

  const projectItems = projects.map((project) => ({
    label: project.title,
    href: `/projeto/${project.id}`,
    image: project.cover,
    synopsis: project.synopsis,
    tags: project.tags.map((tag) => tagTranslations[tag] || tag),
  }));

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
    const lowerQuery = query.toLowerCase();
    return projectItems.filter((item) => {
      const searchableText = [item.label, item.synopsis, item.tags.join(" ")].join(" ").toLowerCase();
      return searchableText.includes(lowerQuery);
    });
  }, [projectItems, query]);

  const filteredPosts = useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    const lowerQuery = query.toLowerCase();
    return postItems.filter((item) =>
      [item.label, item.excerpt].join(" ").toLowerCase().includes(lowerQuery),
    );
  }, [postItems, query]);

  const showResults = isSearchOpen && query.trim().length > 0;
  const hasResults = filteredProjects.length > 0 || filteredPosts.length > 0;

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

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      await apiFetch(apiBase, "/api/logout", {
        method: "POST",
        auth: true,
      });
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <header
      style={{
        left: isMobile
          ? "0px"
          : "calc(var(--sidebar-offset) - (0.3125rem + min(0.1875rem, max(0rem, calc(var(--sidebar-width-current) - var(--sidebar-width-icon))))))",
      }}
      className={cn(
        "fixed left-0 right-0 top-0 z-40 bg-sidebar",
        className,
      )}
    >
      <div className="flex h-[4.75rem] items-center justify-between px-3 sm:px-4 lg:px-6 2xl:px-8">
        <div className="flex min-w-0 items-center gap-2 lg:gap-3">
          <SidebarTrigger className="h-9 w-9 rounded-lg border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white" />
          <Link
            to="/dashboard"
            className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-white/85 transition hover:bg-white/10 xl:flex"
          >
            {logoUrl ? (
              <ThemedSvgLogo
                url={logoUrl}
                label={siteName}
                className="h-6 w-6 rounded-full object-cover text-primary"
              />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[11px] font-semibold">
                {siteName.slice(0, 1)}
              </span>
            )}
            <span className="max-w-[11rem] truncate text-[11px] font-semibold uppercase tracking-[0.2em]">
              {siteName}
            </span>
          </Link>
          <div className="min-w-0 hidden lg:block">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/50">Painel interno</p>
            <p className="truncate text-sm font-semibold text-white">
              {activeMenuItem?.label || "Dashboard"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          <div className="hidden 2xl:flex items-center gap-5 text-sm font-medium text-white/80">
            {navbarLinks.map((item) => {
              const isInternal = isInternalHref(item.href);
              const isActive = isNavbarLinkActive(item.href);
              const className = `transition-colors ${
                isActive ? "text-white font-semibold" : "text-white/80 hover:text-white"
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
                  className="text-white/80 transition-colors hover:text-white"
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.label}
                </a>
              );
            })}
          </div>
          <div className="relative hidden items-center gap-2 xl:flex" ref={searchRef}>
            <div
              className={`flex items-center gap-2 rounded-full border border-transparent bg-secondary/30 px-3 py-2 transition-all duration-300 ${
                isSearchOpen ? "w-52 2xl:w-64 border-border bg-secondary/70" : "w-11"
              }`}
            >
              <button
                type="button"
                aria-label="Abrir pesquisa"
                onClick={() => setIsSearchOpen((prev) => !prev)}
                className="text-white transition-colors hover:text-primary"
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
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pesquisar projetos e posts"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/60"
                />
              )}
            </div>

            {showResults && (
              <div className="absolute right-0 top-12 w-80 rounded-xl border border-border/60 bg-background/95 p-4 shadow-lg backdrop-blur">
                {filteredProjects.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Projetos
                    </p>
                    <ul className="mt-3 space-y-3">
                      {filteredProjects.map((item) => (
                        <li key={item.href}>
                          <Link
                            to={item.href}
                            className="group flex h-[9rem] items-start gap-4 overflow-hidden rounded-xl border border-border/60 bg-gradient-card p-4 transition hover:border-primary/40 hover:bg-primary/5"
                          >
                            <div
                              className="w-20 flex-shrink-0 self-start overflow-hidden rounded-lg bg-secondary"
                              style={{ aspectRatio: "23 / 32" }}
                            >
                              <img
                                src={item.image}
                                alt={item.label}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground group-hover:text-primary">
                                {item.label}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                                {item.synopsis}
                              </p>
                              {item.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5 overflow-hidden">
                                  {item.tags.slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-[9px] uppercase">
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
                    <ul className="mt-2 space-y-2">
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full border border-white/10 bg-white/5 text-white/80 hover:text-white 2xl:hidden"
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
                      <a href={item.href} target="_blank" rel="noreferrer" className="flex items-center gap-2">
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
                className="h-10 rounded-full border border-white/10 bg-white/5 px-2 text-white hover:bg-white/10"
              >
                <Avatar className="h-8 w-8 border border-white/20">
                  {currentUser?.avatarUrl ? <AvatarImage src={currentUser.avatarUrl} alt={userName} /> : null}
                  <AvatarFallback className="bg-white/10 text-xs text-white">{userInitials}</AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[10rem] truncate text-sm font-medium text-white xl:inline">
                  {userName}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 border-white/15 bg-sidebar/95 text-white shadow-xl backdrop-blur-sm"
            >
              {menuItems
                .filter((item) => item.enabled)
                .map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <DropdownMenuItem key={item.href} asChild className="focus:bg-white/10 focus:text-white">
                      <Link to={item.href} className="flex items-center gap-2">
                        <ItemIcon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="focus:bg-white/10 focus:text-white"
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? "Saindo..." : "Sair"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
