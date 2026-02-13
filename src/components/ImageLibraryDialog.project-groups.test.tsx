import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("ImageLibraryDialog project groups", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, { files: [] });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, {
          items: [
            {
              url: "/uploads/projects/projeto-1/capa.png",
              label: "Projeto 1 (Capa)",
              projectId: "projeto-1",
              projectTitle: "Projeto 1",
              kind: "cover",
            },
            {
              url: "/uploads/projects/projeto-1/banner.png",
              label: "Projeto 1 (Banner)",
              projectId: "projeto-1",
              projectTitle: "Projeto 1",
              kind: "banner",
            },
            {
              url: "/uploads/projects/projeto-2/capa.png",
              label: "Projeto 2 (Capa)",
              projectId: "projeto-2",
              projectTitle: "Projeto 2",
              kind: "cover",
            },
          ],
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("renderiza grupos fechados e mostra itens ao expandir", async () => {
    render(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        includeProjectImages
        projectImagesView="by-project"
        onSave={() => undefined}
      />,
    );

    const group1 = await screen.findByRole("button", { name: /Projeto 1/i });
    await screen.findByRole("button", { name: /Projeto 2/i });

    expect(screen.queryByText("Projeto 1 (Capa)")).not.toBeInTheDocument();
    expect(screen.queryByText("Projeto 2 (Capa)")).not.toBeInTheDocument();

    fireEvent.click(group1);

    await waitFor(() => {
      expect(screen.getByText("Projeto 1 (Capa)")).toBeInTheDocument();
      expect(screen.getByText("Projeto 1 (Banner)")).toBeInTheDocument();
    });
    expect(screen.queryByText("Projeto 2 (Capa)")).not.toBeInTheDocument();
  });
});
