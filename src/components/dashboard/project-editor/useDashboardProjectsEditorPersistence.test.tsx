import type {
  ProjectForm,
  ProjectRecord,
} from "@/components/dashboard/project-editor/dashboard-projects-editor-types";
import { buildEmptyProjectForm } from "@/components/dashboard/project-editor/project-editor-form";
import { useDashboardProjectsEditorPersistence } from "@/components/dashboard/project-editor/useDashboardProjectsEditorPersistence";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const refetchPublicBootstrapCacheMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/components/ui/use-toast", () => ({
  toast: toastMock,
}));

vi.mock("@/hooks/use-public-bootstrap", () => ({
  refetchPublicBootstrapCache: refetchPublicBootstrapCacheMock,
}));

vi.mock("@/lib/api-client", () => ({
  apiFetch: apiFetchMock,
}));

const createJsonResponse = (ok: boolean, payload: unknown, status = ok ? 200 : 500) =>
  ({
    ok,
    status,
    json: async () => payload,
  }) as Response;

const createProjectRecord = (overrides: Partial<ProjectRecord> = {}): ProjectRecord => ({
  id: "project-1",
  anilistId: null,
  title: "Projeto Teste",
  titleOriginal: "",
  titleEnglish: "",
  synopsis: "Sinopse",
  description: "Sinopse",
  type: "Anime",
  status: "Em andamento",
  year: "",
  studio: "",
  animationStudios: [],
  episodes: "",
  tags: [],
  genres: [],
  cover: "",
  coverAlt: "",
  banner: "",
  bannerAlt: "",
  season: "",
  schedule: "",
  rating: "",
  country: "",
  source: "",
  discordRoleId: "",
  producers: [],
  score: null,
  startDate: "",
  endDate: "",
  relations: [],
  staff: [],
  animeStaff: [],
  trailerUrl: "",
  forceHero: false,
  heroImageUrl: "",
  heroImageAlt: "",
  readerConfig: {},
  volumeEntries: [],
  volumeCovers: [],
  episodeDownloads: [],
  views: 0,
  commentsCount: 0,
  order: 0,
  ...overrides,
});

const createFormState = (overrides: Partial<ProjectForm> = {}): ProjectForm => ({
  ...buildEmptyProjectForm(),
  title: "Projeto Teste",
  type: "Anime",
  status: "Em andamento",
  ...overrides,
});

const createOptions = (
  overrides: Partial<Parameters<typeof useDashboardProjectsEditorPersistence>[0]> = {},
) => ({
  anilistIdInput: "",
  apiBase: "http://api.local",
  closeEditor: vi.fn(),
  deleteTarget: null,
  editingProject: null,
  episodeSizeDrafts: {},
  episodeSizeErrors: {},
  episodeSizeInputRefs: { current: {} },
  formState: createFormState(),
  markEditorSnapshot: vi.fn(),
  projects: [],
  refreshProjects: vi.fn(async () => undefined),
  restoreWindowMs: 3 * 24 * 60 * 60 * 1000,
  revealEpisodeAtIndex: vi.fn(),
  setDeleteTarget: vi.fn(),
  setEditorAccordionValue: vi.fn(),
  setEpisodeSizeDrafts: vi.fn(),
  setEpisodeSizeErrors: vi.fn(),
  setFormState: vi.fn(),
  setProjects: vi.fn(),
  staffMemberInput: {},
  ...overrides,
});

