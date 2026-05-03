import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardMotionDelays } from "@/components/dashboard/dashboard-motion";
import { DashboardSessionContext } from "@/hooks/dashboard-session-context";
import DashboardWebhooks, { __testing } from "@/pages/DashboardWebhooks";

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const dismissToastMock = vi.hoisted(() => vi.fn());
const clipboardWriteTextMock = vi.hoisted(() => vi.fn());
const clipboardReadTextMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
  dismissToast: (...args: unknown[]) => dismissToastMock(...args),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const integrationUser = {
  id: "user-1",
  name: "Admin",
  username: "admin",
  avatarUrl: null,
  permissions: ["integracoes"],
  grants: { integracoes: true },
};

type TestDashboardUser = Omit<typeof integrationUser, "grants"> & {
  grants: Partial<Record<"integracoes" | "configuracoes" | "projetos", boolean>>;
};

const renderWithDashboardSession = (
  children: ReactNode,
  currentUser: TestDashboardUser | null = integrationUser,
) =>
  render(
    <DashboardSessionContext.Provider
      value={{
        hasProvider: true,
        currentUser,
        isLoading: false,
        hasResolved: true,
        refresh: async () => currentUser,
        setCurrentUser: () => undefined,
      }}
    >
      {children}
    </DashboardSessionContext.Provider>,
  );

const createDeferredResponse = () => {
  let resolve: ((value: Response) => void) | null = null;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return {
    promise,
    resolve: (value: Response) => {
      resolve?.(value);
    },
  };
};

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

const expectStableDashboardActionButton = (element: HTMLElement, sizeToken: "h-9" | "h-10") => {
  const tokens = classTokens(element);

  expect(tokens).toEqual(
    expect.arrayContaining([
      "rounded-xl",
      "bg-background",
      "font-semibold",
      "hover:bg-primary/5",
      "hover:text-foreground",
      sizeToken,
    ]),
  );
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};

const getRoundedBadgesByText = (label: string) =>
  screen
    .getAllByText(label)
    .filter((element) => String((element as HTMLElement).className || "").includes("rounded-full"));

const baseEditorialSettings = {
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
            thumbnailUrl: "{{post.imageUrl}}",
            imageUrl: "{{project.backdropImageUrl}}",
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
            thumbnailUrl: "{{post.imageUrl}}",
            imageUrl: "{{project.backdropImageUrl}}",
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
            thumbnailUrl: "{{project.imageUrl}}",
            imageUrl: "{{chapter.imageUrl}}",
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
            thumbnailUrl: "{{project.imageUrl}}",
            imageUrl: "{{chapter.imageUrl}}",
            fields: [],
          },
        },
      },
    },
  },
};

const baseSettings = {
  version: 2,
  editorial: baseEditorialSettings,
  operational: {
    enabled: true,
    provider: "discord",
    webhookUrl: "https://discord.com/api/webhooks/ops/teste",
    timeoutMs: 5000,
    intervalMs: 60000,
  },
  security: {
    enabled: true,
    provider: "discord",
    webhookUrl: "https://discord.com/api/webhooks/security/teste",
    timeoutMs: 5000,
  },
};

const baseSources = {
  editorial: "stored",
  operational: "env",
  security: "stored",
};

const defaultDeliveriesPayload = {
  items: [
    {
      id: "delivery-1",
      scope: "editorial",
      channel: "posts",
      eventKey: "post_create",
      eventLabel: "Novo post",
      status: "failed",
      provider: "discord",
      attemptCount: 2,
      maxAttempts: 3,
      createdAt: "2026-03-23T12:00:00.000Z",
      nextAttemptAt: null,
      lastAttemptAt: "2026-03-23T12:05:00.000Z",
      statusCode: 429,
      error: "rate_limited",
      targetLabel: "discord.com/api/webhooks/123/...",
      resourceIds: {
        postId: "post-1",
        projectId: "project-1",
      },
      isRetryable: true,
    },
  ],
  summary: {
    queued: 1,
    processing: 0,
    retrying: 1,
    failed: 1,
    sentLast24h: 4,
  },
  page: 1,
  limit: 25,
  total: 1,
};

