import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ImageLibraryDialog from "@/components/ImageLibraryDialog";

const { apiFetchMock, toastMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const ensureDomRectFromRect = () => {
  const globalScope = globalThis as typeof globalThis & { DOMRect?: typeof DOMRect };
  const windowScope = window as Window & typeof globalThis & { DOMRect?: typeof DOMRect };

  if (!windowScope.DOMRect && !globalScope.DOMRect) {
    class DOMRectPolyfill {
      x: number;
      y: number;
      width: number;
      height: number;
      top: number;
      right: number;
      bottom: number;
      left: number;

      constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.top = y;
        this.left = x;
        this.right = x + width;
        this.bottom = y + height;
      }

      static fromRect(rect?: { x?: number; y?: number; width?: number; height?: number }) {
        return new DOMRectPolyfill(rect?.x || 0, rect?.y || 0, rect?.width || 0, rect?.height || 0);
      }
    }

    windowScope.DOMRect = DOMRectPolyfill as unknown as typeof DOMRect;
    globalScope.DOMRect = DOMRectPolyfill as unknown as typeof DOMRect;
    return;
  }

  const domRectCtor = windowScope.DOMRect || globalScope.DOMRect;
  if (!domRectCtor) {
    return;
  }

  if (typeof (domRectCtor as { fromRect?: unknown }).fromRect !== "function") {
    Object.defineProperty(domRectCtor, "fromRect", {
      configurable: true,
      writable: true,
      value: (rect?: { x?: number; y?: number; width?: number; height?: number }) =>
        new domRectCtor(rect?.x || 0, rect?.y || 0, rect?.width || 0, rect?.height || 0),
    });
  }

  windowScope.DOMRect = domRectCtor;
  globalScope.DOMRect = domRectCtor;
};

const ensurePointerEvent = () => {
  const globalScope = globalThis as typeof globalThis & { PointerEvent?: typeof PointerEvent };
  const windowScope = window as Window & typeof globalThis & { PointerEvent?: typeof PointerEvent };

  if (!windowScope.PointerEvent && !globalScope.PointerEvent) {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;

      constructor(type: string, init?: MouseEventInit & { pointerId?: number }) {
        super(type, init);
        this.pointerId = init?.pointerId ?? 0;
      }
    }

    windowScope.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
    globalScope.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
    return;
  }

  const pointerEventCtor = windowScope.PointerEvent || globalScope.PointerEvent;
  if (!pointerEventCtor) {
    return;
  }

  windowScope.PointerEvent = pointerEventCtor;
  globalScope.PointerEvent = pointerEventCtor;
};

