import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProjectEditorImageLibraryDialog from "@/components/dashboard/project-editor/ProjectEditorImageLibraryDialog";

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

describe("ProjectEditorImageLibraryDialog", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    apiFetchMock.mockReset();
  });

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("materializa e salva um upload deduplicado de outro projeto", async () => {
    const onSaveMock = vi.fn();

    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      if (path.startsWith("/api/uploads/list")) {
        const requestUrl = new URL(path, "http://api.local");
        const includeUrls = requestUrl.searchParams.getAll("includeUrl");
        return mockJsonResponse(true, {
          files: [
            {
              name: "cover-a.png",
              label: "Upload Projeto A",
              fileName: "cover-a.png",
              folder: "projects/proj-a",
              mime: "image/png",
              size: 101,
              url: "/uploads/projects/proj-a/cover-a.png",
            },
            ...(includeUrls.includes("/uploads/projects/proj-b/banner.png")
              ? [
                  {
                    name: "banner.png",
                    label: "Banner Projeto B",
                    fileName: "banner.png",
                    folder: "projects/proj-b",
                    mime: "image/png",
                    size: 202,
                    url: "/uploads/projects/proj-b/banner.png",
                    projectId: "proj-b",
                    projectTitle: "Projeto B",
                  },
                ]
              : []),
          ],
        });
      }
      if (
        path === "/api/uploads/image" &&
        String(options?.method || "GET").toUpperCase() === "POST"
      ) {
        return mockJsonResponse(true, {
          url: "/uploads/projects/proj-b/banner.png",
          dedupeHit: true,
        });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, {
          items: [
            {
              url: "/uploads/projects/proj-a/banner-a.png",
              label: "Projeto A (Banner)",
              projectId: "proj-a",
              projectTitle: "Projeto A",
              kind: "banner",
              folder: "projects/proj-a",
            },
          ],
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <ProjectEditorImageLibraryDialog
        activeLibraryOptions={{
          uploadFolder: "projects/proj-a",
          listFolders: ["projects/proj-a"],
          listAll: false,
          includeProjectImages: true,
          projectImageProjectIds: ["proj-a"],
          projectImagesView: "by-project",
        }}
        apiBase="http://api.local"
        currentLibrarySelection="/uploads/projects/proj-a/cover-a.png"
        isOpen
        onOpenChange={() => undefined}
        onSave={onSaveMock}
      />,
    );

    await waitFor(
      () => {
        expect(screen.queryByTestId("image-library-loading-fallback-grid")).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    await screen.findByPlaceholderText(
      "Pesquisar por nome, projeto ou URL...",
      {},
      { timeout: 5000 },
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["same"], "same.png", { type: "image/png" })] },
    });

    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
      expect(screen.getByText("Banner Projeto B")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onSaveMock).toHaveBeenCalledWith({
      urls: ["/uploads/projects/proj-b/banner.png"],
      items: [
        expect.objectContaining({
          url: "/uploads/projects/proj-b/banner.png",
          projectId: "proj-b",
          projectTitle: "Projeto B",
        }),
      ],
    });
  });
});
