import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DashboardPages from "@/pages/DashboardPages";

const { apiFetchMock, imageLibraryPropsSpy } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  imageLibraryPropsSpy: vi.fn(),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: (props: unknown) => {
    imageLibraryPropsSpy(props);
    return <div data-testid="image-library-dialog" />;
  },
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      site: { name: "Nekomata" },
      footer: { brandName: "Nekomata" },
    },
  }),
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
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

const basePagesPayload = {
  pages: {
    home: { shareImage: "" },
    projects: { shareImage: "" },
    about: { shareImage: "" },
    donations: { shareImage: "" },
    faq: { shareImage: "" },
    team: { shareImage: "" },
    recruitment: { shareImage: "" },
  },
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/paginas"]}>
      <DashboardPages />
    </MemoryRouter>,
  );

describe("DashboardPages image library context", () => {
  it("mantem shared mesmo sem grants de posts ou projetos", async () => {
    apiFetchMock.mockReset();
    imageLibraryPropsSpy.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
      grants: {
            paginas: true,
            posts: false,
            projetos: false,
          },
        });
      }
      if (path === "/api/pages" && method === "GET") {
        return mockJsonResponse(true, basePagesPayload);
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderPage();

    await screen.findByRole("heading", { name: /Gerenciar/i });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Pr.via/i }));
    fireEvent.click(
      await screen.findAllByRole("button", { name: "Biblioteca" }).then((items) => items[0]),
    );

    await waitFor(() => {
      expect(imageLibraryPropsSpy).toHaveBeenCalled();
    });

    const imageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      listFolders?: string[];
      listAll?: boolean;
    };

    expect(imageLibraryProps.listFolders).toEqual(["shared"]);
    expect(imageLibraryProps.listAll).toBe(false);
  });

  it("inclui posts e projetos apenas quando esses grants estao habilitados", async () => {
    apiFetchMock.mockReset();
    imageLibraryPropsSpy.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
      grants: {
            paginas: true,
            posts: true,
            projetos: true,
          },
        });
      }
      if (path === "/api/pages" && method === "GET") {
        return mockJsonResponse(true, basePagesPayload);
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderPage();

    await screen.findByRole("heading", { name: /Gerenciar/i });
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Pr.via/i }));
    fireEvent.click(
      await screen.findAllByRole("button", { name: "Biblioteca" }).then((items) => items[0]),
    );

    await waitFor(() => {
      expect(imageLibraryPropsSpy).toHaveBeenCalled();
    });

    const imageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      listFolders?: string[];
    };

    expect(imageLibraryProps.listFolders).toEqual(["shared", "posts", "projects"]);
  });
});
