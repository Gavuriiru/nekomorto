import type { Project, ProjectEpisode } from "@/data/projects";
import { apiFetch } from "@/lib/api-client";
import { downloadBinaryResponse } from "@/lib/project-epub";
import { buildProjectSnapshotForMangaExport } from "@/lib/project-manga";

type ExportMangaChapterOptions = {
  apiBase: string;
  projectId: string;
  projectSnapshot: Project;
  chapter: Pick<ProjectEpisode, "number" | "volume">;
  format: "zip" | "cbz";
};

export const exportMangaChapter = async ({
  apiBase,
  projectId,
  projectSnapshot,
  chapter,
  format,
}: ExportMangaChapterOptions) => {
  const response = await apiFetch(
    apiBase,
    `/api/projects/${encodeURIComponent(projectId)}/manga-export/chapter`,
    {
      method: "POST",
      auth: true,
      json: {
        project: buildProjectSnapshotForMangaExport(projectSnapshot),
        chapterNumber: chapter.number,
        volume: chapter.volume,
        format,
      },
    },
  );

  if (!response.ok) {
    throw new Error("chapter_export_failed");
  }

  await downloadBinaryResponse(response, `capitulo-${Number(chapter.number) || 1}.${format}`);
};
