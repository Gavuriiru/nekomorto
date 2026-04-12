import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project, ProjectEpisode } from "@/data/projects";
import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";
import MangaWorkflowPanel, {
  type MangaWorkflowPanelHandle,
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
  onOpenImportedChapter?: (
    project: Project & { revision?: string },
    chapters: ProjectEpisode[],
  ) => void;
  onProjectChange?: (project: Project & { revision?: string }) => void;
  onPersistProjectSnapshot?: (
    snapshot: Project & { revision?: string },
  ) => Promise<(Project & { revision?: string }) | null>;
  initialStagedChapters?: StageChapter[];
  initialSelectedStageChapterId?: string | null;
}) => {
  const project = createProjectFixture();
  const onSelectedStageChapterChangeSpy = vi.fn(options?.onSelectedStageChapterChange);
  const onOpenImportedChapterSpy = vi.fn(options?.onOpenImportedChapter);
  const onProjectChangeSpy = vi.fn(options?.onProjectChange);
  const workflowRef: { current: MangaWorkflowPanelHandle | null } = { current: null };

  const Harness = () => {
    const [stagedChapters, setStagedChapters] = useState<StageChapter[]>(
      options?.initialStagedChapters ?? [],
    );
    const [selectedStageChapterId, setSelectedStageChapterId] = useState<string | null>(
      options?.initialSelectedStageChapterId ?? options?.initialStagedChapters?.[0]?.id ?? null,
    );
    return (
      <AccessibilityAnnouncerProvider>
        <MangaWorkflowPanel
          ref={(value) => {
            workflowRef.current = value;
          }}
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
          onPersistProjectSnapshot={
            options?.onPersistProjectSnapshot ?? vi.fn(async (snapshot) => snapshot)
          }
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
    workflowRef,
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

  it("mostra importacao e revisao no estado inicial sem o bloco final de importacao", () => {
    renderWorkflow();

    const importCard = screen.getByTestId("manga-workflow-import-card");
    const importSources = screen.getByTestId("manga-workflow-import-sources");
    const importFields = screen.getByTestId("manga-workflow-import-fields");
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
    expect(screen.queryByText(/Incluir rascunhos/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("manga-workflow-staging-card")).not.toBeInTheDocument();
    expect(screen.queryByText("Ação")).not.toBeInTheDocument();
    expect(screen.queryByText(/Preview do leitor/i)).not.toBeInTheDocument();
    expect(importSources).toBeInTheDocument();
    expect(importFields).toBeInTheDocument();
    expect(screen.queryByTestId("manga-workflow-import-submit")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Adicionar arquivos/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Dados iniciais/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Novo capítulo/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Importar agora/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("manga-stage-archive-input")).toHaveAttribute(
      "accept",
      ".zip,.cbz,application/zip,application/x-cbz",
    );
    expect(importSources).toHaveClass("space-y-3", "rounded-xl", "border", "p-3");
    expect(importFields).toHaveClass("space-y-3", "rounded-xl", "border", "p-3");
    expect(within(importFields).getByLabelText(/^Volume$/i)).toBeInTheDocument();
    expect(within(importFields).getByLabelText(/Capítulo/i)).toBeInTheDocument();
    expect(within(importFields).getByLabelText(/Status inicial/i)).toBeInTheDocument();
    expect(within(importFields).queryByRole("button", { name: /Limpar importação/i })).toBeNull();
  });

  it("esconde a importacao quando ha capitulos preparados e a reexibe ao remover o ultimo", async () => {
    renderWorkflow();

    expect(screen.getByTestId("manga-workflow-import-card")).toBeInTheDocument();
    await stageSingleChapter();

    expect(screen.queryByTestId("manga-workflow-import-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-review-card")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar como rascunho/i })).toBeInTheDocument();
    const reviewActions = screen.getByTestId("manga-workflow-review-actions");
    expect(within(reviewActions).getByRole("button", { name: /^Remover$/i })).toBeInTheDocument();

    fireEvent.click(within(reviewActions).getByRole("button", { name: /^Remover$/i }));

    await waitFor(() => {
      expect(screen.getByTestId("manga-workflow-import-card")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("manga-stage-page-surface-0")).not.toBeInTheDocument();
  });
  it("detecta automaticamente atualizacao quando o lote bate em volume + capitulo existente", async () => {
    renderWorkflow();
    await stageSingleChapter("Volume 1/Capitulo 2");

    expect(screen.queryByTestId("manga-workflow-import-card")).not.toBeInTheDocument();
    expect(screen.getByText("Atualiza existente")).toBeInTheDocument();
    expect(screen.queryByText("Criar")).not.toBeInTheDocument();
    expect(document.getElementById("stage-chapter-title") as HTMLInputElement).toHaveClass(
      "w-full",
    );
    expect(document.getElementById("stage-chapter-publication-status")).toBeNull();
    expect(screen.getByRole("button", { name: /Salvar como rascunho/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Publicar$/i })).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-review-data-card")).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-pages-card")).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-pages-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-review-fields")).toHaveClass(
      "grid",
      "gap-3",
      "md:grid-cols-3",
    );
    expect(screen.getByTestId("manga-workflow-review-actions")).toHaveClass(
      "flex",
      "flex-wrap",
      "items-center",
    );
    expect(screen.queryByText(/^Origem:/i)).not.toBeInTheDocument();
  });

  it("usa o capítulo informado ao preparar uma importação com um único capítulo", async () => {
    renderWorkflow();

    fireEvent.change(screen.getByLabelText(/Capítulo/i), {
      target: { value: "9" },
    });
    await stageSingleChapter();

    expect(document.getElementById("stage-chapter-number")).toHaveValue(9);
  });

  it("aplica o override de capítulo só ao primeiro item quando a importação gera vários capítulos", async () => {
    const project = createProjectFixture();

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
            onPersistProjectSnapshot={vi.fn(async (snapshot) => snapshot)}
            onProjectChange={vi.fn()}
            onNavigateToChapter={vi.fn()}
          />
          <button
            type="button"
            data-testid="select-second-stage"
            onClick={() => setSelectedStageChapterId(stagedChapters[1]?.id || null)}
          >
            Select second stage
          </button>
          <div data-testid="staged-chapters-json">{JSON.stringify(stagedChapters)}</div>
        </AccessibilityAnnouncerProvider>
      );
    };

    render(<Harness />);

    fireEvent.change(screen.getByLabelText(/Capítulo/i), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByTestId("manga-stage-folder-input"), {
      target: {
        files: [
          createFolderFile("Volume 1/Capitulo 3/001.jpg"),
          createFolderFile("Volume 1/Capitulo 3/002.jpg"),
          createFolderFile("Volume 1/Capitulo 4/001.jpg"),
          createFolderFile("Volume 1/Capitulo 4/002.jpg"),
        ],
      },
    });

    await waitFor(() => {
      expect(
        JSON.parse(screen.getByTestId("staged-chapters-json").textContent || "[]"),
      ).toHaveLength(2);
    });

    expect(document.getElementById("stage-chapter-number")).toHaveValue(20);

    fireEvent.click(screen.getByTestId("select-second-stage"));

    await waitFor(() => {
      expect(document.getElementById("stage-chapter-number")).toHaveValue(4);
    });
  });

  it("usa o capítulo informado ao criar um novo capítulo manual", () => {
    renderWorkflow();

    fireEvent.change(screen.getByLabelText(/Capítulo/i), {
      target: { value: "11" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Novo capítulo/i }));

    expect(document.getElementById("stage-chapter-number")).toHaveValue(11);
  });

  it("mantém a numeração automática ao criar um novo capítulo manual sem capítulo informado", () => {
    renderWorkflow();

    fireEvent.click(screen.getByRole("button", { name: /Novo capítulo/i }));

    expect(document.getElementById("stage-chapter-number")).toHaveValue(3);
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
    expect(
      screen.getByTestId("manga-stage-page-surface-0").parentElement?.parentElement,
    ).toHaveClass("grid", "gap-3", "sm:grid-cols-2", "lg:grid-cols-3", "xl:grid-cols-5");
    expect(screen.getByTestId("manga-stage-page-position-badge-0")).toHaveTextContent(/P.gina 1/i);
    expect(screen.getByTestId("manga-stage-page-position-badge-1")).toHaveTextContent(/P.gina 2/i);
    expect(screen.getByTestId("manga-stage-page-top-row-0")).toHaveClass(
      "absolute",
      "left-3",
      "top-3",
      "items-start",
    );
    expect(screen.getByTestId("manga-stage-page-top-actions-0")).toHaveClass(
      "absolute",
      "flex",
      "right-3",
      "top-3",
      "justify-end",
    );
    expect(screen.getByTestId("manga-stage-page-top-actions-0")).toHaveAttribute(
      "data-actions-visible",
      "false",
    );
    expect(screen.getByTestId("manga-stage-page-cover-badge-0")).toBeInTheDocument();
    expect(screen.getByTestId("manga-stage-page-surface-0")).toHaveClass("aspect-[1/1.414]");
    expect(screen.getByTestId("manga-stage-page-status-badges-0")).toHaveClass(
      "absolute",
      "right-3",
      "top-3",
      "justify-end",
    );
    expect(screen.getByTestId("manga-stage-page-status-badges-0")).toHaveAttribute(
      "data-status-badges-visible",
      "true",
    );
    expect(screen.getByTestId("manga-stage-page-filename-0")).toHaveTextContent("001.jpg");
    expect(screen.getByTestId("manga-stage-page-filename-1")).toHaveTextContent("002.jpg");
    expect(screen.getByTestId("manga-stage-page-surface-0")).not.toHaveAttribute("title");
    expect(screen.getByTestId("manga-stage-page-filename-0")).not.toHaveAttribute("title");

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
    fireEvent.dragOver(screen.getByTestId("manga-stage-page-surface-0"), { dataTransfer });

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
    expect(screen.getByTestId("manga-stage-page-surface-0")).not.toHaveAttribute("title");

    fireEvent.drop(screen.getByTestId("manga-stage-page-surface-0"), { dataTransfer });
    fireEvent.dragEnd(screen.getByTestId("manga-stage-page-surface-1"), { dataTransfer });

    await waitFor(() => {
      expect(getStagePageOrder()).toEqual(["blob:002.jpg", "blob:001.jpg"]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(/movida para a posi/i);
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

    fireEvent.click(screen.getByRole("button", { name: /^Publicar$/i }));

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
    expect(screen.getByTestId("manga-workflow-import-card")).toBeInTheDocument();
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

  it("permite salvar como rascunho sem imagens com a revisão em cards", async () => {
    const manualChapter: StageChapter = {
      id: "stage-empty",
      number: 5,
      volume: 1,
      title: "",
      synopsis: "",
      titleDetected: "",
      sourceLabel: "Capitulo manual",
      pages: [],
      coverPageId: null,
      entryKind: "main",
      entrySubtype: "chapter",
      displayLabel: undefined,
      publicationStatus: "draft",
      progressStage: "aguardando-raw",
      completedStages: [],
      operation: "create",
      warnings: [],
    };

    const onPersistProjectSnapshot = vi.fn(async (snapshot: Project & { revision?: string }) => ({
      ...snapshot,
      revision: "rev-2",
    }));
    const { onOpenImportedChapterSpy, onProjectChangeSpy } = renderWorkflow({
      onPersistProjectSnapshot,
      initialStagedChapters: [manualChapter],
      initialSelectedStageChapterId: "stage-empty",
    });

    const progressSection = screen.getByTestId("manga-workflow-progress-section");
    const reviewCard = screen.getByTestId("manga-workflow-review-card");
    const dataCard = screen.getByTestId("manga-workflow-review-data-card");
    const pagesCard = screen.getByTestId("manga-workflow-pages-card");

    expect(progressSection).toBeInTheDocument();
    expect(within(reviewCard).getByTestId("manga-workflow-progress-section")).toBe(progressSection);
    expect(dataCard).toBeInTheDocument();
    expect(pagesCard).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-pages-toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-pages-badges")).toBeInTheDocument();
    expect(within(pagesCard).getByTestId("manga-workflow-review-actions")).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-progress-percent")).toHaveTextContent("0%");
    expect(screen.getByTestId("manga-workflow-progress-stage-track")).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-progress-stage-list")).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-progress-stage-chip-aguardando-raw")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Aguardando Raw: atual/i),
    );
    const currentStageBadge = within(progressSection)
      .getAllByText("Atual")
      .find((element) => String((element as HTMLElement).className || "").includes("rounded-full"));
    expect(currentStageBadge).toHaveClass(
      "border-[hsl(var(--badge-info-border))]",
      "bg-[hsl(var(--badge-info-bg))]",
      "text-[hsl(var(--badge-info-fg))]",
    );
    fireEvent.change(screen.getByLabelText(/Sinopse/i), {
      target: { value: "Sinopse do rascunho vazio" },
    });
    expect(screen.getByRole("button", { name: /Salvar como rascunho/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Publicar$/i })).toBeDisabled();

    fireEvent.click(screen.getByTestId("manga-workflow-progress-toggle-aguardando-raw"));
    expect(screen.getByTestId("manga-workflow-progress-percent")).toHaveTextContent("14%");
    expect(screen.getByTestId("manga-workflow-progress-stage-chip-traducao")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Tradução: atual/i),
    );

    fireEvent.click(screen.getByRole("button", { name: /Salvar como rascunho/i }));

    await waitFor(() => {
      expect(onPersistProjectSnapshot).toHaveBeenCalledTimes(1);
    });

    const [persistedSnapshot, persistedOptions] = onPersistProjectSnapshot.mock
      .calls[0] as unknown as [Project & { revision?: string }, { context: string }];
    expect(persistedOptions).toEqual({ context: "manga-import" });
    expect(persistedSnapshot.episodeDownloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          number: 5,
          volume: 1,
          publicationStatus: "draft",
          contentFormat: "images",
          pages: [],
          pageCount: 0,
          hasPages: false,
          synopsis: "Sinopse do rascunho vazio",
          completedStages: ["aguardando-raw"],
          progressStage: "traducao",
        }),
      ]),
    );
    expect(onOpenImportedChapterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: "rev-2",
      }),
      expect.arrayContaining([
        expect.objectContaining({
          number: 5,
          volume: 1,
          publicationStatus: "draft",
          contentFormat: "images",
          pages: [],
          pageCount: 0,
          hasPages: false,
          synopsis: "Sinopse do rascunho vazio",
          completedStages: ["aguardando-raw"],
          progressStage: "traducao",
        }),
      ]),
    );
    expect(onProjectChangeSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("manga-workflow-progress-section")).not.toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-review-card")).toBeInTheDocument();
  });

  it("mantém o progresso dentro da revisão e bloqueia publicar sem imagens", async () => {
    const manualChapter: StageChapter = {
      id: "stage-empty",
      number: 5,
      volume: 1,
      title: "",
      synopsis: "",
      titleDetected: "",
      sourceLabel: "Capitulo manual",
      pages: [],
      coverPageId: null,
      entryKind: "main",
      entrySubtype: "chapter",
      displayLabel: undefined,
      publicationStatus: "draft",
      progressStage: "aguardando-raw",
      completedStages: [],
      operation: "create",
      warnings: [],
    };

    const { onOpenImportedChapterSpy, onProjectChangeSpy } = renderWorkflow({
      initialStagedChapters: [manualChapter],
      initialSelectedStageChapterId: "stage-empty",
    });

    const reviewCard = screen.getByTestId("manga-workflow-review-card");

    expect(screen.getByTestId("manga-workflow-progress-section")).toBeInTheDocument();
    expect(within(reviewCard).getByTestId("manga-workflow-progress-section")).toBeInTheDocument();
    expect(within(reviewCard).getByTestId("manga-workflow-review-data-card")).toBeInTheDocument();
    expect(within(reviewCard).getByTestId("manga-workflow-pages-card")).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-progress-stage-chip-aguardando-raw")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Aguardando Raw: atual/i),
    );
    expect(screen.getByRole("button", { name: /^Publicar$/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Publicar$/i }));

    expect(toastMock).not.toHaveBeenCalled();
    expect(onOpenImportedChapterSpy).not.toHaveBeenCalled();
    expect(onProjectChangeSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("manga-workflow-review-card")).toBeInTheDocument();
  });

  it("mantem warnings reais visiveis e continua bloqueando a importacao", async () => {
    const duplicatedA: StageChapter = {
      id: "stage-dup-1",
      number: 7,
      volume: 1,
      title: "",
      synopsis: "",
      titleDetected: "",
      sourceLabel: "Capitulo duplicado A",
      pages: [
        {
          id: "page-a",
          file: new File(["image"], "001.jpg", { type: "image/jpeg" }),
          previewUrl: "blob:001.jpg",
          relativePath: "Volume 1/Capitulo 7/001.jpg",
          name: "001.jpg",
        },
      ],
      coverPageId: "page-a",
      entryKind: "main",
      entrySubtype: "chapter",
      displayLabel: undefined,
      publicationStatus: "draft",
      progressStage: "aguardando-raw",
      completedStages: [],
      operation: "create",
      warnings: [],
    };
    const duplicatedB: StageChapter = {
      ...duplicatedA,
      id: "stage-dup-2",
      sourceLabel: "Capitulo duplicado B",
      coverPageId: "page-b",
      pages: [
        {
          id: "page-b",
          file: new File(["image"], "002.jpg", { type: "image/jpeg" }),
          previewUrl: "blob:002.jpg",
          relativePath: "Volume 1/Capitulo 7/002.jpg",
          name: "002.jpg",
        },
      ],
    };

    const { onOpenImportedChapterSpy } = renderWorkflow({
      initialStagedChapters: [duplicatedA, duplicatedB],
      initialSelectedStageChapterId: "stage-dup-2",
    });

    expect(screen.getByText(/Ajuste antes de importar/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Já existe outro capítulo preparado com esse número \+ volume\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar como rascunho/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Publicar$/i })).toBeDisabled();
    expect(onOpenImportedChapterSpy).not.toHaveBeenCalled();
  });

  it("mantem o capitulo na revisao quando a importacao direta falha", async () => {
    apiFetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "upload_failed" }),
    } as Response);

    const onPersistProjectSnapshot = vi.fn(
      async (snapshot: Project & { revision?: string }) => snapshot,
    );
    const { onOpenImportedChapterSpy } = renderWorkflow({ onPersistProjectSnapshot });
    await stageSingleChapter();

    fireEvent.click(screen.getByRole("button", { name: /Salvar como rascunho/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Não foi possível concluir a importação",
          variant: "destructive",
        }),
      );
    });

    expect(onPersistProjectSnapshot).not.toHaveBeenCalled();
    expect(onOpenImportedChapterSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("manga-stage-page-surface-0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar como rascunho/i })).toBeInTheDocument();
  });

  it("mantem capitulo manual vazio fora do leave guard ate a primeira edicao", async () => {
    const { workflowRef } = renderWorkflow();

    fireEvent.click(screen.getByRole("button", { name: /Novo capítulo/i }));

    await waitFor(() => {
      expect(screen.getByTestId("manga-workflow-review-card")).toBeInTheDocument();
    });
    expect(workflowRef.current?.hasUnsavedChanges()).toBe(false);

    fireEvent.change(document.getElementById("stage-chapter-volume") as HTMLInputElement, {
      target: { value: "2" },
    });

    expect(workflowRef.current?.hasUnsavedChanges()).toBe(true);
  });

  it("marca importacao preparada como dirty para o leave guard e permite descartar o lote", async () => {
    const { workflowRef } = renderWorkflow();

    await stageSingleChapter();

    expect(workflowRef.current?.hasUnsavedChanges()).toBe(true);

    act(() => {
      workflowRef.current?.discardPreparedChapters();
    });

    expect(workflowRef.current?.hasUnsavedChanges()).toBe(false);
    expect(screen.getByTestId("manga-workflow-import-card")).toBeInTheDocument();
  });

  it("salva o lote preparado como rascunho sem autoabrir ao usar o leave guard", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://cdn.test/pending-page.jpg" }),
    } as Response);

    const onPersistProjectSnapshot = vi.fn(
      async (snapshot: Project & { revision?: string }) => snapshot,
    );
    const { workflowRef, onOpenImportedChapterSpy, onProjectChangeSpy } = renderWorkflow({
      onPersistProjectSnapshot,
    });

    await stageSingleChapter();

    await act(async () => {
      await workflowRef.current?.savePreparedChaptersAsDraft();
    });

    expect(onPersistProjectSnapshot).toHaveBeenCalled();
    expect(onProjectChangeSpy).toHaveBeenCalled();
    expect(onOpenImportedChapterSpy).not.toHaveBeenCalled();
    expect(workflowRef.current?.hasUnsavedChanges()).toBe(false);
    expect(screen.getByTestId("manga-workflow-import-card")).toBeInTheDocument();
  });
});
