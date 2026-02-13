import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HeroSection from "@/components/HeroSection";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/components/ui/carousel", () => {
  const Carousel = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const CarouselContent = ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  );
  const CarouselItem = ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  );
  const CarouselPrevious = ({ className }: { className?: string }) => <button type="button" className={className} />;
  const CarouselNext = ({ className }: { className?: string }) => <button type="button" className={className} />;
  return {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
  };
});

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const setupApiMock = () => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (endpoint === "/api/public/projects" && method === "GET") {
      return mockJsonResponse(true, {
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
          },
        ],
      });
    }
    if (endpoint === "/api/public/updates" && method === "GET") {
      return mockJsonResponse(true, {
        updates: [
          {
            projectId: "project-1",
            kind: "lancamento",
            updatedAt: "2026-02-10T12:00:00.000Z",
          },
        ],
      });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("HeroSection cover fit", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("renderiza o slide com altura responsiva e cover central sem classes antigas de corte", async () => {
    setupApiMock();

    const { container } = render(
      <MemoryRouter>
        <HeroSection />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "Projeto com Hero" });

    const heroSection = container.querySelector("section");
    expect(heroSection).not.toBeNull();
    expect(heroSection).toHaveClass("min-h-[78vh]", "md:min-h-screen");

    const backgroundLayer = container.querySelector("div[style*=\"background-image\"]");
    expect(backgroundLayer).not.toBeNull();
    expect(backgroundLayer).toHaveClass("bg-cover", "bg-center", "bg-no-repeat");
    expect(backgroundLayer).not.toHaveClass("bg-top-right", "scale-105");

    const slideWrapper = backgroundLayer?.parentElement;
    expect(slideWrapper).not.toBeNull();
    expect(slideWrapper).toHaveClass("min-h-[78vh]", "md:min-h-screen");
  });

  it("mantem badge de ultimo lancamento acima de tipo/status no mobile", async () => {
    setupApiMock();

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
});
