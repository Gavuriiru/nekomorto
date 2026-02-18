import { render, screen } from "@testing-library/react";
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

const createSettings = (override: Partial<SiteSettings> = {}) => mergeSettings(defaultSettings, override);

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

describe("Recruitment mobile CTA layout", () => {
  beforeEach(() => {
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

    const ctaLink = await screen.findByRole("link", { name: "Entrar no Discord" });
    const ctaLinkTokens = classTokens(ctaLink);

    expect(ctaLinkTokens).toContain("w-full");
    expect(ctaLinkTokens).toContain("md:w-auto");
    expect(ctaLink).toHaveAttribute("href", "https://discord.gg/recruitment-test");
  });

  it("usa container de CTA com alinhamento stretch no mobile", async () => {
    render(<Recruitment />);

    const ctaHeading = await screen.findByRole("heading", { name: "Pronto para participar?" });
    const ctaTextBlock = ctaHeading.closest("div.space-y-1");
    expect(ctaTextBlock).not.toBeNull();

    const ctaContent = ctaTextBlock?.parentElement as HTMLElement | null;
    expect(ctaContent).not.toBeNull();

    const ctaContentTokens = classTokens(ctaContent as HTMLElement);
    expect(ctaContentTokens).toContain("items-stretch");
    expect(ctaContentTokens).not.toContain("items-start");
  });
});