const dispatchPointerEvent = (
  target: EventTarget,
  type: string,
  init: MouseEventInit & { pointerId?: number },
) => {
  act(() => {
    target.dispatchEvent(
      new window.PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
};

describe("ImageLibraryDialog focal point editor", () => {
  let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    ensureDomRectFromRect();
    ensurePointerEvent();
    originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return DOMRect.fromRect({ x: 0, y: 0, width: 800, height: 320 });
    };

    apiFetchMock.mockReset();
    toastMock.mockReset();

    apiFetchMock.mockImplementation(
      async (_base: string, path: string, options?: { method?: string; body?: string }) => {
        if (path.startsWith("/api/uploads/list")) {
          return mockJsonResponse(true, {
            files: [
              {
                id: "upload-1",
                url: "/uploads/posts/focal.png",
                name: "focal.png",
                fileName: "focal.png",
                width: 100,
                height: 200,
                focalPoint: { x: 0.2, y: 0.8 },
              },
            ],
          });
        }

        if (path === "/api/uploads/upload-1/focal-point" && options?.method === "PATCH") {
          return mockJsonResponse(true, {
            ok: true,
            item: {
              id: "upload-1",
              url: "/uploads/posts/focal.png",
              focalCrops: {
                card: { left: 0.1, top: 0.1, width: 0.4, height: 0.25 },
                hero: { left: 0.05, top: 0.6, width: 0.9, height: 0.3 },
              },
              focalPoints: {
                card: { x: 0.3, y: 0.225 },
                hero: { x: 0.5, y: 0.75 },
              },
              focalPoint: { x: 0.3, y: 0.225 },
              variantsVersion: 2,
              variants: {},
            },
          });
        }

        return mockJsonResponse(false, { error: "not_found" }, 404);
      },
    );
  });

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it("renderiza a imagem inteira em contain e ignora interacoes fora da area util", async () => {
    render(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        onSave={() => undefined}
      />,
    );

    const uploadButton = await screen.findByRole("button", { name: /focal\.png/i });
    fireEvent.contextMenu(uploadButton);
    fireEvent.click(await screen.findByText("Definir ponto focal"));

    const dialogs = await screen.findAllByRole("dialog");
    const focalDialog = dialogs[dialogs.length - 1];
    const layout = within(focalDialog).getByTestId("focal-layout");
    const sidebar = within(focalDialog).getByTestId("focal-sidebar");
    const editorPanel = within(focalDialog).getByTestId("focal-editor-panel");
    const cardPreview = within(focalDialog).getByTestId("focal-preview-card");
    const cardPreviewImage = within(focalDialog).getByTestId("focal-preview-card-image");
    const heroPreview = within(focalDialog).getByTestId("focal-preview-hero");
    const stage = within(focalDialog).getByTestId("focal-stage");
    const imageShell = within(focalDialog).getByTestId("focal-image-shell");

    expect(layout).toBeInTheDocument();
    expect(sidebar).toBeInTheDocument();
    expect(editorPanel).toBeInTheDocument();
    expect(cardPreview).toBeInTheDocument();
    expect(cardPreviewImage).toBeInTheDocument();
    expect(heroPreview).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /card/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /hero/i })).toBeInTheDocument();
    expect(within(sidebar).getByText("1280x853")).toBeInTheDocument();
    expect(within(sidebar).getByText("1600x900")).toBeInTheDocument();
    expect(within(focalDialog).getByRole("button", { name: "Salvar ponto focal" })).toBeInTheDocument();
    expect(cardPreviewImage.style.left).toBe("-0%");
    expect(Number.parseFloat(cardPreviewImage.style.top)).toBeCloseTo(-189.552239, 5);

    await waitFor(() => {
      expect(imageShell.style.left).toBe("320px");
      expect(imageShell.style.top).toBe("0px");
      expect(imageShell.style.width).toBe("160px");
      expect(imageShell.style.height).toBe("320px");
    });

    expect(within(focalDialog).getByRole("img", { name: /focal\.png/i })).toBeInTheDocument();

    fireEvent.pointerDown(stage, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: 60,
      clientY: 60,
    });
    fireEvent.pointerUp(window, {
      pointerId: 1,
    });

    fireEvent.click(within(focalDialog).getByRole("button", { name: "Salvar ponto focal" }));

    await waitFor(() => {
      const patchCall = apiFetchMock.mock.calls.find(
        (call) => String(call[1] || "") === "/api/uploads/upload-1/focal-point",
      );
      expect(patchCall).toBeTruthy();
    });

    const patchCall = apiFetchMock.mock.calls.find(
      (call) => String(call[1] || "") === "/api/uploads/upload-1/focal-point",
    );
    const request = (patchCall?.[2] || {}) as { body?: string };
    const payload = JSON.parse(String(request.body || "{}")) as {
      focalCrops?: Record<string, { left: number; top: number; width: number; height: number }>;
    };

    expect(payload.focalCrops?.card?.left).toBe(0);
    expect(payload.focalCrops?.card?.top).toBeCloseTo(0.635, 6);
    expect(payload.focalCrops?.card?.width).toBe(1);
    expect(payload.focalCrops?.card?.height).toBeCloseTo(0.335, 6);
  });

  it("move e redimensiona a caixa mantendo drafts independentes por preset", async () => {
    render(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        onSave={() => undefined}
      />,
    );

    const uploadButton = await screen.findByRole("button", { name: /focal\.png/i });
    fireEvent.contextMenu(uploadButton);
    fireEvent.click(await screen.findByText("Definir ponto focal"));

    const dialogs = await screen.findAllByRole("dialog");
    const focalDialog = dialogs[dialogs.length - 1];
    const sidebar = within(focalDialog).getByTestId("focal-sidebar");
    const stage = within(focalDialog).getByTestId("focal-stage");
    const imageShell = within(focalDialog).getByTestId("focal-image-shell");

    await waitFor(() => {
      expect(imageShell.style.width).toBe("160px");
    });

    const cropBody = within(focalDialog).getByTestId("focal-crop-body");
    expect(cropBody.style.width).toBe("160px");

    dispatchPointerEvent(cropBody, "pointerdown", {
      pointerId: 2,
      clientX: 400,
      clientY: 240,
    });
    dispatchPointerEvent(stage, "pointermove", {
      pointerId: 2,
      clientX: 400,
      clientY: 200,
    });
    dispatchPointerEvent(stage, "pointerup", {
      pointerId: 2,
    });

    fireEvent.click(within(sidebar).getByRole("button", { name: /hero/i }));

    expect(within(focalDialog).getByText(/Preset ativo:\s*HERO/i)).toBeInTheDocument();

    const resizeHandle = within(focalDialog).getByTestId("focal-crop-handle-se");
    dispatchPointerEvent(resizeHandle, "pointerdown", {
      pointerId: 3,
      clientX: 480,
      clientY: 300,
    });
    dispatchPointerEvent(stage, "pointermove", {
      pointerId: 3,
      clientX: 440,
      clientY: 270,
    });
    dispatchPointerEvent(stage, "pointerup", {
      pointerId: 3,
    });

    fireEvent.click(within(focalDialog).getByRole("button", { name: "Salvar ponto focal" }));

    await waitFor(() => {
      const patchCall = apiFetchMock.mock.calls.find(
        (call) => String(call[1] || "") === "/api/uploads/upload-1/focal-point",
      );
      expect(patchCall).toBeTruthy();
    });

    const patchCall = apiFetchMock.mock.calls.find(
      (call) => String(call[1] || "") === "/api/uploads/upload-1/focal-point",
    );
    const request = (patchCall?.[2] || {}) as { body?: string };
    const payload = JSON.parse(String(request.body || "{}")) as {
      focalCrops?: Record<string, { left: number; top: number; width: number; height: number }>;
    };

    expect(payload.focalCrops?.card?.left).toBe(0);
    expect(payload.focalCrops?.card?.top).toBeCloseTo(0.51, 6);
    expect(payload.focalCrops?.card?.width).toBe(1);
    expect(payload.focalCrops?.card?.height).toBeCloseTo(0.335, 6);

    expect(payload.focalCrops?.hero?.left).toBe(0);
    expect(payload.focalCrops?.hero?.top).toBeCloseTo(0.66, 6);
    expect(payload.focalCrops?.hero?.width).toBeCloseTo(0.653333, 6);
    expect(payload.focalCrops?.hero?.height).toBeCloseTo(0.18375, 6);
  });
});
