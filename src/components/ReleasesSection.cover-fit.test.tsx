import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ReleasesSection from "@/components/ReleasesSection";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/components/LatestEpisodeCard", () => ({
  default: () => null,
}));

vi.mock("@/components/WorkStatusCard", () => ({
  default: () => null,
}));

vi.mock("@/components/DiscordInviteCard", () => ({
  default: () => null,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const setupApiMock = () => {
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation(async (_apiBase: string, endpoint: string, options?: RequestInit) => {
    const method = String(options?.method || "GET").toUpperCase();

    if (endpoint === "/api/public/posts" && method === "GET") {
      return mockJsonResponse(true, {
        posts: [
          {
            id: "post-1",
            slug: "post-teste",
            title: "Post de Teste",
            excerpt: "Resumo",
            author: "Equipe",
            publishedAt: "2026-02-10T12:00:00.000Z",
            coverImageUrl: "/uploads/capa-card.jpg",
            tags: ["acao"],
          },
        ],
      });
    }
    if (endpoint === "/api/public/projects" && method === "GET") {
      return mockJsonResponse(true, { projects: [] });
    }
    if (endpoint === "/api/public/tag-translations" && method === "GET") {
      return mockJsonResponse(true, { tags: {}, genres: {} });
    }
    return mockJsonResponse(false, { error: "not_found" }, 404);
  });
};

describe("ReleasesSection cover fit", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("renderiza capa do card com preenchimento total e wrapper 3:2", async () => {
    setupApiMock();

    render(
      <MemoryRouter>
        <ReleasesSection />
      </MemoryRouter>,
    );

    const coverImage = await screen.findByRole("img", { name: "Post de Teste" });
    expect(coverImage).toHaveClass("absolute", "inset-0", "block", "h-full", "w-full", "object-cover", "object-center");

    const coverContainer = coverImage.parentElement;
    expect(coverContainer).not.toBeNull();
    expect(coverContainer).toHaveClass("relative", "w-full", "aspect-3/2", "overflow-hidden");
  });
});
