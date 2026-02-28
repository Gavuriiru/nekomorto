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

describe("Recruitment role icon shell", () => {
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

  it("mantem badge do icone com contraste sem borda e hover semanticos", async () => {
    render(<Recruitment />);

    const roleHeading = await screen.findByRole("heading", { name: "Tradutor" });
    const roleHeader = roleHeading.parentElement as HTMLElement | null;

    expect(roleHeader).not.toBeNull();

    const iconShell = roleHeader?.querySelector("span.flex.h-10.w-10") as HTMLElement | null;

    expect(iconShell).not.toBeNull();

    const iconShellTokens = classTokens(iconShell as HTMLElement);

    expect(iconShellTokens).toContain("bg-secondary/80");
    expect(iconShellTokens).toContain("group-hover:bg-primary/15");
    expect(iconShellTokens).not.toContain("border");
    expect(iconShellTokens).not.toContain("border-border/60");
    expect(iconShellTokens).not.toContain("group-hover:border-primary/40");
  });
});
