import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImageLibraryDialog from "@/components/ImageLibraryDialog";

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

vi.mock("@wordpress/image-cropper", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    ImageCropper: () => null,
    ImageCropperProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useImageCropper: () => ({
      cropperState: {
        croppedAreaPixels: null,
        rotation: 0,
        flip: { horizontal: false, vertical: false },
      },
      setResetState: () => undefined,
      reset: () => undefined,
    }),
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

const uploadFilesFixture = [
  {
    name: "a.png",
    label: "Imagem A",
    fileName: "a.png",
    folder: "posts",
    mime: "image/png",
    size: 123,
    url: "/uploads/posts/a.png",
  },
  {
    name: "b.png",
    label: "Imagem B",
    fileName: "b.png",
    folder: "posts",
    mime: "image/png",
    size: 456,
    url: "/uploads/posts/b.png",
  },
];

const projectImagesFixture = [
  {
    url: "/uploads/projects/project-1/capa.png",
    label: "Capa Projeto",
    projectId: "project-1",
    projectTitle: "Projeto 1",
    kind: "cover",
  },
];

const renderDialog = (currentSelectionUrls: string[]) =>
  render(
    <ImageLibraryDialog
      open
      onOpenChange={() => undefined}
      apiBase="http://api.local"
      listFolders={["posts"]}
      listAll={false}
      includeProjectImages={false}
      allowDeselect
      mode="single"
      currentSelectionUrls={currentSelectionUrls}
      onSave={() => undefined}
    />,
  );

const getImageButton = async (label: string) => {
  const labelNode = await screen.findByText(label);
  const button = labelNode.closest("button");
  expect(button).toBeTruthy();
  return button as HTMLButtonElement;
};

describe("ImageLibraryDialog selection state", () => {
  beforeEach(() => {
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

  it("preserva pre-selecao existente apos carregar os itens", async () => {
    renderDialog(["/uploads/posts/a.png"]);

    const imageButton = await getImageButton("Imagem A");

    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
      expect(imageButton).toHaveClass("ring-2");
    });
  });

  it("considera URL absoluta equivalente como selecionada", async () => {
    renderDialog(["http://localhost:8080/uploads/posts/a.png?x=1"]);

    const imageButton = await getImageButton("Imagem A");

    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
      expect(imageButton).toHaveClass("ring-2");
    });
  });

  it("limpa automaticamente selecao quando URL nao existe na biblioteca", async () => {
    renderDialog(["/uploads/posts/inexistente.png"]);

    await screen.findByText("Imagem A");

    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 0")).toBeInTheDocument();
    });
  });

  it("permite desselecionar item pre-selecionado", async () => {
    renderDialog(["/uploads/posts/a.png"]);

    const imageButton = await getImageButton("Imagem A");

    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
      expect(imageButton).toHaveClass("ring-2");
    });

    fireEvent.click(imageButton);

    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 0")).toBeInTheDocument();
      expect(imageButton).not.toHaveClass("ring-2");
    });
  });

  it("nao reseta selecao do usuario em rerender com arrays equivalentes de filtros", async () => {
    const { rerender } = render(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        listFolders={["posts"]}
        listAll={false}
        includeProjectImages
        projectImageProjectIds={["project-1"]}
        allowDeselect
        mode="single"
        currentSelectionUrls={["/uploads/posts/a.png"]}
        onSave={() => undefined}
      />,
    );

    const imageButton = await getImageButton("Imagem A");

    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
    });

    fireEvent.click(imageButton);

    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 0")).toBeInTheDocument();
    });

    rerender(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        listFolders={["posts"]}
        listAll={false}
        includeProjectImages
        projectImageProjectIds={["project-1"]}
        allowDeselect
        mode="single"
        currentSelectionUrls={["http://localhost:8080/uploads/posts/a.png?cache=1"]}
        onSave={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 0")).toBeInTheDocument();
      expect(imageButton).not.toHaveClass("ring-2");
    });
  });
});
