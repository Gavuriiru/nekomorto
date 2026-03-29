export const buildAdminExportRuntimeDependencies = (dependencies = {}) => ({
  AccessRole: dependencies.AccessRole,
  adminExportMaxRows: dependencies.adminExportMaxRows ?? dependencies.ADMIN_EXPORT_MAX_ROWS,
  adminExportTtlHours:
    dependencies.adminExportTtlHours ?? dependencies.ADMIN_EXPORT_TTL_HOURS,
  adminExportsDir: dependencies.adminExportsDir,
  appendAuditLog: dependencies.appendAuditLog,
  backgroundJobQueue: dependencies.backgroundJobQueue,
  createSystemAuditReq: dependencies.createSystemAuditReq,
  filterByDateRange: dependencies.filterByDateRange,
  filterExportEntries: dependencies.filterExportEntries,
  loadAdminExportJobs: dependencies.loadAdminExportJobs,
  loadAuditLog: dependencies.loadAuditLog,
  loadOwnerIds: dependencies.loadOwnerIds,
  loadSecurityEvents: dependencies.loadSecurityEvents,
  loadUserSessionIndexRecords: dependencies.loadUserSessionIndexRecords,
  loadUsers: dependencies.loadUsers,
  metricsRegistry: dependencies.metricsRegistry,
  normalizeExportDataset: dependencies.normalizeExportDataset,
  normalizeExportFilters: dependencies.normalizeExportFilters,
  normalizeExportStatus: dependencies.normalizeExportStatus,
  normalizeUsers: dependencies.normalizeUsers,
  upsertAdminExportJob: dependencies.upsertAdminExportJob,
  writeExportFile: dependencies.writeExportFile,
});

export default buildAdminExportRuntimeDependencies;
