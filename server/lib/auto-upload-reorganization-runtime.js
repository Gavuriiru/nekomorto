const AUTO_REORGANIZE_TRIGGER_TO_ACTION = Object.freeze({
  startup: "uploads.auto_reorganize.startup",
  "post-save": "uploads.auto_reorganize.post_save",
  "project-save": "uploads.auto_reorganize.project_save",
});

export const normalizeAutoReorganizationTrigger = (value) =>
  value === "startup" || value === "post-save" || value === "project-save" ? value : "post-save";

export const buildAutoReorganizationMeta = ({ trigger, report, durationMs, error }) => ({
  trigger,
  moves: Number(report?.appliedMovesCount || 0),
  rewrites: Number(report?.totalRewrites || 0),
  failures: Number(report?.moveFailuresCount || 0) + (error ? 1 : 0),
  durationMs: Number(durationMs || 0),
  ...(error ? { error: String(error?.message || error) } : {}),
});

const persistRewrittenDatasets = ({
  changedDatasets,
  rewritten,
  writeComments,
  writePages,
  writePosts,
  writeProjects,
  writeSiteSettings,
  writeUpdates,
  writeUploads,
  writeUsers,
}) => {
  if (changedDatasets.has("posts")) {
    writePosts(rewritten.posts);
  }
  if (changedDatasets.has("projects")) {
    writeProjects(rewritten.projects);
  }
  if (changedDatasets.has("users")) {
    writeUsers(rewritten.users);
  }
  if (changedDatasets.has("comments")) {
    writeComments(rewritten.comments);
  }
  if (changedDatasets.has("updates")) {
    writeUpdates(rewritten.updates);
  }
  if (changedDatasets.has("pages")) {
    writePages(rewritten.pages);
  }
  if (changedDatasets.has("siteSettings")) {
    writeSiteSettings(rewritten.siteSettings);
  }
  if (changedDatasets.has("uploads")) {
    writeUploads(rewritten.uploads);
  }
};

export const createAutoUploadReorganizationRuntime = ({
  appendAuditLog,
  createSystemAuditReq,
  isAutoUploadReorganizationEnabled,
  loadComments,
  loadPages,
  loadPosts,
  loadProjects,
  loadSiteSettings,
  loadUpdates,
  loadUploads,
  loadUsers,
  runUploadsReorganization,
  uploadsDir,
  writeComments,
  writePages,
  writePosts,
  writeProjects,
  writeSiteSettings,
  writeUpdates,
  writeUploads,
  writeUsers,
} = {}) => {
  let autoUploadReorganizationInFlight = null;
  const pendingAutoReorganizationTriggers = new Set();

  const runAutoUploadReorganization = async ({ trigger, req } = {}) => {
    if (!isAutoUploadReorganizationEnabled) {
      return { ok: false, skipped: true, reason: "disabled" };
    }

    const normalizedTrigger = normalizeAutoReorganizationTrigger(trigger);
    pendingAutoReorganizationTriggers.add(normalizedTrigger);

    if (autoUploadReorganizationInFlight) {
      return autoUploadReorganizationInFlight;
    }

    const runner = async () => {
      let latestResult = { ok: true, skipped: true };
      while (pendingAutoReorganizationTriggers.size > 0) {
        const batch = Array.from(pendingAutoReorganizationTriggers);
        pendingAutoReorganizationTriggers.clear();
        const triggerForRun = batch.includes("startup")
          ? "startup"
          : batch.includes("project-save")
            ? "project-save"
            : "post-save";
        const startedAt = Date.now();

        try {
          const datasets = {
            posts: loadPosts(),
            projects: loadProjects(),
            users: loadUsers(),
            comments: loadComments(),
            updates: loadUpdates(),
            pages: loadPages(),
            siteSettings: loadSiteSettings(),
            uploads: loadUploads(),
          };
          const report = runUploadsReorganization({
            datasets,
            uploadsDir,
            applyChanges: true,
          });
          const changedDatasets = new Set(
            Array.isArray(report?.changedDatasets) ? report.changedDatasets : [],
          );
          persistRewrittenDatasets({
            changedDatasets,
            rewritten: report.rewritten,
            writeComments,
            writePages,
            writePosts,
            writeProjects,
            writeSiteSettings,
            writeUpdates,
            writeUploads,
            writeUsers,
          });

          const durationMs = Date.now() - startedAt;
          const action = AUTO_REORGANIZE_TRIGGER_TO_ACTION[triggerForRun];
          appendAuditLog(
            req || createSystemAuditReq(),
            action,
            "uploads",
            buildAutoReorganizationMeta({
              trigger: triggerForRun,
              report,
              durationMs,
            }),
          );
          latestResult = { ok: true, trigger: triggerForRun, report, durationMs };
        } catch (error) {
          const durationMs = Date.now() - startedAt;
          appendAuditLog(
            req || createSystemAuditReq(),
            "uploads.auto_reorganize.failed",
            "uploads",
            buildAutoReorganizationMeta({
              trigger: triggerForRun,
              durationMs,
              error,
            }),
          );
          latestResult = { ok: false, trigger: triggerForRun, error, durationMs };
        }
      }
      return latestResult;
    };

    autoUploadReorganizationInFlight = runner().finally(() => {
      autoUploadReorganizationInFlight = null;
    });

    return autoUploadReorganizationInFlight;
  };

  return {
    runAutoUploadReorganization,
  };
};

export default {
  buildAutoReorganizationMeta,
  createAutoUploadReorganizationRuntime,
  normalizeAutoReorganizationTrigger,
};
