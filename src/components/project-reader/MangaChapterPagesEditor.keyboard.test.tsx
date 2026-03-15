import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Project, ProjectEpisode } from "@/data/projects";
import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";
import MangaChapterPagesEditor from "@/components/project-reader/MangaChapterPagesEditor";

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

const createChapterFixture = (): ProjectEpisode => ({
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
  pages: [
    { position: 1, imageUrl: "https://cdn.test/page-1.jpg" },
    { position: 2, imageUrl: "https://cdn.test/page-2.jpg" },
  ],
  pageCount: 2,
  hasPages: true,
  publicationStatus: "draft",
});

const getPageOrder = () =>
  screen.getAllByTestId("upload-picture").map((node) => node.getAttribute("src"));

describe("MangaChapterPagesEditor keyboard support", () => {
  it("reordena paginas com Alt+seta e anuncia no live region", async () => {
    const Harness = () => {
      const [chapter, setChapter] = useState(createChapterFixture());
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
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(
        /Pagina 1 movida para a posicao 2/i,
      );
    });
  });
});
