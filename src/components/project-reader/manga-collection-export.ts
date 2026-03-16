import type { Project } from "@/data/projects";
import { apiFetch } from "@/lib/api-client";
import { downloadBinaryResponse } from "@/lib/project-epub";
import {
  buildProjectSnapshotForMangaExport,
  normalizeProjectImageExportJob,
} from "@/lib/project-manga";

type ExportMangaCollectionZipOptions = {
  apiBase: string;
  projectId: string;
  projectSnapshot: Project;
  volume: number | null;
  includeDrafts: boolean;
  fallbackName: string;
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const exportMangaCollectionZip = async ({
  apiBase,
  projectId,
  projectSnapshot,
  volume,
  includeDrafts,
  fallbackName,
}: ExportMangaCollectionZipOptions) => {
  const response = await apiFetch(
    apiBase,
    `/api/projects/${encodeURIComponent(projectId)}/manga-export/jobs`,
    {
      method: "POST",
      auth: true,
      json: {
        project: buildProjectSnapshotForMangaExport(projectSnapshot),
        volume,
        includeDrafts,
      },
    },
  );
  if (!response.ok) {
    throw new Error("export_start_failed");
  }

  const data = (await response.json().catch(() => null)) as { job?: unknown } | null;
  const initialJob = normalizeProjectImageExportJob(data?.job);
  if (!initialJob) {
    throw new Error("export_job_invalid");
  }

  let finalJob = initialJob;
  while (finalJob.status === "queued" || finalJob.status === "processing") {
    await sleep(2000);
    const pollResponse = await apiFetch(
      apiBase,
      `/api/projects/${encodeURIComponent(projectId)}/manga-export/jobs/${encodeURIComponent(finalJob.id)}`,
      {
        auth: true,
        cache: "no-store",
      },
    );
    if (!pollResponse.ok) {
      throw new Error("export_job_failed");
    }
    const pollData = (await pollResponse.json().catch(() => null)) as { job?: unknown } | null;
    const polledJob = normalizeProjectImageExportJob(pollData?.job);
    if (!polledJob) {
      throw new Error("export_job_invalid");
    }
    finalJob = polledJob;
  }

  if (finalJob.status !== "completed" || !finalJob.downloadPath) {
    throw new Error(finalJob.error || "export_failed");
  }

  const downloadResponse = await apiFetch(apiBase, finalJob.downloadPath, { auth: true });
  if (!downloadResponse.ok) {
    throw new Error("export_download_failed");
  }

  await downloadBinaryResponse(downloadResponse, fallbackName);
};
