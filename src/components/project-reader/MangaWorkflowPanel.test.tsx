import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project, ProjectEpisode } from "@/data/projects";
import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";
import MangaWorkflowPanel, {
  type StageChapter,
} from "@/components/project-reader/MangaWorkflowPanel";

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

const createExistingChapter = (): ProjectEpisode => ({
  number: 2,
  volume: 1,
  title: "Capitulo publicado",
  synopsis: "",
  releaseDate: "2026-03-14",
  duration: "",
  sourceType: "Web",
  sources: [],
  content: "",
  contentFormat: "images",
  pages: [
    { position: 1, imageUrl: "https://cdn.test/existing-1.jpg" },
    { position: 2, imageUrl: "https://cdn.test/existing-2.jpg" },
  ],
  pageCount: 2,
  hasPages: true,
  publicationStatus: "published",
});

const createProjectFixture = (): Project & { revision?: string } => ({
  id: "project-1",
  revision: "rev-1",
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
  episodeDownloads: [createExistingChapter()],
  staff: [],
});

const createFolderFile = (relativePath: string) => {
  const name = relativePath.split("/").pop() || "pagina.jpg";
  const file = new File(["image"], name, { type: "image/jpeg" });
  Object.defineProperty(file, "webkitRelativePath", {
    value: relativePath,
    configurable: true,
  });
  return file;
};

const createDataTransfer = () => ({
  effectAllowed: "move",
  dropEffect: "move",
  setData: vi.fn(),
  getData: vi.fn(),
  clearData: vi.fn(),
});

const getStagePageOrder = () =>
  screen.getAllByTestId("upload-picture").map((node) => node.getAttribute("src"));

const renderWorkflow = (options?: {
  onSelectedStageChapterChange?: (chapter: StageChapter | null) => void;
  onOpenImportedChapter?: (project: Project & { revision?: string }, chapters: ProjectEpisode[]) => void;
  onProjectChange?: (project: Project & { revision?: string }) => void;
  onPersistProjectSnapshot?: (
    snapshot: Project & { revision?: string },
  ) => Promise<(Project & { revision?: string }) | null>;
}) => {
  const project = createProjectFixture();
  const onSelectedStageChapterChangeSpy = vi.fn(options?.onSelectedStageChapterChange);
  const onOpenImportedChapterSpy = vi.fn(options?.onOpenImportedChapter);
  const onProjectChangeSpy = vi.fn(options?.onProjectChange);

  const Harness = () => {
    const [stagedChapters, setStagedChapters] = useState<StageChapter[]>([]);
    const [selectedStageChapterId, setSelectedStageChapterId] = useState<string | null>(null);
    return (
      <AccessibilityAnnouncerProvider>
        <MangaWorkflowPanel
          apiBase="http://api.local"
          project={project}
          projectSnapshot={project}
          selectedVolume={1}
          filterMode="all"
          filteredChapters={project.episodeDownloads}
          stagedChapters={stagedChapters}
          setStagedChapters={setStagedChapters}
          selectedStageChapterId={selectedStageChapterId}
          setSelectedStageChapterId={setSelectedStageChapterId}
          onPersistProjectSnapshot={options?.onPersistProjectSnapshot ?? vi.fn(async (snapshot) => snapshot)}
          onProjectChange={onProjectChangeSpy}
          onNavigateToChapter={vi.fn()}
          onSelectedStageChapterChange={onSelectedStageChapterChangeSpy}
          onOpenImportedChapter={onOpenImportedChapterSpy}
        />
      </AccessibilityAnnouncerProvider>
    );
  };

  render(<Harness />);
  return {
    onSelectedStageChapterChangeSpy,
    onOpenImportedChapterSpy,
    onProjectChangeSpy,
  };
};

const stageSingleChapter = async (relativeFolder = "Volume 1/Capitulo 3") => {
  fireEvent.change(screen.getByTestId("manga-stage-folder-input"), {
    target: {
      files: [
        createFolderFile(`${relativeFolder}/001.jpg`),
        createFolderFile(`${relativeFolder}/002.jpg`),
      ],
    },
  });

  await screen.findByTestId("manga-stage-page-surface-0");
};

