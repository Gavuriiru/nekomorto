import { render, screen, waitFor } from "@testing-library/react";
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

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

describe("ImageLibraryDialog mobile layout", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return mockJsonResponse(true, { files: [] });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("aplica classes responsivas para aliviar o layout no mobile", async () => {
    render(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        onSave={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    const dialog = await screen.findByRole("dialog");
    const dialogTokens = classTokens(dialog);

    expect(dialogTokens).toContain("w-[96vw]");
    expect(dialogTokens).toContain("sm:w-[92vw]");
    expect(dialogTokens).toContain("p-3");
    expect(dialogTokens).toContain("sm:p-6");

    const description = screen.getByText(/Selecione imagens do servidor/i);
    const descriptionTokens = classTokens(description);

    expect(descriptionTokens).toContain("text-xs");
    expect(descriptionTokens).toContain("leading-snug");
    expect(descriptionTokens).toContain("sm:text-sm");

    const importButton = screen.getByRole("button", { name: "Importar URL" });
    const importButtonTokens = classTokens(importButton);
    const importControls = importButton.parentElement;

    expect(importButtonTokens).toContain("shrink-0");
    expect(importButtonTokens).not.toContain("w-full");
    expect(importControls).toBeTruthy();

    const importControlsTokens = classTokens(importControls as HTMLElement);

    expect(importControlsTokens).toContain("grid");
    expect(importControlsTokens).toContain("grid-cols-[minmax(0,1fr)_auto]");

    const selects = screen.getAllByRole("combobox");
    const searchInput = screen.getByPlaceholderText("Pesquisar por nome, projeto ou URL...");
    const searchInputTokens = classTokens(searchInput as HTMLElement);
    const clearSelectionButton = screen.getByRole("button", { name: /Limpar sele/i });
    const filterControls = screen.getByTestId("image-library-uploads-controls");
    const toolbar = screen.getByTestId("image-library-uploads-toolbar");
    const toolbarTokens = classTokens(toolbar);

    expect(toolbarTokens).toContain("sm:sticky");
    expect(toolbarTokens).toContain("sm:top-0");
    expect(toolbarTokens).not.toContain("sticky");
    expect(toolbarTokens).not.toContain("top-0");
    expect(searchInputTokens).toContain("pl-9");
    expect(selects).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Limpar sele/i })).toHaveLength(1);
    expect(filterControls).toBeTruthy();

    const filterControlsTokens = classTokens(filterControls);

    expect(filterControlsTokens).toContain("flex");
    expect(filterControlsTokens).toContain("flex-wrap");
    expect(filterControlsTokens).toContain("items-center");

    for (const select of selects) {
      const selectTokens = classTokens(select);
      expect(selectTokens).toContain("min-w-0");
      expect(selectTokens).toContain("rounded-full");
    }

    const clearSelectionTokens = classTokens(clearSelectionButton);

    expect(clearSelectionTokens).toContain("rounded-full");
    expect(clearSelectionTokens).not.toContain("w-full");
  });
});
