import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ImageLibraryDialog from "@/components/ImageLibraryDialog";

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

vi.mock("react-advanced-cropper", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const FixedCropper = React.forwardRef((props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) => {
    const cropperApi = {
      getCanvas: () => null,
      getCoordinates: () => null,
      getImage: () => null,
      getState: () => null,
    };
    if (typeof ref === "function") {
      ref(cropperApi);
    } else if (ref && typeof ref === "object") {
      (ref as { current: unknown }).current = cropperApi;
    }
    React.useEffect(() => {
      const onReady = props.onReady;
      if (typeof onReady === "function") {
        const timeout = window.setTimeout(() => onReady(cropperApi), 0);
        return () => window.clearTimeout(timeout);
      }
      return undefined;
    }, [props.onReady]);
    return React.createElement("div", { "data-testid": "advanced-cropper-focus-mock" });
  });

  return {
    Cropper: FixedCropper,
    FixedCropper,
    CircleStencil: () => null,
    RectangleStencil: () => null,
  };
});

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
const usersFolder = "users";

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

const renderAvatarDialog = (listFolders: string[]) =>
  render(
    <ImageLibraryDialog
      open
      onOpenChange={() => undefined}
      apiBase="http://api.local"
      uploadFolder="users"
      listFolders={listFolders}
      listAll={false}
      includeProjectImages={false}
      mode="single"
      cropAvatar
      cropTargetFolder="users"
      cropSlot="avatar-user-1"
      scopeUserId="user-1"
      onSave={() => undefined}
    />,
  );

const renderBroadProjectDialog = () =>
  render(
    <ImageLibraryDialog
      open
      onOpenChange={() => undefined}
      apiBase="http://api.local"
      uploadFolder="projects"
      listFolders={["projects"]}
      listAll={false}
      includeProjectImages
      projectImageProjectIds={["proj-1"]}
      projectImagesView="by-project"
      mode="single"
      onSave={() => undefined}
    />,
  );

const renderScopedProjectDialog = () =>
  render(
    <ImageLibraryDialog
      open
      onOpenChange={() => undefined}
      apiBase="http://api.local"
      uploadFolder="projects/proj-1"
      listFolders={["projects/proj-1"]}
      listAll={false}
      includeProjectImages
      projectImageProjectIds={["proj-1"]}
      projectImagesView="by-project"
      mode="single"
      onSave={() => undefined}
    />,
  );

