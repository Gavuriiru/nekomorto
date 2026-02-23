import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardSettings from "@/pages/DashboardSettings";
import { defaultSettings } from "@/hooks/site-settings-context";

const { apiFetchMock, navigateMock, refreshMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  navigateMock: vi.fn(),
  refreshMock: vi.fn(async () => undefined),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: defaultSettings,
    refresh: refreshMock,
  }),
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const parseSrc = (value: string | null) => {
  const parsed = new URL(String(value || ""), "http://localhost");
  return {
    pathname: parsed.pathname,
    version: parsed.searchParams.get("v"),
  };
};

const settingsWithUploadIcons = {
  ...defaultSettings,
  downloads: {
    ...defaultSettings.downloads,
    sources: defaultSettings.downloads.sources.map((source, index) =>
      index === 0
        ? { ...source, icon: "/uploads/downloads/google-drive.svg" }
        : source,
    ),
  },
};

describe("DashboardSettings svg refresh", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("dashboard.autosave.settings.enabled", "false");

    class MockFileReader {
      result: string | ArrayBuffer | null = null;

      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

      readAsDataURL(_file: Blob) {
        this.result = "data:image/svg+xml;base64,PHN2Zy8+";
        if (this.onload) {
          this.onload.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
        }
      }
    }

    vi.stubGlobal("FileReader", MockFileReader as unknown as typeof FileReader);

    apiFetchMock.mockReset();
    navigateMock.mockReset();
    refreshMock.mockClear();

    apiFetchMock.mockImplementation(async (_base, path, options) => {
      const method = String((options as RequestInit | undefined)?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, { id: "1", name: "Admin", username: "admin" });
      }
      if (path === "/api/settings" && method === "GET") {
        return mockJsonResponse(true, { settings: settingsWithUploadIcons });
      }
      if (path === "/api/public/tag-translations" && method === "GET") {
        return mockJsonResponse(true, {
          tags: { Action: "Acao" },
          genres: { Comedy: "Comedia" },
          staffRoles: { Director: "Diretor" },
        });
      }
      if (path === "/api/projects" && method === "GET") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, {
          items: [
            { id: "instagram", label: "Instagram", icon: "/uploads/socials/instagram.svg" },
            { id: "discord", label: "Discord", icon: "message-circle" },
          ],
        });
      }
      if (path === "/api/uploads/image" && method === "POST") {
        const body = JSON.parse(String((options as RequestInit).body || "{}"));
        if (body.folder === "downloads") {
          return mockJsonResponse(true, { url: "/uploads/downloads/google-drive.svg" });
        }
        if (body.folder === "socials") {
          return mockJsonResponse(true, { url: "/uploads/socials/instagram.svg" });
        }
        return mockJsonResponse(false, { error: "invalid_folder" }, 400);
      }
      if (path === "/api/tag-translations/anilist-sync" && method === "POST") {
        return mockJsonResponse(true, {
          tags: { Action: "Acao" },
          genres: { Comedy: "Comedia" },
          staffRoles: { Director: "Diretor" },
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("updates downloads SVG preview when upload returns the same URL", async () => {
    render(<DashboardSettings />);
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Downloads/i }));
    await screen.findByRole("heading", { name: /Fontes de download/i });

    const previewBefore = await screen.findByAltText(/Google Drive/i);
    const srcBefore = previewBefore.getAttribute("src");
    expect(srcBefore).toBeTruthy();

    const fileInput = document.getElementById("download-icon-0") as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [new File(["<svg/>"], "google-drive.svg", { type: "image/svg+xml" })],
      },
    });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "http://api.local",
        "/api/uploads/image",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      const previewAfter = screen.getByAltText(/Google Drive/i);
      const srcAfter = previewAfter.getAttribute("src");
      expect(srcAfter).toBeTruthy();
      expect(srcAfter).not.toBe(srcBefore);

      const beforeParsed = parseSrc(srcBefore);
      const afterParsed = parseSrc(srcAfter);
      expect(afterParsed.pathname).toBe(beforeParsed.pathname);
      expect(afterParsed.version).not.toBe(beforeParsed.version);
    });
  });

  it("updates social link type SVG preview when upload returns the same URL", async () => {
    render(<DashboardSettings />);
    await screen.findByRole("heading", { name: /Painel/i });

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Redes/i }));
    await screen.findByRole("heading", { name: /Redes sociais \(Usuários\)/i });

    const previewBefore = await screen.findByAltText(/Instagram/i);
    const srcBefore = previewBefore.getAttribute("src");
    expect(srcBefore).toBeTruthy();

    const fileInput = document.getElementById("linktype-icon-0") as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();
    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [new File(["<svg/>"], "instagram.svg", { type: "image/svg+xml" })],
      },
    });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "http://api.local",
        "/api/uploads/image",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      const previewAfter = screen.getByAltText(/Instagram/i);
      const srcAfter = previewAfter.getAttribute("src");
      expect(srcAfter).toBeTruthy();
      expect(srcAfter).not.toBe(srcBefore);

      const beforeParsed = parseSrc(srcBefore);
      const afterParsed = parseSrc(srcAfter);
      expect(afterParsed.pathname).toBe(beforeParsed.pathname);
      expect(afterParsed.version).not.toBe(beforeParsed.version);
    });
  });
});
