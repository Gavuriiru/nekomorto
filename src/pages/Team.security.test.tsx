import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Team from "@/pages/Team";

const apiFetchMock = vi.hoisted(() => vi.fn());

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

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

describe("Team security hardening", () => {
  beforeEach(() => {
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
                  label: "data:image/svg+xml,<svg><script>alert(1)</script></svg>",
                  href: "https://safe.example/profile",
                },
              ],
            },
          ],
        });
      }
      if (endpoint === "/api/link-types" && method === "GET") {
        return mockJsonResponse(true, { items: [] });
      }
      if (endpoint === "/api/public/pages" && method === "GET") {
        return mockJsonResponse(true, { pages: { team: {} } });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("does not treat social label as custom icon URL", async () => {
    const { container } = render(
      <MemoryRouter>
        <Team />
      </MemoryRouter>,
    );

    const heading = await screen.findByRole("heading", { name: "Integrante" });
    const panel = heading.closest("div.rounded-2xl");
    expect(panel).not.toBeNull();

    const link = within(panel as HTMLElement).getByRole("link");
    expect(link).toHaveAttribute("href", "https://safe.example/profile");
    expect(link.querySelector("img")).toBeNull();

    const dataImage = container.querySelector("img[src^=\"data:\"]");
    expect(dataImage).toBeNull();
  });
});
