import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TopProjectsSection from "@/components/TopProjectsSection";

const usePublicBootstrapMock = vi.hoisted(() => vi.fn());
const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

vi.mock("@/hooks/use-public-bootstrap", () => ({
  usePublicBootstrap: () => usePublicBootstrapMock(),
}));

vi.mock("@/components/UploadPicture", () => ({
  default: ({
    src,
    alt,
    className,
    imgClassName,
  }: {
    src?: string;
    alt?: string;
    className?: string;
    imgClassName?: string;
  }) => (
    <picture className={className}>
      <img src={src || ""} alt={alt || ""} className={imgClassName} />
    </picture>
  ),
}));

const createProject = ({
  id,
  title,
  views,
  viewsDaily = {},
}: {
  id: string;
  title: string;
  views: number;
  viewsDaily?: Record<string, number>;
}) => ({
  id,
  title,
  synopsis: `${title} synopsis`,
  description: `${title} description`,
  type: "Anime",
  status: "Em andamento",
  tags: [],
  cover: "/uploads/cover.jpg",
  coverAlt: `${title} cover`,
  banner: "",
  bannerAlt: "",
  heroImageUrl: "",
  heroImageAlt: "",
  forceHero: false,
  trailerUrl: "",
  volumeCovers: [],
  episodeDownloads: [],
  views,
  viewsDaily,
});

const getUtcDayKeyFromOffset = (offsetDays: number) => {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() - offsetDays);
  return day.toISOString().slice(0, 10);
};

describe("TopProjectsSection", () => {
  beforeEach(() => {
    usePublicBootstrapMock.mockReset();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it("ordena por views acumuladas por padrao, limita em top 10 e exibe ranking + contagem", () => {
    const projects = Array.from({ length: 12 }, (_, index) =>
      createProject({
        id: `project-${index + 1}`,
        title: `Projeto ${String(index + 1).padStart(2, "0")}`,
        views: (index + 1) * 10,
      }),
    );

    usePublicBootstrapMock.mockReturnValue({
      isLoading: false,
      data: {
        projects,
        mediaVariants: {},
      },
    });

    render(
      <MemoryRouter>
        <TopProjectsSection />
      </MemoryRouter>,
    );

    const headings = screen.getAllByRole("heading", { level: 3, name: /Projeto /i });
    expect(headings).toHaveLength(10);
    expect(headings[0]).toHaveTextContent("Projeto 12");
    expect(screen.queryByRole("heading", { level: 3, name: "Projeto 01" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Projeto 02" })).not.toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.queryByText(/views acumuladas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/views nos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^views$/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("top-project-item-1-metric")).toHaveTextContent("120");
    expect(screen.getByTestId("top-projects-mode-trigger")).toHaveTextContent(/sempre/i);
    const list = screen.getByTestId("top-projects-list");
    expect(list).toHaveClass(
      "no-scrollbar",
      "overflow-y-auto",
      "overscroll-contain",
      "max-h-[calc((var(--top-card-h)*2)+(var(--top-gap)*1))]",
      "md:max-h-[calc((var(--top-card-h)*3)+(var(--top-gap)*2))]",
    );
    expect(String(list.getAttribute("style") || "")).toContain("--top-card-h: 164px");
    expect(String(list.getAttribute("style") || "")).toContain("--top-gap: 12px");
    const firstItem = screen.getByTestId("top-project-item-1");
    expect(firstItem).toHaveClass("h-(--top-card-h)", "rounded-2xl");
    const firstLink = headings[0].closest("a");
    expect(firstLink).toHaveClass("rounded-2xl");
  });

  it("permite alternar para ranking dos ultimos 30 dias via dropdown", async () => {
    const todayKey = getUtcDayKeyFromOffset(0);
    const oldKey = getUtcDayKeyFromOffset(40);

    usePublicBootstrapMock.mockReturnValue({
      isLoading: false,
      data: {
        projects: [
          createProject({
            id: "alfa",
            title: "Projeto Alfa",
            views: 500,
            viewsDaily: {
              [todayKey]: 1,
            },
          }),
          createProject({
            id: "beta",
            title: "Projeto Beta",
            views: 120,
            viewsDaily: {
              [todayKey]: 40,
            },
          }),
          createProject({
            id: "gama",
            title: "Projeto Gama",
            views: 300,
            viewsDaily: {
              [oldKey]: 60,
            },
          }),
        ],
        mediaVariants: {},
      },
    });

    render(
      <MemoryRouter>
        <TopProjectsSection />
      </MemoryRouter>,
    );

    const initialHeadings = screen.getAllByRole("heading", { level: 3, name: /Projeto /i });
    expect(initialHeadings[0]).toHaveTextContent("Projeto Alfa");
    expect(screen.getByTestId("top-project-item-1-metric")).toHaveTextContent("500");

    fireEvent.click(
      screen.getByRole("combobox", {
        name: /ordenar top 10 por visualiza/i,
      }),
    );
    expect(await screen.findByRole("option", { name: /^sempre$/i })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("option", { name: /^30d$/i }));

    const headingsAfterSwitch = screen.getAllByRole("heading", { level: 3, name: /Projeto /i });
    expect(headingsAfterSwitch[0]).toHaveTextContent("Projeto Beta");
    expect(screen.getByTestId("top-project-item-1-metric")).toHaveTextContent("40");
    expect(screen.getByTestId("top-projects-mode-trigger")).toHaveTextContent("30d");
  });

  it("exibe estado vazio quando nao ha projetos no bootstrap", () => {
    usePublicBootstrapMock.mockReturnValue({
      isLoading: false,
      data: {
        projects: [],
        mediaVariants: {},
      },
    });

    render(
      <MemoryRouter>
        <TopProjectsSection />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Sem dados de visualiza/i)).toBeInTheDocument();
  });
});
