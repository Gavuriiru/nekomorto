import { dashboardEditorDialogWidthClassName } from "@/components/dashboard/dashboard-page-tokens";
import DashboardUsers from "@/pages/DashboardUsers";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());

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

const mockJsonResponse = (
  ok: boolean,
  payload: unknown,
  status = ok ? 200 : 500,
) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const classTokens = (element: Element | null) =>
  String(element?.className || "")
    .split(/\s+/)
    .filter(Boolean);

const expectPrimaryDashboardActionButtonTokens = (
  element: HTMLElement,
  sizeToken: "h-9" | "h-10",
) => {
  const tokens = classTokens(element);

  expect(tokens).toEqual(
    expect.arrayContaining([
      "rounded-xl",
      "border-primary/70",
      "bg-primary/10",
      "hover:border-primary",
      "hover:bg-primary",
      "hover:text-primary-foreground",
      "focus-visible:text-primary-foreground",
      "text-foreground",
      "font-semibold",
      sizeToken,
    ]),
  );
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};

const expectDashboardActionButtonTokens = (
  element: HTMLElement,
  sizeToken: "h-9" | "h-10",
) => {
  const tokens = classTokens(element);

  expect(tokens).toEqual(
    expect.arrayContaining([
      "rounded-xl",
      "bg-background",
      "font-semibold",
      sizeToken,
    ]),
  );
  expect(tokens).not.toContain("interactive-lift-sm");
  expect(tokens).not.toContain("pressable");
};

void expectPrimaryDashboardActionButtonTokens;
void expectDashboardActionButtonTokens;

type TestUser = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  accessRole: string;
  permissions: string[];
  grants?: {
    usuarios?: boolean;
  };
  roles: string[];
  status: "active" | "retired";
  phrase: string;
  bio: string;
  avatarUrl: string | null;
  socials: Array<Record<string, unknown>>;
  favoriteWorks: { manga: string[]; anime: string[] };
  order: number;
  isAdmin?: boolean;
};

const defaultCurrentUser: TestUser = {
  id: "user-1",
  name: "Admin",
  username: "admin",
  email: null,
  accessRole: "owner_primary",
  permissions: ["usuarios"],
  grants: { usuarios: true },
  roles: [],
  status: "active",
  phrase: "",
  bio: "",
  avatarUrl: null,
  socials: [],
  favoriteWorks: { manga: [], anime: [] },
  order: 0,
};

const setupApiMock = ({
  currentUserGrants = {
    usuarios: true,
  },
  currentUser = defaultCurrentUser,
  users = [currentUser],
}: {
  currentUserGrants?: {
    usuarios?: boolean;
  };
  currentUser?: TestUser;
  users?: TestUser[];
} = {}) => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(
    async (_base: string, path: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();

      if (path === "/api/users" && method === "GET") {
        if (currentUserGrants.usuarios === false) {
          return mockJsonResponse(false, { error: "forbidden" }, 403);
        }
        return mockJsonResponse(true, {
          users,
          ownerIds:
            currentUser.accessRole === "owner_primary" ? [currentUser.id] : [],
          primaryOwnerId:
            currentUser.accessRole === "owner_primary" ? currentUser.id : null,
        });
      }
      if (path === "/dashboard" && method === "GET") {
        return mockJsonResponse(false, { error: "not_found" }, 404);
      }
      if (path === "/api/me" && method === "GET") {
        return mockJsonResponse(true, {
          id: currentUser.id,
          name: currentUser.name,
          username: currentUser.username,
          email: currentUser.email,
          accessRole: currentUser.accessRole,
          grants: currentUserGrants,
          permissions: currentUser.permissions,
          phrase: currentUser.phrase,
          bio: currentUser.bio,
          avatarUrl: currentUser.avatarUrl,
          socials: currentUser.socials,
          favoriteWorks: currentUser.favoriteWorks,
          revision: "session-revision",
          ownerIds:
            currentUser.accessRole === "owner_primary" ? [currentUser.id] : [],
          primaryOwnerId:
            currentUser.accessRole === "owner_primary" ? currentUser.id : null,
        });
      }
      if (path === "/api/users/self" && method === "PUT") {
        const payload =
          (options as { json?: Record<string, unknown> } | undefined)?.json ||
          {};
        return mockJsonResponse(true, {
          user: {
            ...currentUser,
            ...payload,
            revision: "self-save-revision",
          },
        });
      }
      if (path === "/api/me/security" && method === "GET") {
        return mockJsonResponse(true, {
          totpEnabled: false,
          recoveryCodesRemaining: 0,
          activeSessionsCount: 1,
          identities: [
            {
              provider: "discord",
              linked: true,
              emailNormalized: "user@example.com",
            },
          ],
        });
      }
      if (path === "/api/me/sessions" && method === "GET") {
        return mockJsonResponse(true, {
          sessions: [
            {
              sid: "session-current",
              createdAt: "2026-04-12T21:44:00.000Z",
              lastSeenAt: "2026-04-12T21:45:09.000Z",
              lastIp: "203.0.113.42",
              userAgent: "Mozilla/5.0",
              current: true,
            },
          ],
        });
      }
      if (path === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }

      return mockJsonResponse(false, { error: "not_found" }, 404);
    },
  );
};

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

