const REQUIRED_DEPENDENCY_KEYS = [
  "backgroundJobQueue",
  "deleteProjectImageExportJobResult",
  "deleteProjectImageImportJobResult",
  "ensureProjectImageExportJobsDirectory",
  "exportProjectImageCollection",
  "fsWriteFileSync",
  "importProjectImageChapters",
  "loadProjectImageExportJobs",
  "loadProjectImageImportJobs",
  "loadUploads",
  "mapProjectImageImportExecutionError",
  "pathBasename",
  "pathJoin",
  "projectImageExportJobsDir",
  "projectImageExportResultTtlMs",
  "projectImageImportJobsDir",
  "projectImageImportResultTtlMs",
  "publicUploadsDir",
  "upsertProjectImageExportJob",
  "upsertProjectImageImportJob",
  "writeProjectImageImportJobResult",
  "writeUploads",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[project-image-jobs-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createProjectImageJobsRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    backgroundJobQueue,
    deleteProjectImageExportJobResult,
    deleteProjectImageImportJobResult,
    ensureProjectImageExportJobsDirectory,
    exportProjectImageCollection,
    fsWriteFileSync,
    importProjectImageChapters,
    loadProjectImageExportJobs,
    loadProjectImageImportJobs,
    loadUploads,
    mapProjectImageImportExecutionError,
    pathBasename,
    pathJoin,
    projectImageExportJobsDir,
    projectImageExportResultTtlMs,
    projectImageImportJobsDir,
    projectImageImportResultTtlMs,
    publicUploadsDir,
    upsertProjectImageExportJob,
    upsertProjectImageImportJob,
    writeProjectImageImportJobResult,
    writeUploads,
  } = dependencies;

  const findProjectImageImportJobForUser = (jobId, actorId) =>
    loadProjectImageImportJobs().find(
      (entry) =>
        String(entry?.id || "") === String(jobId || "") &&
        String(entry?.requestedBy || "") === String(actorId || ""),
    ) || null;

  const expireProjectImageImportJob = (
    job,
    { error = "O resultado da importacao de imagens expirou. Envie o lote novamente." } = {},
  ) => {
    if (!job) {
      return null;
    }
    deleteProjectImageImportJobResult(job.resultPath);
    return upsertProjectImageImportJob({
      ...job,
      status: "expired",
      resultPath: null,
      error,
      finishedAt: job.finishedAt || new Date().toISOString(),
      expiresAt: job.expiresAt || new Date().toISOString(),
    });
  };

  const runProjectImageImportJob = async (
    jobId,
    {
      project,
      files,
      manifestEntries,
      archiveBuffer,
      archiveName,
      targetVolume,
      targetChapterNumber,
      defaultStatus,
    } = {},
  ) => {
    const current = loadProjectImageImportJobs().find(
      (entry) => String(entry?.id || "") === String(jobId || ""),
    );
    if (!current) {
      return null;
    }

    let processing = upsertProjectImageImportJob({
      ...current,
      status: "processing",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      expiresAt: null,
      error: null,
    });
    try {
      const result = await importProjectImageChapters({
        project,
        files,
        manifestEntries,
        archiveBuffer,
        archiveName,
        targetVolume,
        targetChapterNumber,
        defaultStatus,
        uploadsDir: publicUploadsDir,
        loadUploads,
        writeUploads,
      });
      const finishedAt = new Date();
      const resultPath = writeProjectImageImportJobResult({
        jobsDir: projectImageImportJobsDir,
        jobId: processing.id,
        result,
      });
      processing = upsertProjectImageImportJob({
        ...processing,
        status: "completed",
        summary:
          result?.summary && typeof result.summary === "object" && !Array.isArray(result.summary)
            ? result.summary
            : {},
        resultPath,
        error: null,
        finishedAt: finishedAt.toISOString(),
        expiresAt: new Date(finishedAt.getTime() + projectImageImportResultTtlMs).toISOString(),
      });
      return processing;
    } catch (error) {
      deleteProjectImageImportJobResult(processing?.resultPath);
      const mappedError = mapProjectImageImportExecutionError(error);
      return upsertProjectImageImportJob({
        ...processing,
        status: "failed",
        resultPath: null,
        finishedAt: new Date().toISOString(),
        error:
          String(mappedError?.body?.detail || "").trim() ||
          String(error?.message || error || "project_image_import_failed"),
      });
    }
  };

  const enqueueProjectImageImportJob = (jobId, payload) =>
    backgroundJobQueue.enqueue({
      type: "project.image_import",
      payload: {
        jobId,
        projectId: payload?.project?.id || "",
        targetVolume: payload?.targetVolume ?? null,
        targetChapterNumber: payload?.targetChapterNumber ?? null,
      },
      run: async () => runProjectImageImportJob(jobId, payload),
    });

  const buildProjectImageExportDownloadPath = (projectId, jobId) =>
    `/api/projects/${encodeURIComponent(String(projectId || ""))}/manga-export/jobs/${encodeURIComponent(String(jobId || ""))}/download`;

  const findProjectImageExportJobForUser = (jobId, actorId) =>
    loadProjectImageExportJobs().find(
      (entry) =>
        String(entry?.id || "") === String(jobId || "") &&
        String(entry?.requestedBy || "") === String(actorId || ""),
    ) || null;

  const expireProjectImageExportJob = (
    job,
    { error = "O arquivo exportado expirou. Gere a exportacao novamente." } = {},
  ) => {
    if (!job) {
      return null;
    }
    deleteProjectImageExportJobResult(job.resultPath);
    return upsertProjectImageExportJob({
      ...job,
      status: "expired",
      resultPath: null,
      error,
      finishedAt: job.finishedAt || new Date().toISOString(),
      expiresAt: job.expiresAt || new Date().toISOString(),
    });
  };

  const writeProjectImageExportResultFile = ({ jobId, fileName, buffer } = {}) => {
    const directory = ensureProjectImageExportJobsDirectory(projectImageExportJobsDir);
    const safeJobId = String(jobId || "").trim() || "project-image-export-job";
    const safeFileName = pathBasename(String(fileName || "export.zip"));
    const filePath = pathJoin(directory, `${safeJobId}-${safeFileName}`);
    fsWriteFileSync(filePath, buffer);
    return filePath;
  };

  const runProjectImageExportJob = async (jobId, { project, volume, includeDrafts } = {}) => {
    const current = loadProjectImageExportJobs().find(
      (entry) => String(entry?.id || "") === String(jobId || ""),
    );
    if (!current) {
      return null;
    }
    let processing = upsertProjectImageExportJob({
      ...current,
      status: "processing",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      expiresAt: null,
      error: null,
    });
    try {
      const result = exportProjectImageCollection({
        project,
        volume,
        uploadsDir: publicUploadsDir,
        includeDrafts,
      });
      const finishedAt = new Date();
      const resultPath = writeProjectImageExportResultFile({
        jobId: processing.id,
        fileName: result.filename,
        buffer: result.buffer,
      });
      processing = upsertProjectImageExportJob({
        ...processing,
        status: "completed",
        summary:
          result?.summary && typeof result.summary === "object" && !Array.isArray(result.summary)
            ? {
                ...result.summary,
                filename: result.filename,
                contentType: result.contentType,
              }
            : {},
        resultPath,
        error: null,
        finishedAt: finishedAt.toISOString(),
        expiresAt: new Date(finishedAt.getTime() + projectImageExportResultTtlMs).toISOString(),
      });
      return processing;
    } catch (error) {
      deleteProjectImageExportJobResult(processing?.resultPath);
      return upsertProjectImageExportJob({
        ...processing,
        status: "failed",
        resultPath: null,
        finishedAt: new Date().toISOString(),
        error: String(error?.message || error || "project_image_export_failed"),
      });
    }
  };

  const enqueueProjectImageExportJob = (jobId, payload) =>
    backgroundJobQueue.enqueue({
      type: "project.image_export",
      payload: {
        jobId,
        projectId: payload?.project?.id || "",
        volume: payload?.volume ?? null,
      },
      run: async () => runProjectImageExportJob(jobId, payload),
    });

  const recoverProjectImageJobsAfterRestart = () => {
    loadProjectImageImportJobs().forEach((job) => {
      const normalizedStatus = String(job?.status || "")
        .trim()
        .toLowerCase();
      if (normalizedStatus === "completed") {
        const expiresAtTs = new Date(job?.expiresAt || 0).getTime();
        if (Number.isFinite(expiresAtTs) && expiresAtTs <= Date.now()) {
          expireProjectImageImportJob(job);
        }
        return;
      }
      if (normalizedStatus !== "queued" && normalizedStatus !== "processing") {
        return;
      }
      upsertProjectImageImportJob({
        ...job,
        status: "failed",
        resultPath: null,
        finishedAt: new Date().toISOString(),
        error:
          "A importacao de imagens foi interrompida porque o servidor reiniciou antes da conclusao.",
      });
    });

    loadProjectImageExportJobs().forEach((job) => {
      const normalizedStatus = String(job?.status || "")
        .trim()
        .toLowerCase();
      if (normalizedStatus === "completed") {
        const expiresAtTs = new Date(job?.expiresAt || 0).getTime();
        if (Number.isFinite(expiresAtTs) && expiresAtTs <= Date.now()) {
          expireProjectImageExportJob(job);
        }
        return;
      }
      if (normalizedStatus !== "queued" && normalizedStatus !== "processing") {
        return;
      }
      upsertProjectImageExportJob({
        ...job,
        status: "failed",
        resultPath: null,
        finishedAt: new Date().toISOString(),
        error:
          "A exportacao de imagens foi interrompida porque o servidor reiniciou antes da conclusao.",
      });
    });
  };

  return {
    buildProjectImageExportDownloadPath,
    enqueueProjectImageExportJob,
    enqueueProjectImageImportJob,
    expireProjectImageExportJob,
    expireProjectImageImportJob,
    findProjectImageExportJobForUser,
    findProjectImageImportJobForUser,
    recoverProjectImageJobsAfterRestart,
    runProjectImageExportJob,
    runProjectImageImportJob,
  };
};

export default createProjectImageJobsRuntime;
