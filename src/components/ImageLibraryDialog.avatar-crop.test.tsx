import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ImageLibraryDialog from "@/components/ImageLibraryDialog";
import { renderAvatarCropDataUrl } from "@/components/ImageLibraryDialog.avatar-crop";

const {
  apiFetchMock,
  toastMock,
  cropperRenderMock,
  cropperGetCanvasMock,
  cropperGetCoordinatesMock,
  cropperGetImageMock,
  cropperGetStateMock,
  cropperToDataUrlMock,
  drawCroppedAreaMock,
} = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  toastMock: vi.fn(),
  cropperRenderMock: vi.fn(),
  cropperGetCanvasMock: vi.fn(),
  cropperGetCoordinatesMock: vi.fn(),
  cropperGetImageMock: vi.fn(),
  cropperGetStateMock: vi.fn(),
  cropperToDataUrlMock: vi.fn(),
  drawCroppedAreaMock: vi.fn(),
}));

vi.mock("advanced-cropper", async () => {
  const actual = await vi.importActual<typeof import("advanced-cropper")>("advanced-cropper");
  return {
    ...actual,
    drawCroppedArea: (...args: unknown[]) => drawCroppedAreaMock(...args),
  };
});

vi.mock("react-advanced-cropper", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const FixedCropper = React.forwardRef(
    (props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) => {
      cropperRenderMock(props);
      const cropperApi = React.useMemo(
        () => ({
          getCanvas: (...args: unknown[]) => cropperGetCanvasMock(...args),
          getCoordinates: (...args: unknown[]) => cropperGetCoordinatesMock(...args),
          getImage: (...args: unknown[]) => cropperGetImageMock(...args),
          getState: (...args: unknown[]) => cropperGetStateMock(...args),
        }),
        [],
      );
      if (typeof ref === "function") {
        ref(cropperApi);
      } else if (ref && typeof ref === "object") {
        (ref as { current: unknown }).current = cropperApi;
      }
      React.useEffect(() => {
        const onReady = props.onReady;
        if (typeof onReady === "function") {
          const timeout = window.setTimeout(() => onReady(cropperApi), 0);
          return () => window.clearTimeout(timeout);
        }
        return undefined;
      }, [cropperApi, props.onReady, props.src]);
      return React.createElement("div", { "data-testid": "advanced-cropper-mock" });
    },
  );

  return {
    Cropper: FixedCropper,
    FixedCropper,
    CircleStencil: () => null,
    RectangleStencil: () => null,
  };
});

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
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

const baseUploadItem = {
  name: "base-avatar.png",
  label: "Avatar Base",
  fileName: "base-avatar.png",
  folder: "users",
  mime: "image/png",
  size: 512,
  url: "/uploads/users/base-avatar.png",
};

const buildUploadListResponse = (files: Array<Record<string, unknown>>) =>
  mockJsonResponse(true, { files });

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

const getLastRenderedCropperSrc = () => {
  const lastCall = cropperRenderMock.mock.calls[cropperRenderMock.mock.calls.length - 1]?.[0] as
    | { src?: string }
    | undefined;
  return String(lastCall?.src || "");
};

const originalImage = globalThis.Image;

class MockImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  private currentSrc = "";
  naturalWidth = 512;
  naturalHeight = 512;
  width = 512;
  height = 512;

  set src(value: string) {
    this.currentSrc = value;
    window.setTimeout(() => {
      this.onload?.();
    }, 0);
  }

  get src() {
    return this.currentSrc;
  }
}

