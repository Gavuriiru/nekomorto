import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardUsers from "@/pages/DashboardUsers";

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: (props: {
    open?: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (payload: {
      urls: string[];
      items: Array<{ variantsVersion?: number; createdAt?: string }>;
    }) => void;
  }) => {
    if (!props.open) {
      return null;
    }
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            props.onSave({
              urls: ["/uploads/users/avatar-user-1.png"],
              items: [
                {
                  variantsVersion: 2,
                  createdAt: "2026-03-01T00:00:00.000Z",
                },
              ],
            });
            props.onOpenChange(false);
          }}
        >
          Selecionar avatar revisado
        </button>
        <button type="button" onClick={() => props.onOpenChange(false)}>
          Fechar biblioteca mock
        </button>
      </div>
    );
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

const userFixture = {
  id: "user-1",
  name: "Admin",
  phrase: "",
  bio: "",
  avatarUrl: "/uploads/users/avatar-user-1.png",
  revision: "rev-1",
  socials: [],
  status: "active" as const,
  permissions: ["*"],
  roles: [],
  order: 0,
};

const parseAvatarSrc = (value: string) => {
  const parsed = new URL(value, "http://localhost");
  return {
    pathname: parsed.pathname,
    version: parsed.searchParams.get("v"),
  };
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
      <DashboardUsers />
    </MemoryRouter>,
  );

describe("DashboardUsers avatar refresh", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [userFixture],
          ownerIds: ["user-1"],
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
          avatarUrl: userFixture.avatarUrl,
          revision: userFixture.revision,
      grants: {},
        });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }
      if (path === "/api/users/user-1" && method === "PUT") {
        return mockJsonResponse(true, {
          user: {
            ...userFixture,
            avatarUrl: "/uploads/users/avatar-user-1.png",
            revision: "rev-2",
          },
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("atualiza o preview de avatar ao selecionar uma revisao na biblioteca", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Abrir usu.rio Admin/i }));

    const dialog = await screen.findByRole("dialog");
    const previewBefore = within(dialog).getByAltText("Admin");
    const srcBefore = previewBefore.getAttribute("src");
    expect(srcBefore).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Biblioteca" }));
    fireEvent.click(await screen.findByText("Selecionar avatar revisado"));

    await waitFor(() => {
      const previewAfter = within(dialog).getByAltText("Admin");
      const srcAfter = previewAfter.getAttribute("src");
      expect(srcAfter).toBeTruthy();
      expect(srcAfter).not.toBe(srcBefore);

      const beforeParsed = parseAvatarSrc(String(srcBefore));
      const afterParsed = parseAvatarSrc(String(srcAfter));
      expect(afterParsed.pathname).toBe(beforeParsed.pathname);
      expect(afterParsed.version).toBe("variant-2");
    });
  });

  it("atualiza o avatar do card ao salvar com a mesma URL usando a revision do backend", async () => {
    renderPage();

    const cardBefore = await screen.findByAltText("Admin");
    const srcBefore = cardBefore.getAttribute("src");
    expect(srcBefore).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Abrir usu.rio Admin/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "http://api.local",
        "/api/users/user-1",
        expect.objectContaining({
          method: "PUT",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const cardAfter = await screen.findByAltText("Admin");
    const srcAfter = cardAfter.getAttribute("src");
    expect(srcAfter).toBeTruthy();
    expect(srcAfter).not.toBe(srcBefore);

    const afterParsed = parseAvatarSrc(String(srcAfter));
    expect(afterParsed.pathname).toBe("/uploads/users/avatar-user-1.png");
    expect(afterParsed.version).toBe("rev-2");
  });

  it("usa proxy same-origin para avatar do Discord no dashboard", async () => {
    const discordAvatarUser = {
      ...userFixture,
      avatarUrl: "https://cdn.discordapp.com/avatars/123456789/avatar_hash.png?size=64",
      revision: "rev-discord",
    };

    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [discordAvatarUser],
          ownerIds: ["user-1"],
        });
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
          avatarUrl: discordAvatarUser.avatarUrl,
          revision: discordAvatarUser.revision,
      grants: {},
        });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderPage();

    expect(await screen.findByAltText("Admin")).toHaveAttribute(
      "src",
      "/api/public/discord-avatar/123456789/avatar_hash.png?size=128&v=rev-discord",
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir usu.rio Admin/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByAltText("Admin")).toHaveAttribute(
      "src",
      "/api/public/discord-avatar/123456789/avatar_hash.png?size=128&v=rev-discord",
    );
  });
});
