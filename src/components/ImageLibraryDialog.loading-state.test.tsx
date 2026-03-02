import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImageLibraryDialog from "@/components/ImageLibraryDialog";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

describe("ImageLibraryDialog loading state", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("renderiza skeleton enquanto a listagem inicial ainda nao respondeu", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return new Promise<Response>(() => undefined);
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
        onSave={() => undefined}
      />,
    );

    expect(await screen.findByTestId("image-library-loading-grid")).toBeInTheDocument();
  });

  it("marca a importacao por URL como ocupada enquanto o request ainda esta pendente", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, { files: [] });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: [] });
      }
      if (path === "/api/uploads/image-from-url") {
        return new Promise<Response>(() => undefined);
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        onSave={() => undefined}
      />,
    );

    const urlInput = await screen.findByPlaceholderText("https://site.com/imagem.png");
    fireEvent.change(urlInput, { target: { value: "https://cdn.site/imagem.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Importar URL" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Importando/i })).toHaveAttribute(
        "aria-busy",
        "true",
      );
    });
  });
});
