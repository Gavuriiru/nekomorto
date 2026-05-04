import type { ProjectRecord } from "@/components/dashboard/project-editor/dashboard-projects-editor-types";
import {
  buildEmptyProjectForm,
  buildProjectFormFromRecord,
  buildProjectSavePayload,
} from "@/components/dashboard/project-editor/project-editor-form";
import { describe, expect, it } from "vitest";

const projectRecordFixture: ProjectRecord = {
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
  heroLogoUrl: "/uploads/projects/project-1/hero-logo.png",
  heroLogoAlt: "Marca oficial do projeto",
  readerConfig: {},
  volumeEntries: [],
  volumeCovers: [],
  episodeDownloads: [],
  views: 0,
  commentsCount: 0,
  order: 0,
};

describe("project editor form hero logo fields", () => {
  it("hidrata heroLogoUrl e heroLogoAlt ao abrir um projeto existente", () => {
    const form = buildProjectFormFromRecord(projectRecordFixture);

    expect(form.heroLogoUrl).toBe("/uploads/projects/project-1/hero-logo.png");
    expect(form.heroLogoAlt).toBe("Marca oficial do projeto");
  });

  it("persiste heroLogoUrl e heroLogoAlt ao salvar o projeto", () => {
    const formState = {
      ...buildEmptyProjectForm(),
      id: "project-1",
      title: "Projeto Teste",
      type: "Anime",
      status: "Em andamento",
      heroLogoUrl: "/uploads/projects/project-1/hero-logo.png",
      heroLogoAlt: "Marca oficial do projeto",
    };

    const payload = buildProjectSavePayload({
      anilistIdInput: "",
      editingProject: null,
      formState,
      normalizedEpisodesForSave: [],
      normalizedVolumeEntriesForSave: [],
      staffMemberInput: {},
    });

    expect(payload.heroLogoUrl).toBe("/uploads/projects/project-1/hero-logo.png");
    expect(payload.heroLogoAlt).toBe("Marca oficial do projeto");
  });
});
