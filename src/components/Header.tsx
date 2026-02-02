import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu } from "lucide-react";
import type { Project } from "@/data/projects";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api-base";

type HeaderProps = {
  variant?: "fixed" | "static";
  leading?: ReactNode;
  className?: string;
};

const Header = ({ variant = "fixed", leading, className }: HeaderProps) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
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
        const response = await fetch(`${apiBase}/api/public/projects`);
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
        const response = await fetch(`${apiBase}/api/public/posts`);
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
        const response = await fetch(`${apiBase}/api/public/tag-translations`);
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
        const response = await fetch(`${apiBase}/api/me`, { credentials: "include" });
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }
        const data = await response.json();
        setCurrentUser(data);
      } catch {
        setCurrentUser(null);
      }
    };

    loadUser();
  }, [apiBase]);

  return (
    <header
      className={cn(
        "left-0 right-0 px-6 py-4 text-white transition-all duration-300 md:px-12 after:pointer-events-none after:absolute after:inset-0 after:bg-gradient-to-b after:from-black/25 after:via-black/10 after:to-transparent",
        variant === "fixed" ? "fixed top-0" : "relative",
        isScrolled && variant === "fixed" ? "bg-background/70 backdrop-blur-xl" : "bg-transparent",
        leading ? "z-0" : "z-50",
        leading ? "md:pl-[var(--sidebar-offset)]" : "",
        className,
      )}
    >
      <nav className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {leading}
          <Link to="/" className="text-2xl md:text-3xl font-black tracking-wider text-white">
            NEKOMATA
          </Link>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-white/80">
            <Link
              to="/"
              className={`transition-colors ${
                location.pathname === "/"
                  ? "text-white font-semibold"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Início
            </Link>
            <Link
              to="/projetos"
              className={`transition-colors ${
                location.pathname.startsWith("/projetos")
                  ? "text-white font-semibold"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Projetos
            </Link>
            <Link
              to="/equipe"
              className={`transition-colors ${
                location.pathname.startsWith("/equipe")
                  ? "text-white font-semibold"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Equipe
            </Link>
            <a
              href="https://discord.com/invite/BAHKhdX2ju"
              className="text-white/80 hover:text-white transition-colors"
              target="_blank"
              rel="noreferrer"
            >
              Recrutamento
            </a>
            <Link
              to="/sobre"
              className={`transition-colors ${
                location.pathname.startsWith("/sobre")
                  ? "text-white font-semibold"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Sobre
            </Link>
          </div>

          <div className="relative flex items-center gap-3" ref={searchRef}>
            <div
              className={`flex items-center gap-2 rounded-full border border-transparent bg-secondary/30 px-3 py-2 transition-all duration-300 ${
                isSearchOpen ? "w-60 md:w-72 border-border bg-secondary/70" : "w-11"
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
                className="md:hidden h-10 w-10 rounded-full border border-white/10 bg-white/5 text-white/80 hover:text-white"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/">Início</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/projetos">Projetos</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/equipe">Equipe</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="https://discord.com/invite/BAHKhdX2ju" target="_blank" rel="noreferrer">
                  Recrutamento
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/sobre">Sobre</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {currentUser && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-11 gap-2 rounded-full px-2">
                  <Avatar className="h-8 w-8 border border-border/60">
                    {currentUser.avatarUrl ? (
                      <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                    ) : null}
                    <AvatarFallback className="bg-secondary text-xs text-foreground">
                      {currentUser.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium text-white md:inline">
                    {currentUser.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await fetch(`${apiBase}/api/logout`, {
                      method: "POST",
                      credentials: "include",
                    });
                    window.location.href = "/";
                  }}
                >
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;





