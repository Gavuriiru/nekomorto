import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProjectReading from "@/pages/ProjectReading";

const apiFetchMock = vi.hoisted(() => vi.fn());
const usePageMetaMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "",
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/hooks/use-page-meta", () => ({
  usePageMeta: (...args: unknown[]) => usePageMetaMock(...args),
}));

vi.mock("@/hooks/use-deferred-visibility", () => ({
  useDeferredVisibility: () => ({
    isVisible: false,
    sentinelRef: { current: null },
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: "projeto-teste", chapter: "1" }),
  };
});

vi.mock("@/components/lexical/LexicalViewer", () => ({
  default: () => null,
}));

vi.mock("@/components/CommentsSection", () => ({
  default: () => null,
}));

vi.mock("@/components/UploadPicture", () => ({
  default: ({ alt, src }: { alt?: string; src?: string }) => (
    <img alt={String(alt || "")} src={String(src || "")} />
  ),
}));

const mockJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const hasMetaCall = (matcher: (arg: Record<string, unknown>) => boolean) =>
  usePageMetaMock.mock.calls.some(([arg]) => matcher(arg as Record<string, unknown>));

const buildBootstrapProject = (episodeDownloads?: Array<Record<string, unknown>>) => ({
  id: "projeto-teste",
  title: "Projeto Bootstrap",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "Sinopse principal",
  description: "",
  type: "Light Novel",
  status: "Em andamento",
  tags: ["psicologico"],
  genres: ["drama"],
  cover: "/uploads/project-cover.jpg",
  coverAlt: "Capa do projeto",
  banner: "/uploads/project-banner.jpg",
  bannerAlt: "Banner do projeto",
  heroImageUrl: "/uploads/project-hero.jpg",
  heroImageAlt: "Hero do projeto",
  forceHero: false,
  trailerUrl: "",
  studio: "",
  episodes: "12 capitulos",
  producers: [],
  volumeEntries: [
    {
      volume: 2,
      synopsis: "Sinopse do volume",
      coverImageUrl: "/uploads/volume-2.jpg",
      coverImageAlt: "Volume 2",
    },
  ],
  volumeCovers: [],
  episodeDownloads: episodeDownloads || [
    {
      number: 1,
      volume: 2,
      title: "Capitulo Bootstrap",
      releaseDate: "2026-02-10",
      duration: "Leitura",
      coverImageUrl: "/uploads/chapter-1.jpg",
      coverImageAlt: "Capitulo 1",
      sourceType: "Web",
      sources: [],
      progressStage: "",
      completedStages: [],
      chapterUpdatedAt: "2026-02-10T00:00:00.000Z",
      hasContent: true,
    },
  ],
  views: 0,
  viewsDaily: {},
});

describe("ProjectReading SEO image meta", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    usePageMetaMock.mockReset();
    apiFetchMock.mockImplementation(
      async (_apiBase: string, endpoint: string, options?: RequestInit) => {
        const method = String(options?.method || "GET").toUpperCase();
        if (
          endpoint === "/api/public/projects/projeto-teste/chapters/1?volume=2" &&
          method === "GET"
        ) {
          return await new Promise<Response>(() => undefined);
        }
        if (endpoint === "/api/public/analytics/event" && method === "POST") {
          return mockJsonResponse(true, { ok: true });
        }
        return mockJsonResponse(false, { error: "not_found" }, 404);
      },
    );
    delete (
      window as Window & {
        __BOOTSTRAP_PUBLIC__?: unknown;
        __BOOTSTRAP_PUBLIC_ME__?: unknown;
      }
    ).__BOOTSTRAP_PUBLIC__;
    delete (
      window as Window & {
        __BOOTSTRAP_PUBLIC__?: unknown;
        __BOOTSTRAP_PUBLIC_ME__?: unknown;
      }
    ).__BOOTSTRAP_PUBLIC_ME__;
  });

  it("publishes the versioned reading OG image when the chapter is resolvable from bootstrap", async () => {
    (
      window as Window & {
        __BOOTSTRAP_PUBLIC__?: unknown;
      }
    ).__BOOTSTRAP_PUBLIC__ = {
      settings: {
        theme: {
          accent: "#3173ff",
        },
      },
      pages: {},
      projects: [buildBootstrapProject()],
      posts: [],
      updates: [],
      teamMembers: [],
      teamLinkTypes: [],
      mediaVariants: {},
      tagTranslations: {
        tags: { psicologico: "Psicologico" },
        genres: { drama: "Drama" },
        staffRoles: {},
      },
      generatedAt: "2026-03-10T00:00:00.000Z",
      payloadMode: "full",
    };

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        hasMetaCall(
          (arg) =>
            /\/api\/og\/project\/projeto-teste\/reading\/1\?volume=2&v=[a-f0-9]{16}$/.test(
              String(arg.image || ""),
            ) &&
            String(arg.imageAlt || "").includes("Card de compartilhamento da leitura") &&
            arg.type === "article",
        ),
      ).toBe(true);
    });
  });

  it("falls back to the project OG when the chapter snapshot cannot be resolved", async () => {
    (
      window as Window & {
        __BOOTSTRAP_PUBLIC__?: unknown;
      }
    ).__BOOTSTRAP_PUBLIC__ = {
      settings: {
        theme: {
          accent: "#3173ff",
        },
      },
      pages: {},
      projects: [
        buildBootstrapProject([
          {
            number: 1,
            volume: 2,
            title: "Capitulo sem leitura",
            hasContent: false,
            content: "",
          },
        ]),
      ],
      posts: [],
      updates: [],
      teamMembers: [],
      teamLinkTypes: [],
      mediaVariants: {},
      tagTranslations: {
        tags: {},
        genres: {},
        staffRoles: {},
      },
      generatedAt: "2026-03-10T00:00:00.000Z",
      payloadMode: "full",
    };

    render(
      <MemoryRouter initialEntries={["/projeto/projeto-teste/leitura/1?volume=2"]}>
        <ProjectReading />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        hasMetaCall(
          (arg) =>
            String(arg.image || "").includes("/api/og/project/projeto-teste") &&
            !String(arg.image || "").includes("/reading/") &&
            arg.type === "article",
        ),
      ).toBe(true);
    });
  });
});