describe("ImageLibraryDialog avatar crop flow", () => {
  beforeEach(() => {
    ensureDomRectFromRect();
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);
    apiFetchMock.mockReset();
    toastMock.mockReset();
    cropperRenderMock.mockReset();
    cropperGetCanvasMock.mockReset();
    cropperGetCoordinatesMock.mockReset();
    cropperGetImageMock.mockReset();
    cropperGetStateMock.mockReset();
    cropperToDataUrlMock.mockReset();
    drawCroppedAreaMock.mockReset();
    cropperToDataUrlMock.mockReturnValue("data:image/png;base64,cropped-avatar");
    cropperGetCanvasMock.mockReturnValue({
      toDataURL: cropperToDataUrlMock,
    } as unknown as HTMLCanvasElement);
    cropperGetCoordinatesMock.mockReturnValue({
      left: 12,
      top: 18,
      width: 144,
      height: 144,
    });
    cropperGetImageMock.mockReturnValue({
      src: "data:image/png;base64,source-avatar",
      revoke: false,
      transforms: {
        rotate: 0,
        flip: {
          horizontal: false,
          vertical: false,
        },
      },
      arrayBuffer: null,
      width: 320,
      height: 320,
    });
    cropperGetStateMock.mockReturnValue({
      boundary: { width: 320, height: 320 },
      imageSize: { width: 320, height: 320 },
      transforms: {
        rotate: 0,
        flip: {
          horizontal: false,
          vertical: false,
        },
      },
      visibleArea: {
        left: 0,
        top: 0,
        width: 320,
        height: 320,
      },
      coordinates: {
        left: 12,
        top: 18,
        width: 144,
        height: 144,
      },
    });
    drawCroppedAreaMock.mockImplementation(
      (_state: unknown, _image: unknown, resultCanvas: HTMLCanvasElement) => {
        Object.defineProperty(resultCanvas, "toDataURL", {
          configurable: true,
          value: cropperToDataUrlMock,
        });
        return resultCanvas;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.Image = originalImage;
  });

  it("abre editor de avatar somente quando cropAvatar estiver habilitado", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return buildUploadListResponse([baseUploadItem]);
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    const { rerender } = render(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        onSave={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Avatar Base/i }));
    expect(screen.queryByRole("heading", { name: "Editor de avatar" })).not.toBeInTheDocument();

    rerender(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        cropSlot="avatar-user-1"
        scopeUserId="user-1"
        onSave={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Avatar Base/i }));
    expect(await screen.findByRole("heading", { name: "Editor de avatar" })).toBeInTheDocument();

    await waitFor(() => {
      expect(cropperRenderMock).toHaveBeenCalled();
    });
    expect(screen.getByTestId("advanced-cropper-mock")).toBeInTheDocument();
    expect(screen.queryByText("Como ajustar")).not.toBeInTheDocument();

    const cropperPreview = document.querySelector(".avatar-cropper-preview") as HTMLElement | null;
    expect(cropperPreview).not.toBeNull();
    expect(cropperPreview).toHaveStyle({
      width: "320px",
      height: "320px",
    });

    const cropperProps = cropperRenderMock.mock.calls[
      cropperRenderMock.mock.calls.length - 1
    ]?.[0] as Record<string, unknown> | undefined;
    expect(cropperProps).toBeTruthy();
    expect(cropperProps?.imageRestriction).toBe("stencil");
    expect(cropperProps?.transformImage).toMatchObject({
      adjustStencil: false,
    });
    expect(cropperProps?.stencilProps).toMatchObject({
      movable: false,
      resizable: false,
      grid: false,
      handlers: {
        eastNorth: false,
        westNorth: false,
        westSouth: false,
        eastSouth: false,
      },
      lines: {
        west: false,
        north: false,
        east: false,
        south: false,
      },
    });
    expect(typeof cropperProps?.stencilSize).toBe("function");
    const stencilSizeResult = (
      cropperProps?.stencilSize as (state: unknown) => { width: number; height: number }
    )({
      boundary: { width: 220, height: 320 },
    });
    expect(stencilSizeResult).toEqual({
      width: 220,
      height: 220,
    });
  });

  it("aplica crop e envia upload com slot deterministico do usuario", async () => {
    let listCalls = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        listCalls += 1;
        if (listCalls > 1) {
          return buildUploadListResponse([
            baseUploadItem,
            {
              name: "avatar-user-1.png",
              label: "Avatar Final",
              fileName: "avatar-user-1.png",
              folder: "users",
              mime: "image/png",
              size: 1200,
              url: "/uploads/users/avatar-user-1.png",
            },
          ]);
        }
        return buildUploadListResponse([baseUploadItem]);
      }
      if (path === "/api/uploads/image") {
        return mockJsonResponse(true, { url: "/uploads/users/avatar-user-1.png" });
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        cropSlot="avatar-user-1"
        scopeUserId="user-1"
        onSave={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Avatar Base/i }));
    await screen.findByRole("heading", { name: "Editor de avatar" });

    const applyButton = screen.getByRole("button", { name: "Aplicar avatar" });
    await waitFor(() => expect(applyButton).toBeEnabled());
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(drawCroppedAreaMock).toHaveBeenCalled();
    });
    expect(cropperGetCanvasMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "http://api.local",
        "/api/uploads/list?folder=users&recursive=1&scopeUserId=user-1",
        expect.any(Object),
      );
      const cropCall = apiFetchMock.mock.calls.find(
        (call) => String(call[1] || "") === "/api/uploads/image",
      );
      expect(cropCall).toBeTruthy();
      const request = cropCall?.[2] as { body?: string };
      const payload = JSON.parse(String(request?.body || "{}"));
      expect(payload).toMatchObject({
        folder: "users",
        slot: "avatar-user-1",
        filename: "avatar-user-1.png",
        scopeUserId: "user-1",
      });
    });

    expect(await screen.findByText("Avatar Base")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
      expect(screen.getByText("Avatar Final")).toBeInTheDocument();
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Avatar atualizado",
      }),
    );
  });

  it("exibe toast de sucesso ao importar imagem por URL", async () => {
    let listCalls = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        listCalls += 1;
        if (listCalls > 1) {
          return buildUploadListResponse([
            {
              ...baseUploadItem,
              name: "imported.png",
              label: "Importada",
              fileName: "imported.png",
              url: "/uploads/users/imported.png",
            },
          ]);
        }
        return buildUploadListResponse([]);
      }
      if (path === "/api/uploads/image-from-url") {
        return mockJsonResponse(true, { url: "/uploads/users/imported.png" });
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        onSave={() => undefined}
      />,
    );

    const urlInput = await screen.findByPlaceholderText("https://site.com/imagem.png");
    fireEvent.change(urlInput, { target: { value: "https://cdn.site/avatar.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Importar URL" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Imagem importada",
        }),
      );
    });
  });

  it("exibe toast de sucesso ao enviar imagem por arquivo", async () => {
    let listCalls = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        listCalls += 1;
        if (listCalls > 1) {
          return buildUploadListResponse([
            {
              ...baseUploadItem,
              name: "uploaded.png",
              label: "Upload novo",
              fileName: "uploaded.png",
              url: "/uploads/users/uploaded.png",
            },
          ]);
        }
        return buildUploadListResponse([]);
      }
      if (path === "/api/uploads/image") {
        return mockJsonResponse(true, { url: "/uploads/users/uploaded.png" });
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        onSave={() => undefined}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Imagem enviada",
        }),
      );
    });
  });

  it("exibe toast de sucesso ao renomear imagem", async () => {
    let listCalls = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        listCalls += 1;
        if (listCalls > 1) {
          return buildUploadListResponse([
            {
              ...baseUploadItem,
              name: "avatar-renamed.png",
              label: "Avatar Renomeado",
              fileName: "avatar-renamed.png",
              url: "/uploads/users/avatar-renamed.png",
            },
          ]);
        }
        return buildUploadListResponse([baseUploadItem]);
      }
      if (path === "/api/uploads/rename") {
        return mockJsonResponse(true, {
          oldUrl: "/uploads/users/base-avatar.png",
          newUrl: "/uploads/users/avatar-renamed.png",
        });
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        onSave={() => undefined}
      />,
    );

    const imageButton = (await screen.findByText("Avatar Base")).closest("button");
    expect(imageButton).toBeTruthy();
    fireEvent.contextMenu(imageButton as HTMLButtonElement);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Renomear" }));
    fireEvent.change(await screen.findByLabelText("Novo nome do arquivo"), {
      target: { value: "avatar-renamed.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Renomear" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Imagem renomeada",
        }),
      );
    });
  });

  it("exibe toast de sucesso ao excluir imagem", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return buildUploadListResponse([baseUploadItem]);
      }
      if (path === "/api/uploads/delete") {
        return mockJsonResponse(true, { ok: true });
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        onSave={() => undefined}
      />,
    );

    const imageButton = (await screen.findByText("Avatar Base")).closest("button");
    expect(imageButton).toBeTruthy();
    fireEvent.contextMenu(imageButton as HTMLButtonElement);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/Imagem exclu/i),
        }),
      );
    });
  });

  it("oculta acoes de gestao quando o fluxo de avatar usa permissao limitada", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return buildUploadListResponse([baseUploadItem]);
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        cropSlot="avatar-user-1"
        allowUploadManagementActions={false}
        onSave={() => undefined}
      />,
    );

    const imageButton = (await screen.findByText("Avatar Base")).closest("button");
    expect(imageButton).toBeTruthy();
    fireEvent.contextMenu(imageButton as HTMLButtonElement);

    expect(await screen.findByRole("menuitem", { name: "Editar avatar" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Renomear" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Excluir" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Editar texto alternativo" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Definir ponto focal" })).not.toBeInTheDocument();
  });

  it("bloqueia salvar no fluxo de avatar quando a selecao nao e o slot final recortado", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return buildUploadListResponse([baseUploadItem]);
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    const onSaveMock = vi.fn();

    render(
      <ImageLibraryDialog
        open
        onOpenChange={() => undefined}
        apiBase="http://api.local"
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        cropSlot="avatar-user-1"
        onSave={onSaveMock}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Avatar Base/i }));

    const cropDialog = await screen.findByRole("dialog", { name: "Editor de avatar" });
    fireEvent.click(within(cropDialog).getByRole("button", { name: "Cancelar" }));

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const hasMandatoryCropToast = toastMock.mock.calls.some((call) =>
        String((call[0] as { title?: string })?.title || "").includes(
          "Aplique o recorte do avatar",
        ),
      );
      expect(hasMandatoryCropToast).toBe(true);
    });
    expect(onSaveMock).not.toHaveBeenCalled();
  });

  it("impede aplicar crop sem cropSlot e nao envia upload", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return buildUploadListResponse([baseUploadItem]);
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        onSave={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Avatar Base/i }));
    await screen.findByRole("heading", { name: "Editor de avatar" });

    const applyButton = screen.getByRole("button", { name: "Aplicar avatar" });
    await waitFor(() => expect(applyButton).toBeEnabled());
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalled();
      const hasMissingSlotToast = toastMock.mock.calls.some((call) =>
        /Preencha o ID do usu/i.test(String((call[0] as { title?: string })?.title || "")),
      );
      expect(hasMissingSlotToast).toBe(true);
    });

    const calledUploadEndpoint = apiFetchMock.mock.calls.some(
      (call) => String(call[1] || "") === "/api/uploads/image",
    );
    expect(calledUploadEndpoint).toBe(false);
  });

  it("mantem visivel o avatar atual legado e oculta outros avatares finais no fluxo de avatar", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return buildUploadListResponse([
          baseUploadItem,
          {
            name: "avatar-user-1.png",
            label: "Avatar Atual",
            fileName: "avatar-user-1.png",
            folder: "users",
            mime: "image/png",
            size: 1200,
            url: "/uploads/users/avatar-user-1.png",
          },
          {
            name: "avatar-380305493391966208.png",
            label: "Avatar Oculto",
            fileName: "avatar-380305493391966208.png",
            folder: "users",
            mime: "image/png",
            size: 1200,
            url: "/uploads/users/avatar-380305493391966208.png",
          },
        ]);
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        cropSlot="avatar-user-1"
        currentSelectionUrls={["/uploads/users/avatar-user-1.png"]}
        onSave={() => undefined}
      />,
    );

    expect(await screen.findByText("Avatar Base")).toBeInTheDocument();
    const currentAvatarButton = (await screen.findByText("Avatar Atual")).closest("button");
    expect(currentAvatarButton).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
      expect(currentAvatarButton as HTMLButtonElement).toHaveClass("ring-2");
    });
    expect(screen.queryByText("Avatar Oculto")).not.toBeInTheDocument();
  });

  it("revela o upload retornado no fluxo de avatar mesmo quando a busca o esconderia", async () => {
    let listCalls = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        listCalls += 1;
        if (listCalls > 1) {
          return buildUploadListResponse([
            {
              name: "avatar-1712345678901.png",
              label: "Avatar Upload",
              fileName: "avatar-1712345678901.png",
              folder: "users",
              mime: "image/png",
              size: 1200,
              url: "/uploads/users/avatar-1712345678901.png",
            },
          ]);
        }
        return buildUploadListResponse([]);
      }
      if (path === "/api/uploads/image") {
        return mockJsonResponse(true, { url: "/uploads/users/avatar-1712345678901.png" });
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        cropSlot="avatar-user-1"
        allowUploadManagementActions={false}
        onSave={() => undefined}
      />,
    );

    expect(
      await screen.findByText("Nenhum upload corresponde aos filtros atuais."),
    ).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText("Pesquisar por nome, projeto ou URL...");
    fireEvent.change(searchInput, { target: { value: "nao-encontra-avatar" } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    const file = new File(["avatar"], "avatar.png", { type: "image/png" });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Imagem enviada",
        }),
      );
    });
    expect(await screen.findByText("Avatar Upload")).toBeInTheDocument();
    await waitFor(() => {
      expect(searchInput).toHaveValue("");
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
    });
  });

  it("autoabre o cropper apos upload no fluxo de avatar", async () => {
    let listCalls = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        listCalls += 1;
        if (listCalls > 1) {
          return buildUploadListResponse([
            {
              name: "fresh-upload.png",
              label: "Upload Recente",
              fileName: "fresh-upload.png",
              folder: "users",
              mime: "image/png",
              size: 1200,
              url: "/uploads/users/fresh-upload.png",
            },
          ]);
        }
        return buildUploadListResponse([]);
      }
      if (path === "/api/uploads/image") {
        return mockJsonResponse(true, { url: "/uploads/users/fresh-upload.png" });
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        cropSlot="avatar-user-1"
        onSave={() => undefined}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["avatar"], "fresh-upload.png", { type: "image/png" })] },
    });

    expect(await screen.findByRole("heading", { name: "Editor de avatar" })).toBeInTheDocument();
    expect(await screen.findByText("Upload Recente")).toBeInTheDocument();
  });

  it("autoabre o cropper apos importar por URL no fluxo de avatar", async () => {
    let listCalls = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        listCalls += 1;
        if (listCalls > 1) {
          return buildUploadListResponse([
            {
              name: "imported-avatar.png",
              label: "Avatar Importado",
              fileName: "imported-avatar.png",
              folder: "users",
              mime: "image/png",
              size: 1200,
              url: "/uploads/users/imported-avatar.png",
            },
          ]);
        }
        return buildUploadListResponse([]);
      }
      if (path === "/api/uploads/image-from-url") {
        return mockJsonResponse(true, { url: "/uploads/users/imported-avatar.png" });
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        cropSlot="avatar-user-1"
        onSave={() => undefined}
      />,
    );

    const urlInput = await screen.findByPlaceholderText("https://site.com/imagem.png");
    fireEvent.change(urlInput, { target: { value: "https://cdn.site/avatar.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Importar URL" }));

    expect(await screen.findByRole("heading", { name: "Editor de avatar" })).toBeInTheDocument();
    expect(await screen.findByText("Avatar Importado")).toBeInTheDocument();
  });

  it("reabre o cropper em dedupe hit mesmo quando a URL retornada ja estava selecionada", async () => {
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return buildUploadListResponse([
          {
            name: "existing.png",
            label: "Existente",
            fileName: "existing.png",
            folder: "users",
            mime: "image/png",
            size: 100,
            url: "/uploads/users/existing.png",
          },
        ]);
      }
      if (path === "/api/uploads/image") {
        return mockJsonResponse(true, { url: "/uploads/users/existing.png" });
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        cropSlot="avatar-user-1"
        currentSelectionUrls={["/uploads/users/existing.png"]}
        onSave={() => undefined}
      />,
    );

    expect(await screen.findByText("Existente")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Editor de avatar" })).not.toBeInTheDocument();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["avatar"], "same.png", { type: "image/png" })] },
    });

    expect(await screen.findByRole("heading", { name: "Editor de avatar" })).toBeInTheDocument();
  });

  it("nao autoabre o cropper quando o upload retornado ja e o avatar final slot-managed", async () => {
    let listCalls = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        listCalls += 1;
        if (listCalls > 1) {
          return buildUploadListResponse([
            {
              name: "avatar-user-1.png",
              label: "Avatar Final",
              fileName: "avatar-user-1.png",
              folder: "users",
              mime: "image/png",
              size: 1200,
              url: "/uploads/users/avatar-user-1.png",
              slotManaged: true,
            },
          ]);
        }
        return buildUploadListResponse([]);
      }
      if (path === "/api/uploads/image") {
        return mockJsonResponse(true, { url: "/uploads/users/avatar-user-1.png" });
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        cropSlot="avatar-user-1"
        onSave={() => undefined}
      />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["avatar"], "avatar-user-1.png", { type: "image/png" })] },
    });

    expect(await screen.findByText("Avatar Final")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Editor de avatar" })).not.toBeInTheDocument();
    });
  });

  it("atualiza thumbnail e cropper com cache-bust quando o avatar final reutiliza a mesma URL", async () => {
    let listCalls = 0;
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        listCalls += 1;
        if (listCalls > 1) {
          return buildUploadListResponse([
            {
              ...baseUploadItem,
              variantsVersion: 1,
            },
            {
              name: "avatar-user-1.png",
              label: "Avatar Final",
              fileName: "avatar-user-1.png",
              folder: "users",
              mime: "image/png",
              size: 1200,
              url: "/uploads/users/avatar-user-1.png",
              variantsVersion: 2,
            },
          ]);
        }
        return buildUploadListResponse([
          {
            ...baseUploadItem,
            variantsVersion: 1,
          },
          {
            name: "avatar-user-1.png",
            label: "Avatar Final",
            fileName: "avatar-user-1.png",
            folder: "users",
            mime: "image/png",
            size: 1200,
            url: "/uploads/users/avatar-user-1.png",
            variantsVersion: 1,
          },
        ]);
      }
      if (path === "/api/uploads/image") {
        return mockJsonResponse(true, { url: "/uploads/users/avatar-user-1.png" });
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        cropSlot="avatar-user-1"
        currentSelectionUrls={["/uploads/users/avatar-user-1.png"]}
        onSave={() => undefined}
      />,
    );

    const finalAvatarButtonBefore = (await screen.findByText("Avatar Final")).closest("button");
    expect(finalAvatarButtonBefore).toBeTruthy();
    const finalAvatarImageBefore = (finalAvatarButtonBefore as HTMLButtonElement).querySelector(
      "img",
    );
    expect(finalAvatarImageBefore).toBeTruthy();
    expect(finalAvatarImageBefore?.getAttribute("src")).toContain("variant-1");

    fireEvent.click(finalAvatarButtonBefore as HTMLButtonElement);
    await screen.findByRole("heading", { name: "Editor de avatar" });
    expect(getLastRenderedCropperSrc()).toContain("variant-1");

    const applyButton = screen.getByRole("button", { name: "Aplicar avatar" });
    await waitFor(() => expect(applyButton).toBeEnabled());
    fireEvent.click(applyButton);

    await waitFor(() => {
      const finalAvatarImageAfter = screen
        .getByText("Avatar Final")
        .closest("button")
        ?.querySelector("img");
      expect(finalAvatarImageAfter?.getAttribute("src")).toContain("variant-2");
    });

    const finalAvatarButtonForReopen = screen.getByText("Avatar Final").closest("button");
    expect(finalAvatarButtonForReopen).toBeTruthy();
    fireEvent.click(finalAvatarButtonForReopen as HTMLButtonElement);
    await screen.findByRole("heading", { name: "Editor de avatar" });

    await waitFor(() => {
      expect(getLastRenderedCropperSrc()).toContain("variant-2");
    });
  });

  it("mantem apenas a imagem salva selecionada ao fechar e reabrir no fluxo de avatar", async () => {
    const uploadFiles = [
      baseUploadItem,
      {
        name: "avatar-user-1.png",
        label: "Avatar Final",
        fileName: "avatar-user-1.png",
        folder: "users",
        mime: "image/png",
        size: 1200,
        url: "/uploads/users/avatar-user-1.png",
      },
      {
        name: "avatar-user-1-cache.png",
        label: "Avatar Final Cache",
        fileName: "avatar-user-1-cache.png",
        folder: "users",
        mime: "image/png",
        size: 1200,
        url: "/uploads/users/avatar-user-1.png?v=2",
      },
    ];

    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return buildUploadListResponse(uploadFiles);
      }
      if (path === "/api/uploads/image") {
        return mockJsonResponse(true, { url: "/uploads/users/avatar-user-1.png" });
      }
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    const onSaveMock = vi.fn();

    const Harness = () => {
      const [open, setOpen] = useState(true);
      const [selection, setSelection] = useState<string[]>([]);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir biblioteca mock
          </button>
          <ImageLibraryDialog
            open={open}
            onOpenChange={setOpen}
            apiBase="http://api.local"
            uploadFolder="users"
            listFolders={["users"]}
            listAll={false}
            mode="single"
            cropAvatar
            cropTargetFolder="users"
            cropSlot="avatar-user-1"
            currentSelectionUrls={selection}
            onSave={(payload) => {
              onSaveMock(payload);
              setSelection(payload.urls);
            }}
          />
        </>
      );
    };

    render(<Harness />);

    const baseButtonBeforeSave = (await screen.findByText("Avatar Base")).closest("button");
    expect(baseButtonBeforeSave).toBeTruthy();
    expect(screen.queryByText("Avatar Final")).not.toBeInTheDocument();
    expect(screen.queryByText("Avatar Final Cache")).not.toBeInTheDocument();
    fireEvent.click(baseButtonBeforeSave as HTMLButtonElement);

    await screen.findByRole("heading", { name: "Editor de avatar" });
    const applyButton = screen.getByRole("button", { name: "Aplicar avatar" });
    await waitFor(() => expect(applyButton).toBeEnabled());
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
      expect(screen.getByText("Avatar Final")).toBeInTheDocument();
      expect(screen.queryByText("Avatar Final Cache")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          urls: ["/uploads/users/avatar-user-1.png"],
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Abrir biblioteca mock" }));

    const baseButton = (await screen.findByText("Avatar Base")).closest("button");
    const finalAvatarButton = (await screen.findByText("Avatar Final")).closest("button");
    expect(baseButton).toBeTruthy();
    expect(finalAvatarButton).toBeTruthy();
    expect(screen.queryByText("Avatar Final Cache")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
      expect(baseButton as HTMLButtonElement).not.toHaveClass("ring-2");
      expect(finalAvatarButton as HTMLButtonElement).toHaveClass("ring-2");
    });
  });

  it("gera o PNG final a partir de state, image e coordinates do cropper", async () => {
    const cropperHandle = {
      getState: () => ({
        boundary: { width: 320, height: 320 },
        imageSize: { width: 320, height: 320 },
        transforms: {
          rotate: 0,
          flip: {
            horizontal: false,
            vertical: false,
          },
        },
        visibleArea: {
          left: 0,
          top: 0,
          width: 320,
          height: 320,
        },
        coordinates: {
          left: 5,
          top: 7,
          width: 120,
          height: 120,
        },
      }),
      getCoordinates: () => ({
        left: 11,
        top: 13,
        width: 144,
        height: 144,
      }),
      getImage: () => ({
        src: "/uploads/users/source-avatar.png",
        revoke: false,
        transforms: {
          rotate: 0,
          flip: {
            horizontal: false,
            vertical: false,
          },
        },
        arrayBuffer: null,
        width: 320,
        height: 320,
      }),
    };

    const dataUrl = await renderAvatarCropDataUrl(
      cropperHandle as Parameters<typeof renderAvatarCropDataUrl>[0],
    );

    expect(dataUrl).toBe("data:image/png;base64,cropped-avatar");
    expect(drawCroppedAreaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        coordinates: {
          left: 11,
          top: 13,
          width: 144,
          height: 144,
        },
      }),
      expect.objectContaining({
        src: "/uploads/users/source-avatar.png",
      }),
      expect.any(HTMLCanvasElement),
      expect.any(HTMLCanvasElement),
      expect.objectContaining({
        width: 512,
        height: 512,
      }),
    );
  });

  it("falha de forma controlada quando o cropper nao expõe state/image/coordenadas", async () => {
    await expect(
      renderAvatarCropDataUrl({
        getState: () => null,
        getCoordinates: () => null,
        getImage: () => null,
      } as Parameters<typeof renderAvatarCropDataUrl>[0]),
    ).rejects.toThrow("cropper_state_unavailable");
  });

  it("nao envia upload quando o cropper nao consegue fornecer o recorte atual", async () => {
    cropperGetStateMock.mockReturnValue(null);
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path.startsWith("/api/uploads/list")) {
        return buildUploadListResponse([baseUploadItem]);
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
        uploadFolder="users"
        listFolders={["users"]}
        listAll={false}
        mode="single"
        cropAvatar
        cropTargetFolder="users"
        cropSlot="avatar-user-1"
        onSave={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Avatar Base/i }));
    await screen.findByRole("heading", { name: "Editor de avatar" });

    const applyButton = screen.getByRole("button", { name: "Aplicar avatar" });
    await waitFor(() => expect(applyButton).toBeEnabled());
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalled();
    });
    const calledUploadEndpoint = apiFetchMock.mock.calls.some(
      (call) => String(call[1] || "") === "/api/uploads/image",
    );
    expect(calledUploadEndpoint).toBe(false);
  });
});
