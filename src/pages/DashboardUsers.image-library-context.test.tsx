import type { ReactNode } from "react";
import { render, waitFor } from "@testing-library/react";
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
  it("passa contexto de avatar com pasta users e agrupamento por projeto", async () => {
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
              avatarUrl: "",
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

    await waitFor(() => {
      expect(imageLibraryPropsSpy).toHaveBeenCalled();
    });

    const imageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      uploadFolder?: string;
      listFolders?: string[];
      includeProjectImages?: boolean;
      projectImagesView?: "flat" | "by-project";
      cropAvatar?: boolean;
      cropTargetFolder?: string;
    };

    expect(imageLibraryProps.uploadFolder).toBe("users");
    expect(imageLibraryProps.listFolders).toEqual(["users"]);
    expect(imageLibraryProps.includeProjectImages).toBe(true);
    expect(imageLibraryProps.projectImagesView).toBe("by-project");
    expect(imageLibraryProps.cropAvatar).toBe(true);
    expect(imageLibraryProps.cropTargetFolder).toBe("users");
  });
});
