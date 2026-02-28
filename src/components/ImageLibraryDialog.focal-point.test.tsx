import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("ImageLibraryDialog focal point editor", () => {
  beforeEach(() => {
    ensureDomRectFromRect();
    apiFetchMock.mockReset();
    toastMock.mockReset();

    let listCalls = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: { method?: string; body?: string }) => {
      if (path.startsWith("/api/uploads/list")) {
        listCalls += 1;
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
              ...(listCalls > 1
                ? {
                    focalPoints: {
                      thumb: { x: 0.2, y: 0.8 },
                      card: { x: 0.2, y: 0.8 },
                      hero: { x: 0.75, y: 0.8 },
                      og: { x: 0.2, y: 0.8 },
                    },
                  }
                : {}),
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
            focalPoints: {
              thumb: { x: 0.2, y: 0.8 },
              card: { x: 0.2, y: 0.8 },
              hero: { x: 0.75, y: 0.8 },
              og: { x: 0.2, y: 0.8 },
            },
            focalPoint: { x: 0.2, y: 0.8 },
            variantsVersion: 2,
            variants: {},
          },
        });
      }

      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("carrega foco legado, permite editar um preset e envia o mapa completo", async () => {
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

    const menuItem = await screen.findByText("Definir ponto focal");
    fireEvent.click(menuItem);

    const dialogs = await screen.findAllByRole("dialog");
    const focalDialog = dialogs[dialogs.length - 1];

    fireEvent.click(within(focalDialog).getByRole("button", { name: /hero/i }));
    fireEvent.change(within(focalDialog).getByLabelText(/Eixo X/i), {
      target: { value: "75" },
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
      focalPoints?: Record<string, { x: number; y: number }>;
    };

    expect(payload.focalPoints).toEqual({
      thumb: { x: 0.2, y: 0.8 },
      card: { x: 0.2, y: 0.8 },
      hero: { x: 0.75, y: 0.8 },
      og: { x: 0.2, y: 0.8 },
    });
  });
});
