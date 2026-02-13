import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImageLibraryDialog from "@/components/ImageLibraryDialog";

const { apiFetchMock, toastMock, cropperRenderMock, cropperGetCanvasMock, cropperToDataUrlMock } =
  vi.hoisted(() => ({
    apiFetchMock: vi.fn(),
    toastMock: vi.fn(),
    cropperRenderMock: vi.fn(),
    cropperGetCanvasMock: vi.fn(),
    cropperToDataUrlMock: vi.fn(),
  }));

vi.mock("react-advanced-cropper", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const Cropper = React.forwardRef((props: Record<string, unknown>, ref: React.ForwardedRef<unknown>) => {
    cropperRenderMock(props);
    const cropperApi = {
      getCanvas: (...args: unknown[]) => cropperGetCanvasMock(...args),
    };
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
    }, [props.onReady, props.src]);
    return React.createElement("div", { "data-testid": "advanced-cropper-mock" });
  });

  return {
    Cropper,
    CircleStencil: () => null,
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

describe("ImageLibraryDialog avatar crop flow", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
    cropperRenderMock.mockReset();
    cropperGetCanvasMock.mockReset();
    cropperToDataUrlMock.mockReset();
    cropperToDataUrlMock.mockReturnValue("data:image/png;base64,cropped-avatar");
    cropperGetCanvasMock.mockReturnValue({
      toDataURL: cropperToDataUrlMock,
    } as unknown as HTMLCanvasElement);
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
        onSave={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Avatar Base/i }));
    expect(await screen.findByRole("heading", { name: "Editor de avatar" })).toBeInTheDocument();

    await waitFor(() => {
      expect(cropperRenderMock).toHaveBeenCalled();
    });
    expect(screen.getByTestId("advanced-cropper-mock")).toBeInTheDocument();
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
        onSave={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Avatar Base/i }));
    await screen.findByRole("heading", { name: "Editor de avatar" });

    const applyButton = screen.getByRole("button", { name: "Aplicar avatar" });
    await waitFor(() => expect(applyButton).toBeEnabled());
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(cropperGetCanvasMock).toHaveBeenCalledWith({
        width: 512,
        height: 512,
      });
    });

    await waitFor(() => {
      const cropCall = apiFetchMock.mock.calls.find((call) => String(call[1] || "") === "/api/uploads/image");
      expect(cropCall).toBeTruthy();
      const request = cropCall?.[2] as { body?: string };
      const payload = JSON.parse(String(request?.body || "{}"));
      expect(payload).toMatchObject({
        folder: "users",
        slot: "avatar-user-1",
        filename: "avatar-user-1.png",
      });
    });

    expect(await screen.findByText("Avatar Final")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
    });
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
        String((call[0] as { title?: string })?.title || "").includes("Aplique o recorte do avatar"),
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
        String((call[0] as { title?: string })?.title || "").includes("Preencha o ID do usuário"),
      );
      expect(hasMissingSlotToast).toBe(true);
    });

    const calledUploadEndpoint = apiFetchMock.mock.calls.some((call) => String(call[1] || "") === "/api/uploads/image");
    expect(calledUploadEndpoint).toBe(false);
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
      if (path === "/api/uploads/project-images") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    const onSaveMock = vi.fn();

    const Harness = () => {
      const [open, setOpen] = useState(true);
      const [selection, setSelection] = useState<string[]>(["/uploads/users/base-avatar.png"]);
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

    const avatarFinalLabel = await screen.findByText("Avatar Final");
    const avatarFinalButton = avatarFinalLabel.closest("button");
    expect(avatarFinalButton).toBeTruthy();
    fireEvent.click(avatarFinalButton as HTMLButtonElement);

    const cropDialog = await screen.findByRole("dialog", { name: "Editor de avatar" });
    fireEvent.click(within(cropDialog).getByRole("button", { name: "Cancelar" }));

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
    const finalButton = (await screen.findByText("Avatar Final")).closest("button");
    const cacheButton = (await screen.findByText("Avatar Final Cache")).closest("button");
    expect(baseButton).toBeTruthy();
    expect(finalButton).toBeTruthy();
    expect(cacheButton).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Selecionadas: 1")).toBeInTheDocument();
      expect(baseButton as HTMLButtonElement).not.toHaveClass("ring-2");
      expect(finalButton as HTMLButtonElement).toHaveClass("ring-2");
      expect(cacheButton as HTMLButtonElement).not.toHaveClass("ring-2");
    });
  });
});
