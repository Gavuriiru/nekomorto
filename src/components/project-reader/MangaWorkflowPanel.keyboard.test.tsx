import MangaWorkflowPanel, {
  type StageChapter,
} from "@/components/project-reader/MangaWorkflowPanel";
import type { Project, ProjectEpisode } from "@/data/projects";
import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/UploadPicture", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img data-testid="upload-picture" src={src} alt={alt} />
  ),
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

const getStagePageOrder = () =>
  screen.getAllByTestId("upload-picture").map((node) => node.getAttribute("src"));

describe("MangaWorkflowPanel keyboard support", () => {
  beforeEach(() => {
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: (callback: FrameRequestCallback) =>
        window.setTimeout(() => callback(performance.now()), 0),
    });
  });

  it("reordena paginas do lote com Alt+seta e anuncia a nova posicao", async () => {
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

    fireEvent.change(screen.getByTestId("manga-stage-folder-input"), {
      target: {
        files: [
          createFolderFile("Volume 1/Capitulo 3/001.jpg"),
          createFolderFile("Volume 1/Capitulo 3/002.jpg"),
        ],
      },
    });

    const firstSurface = await screen.findByTestId("manga-stage-page-surface-0");

    fireEvent.keyDown(firstSurface, {
      key: "ArrowDown",
      altKey: true,
    });

    await waitFor(() => {
      expect(getStagePageOrder()).toEqual(["blob:002.jpg", "blob:001.jpg"]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(
        /Página 1 movida para a posição 2/i,
      );
    });
  });
});
