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

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

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

    const folderTrigger = screen.getByRole("combobox", { name: "Filtrar por pasta" });
    const sortTrigger = screen.getByRole("combobox", { name: "Ordenar biblioteca" });
    const comboboxes = screen.getAllByRole("combobox");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    const uploadTrigger = screen.getByRole("button", { name: "Escolher arquivo" });
    const searchInput = screen.getByPlaceholderText("Pesquisar por nome, projeto ou URL...");
    const searchInputTokens = classTokens(searchInput as HTMLElement);
    const clearSelectionButton = screen.getByRole("button", { name: /Limpar sele/i });
    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    const saveButton = screen.getByRole("button", { name: "Salvar" });
    const filterControls = screen.getByTestId("image-library-uploads-controls");
    const selectionCount = screen.getByTestId("image-library-selection-count");

    expect(fileInput).toBeTruthy();
    expect(classTokens(fileInput as HTMLInputElement)).toContain("sr-only");
    expect(uploadTrigger).toBeVisible();
    expect(
      (fileInput as HTMLInputElement).compareDocumentPosition(searchInput) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByTestId("image-library-uploads-toolbar")).not.toBeInTheDocument();
    expect(searchInputTokens).toContain("pl-9");
    expect(comboboxes).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Limpar sele/i })).toHaveLength(1);
    expect(filterControls).toBeTruthy();
    expect(selectionCount).toHaveTextContent("Selecionadas: 0");
    expect(clearSelectionButton.parentElement).not.toBe(cancelButton.parentElement);
    expect(saveButton.parentElement).toBe(cancelButton.parentElement);

    const filterControlsTokens = classTokens(filterControls);

    expect(filterControlsTokens).toContain("flex");
    expect(filterControlsTokens).toContain("flex-wrap");
    expect(filterControlsTokens).toContain("items-center");
    expect(filterControlsTokens).toContain("justify-between");

    const folderTriggerTokens = classTokens(folderTrigger);
    const sortTriggerTokens = classTokens(sortTrigger);

    expect(folderTriggerTokens).toContain("w-full");
    expect(folderTriggerTokens).toContain("sm:w-[220px]");
    expect(folderTriggerTokens).toContain("rounded-xl");
    expect(folderTriggerTokens).toContain("focus-visible:ring-inset");
    expect(folderTriggerTokens).toContain("bg-card/70");
    expect(sortTriggerTokens).toContain("w-full");
    expect(sortTriggerTokens).toContain("sm:w-[180px]");
    expect(sortTriggerTokens).toContain("rounded-xl");
    expect(sortTriggerTokens).toContain("focus-visible:ring-inset");
    expect(sortTriggerTokens).toContain("bg-card/70");

    const clearSelectionTokens = classTokens(clearSelectionButton);

    expect(clearSelectionTokens).toContain("w-full");
    expect(clearSelectionTokens).toContain("sm:w-auto");
  });
});
