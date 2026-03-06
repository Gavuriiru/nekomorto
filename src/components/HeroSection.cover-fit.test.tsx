import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
const browserIdleState = vi.hoisted(() => ({
  autoRun: true,
  callbacks: [] as Array<(deadline: IdleDeadline) => void>,
}));
const carouselState = vi.hoisted(() => ({
  scrollNext: vi.fn(),
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

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mobileState.isMobile,
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
      const api = {
        selectedScrollSnap: () => 0,
        scrollNext: () => {
          carouselState.scrollNext();
          listeners.get("select")?.forEach((callback) => callback());
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

  const CarouselPrevious = ({
    className,
    onClick,
  }: {
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  }) => (
    <button type="button" aria-label="previous slide" className={className} onClick={onClick} />
  );

  const CarouselNext = ({
    className,
    onClick,
  }: {
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  }) => (
    <button type="button" aria-label="next slide" className={className} onClick={onClick} />
  );

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
}: { includeSecondProject?: boolean } = {}) => {
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

const runBrowserIdleCallbacks = () => {
  const callbacks = [...browserIdleState.callbacks];
  browserIdleState.callbacks.splice(0, browserIdleState.callbacks.length);
  callbacks.forEach((callback) =>
    callback({
      didTimeout: false,
      timeRemaining: () => 16,
    } as IdleDeadline),
  );
};

describe("HeroSection cover fit", () => {
  beforeEach(() => {
    usePublicBootstrapMock.mockReset();
    themeModeState.effectiveMode = "dark";
    mobileState.isMobile = false;
    browserIdleState.autoRun = true;
    browserIdleState.callbacks.splice(0, browserIdleState.callbacks.length);
    carouselState.scrollNext.mockReset();
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

    const primaryAction = screen.getByRole("link", { name: /Projeto com Hero/ });
    expect(primaryAction).toHaveAttribute("href", "/projeto/project-1");
    expect(primaryAction).toHaveClass("bg-primary", "text-primary-foreground");

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
    expect(within(typeStatus).getByText("Em andamento")).not.toHaveClass(
      "animate-slide-up",
    );
  });

  it("anima o fallback inicial no desktop e nao reaplica a animacao quando o carrossel assume", async () => {
    browserIdleState.autoRun = false;
    setupBootstrapMock({ includeSecondProject: true });

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    const latest = await screen.findByTestId("hero-slide-latest-project-1");
    const typeStatus = screen.getByTestId("hero-slide-type-status-project-1");
    const [type, separator, status] = Array.from(
      typeStatus.querySelectorAll("span"),
    ) as HTMLElement[];
    const heading = screen.getByRole("heading", { name: "Projeto com Hero" });
    const synopsis = screen.getByText("Sinopse de teste");
    const actions = screen.getByRole("link", { name: /Projeto com Hero/ })
      .parentElement as HTMLDivElement;

    expect(screen.queryByTestId("hero-slide-meta-project-2")).not.toBeInTheDocument();
    expect(type).toHaveTextContent("Anime");
    expect(separator).toHaveTextContent("•");
    expect(status).toHaveTextContent("Em andamento");
    expect(latest).toHaveClass("animate-slide-up", "opacity-0");
    expect(type).toHaveClass("animate-slide-up", "opacity-0");
    expect(separator).toHaveClass("animate-slide-up", "opacity-0");
    expect(status).toHaveClass("animate-slide-up", "opacity-0");
    expect(heading).toHaveClass("animate-slide-up", "opacity-0");
    expect(synopsis).toHaveClass("animate-slide-up", "opacity-0");
    expect(actions).toHaveClass("animate-slide-up", "opacity-0");

    expect(latest).toHaveStyle({ animationDelay: "120ms" });
    expect(type).toHaveStyle({ animationDelay: "120ms" });
    expect(separator).toHaveStyle({ animationDelay: "120ms" });
    expect(status).toHaveStyle({ animationDelay: "120ms" });
    expect(heading).toHaveStyle({ animationDelay: "240ms" });
    expect(synopsis).toHaveStyle({ animationDelay: "360ms" });
    expect(actions).toHaveStyle({ animationDelay: "520ms" });

    await act(async () => {
      runBrowserIdleCallbacks();
      await Promise.resolve();
    });

    await screen.findByTestId("hero-slide-meta-project-2");

    const mountedTypeStatus = screen.getByTestId("hero-slide-type-status-project-1");
    const mountedType = within(mountedTypeStatus).getByText("Anime");
    const mountedStatus = within(mountedTypeStatus).getByText("Em andamento");
    const mountedHeading = screen.getByRole("heading", { name: "Projeto com Hero" });

    expect(mountedType).not.toHaveClass("animate-slide-up");
    expect(mountedStatus).not.toHaveClass("animate-slide-up");
    expect(mountedType).not.toHaveClass("opacity-0");
    expect(mountedStatus).not.toHaveClass("opacity-0");
    expect(mountedHeading).not.toHaveClass("animate-slide-up");
    expect(mountedHeading).not.toHaveClass("opacity-0");
  });

  it("inicia autoplay do carrossel em 5s", async () => {
    vi.useFakeTimers();
    setupBootstrapMock({ includeSecondProject: true });

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(carouselState.scrollNext).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(carouselState.scrollNext).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(carouselState.scrollNext).toHaveBeenCalledTimes(1);
  });

  it("reinicia autoplay em 5s apos interacao manual", async () => {
    vi.useFakeTimers();
    setupBootstrapMock({ includeSecondProject: true });

    render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(carouselState.scrollNext).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /next slide/i }));

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(carouselState.scrollNext).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(carouselState.scrollNext).toHaveBeenCalledTimes(1);
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
