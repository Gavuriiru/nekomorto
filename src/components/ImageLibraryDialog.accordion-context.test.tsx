import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImageLibraryDialog from "@/components/ImageLibraryDialog";

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const projectRootFolder = "projects/proj-1";
const chapterFolder = "projects/proj-1/capitulos/volume-1/capitulo-2";
const missingChapterFolder = "projects/proj-1/capitulos/volume-1/capitulo-9";
const volumeFolder = "projects/proj-1/capitulos/volume-1";
const episodesFolder = "projects/proj-1/episodes";

let uploadFilesFixture: Array<Record<string, unknown>> = [];
let projectImagesFixture: Array<Record<string, unknown>> = [];

const renderDialog = (props: Partial<ComponentProps<typeof ImageLibraryDialog>> = {}) =>
  render(
    <ImageLibraryDialog
      open
      onOpenChange={() => undefined}
      apiBase="http://api.local"
      listFolders={[projectRootFolder]}
      listAll={false}
      includeProjectImages={false}
      mode="single"
      onSave={() => undefined}
      {...props}
    />,
  );

const expectTriggerExpanded = async (name: RegExp | string, expanded: boolean) => {
  const trigger = await screen.findByRole("button", { name });
  await waitFor(() => {
    expect(trigger).toHaveAttribute("aria-expanded", expanded ? "true" : "false");
  });
  return trigger;
};

const getFolderFilterSelect = async () => {
  const controls = await screen.findByTestId("image-library-uploads-controls");
  const selects = controls.querySelectorAll("select");
  expect(selects.length).toBeGreaterThanOrEqual(1);
  return selects[0] as HTMLSelectElement;
};

