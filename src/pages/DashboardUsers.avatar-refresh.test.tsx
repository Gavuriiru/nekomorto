import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  default: (props: { open?: boolean; onOpenChange: (open: boolean) => void }) => {
    if (!props.open) {
      return null;
    }
    return (
      <button type="button" onClick={() => props.onOpenChange(false)}>
        Fechar biblioteca mock
      </button>
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
          },
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("atualiza o preview de avatar ao fechar a biblioteca", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("heading", { name: "Admin" }));

    const dialog = await screen.findByRole("dialog");
    const previewBefore = within(dialog).getByAltText("Admin");
    const srcBefore = previewBefore.getAttribute("src");
    expect(srcBefore).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Biblioteca" }));
    fireEvent.click(await screen.findByText("Fechar biblioteca mock"));

    await waitFor(() => {
      const previewAfter = within(dialog).getByAltText("Admin");
      const srcAfter = previewAfter.getAttribute("src");
      expect(srcAfter).toBeTruthy();
      expect(srcAfter).not.toBe(srcBefore);

      const beforeParsed = parseAvatarSrc(String(srcBefore));
      const afterParsed = parseAvatarSrc(String(srcAfter));
      expect(afterParsed.pathname).toBe(beforeParsed.pathname);
      expect(afterParsed.version).not.toBe(beforeParsed.version);
    });
  });

  it("atualiza o avatar do card ao salvar com a mesma URL", async () => {
    renderPage();

    const cardBefore = await screen.findByAltText("Admin");
    const srcBefore = cardBefore.getAttribute("src");
    expect(srcBefore).toBeTruthy();

    fireEvent.click(screen.getByRole("heading", { name: "Admin" }));
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

    const beforeParsed = parseAvatarSrc(String(srcBefore));
    const afterParsed = parseAvatarSrc(String(srcAfter));
    expect(afterParsed.pathname).toBe(beforeParsed.pathname);
    expect(afterParsed.version).not.toBe(beforeParsed.version);
  });
});
