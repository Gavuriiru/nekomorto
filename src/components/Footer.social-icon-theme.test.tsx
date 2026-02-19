import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Footer from "@/components/Footer";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";
import type { SiteSettings } from "@/types/site-settings";

const useSiteSettingsMock = vi.hoisted(() => vi.fn());
const supportsMock = vi.hoisted(() => vi.fn());
const imageState = vi.hoisted(() => ({ shouldFail: false }));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => useSiteSettingsMock(),
}));

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  referrerPolicy = "";

  set src(_value: string) {
    queueMicrotask(() => {
      if (imageState.shouldFail) {
        this.onerror?.();
        return;
      }
      this.onload?.();
    });
  }
}

const createSettings = (override: unknown) =>
  mergeSettings(defaultSettings, override as Partial<SiteSettings>);

const mockSiteSettings = (override: unknown) => {
  useSiteSettingsMock.mockReturnValue({
    settings: createSettings(override),
    isLoading: false,
    refresh: vi.fn(async () => undefined),
  });
};

describe("Footer social icon theme tint", () => {
  beforeEach(() => {
    useSiteSettingsMock.mockReset();
    imageState.shouldFail = false;
    supportsMock.mockReset();
    supportsMock.mockImplementation(
      (property: string) => property === "mask-image" || property === "-webkit-mask-image",
    );
    vi.stubGlobal("CSS", { supports: supportsMock });
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("usa mask para icone social custom e mantem tint por currentColor", async () => {
    mockSiteSettings({
      footer: {
        socialLinks: [
          {
            label: "Canal Custom",
            href: "https://safe.example/social",
            icon: "https://cdn.exemplo.com/social-custom.svg",
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /Canal Custom/ });

    await waitFor(() => {
      expect(within(link).getByRole("img", { name: "Canal Custom" }).tagName).toBe("SPAN");
    });

    const icon = within(link).getByRole("img", { name: "Canal Custom" });
    const iconStyle = String(icon.getAttribute("style") || "").toLowerCase();

    expect(iconStyle).toContain("background-color: currentcolor");
    expect(iconStyle).toContain("mask-image");
    expect(link).toHaveClass("text-foreground/80");

    const iconShell = link.querySelector("span.flex.h-8.w-8");
    expect(iconShell).toHaveClass("text-primary/80");
  });
});
