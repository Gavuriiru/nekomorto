import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const Header = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const projectItems = [
    { label: "Projeto Aurora", href: "/projetos/aurora" },
    { label: "Projeto Nekomata", href: "/projetos/nekomata" },
    { label: "Projeto Rainbow", href: "/projetos/rainbow" },
  ];

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
    return projectItems.filter((item) => item.label.toLowerCase().includes(lowerQuery));
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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 md:px-12">
      <nav className="flex items-center justify-between">
        <Link to="/" className="text-2xl md:text-3xl font-black tracking-wider text-foreground">
          NEKOMATA
        </Link>
        
        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              Início
            </Link>
            <Link to="/projetos" className="hover:text-foreground transition-colors">
              Projetos
            </Link>
            <Link to="/equipe" className="hover:text-foreground transition-colors">
              Equipe
            </Link>
            <a
              href="https://discord.gg/nekogroup"
              className="hover:text-foreground transition-colors"
              target="_blank"
              rel="noreferrer"
            >
              Convite Discord
            </a>
            <a
              href="https://discord.gg/nekogroup"
              className="hover:text-foreground transition-colors"
              target="_blank"
              rel="noreferrer"
            >
              Recrutamento
            </a>
            <Link to="/sobre" className="hover:text-foreground transition-colors">
              Sobre
            </Link>
          </div>

          <div className="relative flex items-center">
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
              <div className="absolute right-0 top-12 w-72 rounded-xl border border-border/60 bg-background/95 p-4 shadow-lg backdrop-blur">
                {filteredProjects.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Projetos
                    </p>
                    <ul className="mt-2 space-y-2">
                      {filteredProjects.map((item) => (
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
