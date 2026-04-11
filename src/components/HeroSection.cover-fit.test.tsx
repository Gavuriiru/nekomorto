import * as React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HeroSection from "@/components/HeroSection";

const themeModeState = vi.hoisted(() => ({
  effectiveMode: "dark" as "light" | "dark",
}));
const usePublicBootstrapMock = vi.hoisted(() => vi.fn());
const browserIdleState = vi.hoisted(() => ({
  autoRun: true,
  callbacks: [] as Array<(deadline: IdleDeadline) => void>,
}));
const carouselState = vi.hoisted(() => ({
  api: null as null | {
    scrollNext: () => void;
    scrollPrev: () => void;
  },
  scrollNext: vi.fn(),
  selectedIndex: 0,
  slideCount: 0,
}));

vi.mock("@/hooks/use-public-bootstrap", () => ({
  usePublicBootstrap: () => usePublicBootstrapMock(),
}));

vi.mock("@/hooks/use-theme-mode", () => ({
  useThemeMode: () => ({
    globalMode: "dark",
    effectiveMode: themeModeState.effectiveMode,
    preference: "global",
    isOverridden: false,
    setPreference: vi.fn(),
  }),
}));

vi.mock("@/lib/browser-idle", () => ({
  scheduleOnBrowserIdle: (callback: (deadline: IdleDeadline) => void) => {
    const deadline = {
      didTimeout: false,
      timeRemaining: () => 16,
    } as IdleDeadline;
    browserIdleState.callbacks.push(callback);
    if (browserIdleState.autoRun) {
      callback(deadline);
    }
    return () => {
      const callbackIndex = browserIdleState.callbacks.indexOf(callback);
      if (callbackIndex >= 0) {
        browserIdleState.callbacks.splice(callbackIndex, 1);
      }
    };
  },
}));

vi.mock("@/components/ui/carousel", () => {
  const Carousel = ({
    children,
    setApi,
  }: {
    children: ReactNode;
    setApi?: (api: {
      selectedScrollSnap: () => number;
      scrollNext: () => void;
      on: (event: string, callback: () => void) => void;
      off: (event: string, callback: () => void) => void;
    }) => void;
  }) => {
    React.useEffect(() => {
      if (!setApi) {
        return;
      }

      const listeners = new Map<string, Set<() => void>>();
      const notify = (event: string) => {
        listeners.get(event)?.forEach((callback) => callback());
      };
      const api = {
        selectedScrollSnap: () => carouselState.selectedIndex,
        scrollNext: () => {
          carouselState.scrollNext();
          const slideCount = Math.max(carouselState.slideCount, 1);
          carouselState.selectedIndex = (carouselState.selectedIndex + 1) % slideCount;
          notify("select");
        },
        scrollPrev: () => {
          const slideCount = Math.max(carouselState.slideCount, 1);
          carouselState.selectedIndex = (carouselState.selectedIndex - 1 + slideCount) % slideCount;
          notify("select");
        },
        on: (event: string, callback: () => void) => {
          const callbacks = listeners.get(event) || new Set<() => void>();
          callbacks.add(callback);
          listeners.set(event, callbacks);
        },
        off: (event: string, callback: () => void) => {
          listeners.get(event)?.delete(callback);
        },
      };

      carouselState.api = api;
      setApi(api);

      return () => {
        carouselState.api = null;
        listeners.clear();
      };
    }, [setApi]);

    return <div>{children}</div>;
  };

  const CarouselContent = ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => {
    carouselState.slideCount = React.Children.count(children);
    return <div className={className}>{children}</div>;
  };

  const CarouselItem = ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  );

  const CarouselPrevious = ({
    className,
    onClick,
  }: {
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  }) => {
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event);
      if (!event.defaultPrevented) {
        carouselState.api?.scrollPrev();
      }
    };

    return (
      <button
        type="button"
        aria-label="previous slide"
        className={className}
        onClick={handleClick}
      />
    );
  };

  const CarouselNext = ({
    className,
    onClick,
  }: {
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  }) => {
    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event);
      if (!event.defaultPrevented) {
        carouselState.api?.scrollNext();
      }
    };

    return (
      <button type="button" aria-label="next slide" className={className} onClick={handleClick} />
    );
  };

  return {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
  };
});

