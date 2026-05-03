import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AccessibilityAnnouncerProvider } from "@/hooks/accessibility-announcer";
import DashboardPosts from "@/pages/DashboardPosts";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageContainer", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  default: ({ title, actions }: { title: string; actions?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/ProjectEmbedCard", () => ({
  default: () => null,
}));

vi.mock("@/components/lexical/LexicalEditor", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const MockEditor = React.forwardRef(
    (_props: unknown, ref: React.ForwardedRef<{ blur: () => void }>) => {
      React.useImperativeHandle(ref, () => ({ blur: () => undefined }));
      return <div data-testid="lexical-editor" />;
    },
  );
  MockEditor.displayName = "MockLexicalEditor";
  return { default: MockEditor };
});

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
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

const postFixture = {
  id: "post-1",
  title: "Post com tags",
  slug: "post-com-tags",
  excerpt: "Resumo",
  content: "",
  contentFormat: "lexical" as const,
  author: "Admin",
  publishedAt: "2026-02-10T12:00:00.000Z",
  status: "draft" as const,
  projectId: "",
  tags: ["ISEKAI", "YURI", "MEDIEVAL"],
  views: 0,
  commentsCount: 0,
  deletedAt: null,
  deletedBy: null,
};

const setupApiMock = () => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (path === "/api/posts" && method === "GET") {
      return mockJsonResponse(true, { posts: [postFixture] });
    }
    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, {
        users: [{ id: "user-1", permissions: ["posts"] }],
        ownerIds: [],
      });
    }
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, {
        id: "user-1",
        name: "Admin",
        username: "admin",
        permissions: ["posts"],
        grants: { posts: true },
      });
    }
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, { projects: [] });
    }
    if (path === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const renderSubject = () =>
  render(
    <AccessibilityAnnouncerProvider>
      <MemoryRouter initialEntries={["/dashboard/posts?edit=post-1"]}>
        <DashboardPosts />
      </MemoryRouter>
    </AccessibilityAnnouncerProvider>,
  );

const getTagSection = (dialog: HTMLElement) => {
  const heading = within(dialog).getByText("Tags");
  const section = heading.closest("section");
  if (!section) {
    throw new Error("Tag section not found");
  }
  return section;
};

const getTagOrder = (dialog: HTMLElement) => {
  const section = getTagSection(dialog);
  return within(section)
    .getAllByRole("button")
    .map((button) => (button.textContent || "").replace("?", "").trim())
    .filter((text) => ["ISEKAI", "YURI", "MEDIEVAL"].includes(text));
};

describe("DashboardPosts tag reorder", () => {
  it("remove as setas visuais de reordenacao das tags", async () => {
    setupApiMock();

    renderSubject();

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: /Mover .* para cima/i }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /Mover .* para baixo/i }),
    ).not.toBeInTheDocument();
  });

  it("reordena tags com Alt+seta e anuncia a nova posicao", async () => {
    setupApiMock();

    renderSubject();

    const dialog = await screen.findByRole("dialog");
    const isekaiButton = within(getTagSection(dialog)).getByRole("button", { name: /Tag ISEKAI/i });

    expect(getTagOrder(dialog)).toEqual(["ISEKAI", "YURI", "MEDIEVAL"]);

    fireEvent.keyDown(isekaiButton, { key: "ArrowDown", altKey: true });

    await waitFor(() => {
      expect(getTagOrder(dialog)).toEqual(["YURI", "ISEKAI", "MEDIEVAL"]);
    });
    await waitFor(() => {
      expect(screen.getByTestId("a11y-live-region")).toHaveTextContent(
        /ISEKAI movida para a posição 2/i,
      );
    });
  });

  it("mantem reordenacao por arraste nas tags", async () => {
    setupApiMock();

    renderSubject();

    const dialog = await screen.findByRole("dialog");
    const section = getTagSection(dialog);
    const isekaiButton = within(section).getByRole("button", { name: /Tag ISEKAI/i });
    const medievalButton = within(section).getByRole("button", { name: /Tag MEDIEVAL/i });

    fireEvent.dragStart(isekaiButton);
    fireEvent.dragOver(medievalButton);
    fireEvent.drop(medievalButton);

    await waitFor(() => {
      expect(getTagOrder(dialog)).toEqual(["YURI", "MEDIEVAL", "ISEKAI"]);
    });
  });
});
