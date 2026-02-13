import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import DashboardPosts from "@/pages/DashboardPosts";

const { apiFetchMock, imageLibraryPropsSpy, lexicalPropsSpy } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  imageLibraryPropsSpy: vi.fn(),
  lexicalPropsSpy: vi.fn(),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageContainer", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  default: ({
    title,
    actions,
  }: {
    title: string;
    actions?: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: (props: unknown) => {
    imageLibraryPropsSpy(props);
    return <div data-testid="image-library-dialog" />;
  },
}));

vi.mock("@/components/ProjectEmbedCard", () => ({
  default: () => null,
}));

vi.mock("@/components/lexical/LexicalEditor", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const MockEditor = React.forwardRef((props: unknown, ref: React.ForwardedRef<{ blur: () => void }>) => {
    lexicalPropsSpy(props);
    React.useImperativeHandle(ref, () => ({ blur: () => undefined }));
    return <div data-testid="lexical-editor" />;
  });
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

const setupApiMock = (config?: { posts?: Array<Record<string, unknown>> }) => {
  apiFetchMock.mockReset();
  imageLibraryPropsSpy.mockReset();
  lexicalPropsSpy.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/posts" && method === "GET") {
      return mockJsonResponse(true, {
        posts: config?.posts ?? [],
      });
    }
    if (path === "/api/users" && method === "GET") {
      return mockJsonResponse(true, {
        users: [{ id: "user-1", permissions: ["posts"] }],
        ownerIds: [],
      });
    }
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, { id: "user-1", name: "Admin", username: "admin" });
    }
    if (path === "/api/projects" && method === "GET") {
      return mockJsonResponse(true, {
        projects: [{ id: "project-1", title: "Projeto 1", tags: [] }],
      });
    }
    if (path === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("DashboardPosts image library context", () => {
  it("passa contexto de pasta de posts para biblioteca e editor lexical", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardPosts />
      </MemoryRouter>,
    );

    const newPostButton = await screen.findByRole("button", { name: "Nova postagem" });
    fireEvent.click(newPostButton);

    await screen.findByRole("heading", { name: "Nova postagem" });
    await waitFor(() => {
      expect(lexicalPropsSpy).toHaveBeenCalled();
    });

    const lexicalProps = lexicalPropsSpy.mock.calls.at(-1)?.[0] as {
      imageLibraryOptions?: {
        uploadFolder?: string;
        listFolders?: string[];
        listAll?: boolean;
        includeProjectImages?: boolean;
        projectImageProjectIds?: string[];
        projectImagesView?: "flat" | "by-project";
        currentSelectionUrls?: string[];
      };
    };
    expect(lexicalProps.imageLibraryOptions).toEqual({
      uploadFolder: "posts",
      listFolders: ["posts", "shared"],
      listAll: false,
      includeProjectImages: true,
      projectImageProjectIds: [],
      projectImagesView: "by-project",
      currentSelectionUrls: [],
    });

    const imageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      uploadFolder?: string;
      listFolders?: string[];
      listAll?: boolean;
      includeProjectImages?: boolean;
      projectImageProjectIds?: string[];
    };
    expect(imageLibraryProps.uploadFolder).toBe("posts");
    expect(imageLibraryProps.listFolders).toEqual(["posts", "shared"]);
    expect(imageLibraryProps.listAll).toBe(false);
    expect(imageLibraryProps.includeProjectImages).toBe(true);
    expect(imageLibraryProps.projectImageProjectIds).toEqual([]);
  });

  it("mantem listFolders fixo em posts/shared mesmo quando a capa vem de pasta de projeto", async () => {
    setupApiMock({
      posts: [
        {
          id: "post-1",
          title: "Post com capa derivada",
          slug: "post-com-capa-derivada",
          coverImageUrl: null,
          coverAlt: "",
          excerpt: "Resumo",
          content: JSON.stringify({
            root: {
              type: "root",
              version: 1,
              children: [
                {
                  type: "paragraph",
                  version: 1,
                  children: [{ type: "text", version: 1, text: "Conteudo" }],
                },
                {
                  type: "image",
                  version: 1,
                  src: "/uploads/projects/project-1/capa.png",
                  altText: "Capa derivada",
                },
              ],
            },
          }),
          contentFormat: "lexical",
          author: "Admin",
          publishedAt: "2026-02-10T12:00:00.000Z",
          status: "published",
          projectId: "",
          tags: [],
          views: 0,
          commentsCount: 0,
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/posts"]}>
        <DashboardPosts />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("Post com capa derivada"));
    await screen.findByRole("heading", { name: "Editar postagem" });

    await waitFor(() => {
      expect(lexicalPropsSpy).toHaveBeenCalled();
      expect(imageLibraryPropsSpy).toHaveBeenCalled();
    });

    const lexicalProps = lexicalPropsSpy.mock.calls.at(-1)?.[0] as {
      imageLibraryOptions?: {
        listFolders?: string[];
        projectImagesView?: "flat" | "by-project";
        currentSelectionUrls?: string[];
      };
    };
    expect(lexicalProps.imageLibraryOptions?.listFolders).toEqual(["posts", "shared"]);
    expect(lexicalProps.imageLibraryOptions?.projectImagesView).toBe("by-project");
    expect(lexicalProps.imageLibraryOptions?.currentSelectionUrls).toEqual([
      "/uploads/projects/project-1/capa.png",
    ]);

    const imageLibraryProps = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      listFolders?: string[];
    };
    expect(imageLibraryProps.listFolders).toEqual(["posts", "shared"]);
  });
});
