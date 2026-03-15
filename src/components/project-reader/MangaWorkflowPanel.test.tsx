import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const renderWorkflow = () => {
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
      </AccessibilityAnnouncerProvider>
    );
  };

  render(<Harness />);
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

  it("une importacao e parametros no card principal e remove staging separado, acao e preview", () => {
    renderWorkflow();

    expect(screen.getByTestId("manga-workflow-import-card")).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-review-card")).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-existing-card")).toBeInTheDocument();
    expect(screen.getByTestId("manga-workflow-publication-card")).toBeInTheDocument();
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
    expect(screen.getByTestId("manga-workflow-review-fields")).toHaveClass(
      "flex",
      "flex-wrap",
      "items-end",
      "gap-3",
    );
    expect(screen.getByTestId("manga-workflow-review-secondary-fields")).toHaveClass(
      "flex",
      "flex-wrap",
      "items-end",
      "justify-between",
    );
  });
  it("reordena paginas do lote por drag and drop", async () => {
    renderWorkflow();
    await stageSingleChapter();

    expect(getStagePageOrder()).toEqual(["blob:001.jpg", "blob:002.jpg"]);

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(screen.getByTestId("manga-stage-page-surface-1"), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId("manga-stage-page-card-0"), { dataTransfer });
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
});

