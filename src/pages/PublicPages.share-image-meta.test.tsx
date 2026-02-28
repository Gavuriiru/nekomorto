import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Index from "@/pages/Index";
import Projects from "@/pages/Projects";

const apiFetchMock = vi.hoisted(() => vi.fn());
const usePageMetaMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: (...args: unknown[]) => usePageMetaMock(...args),
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-dynamic-synopsis-clamp", () => ({
  useDynamicSynopsisClamp: () => ({
    rootRef: { current: null },
    lineByKey: {},
  }),
}));

vi.mock("@/components/HeroSection", () => ({
  default: () => null,
}));

vi.mock("@/components/ReleasesSection", () => ({
  default: () => null,
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

describe("Public pages share image meta", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    usePageMetaMock.mockReset();
    apiFetchMock.mockImplementation(async (_base: string, path: string) => {
      if (path === "/api/public/pages") {
        return mockJsonResponse(true, {
          pages: {
            home: {
              shareImage: "/uploads/home-og.jpg",
              shareImageAlt: "Capa da pagina inicial",
            },
            projects: {
              shareImage: "/uploads/projects-og.jpg",
              shareImageAlt: "Capa da pagina de projetos",
            },
          },
        });
      }
      if (path === "/api/public/projects") {
        return mockJsonResponse(true, { projects: [] });
      }
      if (path === "/api/public/tag-translations") {
        return mockJsonResponse(true, { tags: {}, genres: {}, staffRoles: {} });
      }
      return mockJsonResponse(false, { error: "not_found" }, 404);
    });
  });

  it("Index aplica pages.home.shareImage no metadata", async () => {
    render(
      <MemoryRouter>
        <Index />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(usePageMetaMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Início",
            image: "/uploads/home-og.jpg",
            imageAlt: "Capa da pagina inicial",
        }),
      );
    });
  });

  it("Projects aplica pages.projects.shareImage no metadata", async () => {
    render(
      <MemoryRouter initialEntries={["/projetos"]}>
        <Projects />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(usePageMetaMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Projetos",
            image: "/uploads/projects-og.jpg",
            imageAlt: "Capa da pagina de projetos",
        }),
      );
    });
  });
});
