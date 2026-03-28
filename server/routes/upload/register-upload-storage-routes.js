import { loadUploadsCleanupDatasets } from "./upload-route-utils.js";

export const registerUploadStorageRoutes = (deps) => {
  const {
    app,
    appendAuditLog,
    buildManagedStorageAreaSummary,
    canManageUploads,
    invalidateUploadsCleanupPreviewCache,
    loadCachedUploadsCleanupPreview,
    loadComments,
    loadLinkTypes,
    loadPages,
    loadPosts,
    loadProjects,
    loadSiteSettings,
    loadUpdates,
    loadUploads,
    loadUsers,
    runUploadsCleanup,
    uploadStorageService,
    writeUploads,
  } = deps;

  app.get("/api/uploads/storage/areas", deps.requireAuth, (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageUploads(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }
    const summary = buildManagedStorageAreaSummary(loadUploads());
    return res.json(summary);
  });

  app.get("/api/uploads/storage/cleanup", deps.requireAuth, async (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageUploads(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    const report = await loadCachedUploadsCleanupPreview(async () =>
      runUploadsCleanup({
        datasets: loadUploadsCleanupDatasets({
          loadComments,
          loadLinkTypes,
          loadPages,
          loadPosts,
          loadProjects,
          loadSiteSettings,
          loadUpdates,
          loadUploads,
          loadUsers,
        }),
        uploadsDir: deps.PUBLIC_UPLOADS_DIR,
        applyChanges: false,
        exampleLimit: 8,
        storageService: uploadStorageService,
      }),
    );

    return res.json({
      generatedAt: report.generatedAt,
      unusedCount: report.unusedCount,
      unusedUploadCount: report.unusedUploadCount,
      orphanedVariantFilesCount: report.orphanedVariantFilesCount,
      orphanedVariantDirsCount: report.orphanedVariantDirsCount,
      looseOriginalFilesCount: report.looseOriginalFilesCount,
      looseOriginalTotals: report.looseOriginalTotals,
      quarantinePendingDeleteCount: report.quarantinePendingDeleteCount,
      quarantinePendingDeleteTotals: report.quarantinePendingDeleteTotals,
      totals: report.totals,
      areas: report.areas,
      examples: report.examples,
    });
  });

  app.post("/api/uploads/storage/cleanup", deps.requireAuth, async (req, res) => {
    const sessionUser = req.session.user;
    if (!canManageUploads(sessionUser?.id)) {
      return res.status(403).json({ error: "forbidden" });
    }

    if (String(req.body?.confirm || "").trim() !== "EXCLUIR") {
      return res.status(400).json({ error: "confirm_required" });
    }

    try {
      invalidateUploadsCleanupPreviewCache();
      const report = await runUploadsCleanup({
        datasets: loadUploadsCleanupDatasets({
          loadComments,
          loadLinkTypes,
          loadPages,
          loadPosts,
          loadProjects,
          loadSiteSettings,
          loadUpdates,
          loadUploads,
          loadUsers,
        }),
        uploadsDir: deps.PUBLIC_UPLOADS_DIR,
        applyChanges: true,
        exampleLimit: 8,
        storageService: uploadStorageService,
      });

      if (report.changed) {
        writeUploads(report.rewritten.uploads);
      }

      appendAuditLog(req, "uploads.cleanup_unused", "uploads", {
        deletedCount: report.deletedCount,
        deletedUnusedUploadsCount: report.deletedUnusedUploadsCount,
        deletedOrphanedVariantFilesCount: report.deletedOrphanedVariantFilesCount,
        deletedOrphanedVariantDirsCount: report.deletedOrphanedVariantDirsCount,
        quarantinedLooseOriginalFilesCount: report.quarantinedLooseOriginalFilesCount,
        deletedQuarantineFilesCount: report.deletedQuarantineFilesCount,
        deletedQuarantineDirsCount: report.deletedQuarantineDirsCount,
        failedCount: report.failedCount,
        freedBytes: Number(report.deletedTotals?.totalBytes || 0),
        quarantinedBytes: Number(report.quarantinedTotals?.totalBytes || 0),
        purgedQuarantineBytes: Number(report.purgedQuarantineTotals?.totalBytes || 0),
        failures: report.failures,
      });
      invalidateUploadsCleanupPreviewCache();

      return res.json({
        ok: report.failedCount === 0,
        deletedCount: report.deletedCount,
        deletedUnusedUploadsCount: report.deletedUnusedUploadsCount,
        deletedOrphanedVariantFilesCount: report.deletedOrphanedVariantFilesCount,
        deletedOrphanedVariantDirsCount: report.deletedOrphanedVariantDirsCount,
        quarantinedLooseOriginalFilesCount: report.quarantinedLooseOriginalFilesCount,
        deletedQuarantineFilesCount: report.deletedQuarantineFilesCount,
        deletedQuarantineDirsCount: report.deletedQuarantineDirsCount,
        failedCount: report.failedCount,
        deletedTotals: report.deletedTotals,
        quarantinedTotals: report.quarantinedTotals,
        purgedQuarantineTotals: report.purgedQuarantineTotals,
        failures: report.failures,
      });
    } catch {
      return res.status(500).json({ error: "cleanup_failed" });
    }
  });
};
