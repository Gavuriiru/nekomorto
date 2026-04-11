import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Recruitment from "@/pages/Recruitment";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";

const apiFetchMock = vi.hoisted(() => vi.fn());
const useSiteSettingsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => useSiteSettingsMock(),
}));

const createSettings = (override: Partial<SiteSettings> = {}) =>
  mergeSettings(defaultSettings, override);

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const setWindowBootstrap = (payload: unknown) => {
  (
    window as Window &
      typeof globalThis & {
        __BOOTSTRAP_PUBLIC__?: unknown;
      }
  ).__BOOTSTRAP_PUBLIC__ = payload;
};

describe("Recruitment mobile CTA layout", () => {
  beforeEach(() => {
    setWindowBootstrap(undefined);
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(mockJsonResponse(false, { error: "not_found" }, 404));

    useSiteSettingsMock.mockReset();
    useSiteSettingsMock.mockReturnValue({
      settings: createSettings({
        community: {
          discordUrl: "https://discord.gg/recruitment-test",
          inviteCard: {
            title: "Comunidade",
            subtitle: "Junte-se",
            panelTitle: "Discord",
            panelDescription: "Canal principal",
            ctaLabel: "Entrar",
            ctaUrl: "https://discord.gg/recruitment-test",
          },
        },
      }),
      isLoading: false,
      refresh: vi.fn(async () => undefined),
    });
  });

  it("aplica CTA full width no mobile e auto width no desktop", async () => {
    render(<Recruitment />);

    const main = document.querySelector("main");
    expect(main).not.toBeNull();
    expect(main).toHaveClass("pb-20");

    const ctaLink = await screen.findByRole("link", {
      name: "Entrar no Discord",
    });
    const ctaLinkTokens = classTokens(ctaLink);

    expect(ctaLinkTokens).toContain("w-full");
    expect(ctaLinkTokens).toContain("md:w-auto");
    expect(ctaLink).toHaveAttribute("href", "https://discord.gg/recruitment-test");
  });

  it("usa container de CTA com alinhamento stretch no mobile", async () => {
    render(<Recruitment />);

    const ctaHeading = await screen.findByRole("heading", {
      name: "Pronto para participar?",
    });
    const ctaTextBlock = ctaHeading.closest("div.space-y-1");
    expect(ctaTextBlock).not.toBeNull();

    const ctaContent = ctaTextBlock?.parentElement as HTMLElement | null;
    expect(ctaContent).not.toBeNull();

    const ctaContentTokens = classTokens(ctaContent as HTMLElement);
    expect(ctaContentTokens).toContain("items-stretch");
    expect(ctaContentTokens).not.toContain("items-start");
  });

  it("mantem o card de CTA estatico e concentra o hover no botao do Discord", async () => {
    render(<Recruitment />);

    const ctaHeading = await screen.findByRole("heading", {
      name: "Pronto para participar?",
    });
    const ctaCard = ctaHeading.closest("div.rounded-lg");
    expect(ctaCard).not.toBeNull();

    const ctaCardTokens = classTokens(ctaCard as HTMLElement);
    expect(ctaCardTokens).not.toContain("hover:-translate-y-1");
    expect(ctaCardTokens).not.toContain("hover:border-primary/60");
    expect(ctaCardTokens).not.toContain("hover:bg-card/90");
    expect(ctaCardTokens).not.toContain("hover:shadow-lg");

    const ctaLink = screen.getByRole("link", { name: "Entrar no Discord" });
    const ctaLinkTokens = classTokens(ctaLink);
    expect(ctaLinkTokens).toContain("interactive-lift-sm");
    expect(ctaLinkTokens).toContain("interactive-control-transition");
    expect(ctaLinkTokens).toContain("hover:bg-primary/90");
  });

  it("mantem defaults com bootstrap critical-home e troca para o conteudo completo", async () => {
    setWindowBootstrap({
      settings: {},
      pages: { home: {} },
      projects: [],
      posts: [],
      updates: [],
      tagTranslations: {
        tags: {},
        genres: {},
        staffRoles: {},
      },
      generatedAt: "2026-04-10T19:00:00.000Z",
      mediaVariants: {},
      payloadMode: "critical-home",
    });
    apiFetchMock.mockImplementation(async (_base: string, endpoint: string) => {
      if (endpoint === "/api/public/bootstrap") {
        return mockJsonResponse(true, {
          settings: {},
          pages: {
            recruitment: {
              heroBadge: "Chamadas abertas",
              heroTitle: "Recrutamento configurado",
              heroSubtitle: "Texto configurado pela dashboard.",
              roles: [
                {
                  title: "Editor configurado",
                  description: "Cuida do material configurado.",
                  icon: "PenTool",
                },
              ],
              ctaTitle: "CTA configurado",
              ctaSubtitle: "Subtitulo configurado.",
              ctaButtonLabel: "Falar com recrutamento",
            },
          },
          projects: [],
          posts: [],
          updates: [],
          tagTranslations: {
            tags: {},
            genres: {},
            staffRoles: {},
          },
          generatedAt: "2026-04-10T19:01:00.000Z",
          mediaVariants: {},
          payloadMode: "full",
        });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });

    render(<Recruitment />);

    expect(
      screen.getByRole("heading", { name: "Venha fazer parte da equipe" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar no Discord" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Recrutamento configurado" }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Recrutamento configurado" })).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "Editor configurado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Falar com recrutamento" })).toBeInTheDocument();
  });
});
