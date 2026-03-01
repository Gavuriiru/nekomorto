import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HeroSection from "@/components/HeroSection";

const themeModeState = vi.hoisted(() => ({
  effectiveMode: "dark" as "light" | "dark",
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

vi.mock("@/components/ui/carousel", () => {
  const Carousel = ({ children }: { children: ReactNode }) => <div>{children}</div>;
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

const setupBootstrapMock = () => {
  usePublicBootstrapMock.mockReturnValue({
    isFetched: true,
    data: {
      projects: [
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
      ],
      updates: [
        {
          projectId: "project-1",
          kind: "lancamento",
          updatedAt: "2026-02-10T12:00:00.000Z",
        },
      ],
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
