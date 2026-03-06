import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

const chapterFolder = "projects/proj-1/capitulos/volume-1/capitulo-2";
const episodesFolder = "projects/proj-1/episodes";

const uploadFilesFixture = [
  {
    name: "chapter-2.png",
    label: "Imagem Capitulo",
    fileName: "chapter-2.png",
    folder: chapterFolder,
    mime: "image/png",
    size: 100,
    url: `/uploads/${chapterFolder}/chapter-2.png`,
  },
  {
    name: "legacy-episode.png",
    label: "Imagem Episodios",
    fileName: "legacy-episode.png",
    folder: episodesFolder,
    mime: "image/png",
    size: 101,
    url: `/uploads/${episodesFolder}/legacy-episode.png`,
  },
  {
    name: "project-root.png",
    label: "Imagem Raiz",
    fileName: "project-root.png",
    folder: "projects/proj-1",
    mime: "image/png",
    size: 99,
    url: "/uploads/projects/proj-1/project-root.png",
  },
];

const renderDialog = () =>
  render(
    <ImageLibraryDialog
      open
      onOpenChange={() => undefined}
      apiBase="http://api.local"
      uploadFolder={chapterFolder}
      listFolders={[chapterFolder, episodesFolder, "projects/proj-1"]}
      listAll={false}
      includeProjectImages={false}
      mode="single"
      onSave={() => undefined}
    />,
  );

const getFolderFilterTrigger = async () =>
  screen.findByRole("combobox", { name: "Filtrar por pasta" });

const selectFolderFilterOption = async (name: string | RegExp) => {
  const trigger = await getFolderFilterTrigger();
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name }));
  return trigger;
};

describe("ImageLibraryDialog upload folder focus", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, { files: uploadFilesFixture });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("abre com filtro inicial focado na pasta de capitulo", async () => {
    renderDialog();

    const folderSelect = await getFolderFilterTrigger();
    await waitFor(() => {
      expect(folderSelect).toHaveTextContent(chapterFolder);
    });

    expect(await screen.findByRole("button", { name: /capitulos\/volume-1\/capitulo-2/i })).toBeInTheDocument();
    expect(await screen.findByText("Imagem Capitulo")).toBeInTheDocument();
    expect(screen.queryByText("Imagem Episodios")).not.toBeInTheDocument();
    expect(screen.queryByText("Imagem Raiz")).not.toBeInTheDocument();
  });

  it("permite navegar manualmente para outras pastas do projeto", async () => {
    renderDialog();

    const folderSelect = await getFolderFilterTrigger();
    await waitFor(() => {
      expect(folderSelect).toHaveTextContent(chapterFolder);
    });

    await selectFolderFilterOption("Todas as pastas");
    await waitFor(() => {
      expect(folderSelect).toHaveTextContent("Todas as pastas");
    });
    expect(await screen.findByRole("button", { name: /episodes/i })).toBeInTheDocument();

    await selectFolderFilterOption(episodesFolder);
    await waitFor(() => {
      expect(folderSelect).toHaveTextContent(episodesFolder);
    });
    const episodesTrigger = await screen.findByRole("button", { name: /episodes/i });
    if (episodesTrigger.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(episodesTrigger);
    }
    await waitFor(() => {
      expect(episodesTrigger).toHaveAttribute("aria-expanded", "true");
    });
    expect(await screen.findByText("Imagem Episodios")).toBeInTheDocument();
    expect(screen.queryByText("Imagem Capitulo")).not.toBeInTheDocument();
  });

  it("abre o dropdown de pasta com as opcoes visiveis acima do modal", async () => {
    renderDialog();

    const folderSelect = await getFolderFilterTrigger();
    folderSelect.focus();
    fireEvent.keyDown(folderSelect, { key: "ArrowDown", code: "ArrowDown" });

    expect(await screen.findByRole("option", { name: "Todas as pastas" })).toBeVisible();
    expect(await screen.findByRole("option", { name: "projects/proj-1" })).toBeVisible();
    expect(await screen.findByRole("option", { name: chapterFolder })).toBeVisible();

    const listbox = await screen.findByRole("listbox");
    expect(String(listbox.className)).toContain(
      "origin-[var(--radix-select-content-transform-origin)]",
    );
  });
});
