import { act, render, screen, within } from "@testing-library/react";
import * as React from "react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HeroSection from "@/components/HeroSection";

const themeModeState = vi.hoisted(() => ({
  effectiveMode: "dark" as "light" | "dark",
}));
const mobileState = vi.hoisted(() => ({
  isMobile: false,
}));
const usePublicBootstrapMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mobileState.isMobile,
}));

vi.mock("@/lib/browser-idle", () => ({
  scheduleOnBrowserIdle: (callback: (deadline: IdleDeadline) => void) => {
    callback({
      didTimeout: false,
      timeRemaining: () => 16,
    } as IdleDeadline);
    return () => undefined;
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
      const api = {
        selectedScrollSnap: () => 0,
        scrollNext: () => undefined,
        on: (event: string, callback: () => void) => {
          const callbacks = listeners.get(event) || new Set<() => void>();
          callbacks.add(callback);
          listeners.set(event, callbacks);
        },
        off: (event: string, callback: () => void) => {
          listeners.get(event)?.delete(callback);
        },
      };

      setApi(api);

      return () => {
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
  }) => <div className={className}>{children}</div>;
  const CarouselItem = ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>;
  const CarouselPrevious = ({ className }: { className?: string }) => (
    <button type="button" className={className} />
  );
  const CarouselNext = ({ className }: { className?: string }) => (
    <button type="button" className={className} />
  );
  return {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
  };
});

const setupBootstrapMock = ({ includeSecondProject = false }: { includeSecondProject?: boolean } = {}) => {
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

describe("HeroSection cover fit", () => {
  beforeEach(() => {
    usePublicBootstrapMock.mockReset();
    themeModeState.effectiveMode = "dark";
    mobileState.isMobile = false;
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
    expect(
      screen.getByRole("link", { name: "Acessar página de Projeto com Hero" }),
    ).toHaveAttribute("href", "/projeto/project-1");

    const backgroundImage = container.querySelector(
      "img[aria-hidden='true']",
    ) as HTMLImageElement | null;
    expect(backgroundImage).not.toBeNull();
    expect(backgroundImage).toHaveClass(
      "h-full",
      "w-full",
      "object-cover",
      "object-center",
    );
    expect(backgroundImage?.getAttribute("src")).toContain("/uploads/_variants/project-1/hero-v1.jpeg");
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
  });

  it("mantem first paint mobile estatico no primeiro slide", async () => {
    mobileState.isMobile = true;
    setupBootstrapMock({ includeSecondProject: true });

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    const heading = await screen.findByRole("heading", { name: "Projeto com Hero" });
    expect(screen.queryByTestId("hero-slide-meta-project-2")).not.toBeInTheDocument();
    expect(heading).not.toHaveClass("animate-slide-up");
    expect(heading).not.toHaveClass("opacity-0");

    const typeStatus = screen.getByTestId("hero-slide-type-status-project-1");
    expect(within(typeStatus).getByText("Anime")).not.toHaveClass("animate-slide-up");
    expect(within(typeStatus).getByText("Em andamento")).not.toHaveClass("animate-slide-up");
  });

  it("mantem conteudo textual visivel no first render do modo carrossel desktop", async () => {
    setupBootstrapMock({ includeSecondProject: true });

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    await screen.findByTestId("hero-slide-meta-project-2");

    const typeStatus = await screen.findByTestId("hero-slide-type-status-project-1");
    const type = within(typeStatus).getByText("Anime");
    const status = within(typeStatus).getByText("Em andamento");

    expect(type).not.toHaveClass("animate-slide-up");
    expect(status).not.toHaveClass("animate-slide-up");
    expect(type).not.toHaveClass("opacity-0");
    expect(status).not.toHaveClass("opacity-0");

    const heading = screen.getByRole("heading", { name: "Projeto com Hero" });
    expect(heading).not.toHaveClass("animate-slide-up");
    expect(heading).not.toHaveClass("opacity-0");
  });

  it("atrasa autoplay inicial do carrossel por 20s", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    setupBootstrapMock({ includeSecondProject: true });

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("hero-slide-meta-project-2")).toBeInTheDocument();
    expect(setIntervalSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(19999);
    });
    expect(setIntervalSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 6000);
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
});