describe("DashboardUsers edit query", () => {
  it("abre criacao automaticamente com ?create=1 e limpa a query", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?create=1"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    await screen.findByRole("heading", { name: /adicionar usu.rio/i });
    expect(document.querySelector(".project-editor-dialog")).not.toBeNull();
    expect(
      screen.getByLabelText(/ID interno/i).parentElement?.className,
    ).toContain("gap-2");
    expect(screen.getByLabelText(/e-mail de acesso/i)).toHaveAttribute(
      "type",
      "email",
    );
    expect(screen.getByText(/será definido ao salvar/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });

  it("inicializa o papel de acesso como admin para payload legado", async () => {
    const adminUser: TestUser = {
      id: "user-2",
      name: "Colaborador Admin",
      username: "colaborador-admin",
      email: "admin@example.com",
      accessRole: "normal",
      permissions: ["usuarios"],
      grants: { usuarios: true },
      roles: [],
      status: "active",
      phrase: "Frase antiga",
      bio: "Bio antiga",
      avatarUrl: null,
      socials: [],
      favoriteWorks: { manga: [], anime: [] },
      order: 0,
      isAdmin: true,
    };
    setupApiMock({
      currentUser: defaultCurrentUser,
      users: [defaultCurrentUser, adminUser],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /abrir usu.rio colaborador admin/i }));
    await screen.findByText(/editar usu.rio/i);

    expect(screen.getByText(/^acesso e permissões$/i).closest("button")).toHaveTextContent("Admin");
    expect(screen.getByRole("combobox", { name: /selecionar papel de acesso/i })).toHaveTextContent(
      "Administrador",
    );
  });

  it("limpa permissões automáticas quando volta de administrador para normal", async () => {
    const managedUser: TestUser = {
      id: "user-2",
      name: "Colaborador Normal",
      username: "colaborador-normal",
      email: "normal@example.com",
      accessRole: "normal",
      permissions: ["configuracoes"],
      roles: [],
      status: "active",
      phrase: "Frase antiga",
      bio: "Bio antiga",
      avatarUrl: null,
      socials: [],
      favoriteWorks: { manga: [], anime: [] },
      order: 0,
    };
    setupApiMock({
      currentUser: defaultCurrentUser,
      users: [defaultCurrentUser, managedUser],
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /abrir usu.rio colaborador normal/i }));
    const dialog = await screen.findByRole("dialog");
    const accessRoleCombobox = within(dialog).getByRole("combobox", {
      name: /selecionar papel de acesso/i,
    });

    fireEvent.click(accessRoleCombobox);
    fireEvent.click(await screen.findByRole("option", { name: "Administrador" }));
    expect(within(dialog).getByRole("button", { name: "Posts" })).toHaveClass("bg-primary/10");

    fireEvent.click(accessRoleCombobox);
    fireEvent.click(await screen.findByRole("option", { name: "Normal" }));

    for (const permission of [
      "Posts",
      "Projetos",
      "Comentários",
      "Páginas",
      "Uploads",
      "Análises",
      "Usuários",
    ]) {
      expect(within(dialog).getByRole("button", { name: permission })).toHaveClass("bg-background");
    }
    expect(within(dialog).getByRole("button", { name: "Configurações" })).toHaveClass(
      "bg-primary/10",
    );
  });

  it("esconde id interno, e-mail de acesso e badge de id para self-edit sem privilégio de gestão", async () => {
    setupApiMock({
      currentUserGrants: {
        usuarios: false,
      },
      currentUser: {
        id: "user-2",
        name: "Colaborador",
        username: "colaborador",
        email: "nerdplaygamer1@gmail.com",
        accessRole: "normal",
        permissions: [],
        roles: [],
        status: "active",
        phrase: "Frase antiga",
        bio: "Bio antiga",
        avatarUrl: "/uploads/users/original.png",
        socials: [],
        favoriteWorks: { manga: ["Old Manga"], anime: ["Old Anime"] },
        order: 0,
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    await screen.findByText(/editar usu.rio/i);

    expect(screen.queryByLabelText(/id interno/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/e-mail de acesso/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^ID\s/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/^acesso e permissões$/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^papel de acesso$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^permissões$/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/segurança/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/métodos de acesso/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/e-mail:/i).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?self=1");
    });
  });

  it("abre self-edit com fallback do /api/me quando /api/users retorna 403", async () => {
    setupApiMock({
      currentUserGrants: {
        usuarios: false,
      },
      currentUser: {
        id: "user-2",
        name: "Colaborador",
        username: "colaborador",
        email: "nerdplaygamer1@gmail.com",
        accessRole: "normal",
        permissions: [],
        roles: [],
        status: "active",
        phrase: "Frase antiga",
        bio: "Bio antiga",
        avatarUrl: "/uploads/users/original.png",
        socials: [],
        favoriteWorks: { manga: ["Old Manga"], anime: ["Old Anime"] },
        order: 0,
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByDisplayValue("Colaborador")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("Frase antiga")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("Bio antiga")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("Old Manga")).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue("Old Anime")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?self=1");
    });
  });

  it("mantém self=1 enquanto o modal de self-edit está aberto e limpa ao fechar", async () => {
    setupApiMock({
      currentUserGrants: {
        usuarios: false,
      },
      currentUser: {
        id: "user-2",
        name: "Colaborador",
        username: "colaborador",
        email: "nerdplaygamer1@gmail.com",
        accessRole: "normal",
        permissions: [],
        roles: [],
        status: "active",
        phrase: "Frase antiga",
        bio: "Bio antiga",
        avatarUrl: "/uploads/users/original.png",
        socials: [],
        favoriteWorks: { manga: ["Old Manga"], anime: ["Old Anime"] },
        order: 0,
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    await screen.findByRole("dialog");

    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?self=1");
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /editar usu.rio/i })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("");
    });
  });

  it("mostra id interno, e-mail de acesso e acesso/permissões para self-edit de owner", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    await screen.findByText(/editar usu.rio/i);

    expect(screen.getByLabelText(/id interno/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail de acesso/i)).toHaveAttribute(
      "type",
      "email",
    );
    expect(screen.getAllByText(/^ID\s/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^acesso e permissões$/i)).toBeInTheDocument();
    expect(screen.getByText(/^papel de acesso$/i)).toBeInTheDocument();
    expect(screen.getByText(/^permissões$/i)).toBeInTheDocument();
  });

  it("mostra o aviso de edição restrita com hover accent quando só há acesso básico", async () => {
    setupApiMock({
      currentUserGrants: {
        usuarios: true,
      },
      currentUser: {
        id: "user-2",
        name: "Colaborador",
        username: "colaborador",
        email: "nerdplaygamer1@gmail.com",
        accessRole: "normal",
        permissions: ["usuarios"],
        grants: { usuarios: true },
        roles: [],
        status: "active",
        phrase: "",
        bio: "",
        avatarUrl: null,
        socials: [],
        favoriteWorks: { manga: [], anime: [] },
        order: 0,
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    await screen.findByText(/editar usu.rio/i);

    const restrictedNotice = screen.getByText(
      /Voc. s. pode alterar informa..es b.sicas/i,
    );
    const restrictedNoticeCard = restrictedNotice.closest("div.rounded-2xl");
    expect(restrictedNoticeCard).not.toBeNull();
    expect(classTokens(restrictedNoticeCard)).toContain(
      "hover:border-primary/40",
    );
  });

  it("salva o próprio perfil de usuário comum via /api/users/self com campos básicos", async () => {
    setupApiMock({
      currentUserGrants: {
        usuarios: false,
      },
      currentUser: {
        id: "user-2",
        name: "Colaborador",
        username: "colaborador",
        email: "nerdplaygamer1@gmail.com",
        accessRole: "normal",
        permissions: [],
        roles: [],
        status: "active",
        phrase: "Frase antiga",
        bio: "Bio antiga",
        avatarUrl: "/uploads/users/original.png",
        socials: [],
        favoriteWorks: { manga: ["Old Manga"], anime: ["Old Anime"] },
        order: 0,
      },
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Nome"), {
      target: { value: "Perfil Atualizado" },
    });
    fireEvent.change(within(dialog).getByLabelText("Frase"), {
      target: { value: "Nova frase" },
    });
    fireEvent.change(within(dialog).getByLabelText("Bio"), {
      target: { value: "Nova bio" },
    });
    fireEvent.change(within(dialog).getByPlaceholderText("Mangá 1"), {
      target: { value: "Naruto" },
    });
    fireEvent.change(within(dialog).getByPlaceholderText("Anime 1"), {
      target: { value: "Frieren" },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      const putCall = apiFetchMock.mock.calls.find((call) => {
        const path = call[1];
        const method = String(
          (call[2] as RequestInit | undefined)?.method || "GET",
        ).toUpperCase();
        return path === "/api/users/self" && method === "PUT";
      });
      expect(putCall).toBeTruthy();
      const payload =
        (putCall?.[2] as { json?: Record<string, unknown> }).json || {};
      expect(payload).toMatchObject({
        name: "Perfil Atualizado",
        phrase: "Nova frase",
        bio: "Nova bio",
        favoriteWorks: {
          manga: ["Naruto"],
          anime: ["Frieren"],
        },
      });
      expect(payload).not.toHaveProperty("permissions");
      expect(payload).not.toHaveProperty("accessRole");
      expect(payload).not.toHaveProperty("status");
      expect(payload).not.toHaveProperty("roles");
      expect(payload).not.toHaveProperty("id");
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("controla classe editor-modal-scrolled no dialog ao rolar e fechar", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    await screen.findByRole("heading", { name: /editar usu.rio/i });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?self=1");
    });

    const editorDialog = document.querySelector(
      ".project-editor-dialog",
    ) as HTMLElement | null;
    const editorScrollShell = document.querySelector(
      ".project-editor-scroll-shell",
    ) as HTMLElement | null;
    const editorTop = document.querySelector(
      ".project-editor-top",
    ) as HTMLElement | null;
    const editorFooter = document.querySelector(
      ".project-editor-footer",
    ) as HTMLElement | null;
    const editorHeader = editorTop?.firstElementChild as HTMLElement | null;
    const editorStatusBar = editorTop?.lastElementChild as HTMLElement | null;
    const editorLayout = document.querySelector(
      ".project-editor-layout",
    ) as HTMLElement | null;
    const editorSectionContent = document.querySelector(
      ".project-editor-section-content",
    ) as HTMLElement | null;
    const editorAccordion = document.querySelector(
      ".project-editor-accordion",
    ) as HTMLElement | null;
    const editorBackdrop = screen.getByTestId("dashboard-editor-backdrop");
    const legacyBackdrop = Array.from(
      document.body.querySelectorAll("div"),
    ).find((node) => {
      const tokens = classTokens(node as HTMLElement);
      return (
        tokens.includes("pointer-events-auto") &&
        tokens.includes("fixed") &&
        tokens.includes("inset-0") &&
        tokens.includes("z-40") &&
        tokens.includes("bg-black/80") &&
        tokens.includes("backdrop-blur-xs")
      );
    });
    expect(editorDialog).not.toBeNull();
    expect(editorScrollShell).not.toBeNull();
    expect(editorHeader).not.toBeNull();
    expect(editorStatusBar).not.toBeNull();
    expect(editorLayout).not.toBeNull();
    expect(editorSectionContent).not.toBeNull();
    expect(editorAccordion).not.toBeNull();
    expect(editorTop?.className).toContain("sticky");
    expect(editorFooter?.className).toContain("sticky");
    expect(document.querySelector(".project-editor-dialog-surface")).toBeNull();
    expect(classTokens(editorDialog as HTMLElement)).toContain(
      dashboardEditorDialogWidthClassName,
    );
    expect(classTokens(editorDialog as HTMLElement)).not.toContain("max-w-5xl");
    expect(classTokens(editorDialog as HTMLElement)).not.toContain("h-[85vh]");
    expect(classTokens(editorDialog as HTMLElement)).not.toContain(
      "overflow-hidden",
    );
    expect(classTokens(editorDialog as HTMLElement)).not.toContain(
      "sm:rounded-2xl",
    );
    expect(classTokens(editorDialog as HTMLElement)).toContain("p-0");
    expect(classTokens(editorScrollShell as HTMLElement)).toContain(
      "overflow-y-auto",
    );
    expect(classTokens(editorScrollShell as HTMLElement)).not.toContain(
      "overscroll-contain",
    );
    expect(editorBackdrop).toHaveClass("bg-black/80", "backdrop-blur-xs");
    expect(legacyBackdrop).toBeUndefined();

    Object.defineProperty(editorScrollShell as HTMLElement, "scrollTop", {
      configurable: true,
      value: 24,
      writable: true,
    });
    fireEvent.scroll(editorScrollShell as HTMLElement);

    await waitFor(() => {
      expect(classTokens(editorDialog as HTMLElement)).toContain(
        "editor-modal-scrolled",
      );
    });

    Object.defineProperty(editorScrollShell as HTMLElement, "scrollTop", {
      configurable: true,
      value: 0,
      writable: true,
    });
    fireEvent.scroll(editorScrollShell as HTMLElement);

    await waitFor(() => {
      expect(classTokens(editorDialog as HTMLElement)).not.toContain(
        "editor-modal-scrolled",
      );
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /editar usu.rio/i }),
      ).not.toBeInTheDocument();
    });

    expect(document.documentElement).not.toHaveClass("editor-scroll-locked");
    expect(document.body).not.toHaveClass("editor-scroll-locked");
    expect(
      document.body.getAttribute("data-editor-scroll-lock-count"),
    ).toBeNull();
  });

  it("fecha o editor ao clicar no backdrop e mantém layout sticky até o fechamento", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    await screen.findByRole("heading", { name: /editar usu.rio/i });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?self=1");
    });

    const editorDialog = document.querySelector(
      ".project-editor-dialog",
    ) as HTMLElement | null;
    const editorTop = document.querySelector(
      ".project-editor-top",
    ) as HTMLElement | null;
    const editorFooter = document.querySelector(
      ".project-editor-footer",
    ) as HTMLElement | null;
    const editorHeader = editorTop?.firstElementChild as HTMLElement | null;
    const editorStatusBar = editorTop?.lastElementChild as HTMLElement | null;
    const editorBackdrop = screen.getByTestId("dashboard-editor-backdrop");

    expect(editorDialog).not.toBeNull();
    expect(editorTop).not.toBeNull();
    expect(editorFooter).not.toBeNull();
    expect(editorHeader).not.toBeNull();
    expect(editorStatusBar).not.toBeNull();
    expect(editorTop?.className).toContain("sticky");
    expect(editorFooter?.className).toContain("sticky");
    expect(editorBackdrop).toHaveClass("bg-black/80", "backdrop-blur-xs");

    fireEvent.pointerDown(editorBackdrop);
    fireEvent.click(editorBackdrop);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /editar usu.rio/i }),
      ).not.toBeInTheDocument();
    });
    expect(document.documentElement).not.toHaveClass("editor-scroll-locked");
    expect(document.body).not.toHaveClass("editor-scroll-locked");
    expect(
      document.body.getAttribute("data-editor-scroll-lock-count"),
    ).toBeNull();
  });

  it("mantém altura expandida para obras favoritas, avatar e redes no modo edição", async () => {
    setupApiMock();

    render(
      <MemoryRouter initialEntries={["/dashboard/usuarios?edit=me"]}>
        <DashboardUsers />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: /gest.o de usu.rios/i });
    await screen.findByRole("heading", { name: /editar usu.rio/i });
    await waitFor(() => {
      expect(screen.getByTestId("location-search").textContent).toBe("?self=1");
    });

    expect(screen.getByText(/obras favoritas/i)).toBeInTheDocument();
    expect(screen.getByText(/^Avatar$/i)).toBeInTheDocument();
    expect(screen.getByText(/links e redes/i)).toBeInTheDocument();
  });
});