describe("MangaWorkflowPanel", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
    downloadBinaryResponseMock.mockReset();
    vi.stubGlobal(
      "URL",
      Object.assign({}, window.URL, {
        createObjectURL: vi.fn((file: File) => `blob:${file.name}`),
        revokeObjectURL: vi.fn(),
      }),
    );
  });

  it("mantem importacao e revisao no card principal sem a faixa de acoes em lote", () => {
    renderWorkflow();

    const importCard = screen.getByTestId("manga-workflow-import-card");
    expect(importCard).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-review-card")).toBeInTheDocument();
    expect(screen.queryByTestId("manga-workflow-existing-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manga-workflow-publication-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("manga-workflow-batch-strip")).not.toBeInTheDocument();
    expect(
      within(importCard).queryByRole("button", { name: /Salvar filtrados como rascunho/i }),
    ).not.toBeInTheDocument();
    expect(
      within(importCard).queryByRole("button", { name: /Publicar filtrados/i }),
    ).not.toBeInTheDocument();
    expect(
      within(importCard).queryByRole("button", { name: /Publicar volume 1/i }),
    ).not.toBeInTheDocument();
    expect(
      within(importCard).queryByRole("button", { name: /Exportar colecao/i }),
    ).not.toBeInTheDocument();
    expect(within(importCard).queryByLabelText(/^Volume$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Incluir rascunhos/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("manga-workflow-staging-card")).not.toBeInTheDocument();
    expect(screen.queryByText("Ação")).not.toBeInTheDocument();
    expect(screen.queryByText(/Preview do leitor/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Novo capitulo no lote/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar lote/i })).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-import-fields")).toHaveClass(
      "flex",
      "flex-wrap",
      "items-end",
      "gap-3",
    );
  });
  it("detecta automaticamente atualizacao quando o lote bate em volume + capitulo existente", async () => {
    renderWorkflow();
    await stageSingleChapter("Volume 1/Capitulo 2");

    expect(screen.getByText("Atualiza existente")).toBeInTheDocument();
    expect(screen.queryByText("Criar")).not.toBeInTheDocument();
    expect(document.getElementById("stage-chapter-title") as HTMLInputElement).toHaveClass("w-full");
    expect(document.getElementById("stage-chapter-number") as HTMLInputElement).toHaveClass("w-full", "sm:w-[132px]");
    expect(document.getElementById("stage-chapter-volume") as HTMLInputElement).toHaveClass("w-full", "sm:w-[132px]");
    expect(document.getElementById("stage-chapter-publication-status")).toBeNull();
    expect(screen.getByRole("button", { name: /Salvar como rascunho/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Publicar$/i })).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-review-fields")).toHaveClass(
      "flex",
      "flex-wrap",
      "items-end",
      "gap-3",
    );
    expect(screen.getByTestId("manga-workflow-review-actions")).toHaveClass(
      "flex",
      "min-w-[240px]",
      "flex-1",
      "flex-wrap",
      "items-end",
    );
    expect(screen.queryByText(/^Origem:/i)).not.toBeInTheDocument();
  });
  it("sincroniza o capitulo pendente selecionado com o editor pai", async () => {
    const { onSelectedStageChapterChangeSpy } = renderWorkflow();
    await stageSingleChapter();

    await waitFor(() => {
      expect(onSelectedStageChapterChangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          volume: 1,
          number: 3,
        }),
      );
    });
  });

  it("reordena paginas do lote por drag and drop com preview visual e nome do arquivo", async () => {
    renderWorkflow();
    await stageSingleChapter();

    expect(getStagePageOrder()).toEqual(["blob:001.jpg", "blob:002.jpg"]);
    expect(screen.getByTestId("manga-stage-page-filename-0")).toHaveTextContent("001.jpg");
    expect(screen.getByTestId("manga-stage-page-filename-1")).toHaveTextContent("002.jpg");

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("manga-stage-page-surface-1"), { dataTransfer });
    expect(screen.getByTestId("manga-stage-page-surface-1")).toHaveAttribute(
      "data-reorder-state",
      "dragging",
    );
    expect(screen.getByTestId("manga-stage-page-surface-1")).toHaveAttribute(
      "data-reorder-motion",
      "spring",
    );
    expect(screen.getByTestId("manga-stage-page-card-1")).toHaveAttribute(
      "data-reorder-layout",
      "static",
    );
    fireEvent.dragOver(screen.getByTestId("manga-stage-page-card-0"), { dataTransfer });

    await waitFor(() => {
      expect(getStagePageOrder()).toEqual(["blob:002.jpg", "blob:001.jpg"]);
    });
    expect(screen.getByTestId("manga-stage-page-card-0")).toHaveAttribute(
      "data-reorder-layout",
      "static",
    );
    expect(screen.getByTestId("manga-stage-page-card-1")).toHaveAttribute(
      "data-reorder-layout",
      "animated",
    );
    expect(screen.getByTestId("manga-stage-page-filename-0")).toHaveTextContent("002.jpg");
    expect(screen.getByTestId("manga-stage-page-surface-0")).toHaveAttribute("title", "002.jpg");

    fireEvent.drop(screen.getByTestId("manga-stage-page-card-0"), { dataTransfer });
    fireEvent.dragEnd(screen.getByTestId("manga-stage-page-surface-1"), { dataTransfer });

    await waitFor(() => {
      expect(getStagePageOrder()).toEqual(["blob:002.jpg", "blob:001.jpg"]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(
        /Pagina 2 movida para a posicao 1/i,
      );
    });
  });

  it("abre o capitulo importado pelo callback do editor pai", async () => {
    apiFetchMock.mockImplementation(async (_apiBase: string, path: string) => {
      if (path === "/api/uploads/image") {
        return {
          ok: true,
          json: async () => ({ url: "https://cdn.test/imported-001.jpg" }),
        } as Response;
      }
      throw new Error(`unexpected_api_call:${path}`);
    });

    const { onOpenImportedChapterSpy, onProjectChangeSpy } = renderWorkflow();
    await stageSingleChapter();

    fireEvent.click(screen.getByRole("button", { name: /Importar lote/i }));

    await waitFor(() => {
      expect(onOpenImportedChapterSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "project-1",
        }),
        [
          expect.objectContaining({
            number: 3,
            volume: 1,
            contentFormat: "images",
          }),
        ],
      );
    });

    expect(onProjectChangeSpy).not.toHaveBeenCalled();
  });

  it("importa o capitulo selecionado da revisao como rascunho", async () => {
    apiFetchMock.mockImplementation(async (_apiBase: string, path: string) => {
      if (path === "/api/uploads/image") {
        return {
          ok: true,
          json: async () => ({ url: "https://cdn.test/imported-001.jpg" }),
        } as Response;
      }
      throw new Error(`unexpected_api_call:${path}`);
    });

    const { onOpenImportedChapterSpy, onProjectChangeSpy } = renderWorkflow();
    await stageSingleChapter();

    fireEvent.click(screen.getByRole("button", { name: /Salvar como rascunho/i }));

    await waitFor(() => {
      expect(onOpenImportedChapterSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: "project-1" }),
        [
          expect.objectContaining({
            number: 3,
            volume: 1,
            publicationStatus: "draft",
          }),
        ],
      );
    });

    expect(onProjectChangeSpy).not.toHaveBeenCalled();
  });

  it("importa o capitulo selecionado da revisao como publicado", async () => {
    apiFetchMock.mockImplementation(async (_apiBase: string, path: string) => {
      if (path === "/api/uploads/image") {
        return {
          ok: true,
          json: async () => ({ url: "https://cdn.test/imported-001.jpg" }),
        } as Response;
      }
      throw new Error(`unexpected_api_call:${path}`);
    });

    const { onOpenImportedChapterSpy } = renderWorkflow();
    await stageSingleChapter();

    fireEvent.click(screen.getByRole("button", { name: /^Publicar$/i }));

    await waitFor(() => {
      expect(onOpenImportedChapterSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: "project-1" }),
        [
          expect.objectContaining({
            number: 3,
            volume: 1,
            publicationStatus: "published",
          }),
        ],
      );
    });
  });

  it("mantem o capitulo na revisao quando a importacao direta falha", async () => {
    apiFetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "upload_failed" }),
    } as Response);

    const onPersistProjectSnapshot = vi.fn(async (snapshot: Project & { revision?: string }) => snapshot);
    const { onOpenImportedChapterSpy } = renderWorkflow({ onPersistProjectSnapshot });
    await stageSingleChapter();

    fireEvent.click(screen.getByRole("button", { name: /Salvar como rascunho/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Nao foi possivel concluir a importacao",
          variant: "destructive",
        }),
      );
    });

    expect(onPersistProjectSnapshot).not.toHaveBeenCalled();
    expect(onOpenImportedChapterSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("manga-stage-page-surface-0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar como rascunho/i })).toBeInTheDocument();
  });
});