describe("useDashboardProjectsEditorPersistence", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
    refetchPublicBootstrapCacheMock.mockReset();
    refetchPublicBootstrapCacheMock.mockResolvedValue(undefined);
  });

  it("refaz o bootstrap público após salvar o projeto", async () => {
    apiFetchMock.mockResolvedValueOnce(
      createJsonResponse(true, {
        project: createProjectRecord(),
      }),
    );

    const options = createOptions();
    const { result } = renderHook(() => useDashboardProjectsEditorPersistence(options));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(refetchPublicBootstrapCacheMock).toHaveBeenCalledWith("http://api.local");
    expect(options.closeEditor).toHaveBeenCalledTimes(1);
  });

  it("refaz o bootstrap público após excluir o projeto", async () => {
    apiFetchMock.mockResolvedValueOnce(createJsonResponse(true, {}));

    const deleteTarget = createProjectRecord();
    const options = createOptions({
      deleteTarget,
      editingProject: deleteTarget,
    });
    const { result } = renderHook(() => useDashboardProjectsEditorPersistence(options));

    await act(async () => {
      await result.current.handleDelete();
    });

    expect(refetchPublicBootstrapCacheMock).toHaveBeenCalledWith("http://api.local");
    expect(options.refreshProjects).toHaveBeenCalledTimes(1);
  });

  it("refaz o bootstrap público após restaurar o projeto", async () => {
    const restoredProject = createProjectRecord({ deletedAt: null });
    apiFetchMock.mockResolvedValueOnce(
      createJsonResponse(true, {
        project: restoredProject,
      }),
    );

    const options = createOptions();
    const { result } = renderHook(() => useDashboardProjectsEditorPersistence(options));

    await act(async () => {
      await result.current.handleRestoreProject(
        createProjectRecord({ deletedAt: "2026-04-01T00:00:00.000Z" }),
      );
    });

    expect(refetchPublicBootstrapCacheMock).toHaveBeenCalledWith("http://api.local");
    expect(options.setProjects).toHaveBeenCalledTimes(1);
  });

  it("abre a seção de episódios e bloqueia o save local quando há publicação sem acesso público real", async () => {
    const options = createOptions({
      formState: createFormState({
        type: "Anime",
        episodeDownloads: [
          {
            number: 1,
            title: "Episódio 1",
            synopsis: "",
            releaseDate: "",
            duration: "",
            sourceType: "Web",
            sources: [],
            content: "",
            contentFormat: "lexical",
            publicationStatus: "published",
            completedStages: [],
          },
        ],
      }),
    });
    const { result } = renderHook(() => useDashboardProjectsEditorPersistence(options));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(options.setEditorAccordionValue).toHaveBeenCalledTimes(1);
    expect(options.revealEpisodeAtIndex).toHaveBeenCalledWith(0);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Não foi possível publicar o episódio",
        variant: "destructive",
      }),
    );
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("permite salvar metadados quando o episÃ³dio publicado jÃ¡ estava sem fonte antes da ediÃ§Ã£o", async () => {
    const brokenPublishedEpisode = {
      number: 1,
      title: "EpisÃ³dio 1",
      synopsis: "",
      releaseDate: "",
      duration: "",
      sourceType: "Web" as const,
      sources: [],
      content: "",
      contentFormat: "lexical" as const,
      publicationStatus: "published" as const,
      completedStages: [],
    };
    const editingProject = createProjectRecord({
      episodeDownloads: [brokenPublishedEpisode],
    });
    const savedProject = createProjectRecord({
      title: "Projeto Teste Atualizado",
      episodeDownloads: [brokenPublishedEpisode],
    });
    apiFetchMock.mockResolvedValueOnce(createJsonResponse(true, { project: savedProject }));

    const options = createOptions({
      editingProject,
      formState: createFormState({
        title: "Projeto Teste Atualizado",
        type: "Anime",
        episodeDownloads: [brokenPublishedEpisode],
      }),
    });
    const { result } = renderHook(() => useDashboardProjectsEditorPersistence(options));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      "http://api.local",
      "/api/projects/project-1",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(options.closeEditor).toHaveBeenCalledTimes(1);
  });

  it("mostra toast destrutivo quando o save falha antes da resposta HTTP", async () => {
    apiFetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const options = createOptions();
    const { result } = renderHook(() => useDashboardProjectsEditorPersistence(options));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "N\u00E3o foi poss\u00EDvel salvar o projeto",
        variant: "destructive",
      }),
    );
    expect(options.closeEditor).not.toHaveBeenCalled();
  });
});
