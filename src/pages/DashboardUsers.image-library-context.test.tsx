import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DashboardUsers from "@/pages/DashboardUsers";

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
      teamRoles: [],
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

describe("DashboardUsers image library context", () => {
  it("passa contexto de avatar com pasta users, selecao atual e sem imagens de projeto", async () => {
    apiFetchMock.mockReset();
    imageLibraryPropsSpy.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [
            {
              id: "user-1",
              name: "Admin",
              phrase: "",
              bio: "",
              avatarUrl: "/uploads/users/avatar-user-1.png",
              socials: [],
              status: "active",
              permissions: ["*"],
              roles: [],
              order: 0,
            },
          ],
          ownerIds: ["user-1"],
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
      grants: {
            usuarios: true,
            uploads: false,
          },
        });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Abrir usu.rio Admin/i }));

    await waitFor(() => {
      expect(imageLibraryPropsSpy).toHaveBeenCalled();
    });

    const imageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      uploadFolder?: string;
      listFolders?: string[];
      listAll?: boolean;
      includeProjectImages?: boolean;
      projectImagesView?: "flat" | "by-project";
      cropAvatar?: boolean;
      cropTargetFolder?: string;
      currentSelectionUrls?: string[];
      scopeUserId?: string;
      allowUploadManagementActions?: boolean;
    };

    expect(imageLibraryProps.uploadFolder).toBe("users");
    expect(imageLibraryProps.listFolders).toEqual(["users"]);
    expect(imageLibraryProps.listAll).toBe(false);
    expect(imageLibraryProps.includeProjectImages).toBeUndefined();
    expect(imageLibraryProps.projectImagesView).toBeUndefined();
    expect(imageLibraryProps.cropAvatar).toBe(true);
    expect(imageLibraryProps.cropTargetFolder).toBe("users");
    expect(imageLibraryProps.currentSelectionUrls).toEqual(["/uploads/users/avatar-user-1.png"]);
    expect(imageLibraryProps.scopeUserId).toBe("user-1");
    expect(imageLibraryProps.allowUploadManagementActions).toBe(false);
  });

  it("filtra as pastas do avatar pelos grants disponiveis e mantem acoes de upload quando permitido", async () => {
    apiFetchMock.mockReset();
    imageLibraryPropsSpy.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [
            {
              id: "user-1",
              name: "Admin",
              phrase: "",
              bio: "",
              avatarUrl: "/uploads/users/avatar-user-1.png",
              socials: [],
              status: "active",
              permissions: ["*"],
              roles: [],
              order: 0,
            },
          ],
          ownerIds: ["user-1"],
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
      grants: {
            usuarios: true,
            posts: true,
            projetos: true,
            uploads: true,
          },
        });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Abrir usu.rio Admin/i }));

    await waitFor(() => {
      expect(imageLibraryPropsSpy).toHaveBeenCalled();
    });

    const imageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      listFolders?: string[];
      listAll?: boolean;
      scopeUserId?: string;
      allowUploadManagementActions?: boolean;
    };

    expect(imageLibraryProps.listFolders).toEqual(["users", "posts", "projects"]);
    expect(imageLibraryProps.listAll).toBe(false);
    expect(imageLibraryProps.scopeUserId).toBe("user-1");
    expect(imageLibraryProps.allowUploadManagementActions).toBe(true);
  });
});
