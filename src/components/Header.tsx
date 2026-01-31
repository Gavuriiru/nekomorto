import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { projectData } from "@/data/projects";

const Header = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  const projectItems = projectData.slice(0, 3).map((project) => ({
    label: project.title,
    href: `/projeto/${project.id}`,
    image: project.cover,
    synopsis: project.synopsis,
    tags: project.tags,
  }));

  const postItems = [
    { label: "Atualização de comunidade", href: "/posts/comunidade" },
    { label: "Diário de desenvolvimento", href: "/posts/devlog" },
    { label: "Guia para novos membros", href: "/posts/guia-novos-membros" },
  ];

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
    return postItems.filter((item) => item.label.toLowerCase().includes(lowerQuery));
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

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-300 md:px-12 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-10 after:bg-gradient-to-b after:from-black/20 after:to-transparent ${
        isScrolled
          ? "bg-background/70 shadow-lg shadow-black/10 backdrop-blur-xl"
          : "bg-background/20 backdrop-blur-sm"
      }`}
    >
      <nav className="flex items-center justify-between">
        <Link to="/" className="text-2xl md:text-3xl font-black tracking-wider text-foreground">
          NEKOMATA
        </Link>
        
        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link
              to="/"
              className={`transition-colors ${
                location.pathname === "/"
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Início
            </Link>
            <Link
              to="/projetos"
              className={`transition-colors ${
                location.pathname.startsWith("/projetos")
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Projetos
            </Link>
            <Link
              to="/equipe"
              className={`transition-colors ${
                location.pathname.startsWith("/equipe")
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Equipe
            </Link>
            <a
              href="https://discord.gg/nekogroup"
              className="hover:text-foreground transition-colors"
              target="_blank"
              rel="noreferrer"
            >
              Discord
            </a>
            <a
              href="https://discord.gg/nekogroup"
              className="hover:text-foreground transition-colors"
              target="_blank"
              rel="noreferrer"
            >
              Recrutamento
            </a>
            <Link
              to="/sobre"
              className={`transition-colors ${
                location.pathname.startsWith("/sobre")
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sobre
            </Link>
          </div>

          <div className="relative flex items-center" ref={searchRef}>
            <div
              className={`flex items-center gap-2 rounded-full border border-transparent bg-secondary/30 px-3 py-2 transition-all duration-300 ${
                isSearchOpen ? "w-60 md:w-72 border-border bg-secondary/70" : "w-11"
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
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Pesquisar projetos e posts"
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
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
                            className="group flex gap-3 rounded-lg border border-border/60 bg-background/40 p-3 transition hover:border-primary/40 hover:bg-primary/5"
                          >
                            <div className="w-16 flex-shrink-0 overflow-hidden rounded-md bg-secondary aspect-[2/3]">
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
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                {item.synopsis}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {item.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-[9px] uppercase">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
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
        </div>
      </nav>
    </header>
  );
};

export default Header;
