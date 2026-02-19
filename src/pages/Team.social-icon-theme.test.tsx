import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Team from "@/pages/Team";

const apiFetchMock = vi.hoisted(() => vi.fn());
const supportsMock = vi.hoisted(() => vi.fn());
const imageState = vi.hoisted(() => ({ shouldFail: false }));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      teamRoles: [],
    },
  }),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: () => undefined,
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

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

describe("Team social icon theme tint", () => {
  beforeEach(() => {
    imageState.shouldFail = false;
    supportsMock.mockReset();
    supportsMock.mockImplementation(
      (property: string) => property === "mask-image" || property === "-webkit-mask-image",
    );
    vi.stubGlobal("CSS", { supports: supportsMock });
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);

    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
      const method = String(options?.method || "GET").toUpperCase();
      if (endpoint === "/api/public/users" && method === "GET") {
        return mockJsonResponse(true, {
          users: [
            {
              id: "member-1",
              name: "Integrante",
              phrase: "",
              bio: "",
              status: "active",
              roles: ["Membro"],
              socials: [
                {
                  label: "custom-profile",
                  href: "https://safe.example/profile",
                },
              ],
            },
          ],
        });
      }
      if (endpoint === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, {
          items: [
            {
              id: "custom-profile",
              label: "Perfil",
              icon: "https://cdn.exemplo.com/team-icon.svg",
            },
          ],
        });
      }
      if (endpoint === "/api/public/pages" && method === "GET") {
        return mockJsonResponse(true, { pages: { team: {} } });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("usa mask para icone custom e segue currentColor no card da equipe", async () => {
    render(
      <MemoryRouter>
        <Team />
      </MemoryRouter>,
    );

    const link = await screen.findByRole("link", { name: "Perfil" });

    await waitFor(() => {
      expect(within(link).getByRole("img", { name: "Perfil" }).tagName).toBe("SPAN");
    });

    const icon = within(link).getByRole("img", { name: "Perfil" });
    const iconStyle = String(icon.getAttribute("style") || "").toLowerCase();

    expect(iconStyle).toContain("background-color: currentcolor");
    expect(iconStyle).toContain("mask-image");
    expect(link).toHaveClass("text-primary/80");
  });
});
