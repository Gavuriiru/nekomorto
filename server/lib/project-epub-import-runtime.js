const REQUIRED_DEPENDENCY_KEYS = [
  "backgroundJobQueue",
  "deleteEpubImportJobResult",
  "epubImportJobsDir",
  "epubImportResultTtlMs",
  "importProjectEpub",
  "loadEpubImportJobs",
  "loadUploads",
  "mapEpubImportExecutionError",
  "publicUploadsDir",
  "upsertEpubImportJob",
  "writeEpubImportJobResult",
  "writeUploads",
];

const assertRequiredDependencies = (dependencies = {}) => {
  const missing = REQUIRED_DEPENDENCY_KEYS.filter((key) => dependencies[key] === undefined);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `[project-epub-import-runtime] missing required dependencies: ${missing.sort().join(", ")}`,
  );
};

export const createProjectEpubImportRuntime = (dependencies = {}) => {
  assertRequiredDependencies(dependencies);

  const {
    backgroundJobQueue,
    deleteEpubImportJobResult,
    epubImportJobsDir,
    epubImportResultTtlMs,
    importProjectEpub,
    loadEpubImportJobs,
    loadUploads,
    mapEpubImportExecutionError,
    publicUploadsDir,
    upsertEpubImportJob,
    writeEpubImportJobResult,
    writeUploads,
  } = dependencies;

  const findEpubImportJobForUser = (jobId, actorId) =>
    loadEpubImportJobs().find(
      (entry) =>
        String(entry?.id || "") === String(jobId || "") &&
        String(entry?.requestedBy || "") === String(actorId || ""),
    ) || null;

  const expireEpubImportJob = (
    job,
    { error = "O resultado da importacao EPUB expirou. Envie o arquivo novamente." } = {},
  ) => {
    if (!job) {
      return null;
    }
    deleteEpubImportJobResult(job.resultPath);
    return upsertEpubImportJob({
      ...job,
      status: "expired",
      resultPath: null,
      error,
      finishedAt: job.finishedAt || new Date().toISOString(),
      expiresAt: job.expiresAt || new Date().toISOString(),
    });
  };

  const runEpubImportJob = async (
    jobId,
    { buffer, project, targetVolume, defaultStatus, uploadUserId } = {},
  ) => {
    const current = loadEpubImportJobs().find(
      (entry) => String(entry?.id || "") === String(jobId || ""),
    );
    if (!current) {
      return null;
    }

    let processing = upsertEpubImportJob({
      ...current,
      status: "processing",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      expiresAt: null,
      error: null,
    });

    try {
      const preview = await importProjectEpub({
        buffer,
        project,
        targetVolume,
        defaultStatus,
        uploadsDir: publicUploadsDir,
        loadUploads,
        writeUploads,
        uploadUserId,
      });
      const finishedAt = new Date();
      const resultPath = writeEpubImportJobResult({
        jobsDir: epubImportJobsDir,
        jobId: processing.id,
        result: preview,
      });
      processing = upsertEpubImportJob({
        ...processing,
        status: "completed",
        summary:
          preview?.summary && typeof preview.summary === "object" && !Array.isArray(preview.summary)
            ? preview.summary
            : {},
        resultPath,
        error: null,
        finishedAt: finishedAt.toISOString(),
        expiresAt: new Date(finishedAt.getTime() + epubImportResultTtlMs).toISOString(),
      });
      return processing;
    } catch (error) {
      deleteEpubImportJobResult(processing?.resultPath);
      const mappedError = mapEpubImportExecutionError(error);
      return upsertEpubImportJob({
        ...processing,
        status: "failed",
        resultPath: null,
        finishedAt: new Date().toISOString(),
        error: String(mappedError?.body?.detail || error?.message || error || "epub_import_failed"),
      });
    }
  };

  const enqueueEpubImportJob = (jobId, payload) =>
    backgroundJobQueue.enqueue({
      type: "project.epub_import",
      payload: {
        jobId,
        projectId: payload?.project?.id || payload?.rawProjectId || "",
        targetVolume: payload?.targetVolume ?? null,
      },
      run: async () => runEpubImportJob(jobId, payload),
    });

  const recoverEpubImportJobsAfterRestart = () => {
    loadEpubImportJobs().forEach((job) => {
      const normalizedStatus = String(job?.status || "")
        .trim()
        .toLowerCase();
      if (normalizedStatus === "completed") {
        const expiresAtTs = new Date(job?.expiresAt || 0).getTime();
        if (Number.isFinite(expiresAtTs) && expiresAtTs <= Date.now()) {
          expireEpubImportJob(job);
        }
        return;
      }
      if (normalizedStatus !== "queued" && normalizedStatus !== "processing") {
        return;
      }
      upsertEpubImportJob({
        ...job,
        status: "failed",
        resultPath: null,
        finishedAt: new Date().toISOString(),
        error: "A importacao EPUB foi interrompida porque o servidor reiniciou antes da conclusao.",
      });
    });
  };

  return {
    enqueueEpubImportJob,
    expireEpubImportJob,
    findEpubImportJobForUser,
    recoverEpubImportJobsAfterRestart,
    runEpubImportJob,
  };
};

export default createProjectEpubImportRuntime;
