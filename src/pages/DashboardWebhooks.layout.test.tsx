import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardWebhooks from "@/pages/DashboardWebhooks";

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;
const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

const baseSettings = {
  version: 1,
  mentionMode: "role_id",
  mentionFallback: "skip",
  generalReleaseRoleId: "",
  typeRoles: [
    { type: "Anime", roleId: "", enabled: true, order: 0 },
    { type: "Manga", roleId: "", enabled: true, order: 1 },
  ],
  channels: {
    posts: {
      enabled: false,
      webhookUrl: "",
      timeoutMs: 5000,
      retries: 1,
      events: { post_create: true, post_update: true },
      templates: {
        post_create: {
          content: "{{mention.all}}",
          embed: {
            title: "{{post.title}}",
            description: "{{post.excerpt}}",
            footerText: "{{site.name}}",
            footerIconUrl: "{{site.logoUrl}}",
            url: "{{post.url}}",
            color: "#3b82f6",
            authorName: "{{author.name}}",
            authorIconUrl: "{{author.avatarUrl}}",
            authorUrl: "{{site.url}}",
            thumbnailUrl: "{{post.coverImageUrl}}",
            imageUrl: "{{project.banner}}",
            fields: [],
          },
        },
        post_update: {
          content: "{{mention.all}}",
          embed: {
            title: "{{post.title}}",
            description: "{{post.excerpt}}",
            footerText: "{{site.name}}",
            footerIconUrl: "{{site.logoUrl}}",
            url: "{{post.url}}",
            color: "#f59e0b",
            authorName: "{{author.name}}",
            authorIconUrl: "{{author.avatarUrl}}",
            authorUrl: "{{site.url}}",
            thumbnailUrl: "{{post.coverImageUrl}}",
            imageUrl: "{{project.banner}}",
            fields: [],
          },
        },
      },
    },
    projects: {
      enabled: false,
      webhookUrl: "",
      timeoutMs: 5000,
      retries: 1,
      events: { project_release: true, project_adjust: true },
      templates: {
        project_release: {
          content: "{{mention.all}}",
          embed: {
            title: "{{project.title}}",
            description: "{{update.reason}}",
            footerText: "{{site.name}}",
            footerIconUrl: "{{site.logoUrl}}",
            url: "{{project.url}}",
            color: "#10b981",
            authorName: "{{event.label}}",
            authorIconUrl: "{{site.logoUrl}}",
            authorUrl: "{{site.url}}",
            thumbnailUrl: "{{project.cover}}",
            imageUrl: "{{project.banner}}",
            fields: [],
          },
        },
        project_adjust: {
          content: "{{mention.all}}",
          embed: {
            title: "{{project.title}}",
            description: "{{update.reason}}",
            footerText: "{{site.name}}",
            footerIconUrl: "{{site.logoUrl}}",
            url: "{{project.url}}",
            color: "#f59e0b",
            authorName: "{{event.label}}",
            authorIconUrl: "{{site.logoUrl}}",
            authorUrl: "{{site.url}}",
            thumbnailUrl: "{{project.cover}}",
            imageUrl: "{{project.banner}}",
            fields: [],
          },
        },
      },
    },
  },
};

