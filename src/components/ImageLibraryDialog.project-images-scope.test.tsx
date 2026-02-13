import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("ImageLibraryDialog project image scope", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("nao consulta /api/uploads/project-images por padrao", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, { files: [] });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        listFolders={["posts"]}
        listAll={false}
        onSave={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    const calledProjectImagesEndpoint = apiFetchMock.mock.calls.some(
      (call) => String(call[1] || "") === "/api/uploads/project-images",
    );
    expect(calledProjectImagesEndpoint).toBe(false);
  });

  it("ignora itens de projeto fora de /uploads/projects/", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, { files: [] });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, {
          items: [
            {
              url: "/uploads/shared/fora-do-escopo.png",
              label: "Shared Fora do Escopo",
              projectId: "project-1",
            },
            {
              url: "https://cdn.exemplo.com/uploads/projects/project-1/capa-absoluta.png?cache=1",
              label: "Capa Absoluta",
              projectId: "project-1",
            },
            {
              url: "/uploads/projects/project-1/capa-relativa.png",
              label: "Capa Relativa",
              projectId: "project-1",
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
        listFolders={["posts"]}
        listAll={false}
        includeProjectImages
        onSave={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    expect(screen.getByText("Capa Absoluta")).toBeInTheDocument();
    expect(screen.getByText("Capa Relativa")).toBeInTheDocument();
    expect(screen.queryByText("Shared Fora do Escopo")).not.toBeInTheDocument();
  });
});