const setupBootstrapMock = ({
  includeSecondProject = false,
}: {
  includeSecondProject?: boolean;
} = {}) => {
  const projects = [
    {
      id: "project-1",
      title: "Projeto com Hero",
      synopsis: "Sinopse de teste",
      description: "Descricao de teste",
      type: "Anime",
      status: "Em andamento",
      heroImageUrl: "/uploads/hero-fit.jpg",
      banner: "",
      cover: "",
      trailerUrl: "",
      forceHero: true,
    },
  ];
  const updates = [
    {
      projectId: "project-1",
      kind: "lancamento",
      updatedAt: "2026-02-10T12:00:00.000Z",
    },
  ];

  if (includeSecondProject) {
    projects.push({
      id: "project-2",
      title: "Projeto Secundario",
      synopsis: "Sinopse secundaria",
      description: "Descricao secundaria",
      type: "Manga",
      status: "Completo",
      heroImageUrl: "/uploads/hero-fit-2.jpg",
      banner: "",
      cover: "",
      trailerUrl: "",
      forceHero: false,
    });
    updates.push({
      projectId: "project-2",
      kind: "lancamento",
      updatedAt: "2026-02-08T10:00:00.000Z",
    });
  }

  usePublicBootstrapMock.mockReturnValue({
    isFetched: true,
    data: {
      projects,
      updates,
      mediaVariants: {
        "/uploads/hero-fit.jpg": {
          variantsVersion: 1,
          variants: {
            hero: {
              formats: {
                fallback: { url: "/uploads/_variants/project-1/hero-v1.jpeg" },
              },
            },
          },
          focalPoints: {
            hero: { x: 0.2, y: 0.8 },
          },
        },
      },
    },
  });
};

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

const expectHeroPrimaryButtonTokens = (element: HTMLElement) => {
  const tokens = classTokens(element);

  expect(tokens).toEqual(
    expect.arrayContaining([
      "rounded-xl",
      "shadow-none",
      "border-[color:var(--hero-primary-border-rest)]",
      "bg-[color:var(--hero-primary-bg-rest)]",
      "text-foreground",
      "hover:border-[color:var(--hero-primary-border-hover)]",
      "hover:bg-[color:var(--hero-primary-bg-hover)]",
      "hover:text-(--hero-accent-foreground,hsl(var(--primary-foreground)))",
      "focus-visible:border-[color:var(--hero-primary-border-hover)]",
      "focus-visible:bg-[color:var(--hero-primary-bg-hover)]",
      "focus-visible:text-(--hero-accent-foreground,hsl(var(--primary-foreground)))",
    ]),
  );
  expect(element.style.getPropertyValue("--hero-primary-bg-rest")).toBe(
    "color-mix(in srgb, var(--hero-accent, hsl(var(--primary))) 10%, transparent)",
  );
  expect(element.style.getPropertyValue("--hero-primary-border-rest")).toBe(
    "color-mix(in srgb, var(--hero-accent, hsl(var(--primary))) 70%, transparent)",
  );
  expect(element.style.getPropertyValue("--hero-primary-bg-hover")).toBe(
    "var(--hero-accent, hsl(var(--primary)))",
  );
  expect(element.style.getPropertyValue("--hero-primary-border-hover")).toBe(
    "color-mix(in srgb, var(--hero-accent, hsl(var(--primary))) 100%, transparent)",
  );
  expect(tokens).not.toContain("hover:brightness-110");
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};