const renderMixedProjectFilterDialog = () =>
  render(
    <ImageLibraryDialog
      open
      onOpenChange={() => undefined}
      apiBase="http://api.local"
      uploadFolder={usersFolder}
      listFolders={[usersFolder, "projects/proj-1"]}
      listAll={false}
      includeProjectImages
      projectImageProjectIds={["proj-1"]}
      projectImagesView="by-project"
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

  it("revela upload deduplicado em outra pasta mesmo fora do fluxo de avatar", async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, {
          files: [
            {
              name: "legacy-episode.png",
              label: "Imagem Episodios",
              fileName: "legacy-episode.png",
              folder: episodesFolder,
              mime: "image/png",
              size: 101,
              url: `/uploads/${episodesFolder}/legacy-episode.png`,
            },
          ],
        });
      }
      if (path === "/api/uploads/image" && String(options?.method || "GET").toUpperCase() === "POST") {
        return mockJsonResponse(true, {
          url: `/uploads/${episodesFolder}/legacy-episode.png`,
        });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderDialog();

    const searchInput = screen.getByPlaceholderText("Pesquisar por nome, projeto ou URL...");
    fireEvent.change(searchInput, { target: { value: "oculto" } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["same"], "same.png", { type: "image/png" })] },
    });

    const folderSelect = await getFolderFilterTrigger();
    await waitFor(() => {
      expect(searchInput).toHaveValue("");
      expect(folderSelect).toHaveTextContent(episodesFolder);
      expect(screen.getByText("Imagem Episodios")).toBeInTheDocument();
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
    });

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("prefere o card de upload quando o item revelado continua visivel no topo", async () => {
    const scrolledSections: string[] = [];
    HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
      scrolledSections.push(this.dataset.librarySection || "");
    });
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, {
          files: [
            {
              name: "cover.png",
              label: "Upload Raiz",
              fileName: "cover.png",
              folder: "projects/proj-1",
              mime: "image/png",
              size: 101,
              url: "/uploads/projects/proj-1/cover.png",
            },
          ],
        });
      }
      if (path === "/api/uploads/image" && String(options?.method || "GET").toUpperCase() === "POST") {
        return mockJsonResponse(true, {
          url: "/uploads/projects/proj-1/cover.png",
        });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, {
          items: [
            {
              url: "/uploads/projects/proj-1/banner.png",
              label: "Projeto Um (Banner)",
              projectId: "proj-1",
              projectTitle: "Projeto Um",
              kind: "banner",
              folder: "projects/proj-1",
            },
          ],
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        uploadFolder="projects/proj-1"
        listFolders={["projects/proj-1"]}
        listAll={false}
        includeProjectImages
        projectImageProjectIds={["proj-1"]}
        projectImagesView="by-project"
        mode="single"
        onSave={() => undefined}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["same"], "same.png", { type: "image/png" })] },
    });

    await waitFor(() => {
      expect(screen.getByText("Upload Raiz")).toBeInTheDocument();
      expect(screen.getByText("Projeto Um (Banner)")).toBeInTheDocument();
      expect(scrolledSections).toContain("upload");
    });
  });

  it("faz fallback para o card de projeto quando o upload do topo foi desduplicado na biblioteca de projeto escopada", async () => {
    const scrolledSections: string[] = [];
    HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
      scrolledSections.push(this.dataset.librarySection || "");
    });
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, {
          files: [
            {
              name: "cover.png",
              label: "Upload Projeto",
              fileName: "cover.png",
              folder: "projects/proj-1",
              mime: "image/png",
              size: 101,
              url: "/uploads/projects/proj-1/cover.png",
            },
          ],
        });
      }
      if (path === "/api/uploads/image" && String(options?.method || "GET").toUpperCase() === "POST") {
        return mockJsonResponse(true, {
          url: "/uploads/projects/proj-1/cover.png",
        });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, {
          items: [
            {
              url: "/uploads/projects/proj-1/cover.png",
              label: "Projeto Um (Capa)",
              projectId: "proj-1",
              projectTitle: "Projeto Um",
              kind: "cover",
              folder: "projects/proj-1",
            },
          ],
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderScopedProjectDialog();

    const searchInput = screen.getByPlaceholderText("Pesquisar por nome, projeto ou URL...");
    fireEvent.change(searchInput, { target: { value: "oculto" } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["same"], "same.png", { type: "image/png" })] },
    });

    await waitFor(() => {
      expect(searchInput).toHaveValue("");
      expect(screen.getByText("Projeto Um (Capa)")).toBeInTheDocument();
      expect(scrolledSections).toContain("project");
    });

    expect(screen.queryByText("Upload Projeto")).not.toBeInTheDocument();
  });

  it("faz fallback para o card de projeto quando o upload do topo foi desduplicado na biblioteca ampla", async () => {
    const scrolledSections: string[] = [];
    HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
      scrolledSections.push(this.dataset.librarySection || "");
    });
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, {
          files: [
            {
              name: "cover.png",
              label: "Upload Projeto",
              fileName: "cover.png",
              folder: "projects/proj-1",
              mime: "image/png",
              size: 101,
              url: "/uploads/projects/proj-1/cover.png",
            },
          ],
        });
      }
      if (path === "/api/uploads/image" && String(options?.method || "GET").toUpperCase() === "POST") {
        return mockJsonResponse(true, {
          url: "/uploads/projects/proj-1/cover.png",
        });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, {
          items: [
            {
              url: "/uploads/projects/proj-1/cover.png",
              label: "Projeto Um (Capa)",
              projectId: "proj-1",
              projectTitle: "Projeto Um",
              kind: "cover",
              folder: "projects/proj-1",
            },
          ],
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderBroadProjectDialog();

    const searchInput = screen.getByPlaceholderText("Pesquisar por nome, projeto ou URL...");
    fireEvent.change(searchInput, { target: { value: "oculto" } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["same"], "same.png", { type: "image/png" })] },
    });

    await waitFor(() => {
      expect(searchInput).toHaveValue("");
      expect(screen.getByText("Projeto Um (Capa)")).toBeInTheDocument();
      expect(scrolledSections).toContain("project");
    });

    expect(screen.queryByRole("button", { name: /projects\/proj-1/i })).not.toBeInTheDocument();
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

  it("remove caminhos de projeto do dropdown quando imagens de projeto estao habilitadas", async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, {
          files: [
            {
              name: "avatar.png",
              label: "Avatar",
              fileName: "avatar.png",
              folder: usersFolder,
              mime: "image/png",
              size: 100,
              url: "/uploads/users/avatar.png",
            },
            {
              name: "cover.png",
              label: "Upload Projeto",
              fileName: "cover.png",
              folder: "projects/proj-1",
              mime: "image/png",
              size: 101,
              url: "/uploads/projects/proj-1/cover-exclusive.png",
            },
          ],
        });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, {
          items: [
            {
              url: "/uploads/projects/proj-1/cover-canonical.png",
              label: "Projeto Um (Capa)",
              projectId: "proj-1",
              projectTitle: "Projeto Um",
              kind: "cover",
              folder: "projects/proj-1",
            },
          ],
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderMixedProjectFilterDialog();

    const folderSelect = await getFolderFilterTrigger();
    folderSelect.focus();
    fireEvent.keyDown(folderSelect, { key: "ArrowDown", code: "ArrowDown" });

    expect(await screen.findByRole("option", { name: "Todas as pastas" })).toBeVisible();
    expect(await screen.findByRole("option", { name: usersFolder })).toBeVisible();
    expect(screen.queryByRole("option", { name: "projects" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "projects/proj-1" })).not.toBeInTheDocument();
  });

  it("oculta o dropdown de pasta quando so restam uploads em projects", async () => {
    renderScopedProjectDialog();

    expect(screen.queryByRole("combobox", { name: "Filtrar por pasta" })).not.toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Ordenar biblioteca" })).toBeInTheDocument();
    expect(await screen.findByText("Imagem Raiz")).toBeInTheDocument();
  });

  it("oculta 'Todas as pastas' quando o fluxo de avatar so pode navegar em users", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, { files: [] });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderAvatarDialog(["users"]);

    const folderSelect = await getFolderFilterTrigger();
    await waitFor(() => {
      expect(folderSelect).toHaveTextContent("users");
    });

    folderSelect.focus();
    fireEvent.keyDown(folderSelect, { key: "ArrowDown", code: "ArrowDown" });

    expect(await screen.findByRole("option", { name: "users" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "Todas as pastas" })).not.toBeInTheDocument();
  });

  it("carrega apenas os roots explicitamente autorizados no avatar", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.includes("folder=users")) {
        return mockJsonResponse(true, {
          files: [
            {
              name: "manual-avatar.png",
              label: "Avatar Atual",
              fileName: "manual-avatar.png",
              folder: "users",
              mime: "image/png",
              size: 100,
              url: "/uploads/users/manual-avatar.png",
            },
          ],
        });
      }
      if (path.includes("folder=posts")) {
        return mockJsonResponse(true, {
          files: [
            {
              name: "publica.png",
              label: "Biblioteca Posts",
              fileName: "publica.png",
              folder: "posts",
              mime: "image/png",
              size: 100,
              url: "/uploads/posts/publica.png",
            },
          ],
        });
      }
      if (path.includes("folder=projects")) {
        return mockJsonResponse(true, {
          files: [
            {
              name: "projeto.png",
              label: "Biblioteca Projetos",
              fileName: "projeto.png",
              folder: "projects/proj-1",
              mime: "image/png",
              size: 100,
              url: "/uploads/projects/proj-1/projeto.png",
            },
          ],
        });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderAvatarDialog(["users", "posts", "projects"]);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "http://api.local",
        "/api/uploads/list?folder=users&recursive=1&scopeUserId=user-1",
        expect.any(Object),
      );
      expect(apiFetchMock).toHaveBeenCalledWith(
        "http://api.local",
        "/api/uploads/list?folder=posts&recursive=1&scopeUserId=user-1",
        expect.any(Object),
      );
      expect(apiFetchMock).toHaveBeenCalledWith(
        "http://api.local",
        "/api/uploads/list?folder=projects&recursive=1&scopeUserId=user-1",
        expect.any(Object),
      );
    });

    const folderSelect = await getFolderFilterTrigger();
    await waitFor(() => {
      expect(folderSelect).toHaveTextContent("users");
    });

    await selectFolderFilterOption("Todas as pastas");

    const usersTrigger = await screen.findByRole("button", { name: /users/i });
    if (usersTrigger.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(usersTrigger);
    }
    const postsTrigger = await screen.findByRole("button", { name: /posts/i });
    if (postsTrigger.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(postsTrigger);
    }
    expect(await screen.findByText("Avatar Atual")).toBeInTheDocument();
    expect(await screen.findByText("Biblioteca Posts")).toBeInTheDocument();
  });

  it("revela novamente o retorno do segundo upload depois de um dedupe hit inicial", async () => {
    let listCalls = 0;
    let uploadCalls = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      if (path.startsWith("/api/uploads/list")) {
        listCalls += 1;
        if (listCalls === 1) {
          return mockJsonResponse(true, {
            files: [
              {
                name: "existing.png",
                label: "Existente",
                fileName: "existing.png",
                folder: "users",
                mime: "image/png",
                size: 100,
                url: "/uploads/users/existing.png",
              },
            ],
          });
        }
        if (listCalls === 2) {
          return mockJsonResponse(true, {
            files: [
              {
                name: "existing.png",
                label: "Existente",
                fileName: "existing.png",
                folder: "users",
                mime: "image/png",
                size: 100,
                url: "/uploads/users/existing.png",
              },
            ],
          });
        }
        return mockJsonResponse(true, {
          files: [
            {
              name: "existing.png",
              label: "Existente",
              fileName: "existing.png",
              folder: "users",
              mime: "image/png",
              size: 100,
              url: "/uploads/users/existing.png",
            },
            {
              name: "novo.png",
              label: "Novo Upload",
              fileName: "novo.png",
              folder: "users",
              mime: "image/png",
              size: 100,
              url: "/uploads/users/novo.png",
            },
          ],
        });
      }
      if (path === "/api/uploads/image" && String(options?.method || "GET").toUpperCase() === "POST") {
        uploadCalls += 1;
        return mockJsonResponse(true, {
          url: uploadCalls === 1 ? "/uploads/users/existing.png" : "/uploads/users/novo.png",
        });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderAvatarDialog(["users"]);

    const searchInput = screen.getByPlaceholderText("Pesquisar por nome, projeto ou URL...");
    fireEvent.change(searchInput, { target: { value: "oculto" } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["same"], "same.png", { type: "image/png" })] },
    });

    await waitFor(() => {
      expect(screen.getByText("Existente")).toBeInTheDocument();
      expect(searchInput).toHaveValue("");
    });

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["new"], "new.png", { type: "image/png" })] },
    });

    await waitFor(() => {
      expect(screen.getByText("Novo Upload")).toBeInTheDocument();
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
    });

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
