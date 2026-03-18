import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import MangaChapterPagesEditor from "@/components/project-reader/MangaChapterPagesEditor";
import type { Project, ProjectEpisode } from "@/data/projects";
import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";

vi.mock("@/components/UploadPicture", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img data-testid="upload-picture" src={src} alt={alt} />
  ),
}));

const createProjectFixture = (): Project => ({
  id: "project-1",
  title: "Projeto Manga",
  synopsis: "",
  description: "",
  type: "Manga",
  status: "Ativo",
  year: "2026",
  studio: "Studio Teste",
  episodes: "2",
  tags: [],
  cover: "/cover.jpg",
  banner: "/banner.jpg",
  season: "Volume 1",
  schedule: "",
  rating: "Livre",
  episodeDownloads: [],
  staff: [],
});

const createPageFixtures = (
  count: number,
  spreadPairId?: string,
): ProjectEpisode["pages"] =>
  Array.from({ length: count }, (_, index) => ({
    position: index + 1,
    imageUrl: `https://cdn.test/page-${index + 1}.jpg`,
    ...(spreadPairId && index < 2 ? { spreadPairId } : {}),
  }));

const createChapterFixture = (overrides: Partial<ProjectEpisode> = {}): ProjectEpisode => {
  const pages = Array.isArray(overrides.pages) ? overrides.pages : createPageFixtures(2);

  return {
    number: 3,
    volume: 1,
    title: "Capitulo teste",
    synopsis: "",
    releaseDate: "2026-03-14",
    duration: "",
    sourceType: "Web",
    sources: [],
    content: "",
    contentFormat: "images",
    coverImageUrl: "https://cdn.test/page-1.jpg",
    coverImageAlt: "Capa do capitulo 3",
    pages,
    pageCount: pages.length,
    hasPages: pages.length > 0,
    publicationStatus: "draft",
    ...overrides,
    pages,
    pageCount: overrides.pageCount ?? pages.length,
    hasPages: overrides.hasPages ?? pages.length > 0,
  };
};

const getPageOrder = () =>
  screen.getAllByTestId("upload-picture").map((node) => node.getAttribute("src"));

const renderKeyboardEditor = (initialChapter = createChapterFixture()) => {
  const Harness = () => {
    const [chapter, setChapter] = useState(initialChapter);
    return (
      <AccessibilityAnnouncerProvider>
        <MangaChapterPagesEditor
          apiBase="http://api.local"
          projectSnapshot={createProjectFixture()}
          chapter={chapter}
          uploadFolder="projects/project-1/capitulos/volume-1/capitulo-3"
          onChange={setChapter}
        />
      </AccessibilityAnnouncerProvider>
    );
  };

  render(<Harness />);
};

describe("MangaChapterPagesEditor keyboard support", () => {
  it("reordena paginas com Alt+seta e anuncia no live region", async () => {
    renderKeyboardEditor();

    fireEvent.keyDown(screen.getByTestId("manga-page-surface-0"), {
      key: "ArrowDown",
      altKey: true,
    });

    await waitFor(() => {
      expect(getPageOrder()).toEqual([
        "https://cdn.test/page-2.jpg",
        "https://cdn.test/page-1.jpg",
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(/movida para a posi/i);
    });
  });

  it("desfaz um spread ao separar o par pelo teclado", async () => {
    renderKeyboardEditor(
      createChapterFixture({
        pages: createPageFixtures(3, "spread-1"),
      }),
    );

    expect(screen.getByTestId("manga-page-spread-badge-0")).toBeInTheDocument();
    expect(screen.getByTestId("manga-page-spread-badge-1")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId("manga-page-surface-1"), {
      key: "ArrowDown",
      altKey: true,
    });

    await waitFor(() => {
      expect(getPageOrder()).toEqual([
        "https://cdn.test/page-1.jpg",
        "https://cdn.test/page-3.jpg",
        "https://cdn.test/page-2.jpg",
      ]);
    });

    expect(screen.queryByTestId("manga-page-spread-badge-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manga-page-spread-badge-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manga-page-spread-badge-2")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(
        /Spread desfeito porque as paginas deixaram de ficar juntas/i,
      );
    });
  });

  it("mantem o foco dos botoes sem ativar a superficie da imagem", async () => {
    renderKeyboardEditor();

    const surface = screen.getByTestId("manga-page-surface-0");
    const topActions = screen.getByTestId("manga-page-top-actions-0");
    const statusBadges = screen.getByTestId("manga-page-status-badges-0");
    const joinSpreadButton = screen.getAllByRole("button", { name: /Juntar com a pr/i })[0];

    fireEvent.keyDown(surface, { key: "Tab" });
    fireEvent.focus(surface);
    await waitFor(() => {
      expect(surface).toHaveAttribute("data-surface-active", "true");
    });
    expect(topActions).toHaveAttribute("data-actions-visible", "true");
    expect(statusBadges).toHaveAttribute("data-status-badges-visible", "false");

    fireEvent.focus(joinSpreadButton);

    await waitFor(() => {
      expect(surface).toHaveAttribute("data-surface-active", "false");
    });
    expect(topActions).toHaveAttribute("data-actions-visible", "true");
    expect(statusBadges).toHaveAttribute("data-status-badges-visible", "false");
  });
});