const setupApiMock = ({
  testResponse,
  putResponse,
}: { testResponse?: Response; putResponse?: Response } = {}) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return mockJsonResponse(true, {
        id: "user-1",
        name: "Admin",
        username: "admin",
        permissions: ["integracoes"],
      });
    }
    if (path === "/api/integrations/webhooks/editorial" && method === "GET") {
      return mockJsonResponse(true, {
        settings: baseSettings,
        projectTypes: ["Anime", "Manga"],
      });
    }
    if (path === "/api/integrations/webhooks/editorial/test" && method === "POST") {
      return (
        testResponse ||
        mockJsonResponse(true, {
          ok: true,
          eventKey: "post_create",
          channel: "posts",
          status: "sent",
          code: null,
        })
      );
    }
    if (path === "/api/integrations/webhooks/editorial" && method === "PUT") {
      if (putResponse) {
        return putResponse;
      }
      const parsedBody =
        typeof options?.body === "string" ? (JSON.parse(options.body) as { settings?: unknown }) : {};
      return mockJsonResponse(true, {
        settings: parsedBody.settings || baseSettings,
        projectTypes: ["Anime", "Manga"],
      });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

const expectBefore = (a: string | RegExp, b: string | RegExp) => {
  const first = screen.getAllByText(a)[0];
  const second = screen.getAllByText(b)[0];
  const relation = first.compareDocumentPosition(second);
  expect((relation & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
};

describe("DashboardWebhooks layout", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
  });

  it("inicia com accordion principal aberto, internos colapsados e organiza o editor na ordem esperada", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks editoriais/i });
    await screen.findByText(/Role geral de lan/i);

    expect(screen.getByRole("button", { name: /^Salvar$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar tipos e men/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar posts/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar projetos/i })).toBeInTheDocument();

    expect(screen.queryByText(/^Ativa$/i)).not.toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("ID do cargo do Discord").length).toBeGreaterThan(0);

    expect(screen.queryByText(/Conte.*da mensagem/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Novo post/i }));

    await waitFor(() => {
      expect(screen.getByText(/Conte.*da mensagem/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/^#[0-9A-F]{6}$/i)).toBeInTheDocument();
    expect(screen.getByText("{{mention.type}}")).toBeInTheDocument();
    expect(screen.getByText("{{mention.release}}")).toBeInTheDocument();
    expect(screen.queryByText("{{mention.category}}")).not.toBeInTheDocument();
    expect(screen.queryByText("{{mention.general}}")).not.toBeInTheDocument();

    expectBefore(/Conte.*da mensagem/i, /Autor e miniatura/i);
    expectBefore(/Autor e miniatura/i, /URL da embed/i);
    expectBefore(/URL da embed/i, /Descri/i);
    expectBefore(/Descri/i, /Campos da embed/i);
    expectBefore(/Campos da embed/i, /URL da imagem/i);
    expectBefore(/URL da imagem/i, /Rodap/i);
    expectBefore(/Rodap/i, /Cor da embed/i);
  });

  it("aplica motion aos accordions principais e aos blocos internos", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks editoriais/i });
    await screen.findByText(/Role geral de lan/i);

    const typesSection = screen.getByTestId("dashboard-webhooks-section-types");
    const postsSection = screen.getByTestId("dashboard-webhooks-section-posts");
    const typesContent = screen.getByTestId("dashboard-webhooks-section-content-types");
    const postsContent = screen.getByTestId("dashboard-webhooks-section-content-posts");
    const eventItem = screen.getByTestId("dashboard-webhooks-event-posts-post_create");

    expect(classTokens(typesSection)).toContain("animate-slide-up");
    expect(classTokens(typesSection)).toContain("opacity-0");
    expect(classTokens(postsSection)).toContain("animate-slide-up");
    expect(classTokens(typesContent)).toContain("animate-slide-up");
    expect(classTokens(postsContent)).toContain("animate-slide-up");
    expect(classTokens(eventItem)).toContain("animate-slide-up");

    fireEvent.click(screen.getByRole("button", { name: /Novo post/i }));

    await waitFor(() => {
      expect(
        screen.getByTestId("dashboard-webhooks-event-content-posts-post_create"),
      ).toBeInTheDocument();
    });

    expect(
      classTokens(screen.getByTestId("dashboard-webhooks-event-content-posts-post_create")),
    ).toContain("animate-slide-up");
  });

  it("salva apenas a secao de posts e mantem rascunhos das outras secoes", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks editoriais/i });

    const roleInputs = screen.getAllByPlaceholderText("ID do cargo do Discord");
    fireEvent.change(roleInputs[0], { target: { value: "123456" } });

    const webhookInputs = screen.getAllByPlaceholderText("https://discord.com/api/webhooks/...");
    fireEvent.change(webhookInputs[0], {
      target: { value: "https://discord.com/api/webhooks/posts/teste" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Salvar posts/i }));

    await waitFor(() => {
      const putCalls = apiFetchMock.mock.calls.filter((call) => {
        const path = String(call[1] || "");
        const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
        return path === "/api/integrations/webhooks/editorial" && method === "PUT";
      });
      expect(putCalls).toHaveLength(1);
    });

    const putCall = apiFetchMock.mock.calls.find((call) => {
      const path = String(call[1] || "");
      const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
      return path === "/api/integrations/webhooks/editorial" && method === "PUT";
    });

    const payload = ((putCall?.[2] as { json?: { settings?: typeof baseSettings } } | undefined)?.json || {})
      .settings;

    expect(payload?.channels?.posts?.webhookUrl).toBe("https://discord.com/api/webhooks/posts/teste");
    expect(payload?.typeRoles?.[0]?.roleId || "").toBe("");

    expect((screen.getAllByPlaceholderText("ID do cargo do Discord")[0] as HTMLInputElement).value).toBe(
      "123456",
    );
  });

  it("mostra errorDetail no toast quando o teste falha", async () => {
    setupApiMock({
      testResponse: mockJsonResponse(true, {
        ok: false,
        eventKey: "project_release",
        channel: "projects",
        status: "failed",
        code: "http_error",
        error: "http_error",
        errorDetail: "Invalid Form Body",
      }),
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks editoriais/i });
    fireEvent.click(screen.getByRole("button", { name: /Novo lan/i }));
    fireEvent.click(screen.getByRole("button", { name: /Enviar teste/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Teste falhou",
          description: "Invalid Form Body",
        }),
      );
    });
  });
});