describe("HeroSection cover fit", () => {
  beforeEach(() => {
    usePublicBootstrapMock.mockReset();
    themeModeState.effectiveMode = "dark";
    browserIdleState.autoRun = true;
    browserIdleState.callbacks.splice(0, browserIdleState.callbacks.length);
    carouselState.api = null;
    carouselState.scrollNext.mockReset();
    carouselState.selectedIndex = 0;
    carouselState.slideCount = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renderiza o slide com altura responsiva e imagem em cover central", async () => {
    setupBootstrapMock();

    const { container } = render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto com Hero" });

    const heroSection = container.querySelector("section");
    expect(heroSection).not.toBeNull();
    expect(heroSection).toHaveClass("min-h-[78vh]", "md:min-h-screen");
    expectHeroPrimaryButtonTokens(
      screen.getByRole("link", { name: /Acessar p.gina de Projeto com Hero/i }),
    );
    expect(
      screen.getByRole("link", { name: "Acessar página de Projeto com Hero" }),
    ).toHaveAttribute("href", "/projeto/project-1");

    const backgroundImage = container.querySelector(
      "img[aria-hidden='true']",
    ) as HTMLImageElement | null;
    expect(backgroundImage).not.toBeNull();
    expect(backgroundImage).toHaveClass("h-full", "w-full", "object-cover", "object-center");
    expect(backgroundImage?.getAttribute("src")).toContain(
      "/uploads/_variants/project-1/hero-v1.jpeg",
    );
    expect(backgroundImage).toHaveStyle({ objectPosition: "20% 80%" });
    expect(backgroundImage?.getAttribute("fetchpriority")).toBe("high");
    expect(backgroundImage?.getAttribute("loading")).toBe("eager");
  });

  it("mantem badge de ultimo lancamento acima de tipo/status no mobile", async () => {
    setupBootstrapMock();

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto com Hero" });

    const meta = await screen.findByTestId("hero-slide-meta-project-1");
    expect(meta).toHaveClass("flex-col", "md:flex-row");

    const latest = screen.getByTestId("hero-slide-latest-project-1");
    const typeStatus = screen.getByTestId("hero-slide-type-status-project-1");
    expect(latest).toBeInTheDocument();
    expect(typeStatus).toBeInTheDocument();

    const children = Array.from(meta.children);
    expect(children.indexOf(latest)).toBeGreaterThanOrEqual(0);
    expect(children.indexOf(typeStatus)).toBeGreaterThanOrEqual(0);
    expect(children.indexOf(latest)).toBeLessThan(children.indexOf(typeStatus));

    expect(within(typeStatus).getByText("Anime")).toBeInTheDocument();
    expect(within(typeStatus).getByText("Em andamento")).toBeInTheDocument();
    expectHeroPrimaryButtonTokens(
      screen.getByRole("link", { name: /Acessar p.gina de Projeto com Hero/i }),
    );
    const separator = within(typeStatus).getByText("\u2022");
    expect(separator).toHaveClass("animate-slide-up", "opacity-0", "text-muted-foreground/50");
    expect(separator).not.toHaveClass("opacity-50");
  });

  it("aplica animacao escalonada em tipo, separador, status e titulo no modo carrossel", async () => {
    setupBootstrapMock({ includeSecondProject: true });

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    await screen.findByTestId("hero-slide-meta-project-2");

    const typeStatus = await screen.findByTestId("hero-slide-type-status-project-1");
    expectHeroPrimaryButtonTokens(
      screen.getByRole("link", { name: /Acessar p.gina de Projeto com Hero/i }),
    );
    const type = within(typeStatus).getByText("Anime");
    const separator = within(typeStatus).getByText("\u2022");
    const status = within(typeStatus).getByText("Em andamento");

    expect(type).toHaveClass("animate-slide-up", "opacity-0");
    expect(separator).toHaveClass("animate-slide-up", "opacity-0");
    expect(status).toHaveClass("animate-slide-up", "opacity-0");
    expect(separator).toHaveClass("text-muted-foreground/50");
    expect(separator).not.toHaveClass("opacity-50");
    expect(type).toHaveStyle({ animationDelay: "120ms" });
    expect(separator).toHaveStyle({ animationDelay: "120ms" });
    expect(status).toHaveStyle({ animationDelay: "120ms" });

    const heading = screen.getByRole("heading", { name: "Projeto com Hero" });
    expect(heading).toHaveClass("animate-slide-up", "opacity-0");
    expect(heading).toHaveStyle({ animationDelay: "240ms" });
  });

  it("monta a estrutura completa do carrossel no primeiro render mesmo antes do idle", () => {
    browserIdleState.autoRun = false;
    setupBootstrapMock({ includeSecondProject: true });

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("hero-slide-meta-project-1")).toBeInTheDocument();
    expect(screen.getByTestId("hero-slide-meta-project-2")).toBeInTheDocument();
  });

  it("remove as animacoes de entrada do primeiro slide quando o shell inicial existe", async () => {
    setupBootstrapMock();
    const shell = document.createElement("div");
    shell.id = "home-hero-shell";
    document.body.appendChild(shell);

    const { unmount } = render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    const heading = await screen.findByRole("heading", { name: "Projeto com Hero" });
    const latestBadge = screen.getByTestId("hero-slide-latest-project-1");
    const actions = heading.parentElement?.querySelector(".mt-8");

    expect(heading).not.toHaveClass("animate-slide-up", "opacity-0");
    expect(latestBadge).not.toHaveClass("animate-slide-up", "opacity-0");
    expect(actions).not.toHaveClass("animate-slide-up", "opacity-0");

    unmount();
    shell.remove();
  });

  it("inicia autoplay do carrossel em 6s", async () => {
    vi.useFakeTimers();
    setupBootstrapMock({ includeSecondProject: true });

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("hero-slide-meta-project-2")).toBeInTheDocument();
    expect(carouselState.scrollNext).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5999);
    });
    expect(carouselState.scrollNext).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(carouselState.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("retoma autoplay 3s depois de interacao manual e volta a avancar apos 6s", async () => {
    vi.useFakeTimers();
    setupBootstrapMock({ includeSecondProject: true });

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("hero-slide-meta-project-2")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(carouselState.scrollNext).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /next slide/i }));
    expect(carouselState.scrollNext).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(8999);
    });
    expect(carouselState.scrollNext).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(carouselState.scrollNext).toHaveBeenCalledTimes(2);
  });

  it("renderiza overlay superior para contraste da navbar no tema claro", async () => {
    themeModeState.effectiveMode = "light";
    setupBootstrapMock();

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto com Hero" });
    expect(screen.getByTestId("hero-navbar-overlay")).toBeInTheDocument();
  });

  it("nao renderiza overlay superior no tema escuro", async () => {
    themeModeState.effectiveMode = "dark";
    setupBootstrapMock();

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto com Hero" });
    expect(screen.queryByTestId("hero-navbar-overlay")).not.toBeInTheDocument();
  });

  it("prioriza o ultimo lancamento de manga quando o bootstrap publico o inclui nos updates", async () => {
    usePublicBootstrapMock.mockReturnValue({
      isFetched: true,
      data: {
        projects: [
          {
            id: "project-anime",
            title: "Projeto Anime",
            synopsis: "Sinopse anime",
            description: "Descricao anime",
            type: "Anime",
            status: "Em andamento",
            heroImageUrl: "/uploads/hero-anime.jpg",
            banner: "",
            cover: "",
            trailerUrl: "",
            forceHero: false,
          },
          {
            id: "project-manga",
            title: "Projeto Manga",
            synopsis: "Sinopse manga",
            description: "Descricao manga",
            type: "Manga",
            status: "Em andamento",
            heroImageUrl: "/uploads/hero-manga.jpg",
            banner: "",
            cover: "",
            trailerUrl: "",
            forceHero: false,
          },
        ],
        updates: [
          {
            projectId: "project-anime",
            kind: "lancamento",
            updatedAt: "2026-02-10T12:00:00.000Z",
          },
          {
            projectId: "project-manga",
            kind: "lancamento",
            updatedAt: "2026-02-12T12:00:00.000Z",
          },
        ],
        mediaVariants: {},
      },
    });

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto Manga" });
    expect(
      screen.getByRole("link", {
        name: /Acessar p.gina de Projeto Manga/i,
      }),
    ).toHaveAttribute("href", "/projeto/project-manga");
  });
});
