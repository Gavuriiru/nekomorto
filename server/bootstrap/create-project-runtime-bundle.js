import { createProjectEpubImportRuntime } from "../lib/project-epub-import-runtime.js";
import { createProjectImportRequestRuntime } from "../lib/project-import-request-runtime.js";
import { createProjectImageJobsRuntime } from "../lib/project-image-jobs-runtime.js";
import { assertRequiredDependencies } from "./assert-required-dependencies.js";

const PROJECT_RUNTIME_DEPENDENCY_KEYS = [
  "EPUB_IMPORT_MULTIPART_LIMITS",
  "PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS",
  "backgroundJobQueue",
  "deleteEpubImportJobResult",
  "deleteProjectImageExportJobResult",
  "deleteProjectImageImportJobResult",
  "ensureProjectImageExportJobsDirectory",
  "epubImportJobsDir",
  "epubImportResultTtlMs",
  "exportProjectImageCollection",
  "express",
  "findDuplicateEpisodeKey",
  "findDuplicateVolumeCover",
  "fsWriteFileSync",
  "importProjectEpub",
  "importProjectImageChapters",
  "loadEpubImportJobs",
  "loadProjectImageExportJobs",
  "loadProjectImageImportJobs",
  "loadUploads",
  "mapEpubImportExecutionError",
  "mapEpubImportMultipartError",
  "mapProjectImageImportExecutionError",
  "mapProjectImageImportMultipartError",
  "multer",
  "normalizeProjects",
  "pathBasename",
  "pathJoin",
  "projectImageExportJobsDir",
  "projectImageExportResultTtlMs",
  "projectImageImportJobsDir",
  "projectImageImportResultTtlMs",
  "publicUploadsDir",
  "upsertEpubImportJob",
  "upsertProjectImageExportJob",
  "upsertProjectImageImportJob",
  "writeEpubImportJobResult",
  "writeProjectImageImportJobResult",
  "writeUploads",
];

export const createProjectRuntimeBundle = (dependencies = {}) => {
  assertRequiredDependencies(
    "createProjectRuntimeBundle",
    dependencies,
    PROJECT_RUNTIME_DEPENDENCY_KEYS,
  );

  const requestRuntime = createProjectImportRequestRuntime({
    EPUB_IMPORT_MULTIPART_LIMITS: dependencies.EPUB_IMPORT_MULTIPART_LIMITS,
    PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS: dependencies.PROJECT_IMAGE_IMPORT_MULTIPART_LIMITS,
    express: dependencies.express,
    findDuplicateEpisodeKey: dependencies.findDuplicateEpisodeKey,
    findDuplicateVolumeCover: dependencies.findDuplicateVolumeCover,
    mapEpubImportMultipartError: dependencies.mapEpubImportMultipartError,
    mapProjectImageImportMultipartError: dependencies.mapProjectImageImportMultipartError,
    multer: dependencies.multer,
    normalizeProjects: dependencies.normalizeProjects,
  });

  const epubImportRuntime = createProjectEpubImportRuntime({
    backgroundJobQueue: dependencies.backgroundJobQueue,
    deleteEpubImportJobResult: dependencies.deleteEpubImportJobResult,
    epubImportJobsDir: dependencies.epubImportJobsDir,
    epubImportResultTtlMs: dependencies.epubImportResultTtlMs,
    importProjectEpub: dependencies.importProjectEpub,
    loadEpubImportJobs: dependencies.loadEpubImportJobs,
    loadUploads: dependencies.loadUploads,
    mapEpubImportExecutionError: dependencies.mapEpubImportExecutionError,
    publicUploadsDir: dependencies.publicUploadsDir,
    upsertEpubImportJob: dependencies.upsertEpubImportJob,
    writeEpubImportJobResult: dependencies.writeEpubImportJobResult,
    writeUploads: dependencies.writeUploads,
  });

  const projectImageJobsRuntime = createProjectImageJobsRuntime({
    backgroundJobQueue: dependencies.backgroundJobQueue,
    deleteProjectImageExportJobResult: dependencies.deleteProjectImageExportJobResult,
    deleteProjectImageImportJobResult: dependencies.deleteProjectImageImportJobResult,
    ensureProjectImageExportJobsDirectory: dependencies.ensureProjectImageExportJobsDirectory,
    exportProjectImageCollection: dependencies.exportProjectImageCollection,
    fsWriteFileSync: dependencies.fsWriteFileSync,
    importProjectImageChapters: dependencies.importProjectImageChapters,
    loadProjectImageExportJobs: dependencies.loadProjectImageExportJobs,
    loadProjectImageImportJobs: dependencies.loadProjectImageImportJobs,
    loadUploads: dependencies.loadUploads,
    mapProjectImageImportExecutionError: dependencies.mapProjectImageImportExecutionError,
    pathBasename: dependencies.pathBasename,
    pathJoin: dependencies.pathJoin,
    projectImageExportJobsDir: dependencies.projectImageExportJobsDir,
    projectImageExportResultTtlMs: dependencies.projectImageExportResultTtlMs,
    projectImageImportJobsDir: dependencies.projectImageImportJobsDir,
    projectImageImportResultTtlMs: dependencies.projectImageImportResultTtlMs,
    publicUploadsDir: dependencies.publicUploadsDir,
    upsertProjectImageExportJob: dependencies.upsertProjectImageExportJob,
    upsertProjectImageImportJob: dependencies.upsertProjectImageImportJob,
    writeProjectImageImportJobResult: dependencies.writeProjectImageImportJobResult,
    writeUploads: dependencies.writeUploads,
  });

  return {
    ...requestRuntime,
    ...epubImportRuntime,
    ...projectImageJobsRuntime,
  };
};

export default createProjectRuntimeBundle;
