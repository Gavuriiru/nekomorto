import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ReleasesSection from "@/components/ReleasesSection";
import { defaultSettings, mergeSettings } from "@/hooks/site-settings-context";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: mergeSettings(defaultSettings, {}),
    isLoading: false,
    refresh: vi.fn(async () => undefined),
  }),
}));

vi.mock("@/hooks/use-theme-mode", () => ({
  useThemeMode: () => ({
    globalMode: "dark",
    effectiveMode: "dark",
    preference: "global",
    isOverridden: false,
    setPreference: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-dynamic-synopsis-clamp", () => ({
  useDynamicSynopsisClamp: () => ({
    rootRef: { current: null },
    lineByKey: {},
  }),
}));

vi.mock("@/components/ui/carousel", () => {
  const Carousel = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  const CarouselContent = ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>;
  const CarouselItem = ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>;
  const CarouselPrevious = ({ className }: { className?: string }) => (
    <button type="button" className={className} />
  );
  const CarouselNext = ({ className }: { className?: string }) => (
    <button type="button" className={className} />
  );
  return {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
  };
});

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

describe("public bootstrap dedupe", () => {
  it("faz uma unica chamada para /api/public/bootstrap com multiplos consumidores", async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
        const method = String(options?.method || "GET").toUpperCase();
        if (endpoint === "/api/public/bootstrap" && method === "GET") {
          return mockJsonResponse(true, {
            settings: {},
            projects: [
              {
                id: "project-1",
                title: "Projeto Teste",
                synopsis: "Sinopse",
                description: "Descricao",
                type: "Anime",
                status: "Em andamento",
                tags: ["acao"],
                cover: "/placeholder.svg",
                banner: "/placeholder.svg",
                heroImageUrl: "",
                forceHero: false,
                trailerUrl: "",
                episodeDownloads: [
                  {
                    number: 1,
                    title: "Ep 1",
                    sources: [],
                    completedStages: ["traducao"],
                  },
                ],
              },
            ],
            posts: [
              {
                id: "post-1",
                title: "Post Teste",
                slug: "post-teste",
                excerpt: "Resumo",
                author: "Equipe",
                publishedAt: "2026-02-10T12:00:00.000Z",
                projectId: "project-1",
                tags: ["acao"],
                coverImageUrl: "/placeholder.svg",
                coverAlt: "capa",
              },
            ],
            updates: [
              {
                id: "update-1",
                projectId: "project-1",
                projectTitle: "Projeto Teste",
                episodeNumber: 1,
                kind: "Lançamento",
                reason: "Novo episódio",
                updatedAt: "2026-02-10T12:00:00.000Z",
                image: "/placeholder.svg",
                unit: "Episódio",
              },
            ],
            tagTranslations: {
              tags: { acao: "Ação" },
              genres: {},
              staffRoles: {},
            },
            generatedAt: "2026-02-10T12:00:00.000Z",
          });
        }
        if (endpoint === "/api/public/me" && method === "GET") {
          return mockJsonResponse(false, { error: "unauthorized" }, 401);
        }
        return mockJsonResponse(false, { error: "not_found" }, 404);
      },
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Header />
          <HeroSection />
          <ReleasesSection />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      const bootstrapCalls = apiFetchMock.mock.calls.filter(
        (call) => call[1] === "/api/public/bootstrap",
      );
      expect(bootstrapCalls).toHaveLength(1);
    });
  });
});
