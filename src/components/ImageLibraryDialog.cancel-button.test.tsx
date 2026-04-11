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

const EMPTY_PROJECT_IMAGE_IDS: string[] = [];
const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

const expectDashboardActionButtonTokens = (element: HTMLElement, sizeToken: "h-9" | "h-10") => {
  const tokens = classTokens(element);

  expect(tokens).toEqual(
    expect.arrayContaining(["rounded-xl", "bg-background", "font-semibold", sizeToken]),
  );
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};

const expectPrimaryDashboardActionButtonTokens = (
  element: HTMLElement,
  sizeToken: "h-9" | "h-10",
) => {
  const tokens = classTokens(element);

  expect(tokens).toEqual(
    expect.arrayContaining([
      "rounded-xl",
      "border-primary/35",
      "bg-primary/90",
      "hover:border-primary/85",
      "hover:bg-primary",
      "text-primary-foreground",
      "font-semibold",
      sizeToken,
    ]),
  );
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};

describe("ImageLibraryDialog cancel button", () => {
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

  it("renderiza o botao Cancelar no footer principal", async () => {
    render(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        projectImageProjectIds={EMPTY_PROJECT_IMAGE_IDS}
        onSave={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    const clearButton = screen.getByRole("button", { name: /Limpar sele/i });
    const cancelButton = screen.getByRole("button", { name: "Cancelar" });
    const saveButton = screen.getByRole("button", { name: "Salvar" });
    const footer = cancelButton.closest("div.mt-4") as HTMLElement | null;

    expect(clearButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();
    expect(footer).not.toBeNull();
    const footerColumns = Array.from((footer as HTMLElement).children) as HTMLElement[];
    expect(footerColumns).toHaveLength(2);
    expect(footerColumns[0].contains(clearButton)).toBe(true);
    expect(footerColumns[1].contains(cancelButton)).toBe(true);
    expect(footerColumns[1].contains(saveButton)).toBe(true);
    expectDashboardActionButtonTokens(clearButton, "h-9");
    expectDashboardActionButtonTokens(cancelButton, "h-9");
    expectPrimaryDashboardActionButtonTokens(saveButton, "h-9");
  });

  it("fecha sem salvar quando clica em Cancelar", async () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn();

    render(
      <ImageLibraryDialog
        open
        onOpenChange={onOpenChange}
        apiBase="http://api.local"
        projectImageProjectIds={EMPTY_PROJECT_IMAGE_IDS}
        onSave={onSave}
      />,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("exibe acao para uploads e mantem o modal aberto quando a navegacao e cancelada", async () => {
    const onOpenChange = vi.fn();
    const onRequestNavigateToUploads = vi.fn(async () => false);

    render(
      <ImageLibraryDialog
        open
        onOpenChange={onOpenChange}
        apiBase="http://api.local"
        projectImageProjectIds={EMPTY_PROJECT_IMAGE_IDS}
        onRequestNavigateToUploads={onRequestNavigateToUploads}
        onSave={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Ir para uploads" }));

    await waitFor(() => {
      expect(onRequestNavigateToUploads).toHaveBeenCalledTimes(1);
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
