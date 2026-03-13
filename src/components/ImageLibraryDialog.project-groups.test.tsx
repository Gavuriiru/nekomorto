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
              folder: "projects/projeto-1",
            },
            {
              url: "/uploads/projects/projeto-1/banner.png",
              label: "Projeto 1 (Banner)",
              projectId: "projeto-1",
              projectTitle: "Projeto 1",
              kind: "banner",
              folder: "projects/projeto-1/capitulos/volume-1/capitulo-1",
            },
            {
              url: "/uploads/projects/projeto-2/capa.png",
              label: "Projeto 2 (Capa)",
              projectId: "projeto-2",
              projectTitle: "Projeto 2",
              kind: "cover",
              folder: "projects/projeto-2",
            },
          ],
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("agrupa por projeto e pasta, exibindo itens so apos expandir a pasta", async () => {
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

    let rootTrigger: HTMLElement | null = null;
    let chapterTrigger: HTMLElement | null = null;
    await waitFor(() => {
      rootTrigger = screen.getByRole("button", { name: /Raiz do projeto/i });
      chapterTrigger = screen.getByRole("button", { name: /capitulos\/volume-1\/capitulo-1/i });
      expect(rootTrigger).toBeInTheDocument();
      expect(chapterTrigger).toBeInTheDocument();
    });
    expect(rootTrigger!.compareDocumentPosition(chapterTrigger!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.queryByText("Projeto 1 (Capa)")).not.toBeInTheDocument();
    expect(screen.queryByText("Projeto 1 (Banner)")).not.toBeInTheDocument();

    fireEvent.click(rootTrigger as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText("Projeto 1 (Capa)")).toBeInTheDocument();
    });
    expect(screen.queryByText("Projeto 1 (Banner)")).not.toBeInTheDocument();

    fireEvent.click(chapterTrigger as HTMLElement);

    await waitFor(() => {
      expect(screen.getByText("Projeto 1 (Banner)")).toBeInTheDocument();
    });
    expect(screen.queryByText("Projeto 2 (Capa)")).not.toBeInTheDocument();
  });

  it("ordena projetos e pastas com comparacao natural", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, { files: [] });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, {
          items: [
            {
              url: "/uploads/projects/projeto-10/capa.png",
              label: "Projeto 10 (Capa)",
              projectId: "projeto-10",
              projectTitle: "Projeto 10",
              kind: "cover",
              folder: "projects/projeto-10",
            },
            {
              url: "/uploads/projects/projeto-2/capa.png",
              label: "Projeto 2 (Capa)",
              projectId: "projeto-2",
              projectTitle: "Projeto 2",
              kind: "cover",
              folder: "projects/projeto-2",
            },
            {
              url: "/uploads/projects/projeto-1/capa.png",
              label: "Projeto 1 (Capa)",
              projectId: "projeto-1",
              projectTitle: "Projeto 1",
              kind: "cover",
              folder: "projects/projeto-1",
            },
            {
              url: "/uploads/projects/projeto-1/capitulos/volume-1/capitulo-10.png",
              label: "Projeto 1 (Capitulo 10)",
              projectId: "projeto-1",
              projectTitle: "Projeto 1",
              kind: "episode-cover",
              folder: "projects/projeto-1/capitulos/volume-1/capitulo-10",
            },
            {
              url: "/uploads/projects/projeto-1/capitulos/volume-1/capitulo-2.png",
              label: "Projeto 1 (Capitulo 2)",
              projectId: "projeto-1",
              projectTitle: "Projeto 1",
              kind: "episode-cover",
              folder: "projects/projeto-1/capitulos/volume-1/capitulo-2",
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
        includeProjectImages
        projectImagesView="by-project"
        onSave={() => undefined}
      />,
    );

    const group1 = (await screen.findByText(/^Projeto 1$/i)).closest("button");
    const group2 = (await screen.findByText(/^Projeto 2$/i)).closest("button");
    const group10 = (await screen.findByText(/^Projeto 10$/i)).closest("button");

    expect(group1).toBeTruthy();
    expect(group2).toBeTruthy();
    expect(group10).toBeTruthy();
    expect(group1!.compareDocumentPosition(group2!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(group2!.compareDocumentPosition(group10!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.click(group1 as HTMLElement);

    let rootTrigger: HTMLElement | null = null;
    let chapter2Trigger: HTMLElement | null = null;
    let chapter10Trigger: HTMLElement | null = null;
    await waitFor(() => {
      rootTrigger = screen.getByRole("button", { name: /Raiz do projeto/i });
      chapter2Trigger = screen.getByRole("button", { name: /capitulos\/volume-1\/capitulo-2/i });
      chapter10Trigger = screen.getByRole("button", { name: /capitulos\/volume-1\/capitulo-10/i });
      expect(rootTrigger).toBeInTheDocument();
      expect(chapter2Trigger).toBeInTheDocument();
      expect(chapter10Trigger).toBeInTheDocument();
    });

    expect(rootTrigger!.compareDocumentPosition(chapter2Trigger!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(chapter2Trigger!.compareDocumentPosition(chapter10Trigger!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