const setupApiMock = ({
  meResponse,
  testResponse,
  putResponse,
  deliveriesResponse,
  retryResponse,
}: {
  meResponse?: Response;
  testResponse?: Response;
  putResponse?: Response;
  deliveriesResponse?: Response;
  retryResponse?: Response;
} = {}) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();
    if (path === "/api/me" && method === "GET") {
      return (
        meResponse ||
        mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
          permissions: ["integracoes"],
          grants: { integracoes: true },
        })
      );
    }
    if (path === "/api/integrations/webhooks" && method === "GET") {
      return mockJsonResponse(true, {
        settings: baseSettings,
        projectTypes: ["Anime", "Manga"],
        revision: "rev-1",
        sources: baseSources,
      });
    }
    if (path.startsWith("/api/integrations/webhooks/deliveries?") && method === "GET") {
      return deliveriesResponse || mockJsonResponse(true, defaultDeliveriesPayload);
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
    if (path === "/api/integrations/webhooks/operational/test" && method === "POST") {
      return mockJsonResponse(true, {
        ok: true,
        scope: "operational",
        status: "sent",
        code: null,
      });
    }
    if (path === "/api/integrations/webhooks/security/test" && method === "POST") {
      return mockJsonResponse(true, {
        ok: true,
        scope: "security",
        status: "sent",
        code: null,
      });
    }
    if (path === "/api/integrations/webhooks" && method === "PUT") {
      if (putResponse) {
        return putResponse;
      }
      const parsedBody =
        typeof options?.body === "string"
          ? (JSON.parse(options.body) as { settings?: unknown })
          : {};
      return mockJsonResponse(true, {
        settings: parsedBody.settings || baseSettings,
        projectTypes: ["Anime", "Manga"],
        revision: "rev-2",
        sources: {
          editorial: "stored",
          operational: "stored",
          security: "stored",
        },
      });
    }
    if (path === "/api/integrations/webhooks/deliveries/delivery-1/retry" && method === "POST") {
      return (
        retryResponse ||
        mockJsonResponse(true, {
          ok: true,
          delivery: {
            ...defaultDeliveriesPayload.items[0],
            id: "delivery-2",
            status: "queued",
          },
        })
      );
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
    __testing.clearEditorialSettingsCache();
    apiFetchMock.mockReset();
    toastMock.mockReset();
    toastMock.mockReturnValue("dashboard-webhooks-refresh-toast");
    dismissToastMock.mockReset();
    clipboardWriteTextMock.mockReset();
    clipboardReadTextMock.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteTextMock,
        readText: clipboardReadTextMock,
      },
    });
    (window as Window & { __BOOTSTRAP_PUBLIC_ME__?: unknown }).__BOOTSTRAP_PUBLIC_ME__ = undefined;
  });

  it("mantem shell e placeholders de secao enquanto settings carregam sem refazer /api/me com bootstrap", async () => {
    const settingsDeferred = createDeferredResponse();
    (window as Window & { __BOOTSTRAP_PUBLIC_ME__?: unknown }).__BOOTSTRAP_PUBLIC_ME__ = {
      id: "user-1",
      name: "Admin",
      username: "admin",
      avatarUrl: null,
      permissions: ["integracoes"],
      grants: { integracoes: true },
    };

    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/integrations/webhooks" && method === "GET") {
        return settingsDeferred.promise;
      }
      if (path.startsWith("/api/integrations/webhooks/deliveries?") && method === "GET") {
        return mockJsonResponse(true, defaultDeliveriesPayload);
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /Webhooks/i })).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-webhooks-section-types")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-webhooks-section-posts")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-webhooks-section-projects")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-webhooks-placeholder-types")).toBeInTheDocument();
    expect(classTokens(screen.getByTestId("dashboard-webhooks-section-types"))).toContain(
      "bg-card",
    );
    expect(
      classTokens(screen.getByTestId("dashboard-webhooks-general-role-placeholder-field")),
    ).toContain("gap-2");
    expect(screen.getByTestId("dashboard-webhooks-placeholder-posts")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-webhooks-placeholder-projects")).toBeInTheDocument();
    const placeholderTypeCard = screen
      .getByTestId("dashboard-webhooks-placeholder-types")
      .querySelector(".rounded-xl");
    expect(placeholderTypeCard).not.toBeNull();
    expect(classTokens(placeholderTypeCard as HTMLElement)).toContain("bg-background");
    expect(screen.queryByTestId("dashboard-webhooks-refresh-status")).not.toBeInTheDocument();
    expect(screen.queryByText(/Carregando webhooks/i)).not.toBeInTheDocument();
    expect(toastMock).not.toHaveBeenCalled();
    expect(
      apiFetchMock.mock.calls.some(
        (call) =>
          String(call[1] || "") === "/api/me" &&
          String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase() === "GET",
      ),
    ).toBe(false);

    settingsDeferred.resolve(
      mockJsonResponse(true, {
        settings: baseSettings,
        projectTypes: ["Anime", "Manga"],
        revision: "rev-1",
        sources: baseSources,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-webhooks-placeholder-types")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("dashboard-webhooks-section-content-types")).toBeInTheDocument();
    expect(classTokens(screen.getByTestId("dashboard-webhooks-general-role-field"))).toContain(
      "gap-2",
    );
  });

  it("reabre com cache quente e preserva o editor quando o refresh falha", async () => {
    setupApiMock();
    (window as Window & { __BOOTSTRAP_PUBLIC_ME__?: unknown }).__BOOTSTRAP_PUBLIC_ME__ = {
      id: "user-1",
      name: "Admin",
      username: "admin",
      avatarUrl: null,
      permissions: ["integracoes"],
      grants: { integracoes: true },
    };

    const firstRender = renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByText(/Role geral de lan/i);
    firstRender.unmount();

    const refreshDeferred = createDeferredResponse();
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (path === "/api/integrations/webhooks" && method === "GET") {
        return refreshDeferred.promise;
      }
      if (path.startsWith("/api/integrations/webhooks/deliveries?") && method === "GET") {
        return mockJsonResponse(true, defaultDeliveriesPayload);
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Role geral de lan/i)).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-webhooks-placeholder-types")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-webhooks-refresh-status")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Atualizando Webhooks",
          intent: "info",
        }),
      );
    });

    refreshDeferred.resolve(mockJsonResponse(false, { error: "load_failed" }, 500));

    await waitFor(() => {
      expect(screen.getByText(/Mantendo os últimos dados carregados/i)).toBeInTheDocument();
    });
    expect(dismissToastMock).toHaveBeenCalledWith("dashboard-webhooks-refresh-toast");
    expect(screen.getByText(/Role geral de lan/i)).toBeInTheDocument();
    expect(screen.queryByText(/Falha ao carregar/i)).not.toBeInTheDocument();
  });

  it("inicia com accordion principal aberto, internos colapsados e organiza o editor na ordem esperada", async () => {
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });
    await screen.findByText(/Role geral de lan/i);

    const saveAllButton = screen.getByRole("button", { name: /^Salvar$/i });
    const saveTypesButton = screen.getByRole("button", {
      name: /Salvar tipos e men/i,
    });
    const savePostsButton = screen.getByRole("button", {
      name: /Salvar posts/i,
    });
    const saveProjectsButton = screen.getByRole("button", {
      name: /Salvar projetos/i,
    });
    const saveOperationalButton = screen.getByRole("button", {
      name: /Salvar alertas operacionais/i,
    });
    const saveSecurityButton = screen.getByRole("button", {
      name: /Salvar seguran/i,
    });

    expectStableDashboardActionButton(saveAllButton, "h-10");
    expectStableDashboardActionButton(saveTypesButton, "h-9");
    expectStableDashboardActionButton(savePostsButton, "h-9");
    expectStableDashboardActionButton(saveProjectsButton, "h-9");
    expectStableDashboardActionButton(saveOperationalButton, "h-9");
    expectStableDashboardActionButton(saveSecurityButton, "h-9");

    expect(screen.queryByText(/^Ativa$/i)).not.toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("ID do cargo do Discord").length).toBeGreaterThan(0);

    expect(screen.queryByText(/Conte.*da mensagem/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Novo post/i }));

    await waitFor(() => {
      expect(screen.getByText(/Conte.*da mensagem/i)).toBeInTheDocument();
    });

    const postCreateSection = screen.getByTestId("dashboard-webhooks-event-posts-post_create");
    expectStableDashboardActionButton(
      within(postCreateSection).getByRole("button", { name: /Enviar teste/i }),
      "h-9",
    );
    expectStableDashboardActionButton(
      within(postCreateSection).getByRole("button", {
        name: /Adicionar campo/i,
      }),
      "h-9",
    );

    expect(screen.getByDisplayValue("{{postagem.imagemUrl}}")).toBeInTheDocument();
    expect(screen.getByDisplayValue("{{projeto.fundoImagemUrl}}")).toBeInTheDocument();

    expect(screen.getByText(/^#[0-9A-F]{6}$/i)).toBeInTheDocument();
    expect(screen.getByText("{{mencao.tipo}}")).toBeInTheDocument();
    expect(screen.getByText("{{mencao.lancamento}}")).toBeInTheDocument();
    expect(screen.getByText("{{mencao.tipo}}")).toHaveAttribute(
      "title",
      "Mostra a menção do cargo configurado para o tipo do projeto. Ex.: <@&123456789>.",
    );
    expect(screen.getByText("{{postagem.imagemUrl}}")).toHaveAttribute(
      "title",
      "Mostra a melhor imagem disponível para a postagem. Ex.: capa, OG ou imagem padrão.",
    );
    expect(screen.getByText("{{postagem.ogImagemUrl}}")).toBeInTheDocument();
    expect(screen.getByText("{{projeto.fundoImagemUrl}}")).toBeInTheDocument();
    expect(screen.queryByText("{{mention.category}}")).not.toBeInTheDocument();
    expect(screen.queryByText("{{mention.general}}")).not.toBeInTheDocument();

    expectBefore(/Conte.*da mensagem/i, /Autor e miniatura/i);
    expectBefore(/Autor e miniatura/i, /URL da embed/i);
    expectBefore(/URL da embed/i, /Descri/i);
    expectBefore(/Descri/i, /Campos da embed/i);
    expectBefore(/Campos da embed/i, /URL da imagem/i);
    expectBefore(/URL da imagem/i, /Rodap/i);
    expectBefore(/Rodap/i, /Cor da embed/i);

    fireEvent.click(screen.getByRole("button", { name: /Novo lan/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("{{projeto.imagemUrl}}")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("{{conteudo.imagemUrl}}")).toBeInTheDocument();
    expect(screen.getAllByText("{{projeto.imagemUrl}}").length).toBeGreaterThan(0);
    expect(screen.getAllByText("{{projeto.ogImagemUrl}}").length).toBeGreaterThan(0);
    expect(screen.getAllByText("{{conteudo.imagemUrl}}").length).toBeGreaterThan(0);
    expect(screen.getAllByText("{{conteudo.ogImagemUrl}}").length).toBeGreaterThan(0);
    expect(screen.getByText("{{conteudo.tipo}}")).toHaveAttribute(
      "title",
      "Mostra Capítulo, Episódio, Extra ou Especial conforme o conteúdo. Ex.: Capítulo.",
    );
  });

  it("permite carregar a página com grant de integrações", async () => {
    setupApiMock({
      meResponse: mockJsonResponse(true, {
        id: "user-1",
        name: "Admin",
        username: "admin",
        grants: {
          posts: false,
          projetos: false,
          comentarios: false,
          paginas: false,
          uploads: false,
          analytics: false,
          usuarios: false,
          configuracoes: false,
          audit_log: false,
          integracoes: true,
        },
      }),
    });

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });
    expect(screen.queryByText(/Acesso negado/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Role geral de lan/i)).toBeInTheDocument();
  });

  it("bloqueia a página com apenas configurações ou projetos", async () => {
    for (const grants of [{ configuracoes: true }, { projetos: true }]) {
      apiFetchMock.mockReset();
      setupApiMock({
        meResponse: mockJsonResponse(true, {
          id: "user-1",
          name: "Admin",
          username: "admin",
          grants,
        }),
      });

      const view = renderWithDashboardSession(
        <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
          <DashboardWebhooks />
        </MemoryRouter>,
        { ...integrationUser, grants } as TestDashboardUser,
      );

      expect(await screen.findByText(/Acesso negado/i)).toBeInTheDocument();
      view.unmount();
    }
  });

  it("nao aplica reveal no section raiz e preserva o reveal proprio do badge", async () => {
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    const heading = await screen.findByRole("heading", { name: /Webhooks/i });
    await screen.findByText(/Role geral de lan/i);

    const rootSection = heading.closest("section");
    const headerBadge = screen.getByText(/Integra/i);
    const headerBadgeReveal = headerBadge.parentElement;
    const typesSection = screen.getByTestId("dashboard-webhooks-section-types");
    const postsSection = screen.getByTestId("dashboard-webhooks-section-posts");

    expect(rootSection).not.toBeNull();
    expect(classTokens(rootSection as HTMLElement)).not.toContain("reveal");
    expect(rootSection).not.toHaveAttribute("data-reveal");

    expect(headerBadgeReveal).not.toBeNull();
    expect(classTokens(headerBadgeReveal as HTMLElement)).toContain("reveal");
    expect(classTokens(headerBadgeReveal as HTMLElement)).toContain("reveal-delay-1");
    expect(headerBadgeReveal).toHaveAttribute("data-reveal");

    expect(classTokens(typesSection)).toContain("animate-slide-up");
    expect(classTokens(typesSection)).toContain("opacity-0");
    expect(classTokens(postsSection)).toContain("animate-slide-up");
    expect(classTokens(postsSection)).toContain("opacity-0");
  });

  it("aplica motion ao shell principal sem reanimar blocos internos em refresh de dados", async () => {
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });
    await screen.findByText(/Role geral de lan/i);

    const typesSection = screen.getByTestId("dashboard-webhooks-section-types");
    const postsSection = screen.getByTestId("dashboard-webhooks-section-posts");
    const typesContent = screen.getByTestId("dashboard-webhooks-section-content-types");
    const postsContent = screen.getByTestId("dashboard-webhooks-section-content-posts");
    const eventItem = screen.getByTestId("dashboard-webhooks-event-posts-post_create");

    expect(classTokens(typesSection)).toContain("animate-slide-up");
    expect(classTokens(typesSection)).toContain("opacity-0");
    expect(classTokens(postsSection)).toContain("animate-slide-up");
    expect(classTokens(typesContent)).not.toContain("animate-slide-up");
    expect(classTokens(postsContent)).not.toContain("animate-slide-up");
    expect(classTokens(eventItem)).not.toContain("animate-slide-up");
    expect(typesSection).toHaveStyle({ animationDelay: "0ms" });
    expect(postsSection).toHaveStyle({
      animationDelay: `${dashboardMotionDelays.sectionStepMs}ms`,
    });

    fireEvent.click(screen.getByRole("button", { name: /Novo post/i }));

    await waitFor(() => {
      expect(
        screen.getByTestId("dashboard-webhooks-event-content-posts-post_create"),
      ).toBeInTheDocument();
    });

    expect(
      classTokens(screen.getByTestId("dashboard-webhooks-event-content-posts-post_create")),
    ).not.toContain("animate-slide-up");
  });

  it("salva apenas a secao de posts e mantem rascunhos das outras secoes", async () => {
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });

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
        return path === "/api/integrations/webhooks" && method === "PUT";
      });
      expect(putCalls).toHaveLength(1);
    });

    const putCall = apiFetchMock.mock.calls.find((call) => {
      const path = String(call[1] || "");
      const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
      return path === "/api/integrations/webhooks" && method === "PUT";
    });

    const requestPayload =
      (
        putCall?.[2] as
          | {
              json?: { settings?: typeof baseSettings; ifRevision?: string };
            }
          | undefined
      )?.json || {};
    const payload = requestPayload.settings;

    expect(payload?.editorial?.channels?.posts?.webhookUrl).toBe(
      "https://discord.com/api/webhooks/posts/teste",
    );
    expect(payload?.editorial?.typeRoles?.[0]?.roleId || "").toBe("");
    expect(requestPayload.ifRevision).toBe("rev-1");

    expect(
      (screen.getAllByPlaceholderText("ID do cargo do Discord")[0] as HTMLInputElement).value,
    ).toBe("123456");
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

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });
    fireEvent.click(screen.getByRole("button", { name: /Novo lan/i }));
    fireEvent.click(
      within(screen.getByTestId("dashboard-webhooks-event-projects-project_release")).getByRole(
        "button",
        { name: /Enviar teste/i },
      ),
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Teste falhou",
          description: "Invalid Form Body",
        }),
      );
    });
  });

  it("envia o rascunho atual no teste manual", async () => {
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });

    const webhookInputs = screen.getAllByPlaceholderText("https://discord.com/api/webhooks/...");
    fireEvent.change(webhookInputs[0], {
      target: { value: "https://discord.com/api/webhooks/posts/draft-token" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Novo post/i }));
    fireEvent.change(screen.getByDisplayValue("{{mencao.todos}}"), {
      target: { value: "rascunho local" },
    });
    fireEvent.click(
      within(screen.getByTestId("dashboard-webhooks-event-posts-post_create")).getByRole("button", {
        name: /Enviar teste/i,
      }),
    );

    await waitFor(() => {
      const testCalls = apiFetchMock.mock.calls.filter((call) => {
        const path = String(call[1] || "");
        const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
        return path === "/api/integrations/webhooks/editorial/test" && method === "POST";
      });
      expect(testCalls).toHaveLength(1);
    });

    const testCall = apiFetchMock.mock.calls.find((call) => {
      const path = String(call[1] || "");
      const method = String((call[2] as RequestInit | undefined)?.method || "GET").toUpperCase();
      return path === "/api/integrations/webhooks/editorial/test" && method === "POST";
    });
    const requestPayload =
      (testCall?.[2] as { json?: { settings?: typeof baseSettings } } | undefined)?.json || {};

    expect(requestPayload.settings?.editorial.channels.posts.webhookUrl).toBe(
      "https://discord.com/api/webhooks/posts/draft-token",
    );
    expect(requestPayload.settings?.editorial.channels.posts.templates.post_create.content).toBe(
      "rascunho local",
    );
  });

  it("copia o template editorial como JSON versionado", async () => {
    clipboardWriteTextMock.mockResolvedValue(undefined);
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });
    fireEvent.click(screen.getByRole("button", { name: /Novo post/i }));
    fireEvent.click(
      within(screen.getByTestId("dashboard-webhooks-event-posts-post_create")).getByRole("button", {
        name: /Copiar template/i,
      }),
    );

    await waitFor(() => {
      expect(clipboardWriteTextMock).toHaveBeenCalledTimes(1);
    });

    const copied = JSON.parse(String(clipboardWriteTextMock.mock.calls[0]?.[0] || "{}"));
    expect(copied).toEqual(
      expect.objectContaining({
        kind: "nekomorto.editorialWebhookTemplate",
        version: 1,
        channelKey: "posts",
        eventKey: "post_create",
      }),
    );
    expect(copied.template.content).toBe("{{mencao.todos}}");
    expect(copied.template.embed).toEqual(
      expect.objectContaining({
        title: "{{postagem.titulo}}",
        color: "#3b82f6",
      }),
    );
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Template copiado" }));
  });

  it("cola conteudo, embed, cor e campos customizados no evento atual", async () => {
    clipboardReadTextMock.mockResolvedValue(
      JSON.stringify({
        kind: "nekomorto.editorialWebhookTemplate",
        version: 1,
        channelKey: "posts",
        eventKey: "post_create",
        template: {
          content: "conteudo colado",
          embed: {
            title: "Titulo colado",
            description: "Descricao colada",
            footerText: "Rodape colado",
            footerIconUrl: "https://cdn.local/footer.png",
            url: "https://nekomorto.local/post",
            color: "abc123",
            authorName: "Autor colado",
            authorIconUrl: "https://cdn.local/author.png",
            authorUrl: "https://nekomorto.local/autor",
            thumbnailUrl: "https://cdn.local/thumb.png",
            imageUrl: "https://cdn.local/image.png",
            fields: [{ name: "Campo", value: "Valor", inline: true }],
          },
        },
      }),
    );
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });
    fireEvent.click(screen.getByRole("button", { name: /Novo post/i }));
    fireEvent.click(
      within(screen.getByTestId("dashboard-webhooks-event-posts-post_create")).getByRole("button", {
        name: /Colar template/i,
      }),
    );

    expect(await screen.findByDisplayValue("conteudo colado")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Titulo colado")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Descricao colada")).toBeInTheDocument();
    expect(screen.getByText("#ABC123")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Campo")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Valor")).toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Template colado" }));
  });

  it("cola template de outro evento e mostra aviso", async () => {
    clipboardReadTextMock.mockResolvedValue(
      JSON.stringify({
        kind: "nekomorto.editorialWebhookTemplate",
        version: 1,
        channelKey: "projects",
        eventKey: "project_release",
        template: {
          content: "template de projeto",
          embed: {
            title: "Projeto colado",
            description: "",
            footerText: "",
            footerIconUrl: "",
            url: "",
            color: "#10b981",
            authorName: "",
            authorIconUrl: "",
            authorUrl: "",
            thumbnailUrl: "",
            imageUrl: "",
            fields: [],
          },
        },
      }),
    );
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });
    fireEvent.click(screen.getByRole("button", { name: /Novo post/i }));
    fireEvent.click(
      within(screen.getByTestId("dashboard-webhooks-event-posts-post_create")).getByRole("button", {
        name: /Colar template/i,
      }),
    );

    expect(await screen.findByDisplayValue("template de projeto")).toBeInTheDocument();
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Template colado com aviso",
        description: "Template colado de outro evento; revise os placeholders antes de salvar.",
      }),
    );
  });

  it("nao altera o template quando o JSON colado e invalido", async () => {
    clipboardReadTextMock.mockResolvedValue("{json invalido");
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });
    fireEvent.click(screen.getByRole("button", { name: /Novo post/i }));
    const eventPanel = screen.getByTestId("dashboard-webhooks-event-content-posts-post_create");
    const contentInput = within(eventPanel).getByDisplayValue("{{mencao.todos}}");
    fireEvent.click(
      within(screen.getByTestId("dashboard-webhooks-event-posts-post_create")).getByRole("button", {
        name: /Colar template/i,
      }),
    );

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Template inválido" }),
      );
    });
    expect(contentInput).toHaveValue("{{mencao.todos}}");
  });

  it("converte aliases antigos ao colar template", async () => {
    clipboardReadTextMock.mockResolvedValue(
      JSON.stringify({
        kind: "nekomorto.editorialWebhookTemplate",
        version: 1,
        channelKey: "posts",
        eventKey: "post_create",
        template: {
          content: "{{mention.all}}",
          embed: {
            title: "{{post.title}}",
            description: "{{post.excerpt}}",
            footerText: "{{site.name}}",
            footerIconUrl: "",
            url: "{{post.url}}",
            color: "#3b82f6",
            authorName: "{{author.name}}",
            authorIconUrl: "{{author.avatarUrl}}",
            authorUrl: "{{site.url}}",
            thumbnailUrl: "{{post.imageUrl}}",
            imageUrl: "",
            fields: [{ name: "Resumo", value: "{{post.excerpt}}", inline: false }],
          },
        },
      }),
    );
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });
    fireEvent.click(screen.getByRole("button", { name: /Novo post/i }));
    fireEvent.click(
      within(screen.getByTestId("dashboard-webhooks-event-posts-post_create")).getByRole("button", {
        name: /Colar template/i,
      }),
    );

    expect(await screen.findByDisplayValue("{{mencao.todos}}")).toBeInTheDocument();
    expect(screen.getByDisplayValue("{{postagem.titulo}}")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("{{postagem.resumo}}").length).toBeGreaterThan(0);
  });

  it("renderiza a toolbar de template no evento aberto", async () => {
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });
    fireEvent.click(screen.getByRole("button", { name: /Novo post/i }));

    const eventCard = screen.getByTestId("dashboard-webhooks-event-posts-post_create");
    expect(within(eventCard).getByRole("button", { name: /Copiar template/i })).toBeInTheDocument();
    expect(within(eventCard).getByRole("button", { name: /Colar template/i })).toBeInTheDocument();
    expect(within(eventCard).getByRole("button", { name: /Enviar teste/i })).toBeInTheDocument();
  });

  it("preserva o rascunho local quando o save encontra conflito de revisao", async () => {
    setupApiMock({
      putResponse: mockJsonResponse(
        false,
        {
          error: "edit_conflict",
          currentRevision: "rev-2",
          projectTypes: ["Anime", "Manga"],
          sources: baseSources,
          settings: {
            ...baseSettings,
            editorial: {
              ...baseEditorialSettings,
              generalReleaseRoleId: "999",
            },
          },
        },
        409,
      ),
    });

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });

    const roleInput = screen.getAllByPlaceholderText("ID do cargo do Discord")[0];
    fireEvent.change(roleInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/i }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Configuração desatualizada",
        }),
      );
    });

    expect(
      (screen.getAllByPlaceholderText("ID do cargo do Discord")[0] as HTMLInputElement).value,
    ).toBe("123456");
  });

  it("envia os testes de alertas operacionais e segurança com o rascunho atual", async () => {
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /Webhooks/i });

    const operationalSection = screen.getByTestId("dashboard-webhooks-section-content-operational");
    const securitySection = screen.getByTestId("dashboard-webhooks-section-content-security");
    const operationalWebhookInput = within(operationalSection).getByPlaceholderText(
      "https://discord.com/api/webhooks/...",
    );
    const securityWebhookInput = within(securitySection).getByPlaceholderText(
      "https://discord.com/api/webhooks/...",
    );

    fireEvent.change(operationalWebhookInput, {
      target: { value: "https://discord.com/api/webhooks/ops/draft-token" },
    });
    fireEvent.change(securityWebhookInput, {
      target: {
        value: "https://discord.com/api/webhooks/security/draft-token",
      },
    });

    fireEvent.click(within(operationalSection).getByRole("button", { name: /Enviar teste/i }));
    fireEvent.click(within(securitySection).getByRole("button", { name: /Enviar teste/i }));

    await waitFor(() => {
      const operationalCall = apiFetchMock.mock.calls.find(
        (call) => String(call[1] || "") === "/api/integrations/webhooks/operational/test",
      );
      const securityCall = apiFetchMock.mock.calls.find(
        (call) => String(call[1] || "") === "/api/integrations/webhooks/security/test",
      );

      expect(operationalCall).toBeDefined();
      expect(securityCall).toBeDefined();
      expect(
        (operationalCall?.[2] as { json?: { settings?: typeof baseSettings } } | undefined)?.json
          ?.settings?.operational?.webhookUrl || "",
      ).toBe("https://discord.com/api/webhooks/ops/draft-token");
      expect(
        (securityCall?.[2] as { json?: { settings?: typeof baseSettings } } | undefined)?.json
          ?.settings?.security?.webhookUrl || "",
      ).toBe("https://discord.com/api/webhooks/security/draft-token");
    });
  });

  it("mostra entregas persistidas e permite reenfileirar uma falha", async () => {
    setupApiMock();

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByTestId("dashboard-webhooks-section-deliveries");
    await screen.findByTestId("dashboard-webhooks-deliveries-list");
    const summaryGrid = screen.getByTestId("dashboard-webhooks-delivery-summary-grid");

    expect(classTokens(summaryGrid)).toContain("grid");
    expect(classTokens(summaryGrid)).toContain("md:grid-cols-2");
    expect(classTokens(summaryGrid)).toContain("lg:grid-cols-3");
    expect(classTokens(summaryGrid)).toContain("xl:grid-cols-5");
    expect(
      within(summaryGrid).getByTestId("dashboard-webhooks-delivery-summary-card-queued"),
    ).toBeInTheDocument();
    expect(
      within(summaryGrid).getByTestId("dashboard-webhooks-delivery-summary-card-processing"),
    ).toBeInTheDocument();
    expect(
      within(summaryGrid).getByTestId("dashboard-webhooks-delivery-summary-card-retrying"),
    ).toBeInTheDocument();
    expect(
      within(summaryGrid).getByTestId("dashboard-webhooks-delivery-summary-card-failed"),
    ).toBeInTheDocument();
    expect(
      within(summaryGrid).getByTestId("dashboard-webhooks-delivery-summary-card-sent_last_24h"),
    ).toBeInTheDocument();
    expect(within(summaryGrid).getByText("Na fila")).toBeInTheDocument();
    expect(within(summaryGrid).getByText("Processando")).toBeInTheDocument();
    expect(within(summaryGrid).getByText("Reagendado")).toBeInTheDocument();
    expect(within(summaryGrid).getByText("Falhas")).toBeInTheDocument();
    expect(within(summaryGrid).getByText("Enviados 24h")).toBeInTheDocument();

    expect(screen.getByText("discord.com/api/webhooks/123/...")).toBeInTheDocument();
    expect(screen.getByText(/rate_limited/i)).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /Reenfileirar/i });
    expectStableDashboardActionButton(retryButton, "h-9");
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "http://api.local",
        "/api/integrations/webhooks/deliveries/delivery-1/retry",
        expect.objectContaining({
          method: "POST",
          auth: true,
        }),
      );
    });

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Entrega reenfileirada",
        }),
      );
    });
  });

  it("usa variantes semanticas para os badges de status das entregas", async () => {
    setupApiMock({
      deliveriesResponse: mockJsonResponse(true, {
        ...defaultDeliveriesPayload,
        items: [
          {
            ...defaultDeliveriesPayload.items[0],
            id: "delivery-queued",
            status: "queued",
            error: "",
            statusCode: null,
            isRetryable: false,
          },
          {
            ...defaultDeliveriesPayload.items[0],
            id: "delivery-processing",
            status: "processing",
            error: "",
            statusCode: null,
            isRetryable: false,
          },
          {
            ...defaultDeliveriesPayload.items[0],
            id: "delivery-sent",
            status: "sent",
            error: "",
            statusCode: 200,
            isRetryable: false,
          },
          {
            ...defaultDeliveriesPayload.items[0],
            id: "delivery-failed",
            status: "failed",
          },
        ],
        total: 4,
      }),
    });

    renderWithDashboardSession(
      <MemoryRouter initialEntries={["/dashboard/webhooks"]}>
        <DashboardWebhooks />
      </MemoryRouter>,
    );

    await screen.findByTestId("dashboard-webhooks-deliveries-list");

    expect(getRoundedBadgesByText("Na fila")[0]).toHaveClass(
      "border-[hsl(var(--badge-neutral-border))]",
      "bg-[hsl(var(--badge-neutral-bg))]",
      "text-[hsl(var(--badge-neutral-fg))]",
    );
    expect(getRoundedBadgesByText("Processando")[0]).toHaveClass(
      "border-[hsl(var(--badge-warning-border))]",
      "bg-[hsl(var(--badge-warning-bg))]",
      "text-[hsl(var(--badge-warning-fg))]",
    );
    expect(getRoundedBadgesByText("Enviado")[0]).toHaveClass(
      "border-[hsl(var(--badge-success-border))]",
      "bg-[hsl(var(--badge-success-bg))]",
      "text-[hsl(var(--badge-success-fg))]",
    );
    expect(getRoundedBadgesByText("Falhou")[0]).toHaveClass(
      "border-[hsl(var(--badge-danger-border))]",
      "bg-[hsl(var(--badge-danger-bg))]",
      "text-[hsl(var(--badge-danger-fg))]",
    );
  });
});