describe("ImageLibraryDialog accordion context", () => {
  beforeEach(() => {
    uploadFilesFixture = [];
    projectImagesFixture = [];
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, { files: uploadFilesFixture });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: projectImagesFixture });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("uploads iniciam com apenas o contexto atual expandido", async () => {
    uploadFilesFixture = [
      {
        name: "project-root.png",
        label: "Projeto",
        fileName: "project-root.png",
        folder: projectRootFolder,
        mime: "image/png",
        size: 120,
        url: "/uploads/projects/proj-1/project-root.png",
      },
      {
        name: "chapter.png",
        label: "Capitulo",
        fileName: "chapter.png",
        folder: chapterFolder,
        mime: "image/png",
        size: 140,
        url: `/uploads/${chapterFolder}/chapter.png`,
      },
      {
        name: "episode.png",
        label: "Episodios",
        fileName: "episode.png",
        folder: episodesFolder,
        mime: "image/png",
        size: 160,
        url: `/uploads/${episodesFolder}/episode.png`,
      },
    ];

    renderDialog({
      uploadFolder: projectRootFolder,
      listFolders: [projectRootFolder],
    });

    const folderSelect = await getFolderFilterSelect();
    await waitFor(() => {
      expect(folderSelect.value).toBe(projectRootFolder);
    });

    await expectTriggerExpanded(/Raiz do projeto/i, true);
    await expectTriggerExpanded(/capitulos\/volume-1\/capitulo-2/i, false);
    await expectTriggerExpanded(/episodes/i, false);
  });

  it("uploads aplicam fallback para ancestral mais proximo quando contexto nao existe", async () => {
    uploadFilesFixture = [
      {
        name: "root.png",
        label: "Raiz",
        fileName: "root.png",
        folder: projectRootFolder,
        mime: "image/png",
        size: 100,
        url: "/uploads/projects/proj-1/root.png",
      },
      {
        name: "volume.png",
        label: "Volume",
        fileName: "volume.png",
        folder: volumeFolder,
        mime: "image/png",
        size: 101,
        url: `/uploads/${volumeFolder}/volume.png`,
      },
      {
        name: "episode.png",
        label: "Episode",
        fileName: "episode.png",
        folder: episodesFolder,
        mime: "image/png",
        size: 102,
        url: `/uploads/${episodesFolder}/episode.png`,
      },
    ];

    renderDialog({
      uploadFolder: missingChapterFolder,
      listFolders: [missingChapterFolder, projectRootFolder],
    });

    const folderSelect = await getFolderFilterSelect();
    await waitFor(() => {
      expect(folderSelect.value).toBe("__all__");
    });

    await expectTriggerExpanded(/capitulos\/volume-1/i, true);
    await expectTriggerExpanded(/Raiz do projeto/i, false);
    await expectTriggerExpanded(/episodes/i, false);
  });

  it("nao sobrescreve escolha manual enquanto aberto e reaplica defaults ao reabrir", async () => {
    uploadFilesFixture = [
      {
        name: "project-root.png",
        label: "Projeto",
        fileName: "project-root.png",
        folder: projectRootFolder,
        mime: "image/png",
        size: 120,
        url: "/uploads/projects/proj-1/project-root.png",
      },
      {
        name: "chapter.png",
        label: "Capitulo",
        fileName: "chapter.png",
        folder: chapterFolder,
        mime: "image/png",
        size: 140,
        url: `/uploads/${chapterFolder}/chapter.png`,
      },
      {
        name: "episode.png",
        label: "Episodios",
        fileName: "episode.png",
        folder: episodesFolder,
        mime: "image/png",
        size: 160,
        url: `/uploads/${episodesFolder}/episode.png`,
      },
    ];

    const baseProps = {
      apiBase: "http://api.local",
      uploadFolder: projectRootFolder,
      listFolders: [projectRootFolder],
      listAll: false,
      includeProjectImages: false,
      mode: "single" as const,
      onSave: () => undefined,
      onOpenChange: () => undefined,
    };

    const { rerender } = render(<ImageLibraryDialog open {...baseProps} />);

    const rootTrigger = await expectTriggerExpanded(/Raiz do projeto/i, true);
    const episodesTrigger = await expectTriggerExpanded(/episodes/i, false);

    fireEvent.click(episodesTrigger);
    await waitFor(() => {
      expect(episodesTrigger).toHaveAttribute("aria-expanded", "true");
    });

    rerender(<ImageLibraryDialog open {...baseProps} listFolders={[projectRootFolder]} />);
    await waitFor(() => {
      expect(episodesTrigger).toHaveAttribute("aria-expanded", "true");
    });

    fireEvent.click(rootTrigger);
    await waitFor(() => {
      expect(rootTrigger).toHaveAttribute("aria-expanded", "false");
    });

    rerender(<ImageLibraryDialog open={false} {...baseProps} />);
    rerender(<ImageLibraryDialog open {...baseProps} />);

    await expectTriggerExpanded(/Raiz do projeto/i, true);
    await expectTriggerExpanded(/episodes/i, false);
  });

  it("imagens de projeto em by-project abrem apenas projeto e pasta de contexto", async () => {
    projectImagesFixture = [
      {
        url: `/uploads/${chapterFolder}/cover.png`,
        label: "Capa Capitulo",
        folder: chapterFolder,
        projectId: "proj-1",
        projectTitle: "Projeto Um",
        kind: "episode-cover",
      },
      {
        url: `/uploads/${episodesFolder}/legacy.png`,
        label: "Capa Episodio",
        folder: episodesFolder,
        projectId: "proj-1",
        projectTitle: "Projeto Um",
        kind: "episode-cover",
      },
      {
        url: "/uploads/projects/proj-2/capitulos/volume-9/other.png",
        label: "Outro",
        folder: "projects/proj-2/capitulos/volume-9",
        projectId: "proj-2",
        projectTitle: "Projeto Dois",
        kind: "episode-cover",
      },
    ];

    renderDialog({
      uploadFolder: chapterFolder,
      listFolders: [chapterFolder],
      includeProjectImages: true,
      projectImagesView: "by-project",
      projectImageProjectIds: ["proj-1", "proj-2"],
    });

    await expectTriggerExpanded(/Projeto Um/i, true);
    await expectTriggerExpanded(/Projeto Dois/i, false);
    await expectTriggerExpanded(/capitulos\/volume-1\/capitulo-2/i, true);
    expect(screen.queryByText("Capa Episodio")).not.toBeInTheDocument();
  });

  it("imagens de projeto aplicam fallback ancestral para pasta quando capitulo nao existe", async () => {
    projectImagesFixture = [
      {
        url: `/uploads/${volumeFolder}/volume-cover.png`,
        label: "Volume",
        folder: volumeFolder,
        projectId: "proj-1",
        projectTitle: "Projeto Um",
        kind: "episode-cover",
      },
      {
        url: `/uploads/${episodesFolder}/legacy.png`,
        label: "Episodio",
        folder: episodesFolder,
        projectId: "proj-1",
        projectTitle: "Projeto Um",
        kind: "episode-cover",
      },
      {
        url: "/uploads/projects/proj-2/episodes/item.png",
        label: "Outro",
        folder: "projects/proj-2/episodes",
        projectId: "proj-2",
        projectTitle: "Projeto Dois",
        kind: "episode-cover",
      },
    ];

    renderDialog({
      uploadFolder: missingChapterFolder,
      listFolders: [missingChapterFolder, projectRootFolder],
      includeProjectImages: true,
      projectImagesView: "by-project",
      projectImageProjectIds: ["proj-1", "proj-2"],
    });

    await expectTriggerExpanded(/Projeto Um/i, true);
    await expectTriggerExpanded(/Projeto Dois/i, false);
    await expectTriggerExpanded(/capitulos\/volume-1/i, true);
    expect(screen.queryByText("Episodio")).not.toBeInTheDocument();
  });
});
