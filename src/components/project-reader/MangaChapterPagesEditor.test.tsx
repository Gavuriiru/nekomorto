import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MangaChapterPagesEditor from "@/components/project-reader/MangaChapterPagesEditor";
import type { Project, ProjectEpisode } from "@/data/projects";
import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";

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

const createPageFixtures = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    position: index + 1,
    imageUrl: `https://cdn.test/page-${index + 1}.jpg`,
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
    sources: [{ label: "Galeria", url: "https://cdn.test/gallery" }],
    content: "",
    contentFormat: "images",
    coverImageUrl: "https://cdn.test/page-1.jpg",
    coverImageAlt: "Capa do capitulo 3",
    pages,
    publicationStatus: "draft",
    ...overrides,
    pageCount: overrides.pageCount ?? pages.length,
    hasPages: overrides.hasPages ?? pages.length > 0,
  };
};

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
    expect(screen.getByTestId("manga-pages-upload-actions")).toBeInTheDocument();
    expect(screen.getByTestId("manga-pages-export-actions")).toBeInTheDocument();
    expect(screen.getByTestId("manga-pages-grid")).toBeInTheDocument();
    expect(screen.getByTestId("manga-pages-grid")).toHaveClass(
      "grid",
      "gap-3",
      "sm:grid-cols-2",
      "lg:grid-cols-3",
      "xl:grid-cols-5",
    );
    expect(screen.queryByTestId("manga-pages-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manga-pages-add-tile")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Trocar/i })).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("manga-pages-upload-actions")).getByRole("button", {
        name: /^ZIP$/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("manga-pages-export-actions")).getByRole("button", {
        name: /^ZIP$/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^CBZ$/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("manga-pages-archive-input")).toHaveAttribute(
      "accept",
      ".zip,.cbz,application/zip,application/x-cbz",
    );
    expect(getPageOrder()).toEqual(["https://cdn.test/page-1.jpg", "https://cdn.test/page-2.jpg"]);
    expect(screen.getByTestId("manga-page-position-badge-0")).toHaveTextContent(/P.gina 1/i);
    expect(screen.getByTestId("manga-page-position-badge-1")).toHaveTextContent(/P.gina 2/i);
    expect(screen.getByTestId("manga-page-top-row-0")).toHaveClass(
      "absolute",
      "left-3",
      "top-3",
      "items-start",
    );
    expect(screen.getByTestId("manga-page-top-actions-0")).toHaveClass(
      "absolute",
      "flex",
      "right-3",
      "top-3",
      "justify-end",
    );
    expect(screen.getByTestId("manga-page-top-actions-0")).toHaveAttribute(
      "data-actions-visible",
      "false",
    );
    expect(screen.getByTestId("manga-page-cover-badge-0")).toBeInTheDocument();
    expect(screen.getByTestId("manga-page-surface-0")).toHaveClass("aspect-[1/1.414]");
    expect(screen.getByTestId("manga-page-status-badges-0")).toHaveClass(
      "absolute",
      "right-3",
      "top-3",
      "justify-end",
    );
    expect(screen.getByTestId("manga-page-status-badges-0")).toHaveAttribute(
      "data-status-badges-visible",
      "true",
    );
    expect(screen.getByTestId("manga-page-filename-0")).toHaveTextContent("page-1.jpg");
    expect(screen.getByTestId("manga-page-filename-1")).toHaveTextContent("page-2.jpg");
    expect(screen.getByTestId("manga-page-surface-0")).not.toHaveAttribute("title");
    expect(screen.getByTestId("manga-page-filename-0")).not.toHaveAttribute("title");

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
    expect(screen.getByTestId("manga-page-surface-0")).not.toHaveAttribute("title");

    fireEvent.drop(screen.getByTestId("manga-page-surface-0"), { dataTransfer });
    fireEvent.dragEnd(screen.getByTestId("manga-page-surface-1"), { dataTransfer });

    await waitFor(() => {
      expect(getPageOrder()).toEqual([
        "https://cdn.test/page-2.jpg",
        "https://cdn.test/page-1.jpg",
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(/movida para a posi/i);
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

  it("mantem exportacao curta na barra superior e fontes em secao propria", () => {
    renderEditor();

    expect(screen.queryByTestId("manga-pages-utilities")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manga-pages-utilities-trigger")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manga-pages-utilities-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manga-pages-export")).not.toBeInTheDocument();
    expect(screen.queryByText(/Preview/i)).not.toBeInTheDocument();

    expect(screen.getByTestId("manga-pages-export-actions")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("manga-pages-upload-actions")).getByRole("button", {
        name: /^ZIP$/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("manga-pages-export-actions")).getByRole("button", {
        name: /^ZIP$/i,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^CBZ$/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("manga-pages-archive-input")).toHaveAttribute(
      "accept",
      ".zip,.cbz,application/zip,application/x-cbz",
    );
    expect(screen.getByTestId("manga-pages-sources")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Fonte 1" })).toHaveTextContent("Galeria");
    expect(screen.getByDisplayValue("https://cdn.test/gallery")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Abrir leitura/i })).not.toBeInTheDocument();
  });

  it("cria e desfaz um spread entre paginas adjacentes com pill visivel no bloco direito", async () => {
    const { onChangeSpy } = renderEditor();

    fireEvent.click(screen.getAllByRole("button", { name: /Juntar com a pr/i })[0]);

    await waitFor(() => {
      const lastCall = onChangeSpy.mock.lastCall?.[0] as ProjectEpisode | undefined;
      expect(lastCall?.pages?.[0]?.spreadPairId).toBeTruthy();
      expect(lastCall?.pages?.[0]?.spreadPairId).toBe(lastCall?.pages?.[1]?.spreadPairId);
    });

    const coverSpreadBadges = screen.getByTestId("manga-page-status-badges-0");
    expect(screen.getByTestId("manga-page-spread-badge-0")).toBeInTheDocument();
    expect(screen.getByTestId("manga-page-spread-badge-1")).toBeInTheDocument();
    expect(screen.getByTestId("manga-page-spread-badge-0")).toHaveClass(
      "bg-primary",
      "text-primary-foreground",
    );
    expect(Array.from(coverSpreadBadges.children).map((node) => node.textContent)).toEqual([
      "Capa",
      "Spread",
    ]);

    await waitFor(() => {
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(
        /Spread criado entre as paginas 1 e 2/i,
      );
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Desfazer spread/i })[0]);

    await waitFor(() => {
      const lastCall = onChangeSpy.mock.lastCall?.[0] as ProjectEpisode | undefined;
      expect(lastCall?.pages?.some((page) => page.spreadPairId)).toBe(false);
    });

    expect(screen.queryByTestId("manga-page-spread-badge-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manga-page-spread-badge-1")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(
        /Spread removido das paginas 1 e 2/i,
      );
    });
  });

  it("oculta badges no hover e nao trava os botoes apos foco por mouse", () => {
    renderEditor();

    const surface = screen.getByTestId("manga-page-surface-0");
    const topActions = screen.getByTestId("manga-page-top-actions-0");
    const statusBadges = screen.getByTestId("manga-page-status-badges-0");
    const actions = screen.getByTestId("manga-page-actions-0");
    const joinSpreadButton = screen.getAllByRole("button", { name: /Juntar com a pr/i })[0];

    expect(statusBadges).toHaveAttribute("data-status-badges-visible", "true");
    fireEvent.mouseEnter(surface);
    expect(surface).toHaveAttribute("data-surface-active", "true");
    expect(topActions).toHaveAttribute("data-actions-visible", "true");
    expect(statusBadges).toHaveAttribute("data-status-badges-visible", "false");

    fireEvent.mouseEnter(actions);
    expect(surface).toHaveAttribute("data-surface-active", "false");
    expect(topActions).toHaveAttribute("data-actions-visible", "true");
    expect(statusBadges).toHaveAttribute("data-status-badges-visible", "false");

    fireEvent.pointerDown(joinSpreadButton);
    fireEvent.focus(joinSpreadButton);
    fireEvent.mouseLeave(actions);
    fireEvent.mouseLeave(surface);

    expect(surface).toHaveAttribute("data-surface-active", "false");
    expect(topActions).toHaveAttribute("data-actions-visible", "false");
    expect(statusBadges).toHaveAttribute("data-status-badges-visible", "true");
  });

  it("desfaz o spread quando um reorder separa o par", async () => {
    const { onChangeSpy } = renderEditor({
      chapter: createChapterFixture({
        pages: createPageFixtures(3),
      }),
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Juntar com a pr/i })[0]);

    await waitFor(() => {
      expect(screen.getByTestId("manga-page-spread-badge-0")).toBeInTheDocument();
      expect(screen.getByTestId("manga-page-spread-badge-1")).toBeInTheDocument();
    });

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("manga-page-surface-1"), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId("manga-page-surface-2"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("manga-page-surface-2"), { dataTransfer });
    fireEvent.dragEnd(screen.getByTestId("manga-page-surface-1"), { dataTransfer });

    await waitFor(() => {
      expect(getPageOrder()).toEqual([
        "https://cdn.test/page-1.jpg",
        "https://cdn.test/page-3.jpg",
        "https://cdn.test/page-2.jpg",
      ]);
    });

    await waitFor(() => {
      const lastCall = onChangeSpy.mock.lastCall?.[0] as ProjectEpisode | undefined;
      expect(lastCall?.pages?.map((page) => page.imageUrl)).toEqual([
        "https://cdn.test/page-1.jpg",
        "https://cdn.test/page-3.jpg",
        "https://cdn.test/page-2.jpg",
      ]);
      expect(lastCall?.pages?.some((page) => page.spreadPairId)).toBe(false);
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

  it("limpa o spread restante quando uma das paginas do par e removida", async () => {
    const { onChangeSpy } = renderEditor({
      chapter: createChapterFixture({
        pages: createPageFixtures(3),
      }),
    });

    fireEvent.click(screen.getAllByRole("button", { name: /Juntar com a pr/i })[0]);

    await waitFor(() => {
      expect(screen.getByTestId("manga-page-spread-badge-0")).toBeInTheDocument();
      expect(screen.getByTestId("manga-page-spread-badge-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Remover" })[0]);

    await waitFor(() => {
      expect(getPageOrder()).toEqual([
        "https://cdn.test/page-2.jpg",
        "https://cdn.test/page-3.jpg",
      ]);
    });

    await waitFor(() => {
      const lastCall = onChangeSpy.mock.lastCall?.[0] as ProjectEpisode | undefined;
      expect(lastCall?.pages?.map((page) => page.imageUrl)).toEqual([
        "https://cdn.test/page-2.jpg",
        "https://cdn.test/page-3.jpg",
      ]);
      expect(lastCall?.pages?.some((page) => page.spreadPairId)).toBe(false);
    });

    await waitFor(() => {
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(
        /Spread desfeito apos remover a pagina/i,
      );
    });
  });
});
