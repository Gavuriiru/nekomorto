import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project, ProjectEpisode } from "@/data/projects";
import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";
import MangaChapterPagesEditor from "@/components/project-reader/MangaChapterPagesEditor";

const { apiFetchMock, toastMock, downloadBinaryResponseMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  toastMock: vi.fn(),
  downloadBinaryResponseMock: vi.fn(),
}));

vi.mock("@/components/UploadPicture", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img data-testid="upload-picture" src={src} alt={alt} />
  ),
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

vi.mock("@/lib/project-epub", () => ({
  downloadBinaryResponse: (...args: unknown[]) => downloadBinaryResponseMock(...args),
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

const createChapterFixture = (): ProjectEpisode => ({
  number: 3,
  volume: 1,
  title: "Capitulo teste",
  synopsis: "",
  releaseDate: "2026-03-14",
  duration: "",
  sourceType: "Web",
  sources: [{ label: "Galeria", url: "https://cdn.test/gallery" }],
  content: "",
  contentFormat: "images",
  coverImageUrl: "https://cdn.test/page-1.jpg",
  coverImageAlt: "Capa do capitulo 3",
  pages: [
    { position: 1, imageUrl: "https://cdn.test/page-1.jpg" },
    { position: 2, imageUrl: "https://cdn.test/page-2.jpg" },
  ],
  pageCount: 2,
  hasPages: true,
  publicationStatus: "draft",
});

const createDataTransfer = () => ({
  effectAllowed: "move",
  dropEffect: "move",
  setData: vi.fn(),
  getData: vi.fn(),
  clearData: vi.fn(),
});

const getPageOrder = () =>
  screen.getAllByTestId("upload-picture").map((node) => node.getAttribute("src"));

const renderEditor = (options?: { chapter?: ProjectEpisode }) => {
  const onChangeSpy = vi.fn();
  const initialChapter = options?.chapter ?? createChapterFixture();

  const Harness = () => {
    const [chapter, setChapter] = useState(initialChapter);
    return (
      <AccessibilityAnnouncerProvider>
        <MangaChapterPagesEditor
          apiBase="http://api.local"
          projectSnapshot={createProjectFixture()}
          chapter={chapter}
          uploadFolder="projects/project-1/capitulos/volume-1/capitulo-3"
          onChange={(nextChapter) => {
            onChangeSpy(nextChapter);
            setChapter(nextChapter);
          }}
        />
      </AccessibilityAnnouncerProvider>
    );
  };

  render(<Harness />);
  return { onChangeSpy };
};

describe("MangaChapterPagesEditor", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
    downloadBinaryResponseMock.mockReset();
  });

  it("mantem um grid limpo e reordena paginas por drag and drop direto na imagem", async () => {
    const { onChangeSpy } = renderEditor();

    expect(screen.getByTestId("manga-pages-actions")).toBeInTheDocument();
    expect(screen.getByTestId("manga-pages-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("manga-pages-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manga-pages-add-tile")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Trocar/i })).not.toBeInTheDocument();
    expect(getPageOrder()).toEqual([
      "https://cdn.test/page-1.jpg",
      "https://cdn.test/page-2.jpg",
    ]);
    expect(screen.getByTestId("manga-page-filename-0")).toHaveTextContent("page-1.jpg");
    expect(screen.getByTestId("manga-page-filename-1")).toHaveTextContent("page-2.jpg");

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("manga-page-surface-1"), { dataTransfer });
    expect(screen.getByTestId("manga-page-surface-1")).toHaveAttribute(
      "data-reorder-state",
      "dragging",
    );
    expect(screen.getByTestId("manga-page-surface-1")).toHaveAttribute(
      "data-reorder-motion",
      "spring",
    );
    expect(screen.getByTestId("manga-page-card-1")).toHaveAttribute(
      "data-reorder-layout",
      "static",
    );
    fireEvent.dragOver(screen.getByTestId("manga-page-surface-0"), { dataTransfer });

    await waitFor(() => {
      expect(getPageOrder()).toEqual([
        "https://cdn.test/page-2.jpg",
        "https://cdn.test/page-1.jpg",
      ]);
    });
    expect(screen.getByTestId("manga-page-card-0")).toHaveAttribute(
      "data-reorder-layout",
      "static",
    );
    expect(screen.getByTestId("manga-page-card-1")).toHaveAttribute(
      "data-reorder-layout",
      "animated",
    );
    expect(screen.getByTestId("manga-page-filename-0")).toHaveTextContent("page-2.jpg");
    expect(screen.getByTestId("manga-page-surface-0")).toHaveAttribute("title", "page-2.jpg");

    fireEvent.drop(screen.getByTestId("manga-page-surface-0"), { dataTransfer });
    fireEvent.dragEnd(screen.getByTestId("manga-page-surface-1"), { dataTransfer });

    await waitFor(() => {
      expect(getPageOrder()).toEqual([
        "https://cdn.test/page-2.jpg",
        "https://cdn.test/page-1.jpg",
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(
        /Pagina 2 movida para a posicao 1/i,
      );
    });

    const lastCall = onChangeSpy.mock.lastCall?.[0] as ProjectEpisode | undefined;
    expect(lastCall?.pages?.map((page) => page.imageUrl)).toEqual([
      "https://cdn.test/page-2.jpg",
      "https://cdn.test/page-1.jpg",
    ]);
  });

  it("mantem usar capa e remover acessiveis mesmo com acoes aparecendo so no hover", async () => {
    const { onChangeSpy } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Usar capa" }));

    await waitFor(() => {
      const lastCall = onChangeSpy.mock.lastCall?.[0] as ProjectEpisode | undefined;
      expect(lastCall?.coverImageUrl).toBe("https://cdn.test/page-2.jpg");
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Remover" })[0]);

    await waitFor(() => {
      expect(getPageOrder()).toEqual(["https://cdn.test/page-2.jpg"]);
    });

    const lastCall = onChangeSpy.mock.lastCall?.[0] as ProjectEpisode | undefined;
    expect(lastCall?.pages?.map((page) => page.imageUrl)).toEqual(["https://cdn.test/page-2.jpg"]);
    expect(lastCall?.pageCount).toBe(1);
  });

  it("mantem exportacao e fontes no bloco utilitario sem preview publico", () => {
    renderEditor();

    expect(screen.getByTestId("manga-pages-utilities-trigger")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByTestId("manga-pages-utilities-panel")).not.toBeInTheDocument();
    expect(screen.queryByText(/Preview/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("manga-pages-utilities-trigger"));

    expect(screen.getByTestId("manga-pages-utilities-panel")).toBeInTheDocument();
    expect(screen.getByTestId("manga-pages-export")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar ZIP/i })).toBeInTheDocument();
    expect(screen.getByTestId("manga-pages-sources")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Galeria")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://cdn.test/gallery")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Abrir leitura/i })).not.toBeInTheDocument();
  });
});
