import { describe, expect, it, vi } from "vitest";

import { createDataRepositoryAdaptersRuntime } from "../../server/lib/data-repository-adapters-runtime.js";

const createRepository = () => ({
  loadSecurityEvents: vi.fn(() => [{ id: "event-1" }]),
  upsertSecurityEvent: vi.fn((event) => ({ ...event, saved: true })),
  loadAdminExportJobs: vi.fn(() => [{ id: "export-1" }]),
  upsertAdminExportJob: vi.fn((job) => ({ ...job, saved: true })),
  loadWebhookDeliveries: vi.fn(() => [{ id: "delivery-1" }]),
  findWebhookDelivery: vi.fn((id) => ({ id })),
  upsertWebhookDelivery: vi.fn((delivery) => ({ ...delivery, saved: true })),
  claimWebhookDelivery: vi.fn(async (options) => ({ ...options, claimed: true })),
  loadWebhookState: vi.fn((key) => ({ key, ok: true })),
  writeWebhookState: vi.fn((key, data) => ({ key, data })),
  loadEpubImportJobs: vi.fn(() => [{ id: "epub-1" }]),
  isEpubImportJobStorageAvailable: vi.fn(() => true),
  upsertEpubImportJob: vi.fn((job) => ({ ...job, saved: true })),
  loadProjectImageImportJobs: vi.fn(() => [{ id: "img-import-1" }]),
  isProjectImageImportJobStorageAvailable: vi.fn(() => true),
  upsertProjectImageImportJob: vi.fn((job) => ({ ...job, saved: true })),
  loadProjectImageExportJobs: vi.fn(() => [{ id: "img-export-1" }]),
  isProjectImageExportJobStorageAvailable: vi.fn(() => true),
  upsertProjectImageExportJob: vi.fn((job) => ({ ...job, saved: true })),
  loadSecretRotations: vi.fn(() => [{ id: "rotation-1" }]),
  appendSecretRotation: vi.fn((entry) => ({ ...entry, saved: true })),
});

describe("data-repository-adapters-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createDataRepositoryAdaptersRuntime()).toThrow(
      /missing required dependencies/i,
    );
  });

  it("delegates all supported repository methods", async () => {
    const dataRepository = createRepository();
    const runtime = createDataRepositoryAdaptersRuntime({ dataRepository });

    expect(runtime.loadSecurityEvents()).toEqual([{ id: "event-1" }]);
    expect(runtime.upsertSecurityEvent({ id: "event-2" })).toEqual({
      id: "event-2",
      saved: true,
    });
    expect(runtime.loadAdminExportJobs()).toEqual([{ id: "export-1" }]);
    expect(runtime.upsertAdminExportJob({ id: "export-2" })).toEqual({
      id: "export-2",
      saved: true,
    });
    expect(runtime.loadWebhookDeliveries()).toEqual([{ id: "delivery-1" }]);
    expect(runtime.findWebhookDelivery("delivery-2")).toEqual({ id: "delivery-2" });
    expect(runtime.upsertWebhookDelivery({ id: "delivery-3" })).toEqual({
      id: "delivery-3",
      saved: true,
    });
    await expect(runtime.claimWebhookDelivery({ workerId: "worker-1" })).resolves.toEqual({
      workerId: "worker-1",
      claimed: true,
    });
    expect(runtime.loadWebhookState("ops")).toEqual({ key: "ops", ok: true });
    expect(runtime.writeWebhookState("ops", { baseline: true })).toEqual({
      key: "ops",
      data: { baseline: true },
    });
    expect(runtime.loadEpubImportJobs()).toEqual([{ id: "epub-1" }]);
    expect(runtime.isEpubImportJobStorageAvailable()).toBe(true);
    expect(runtime.upsertEpubImportJob({ id: "epub-2" })).toEqual({
      id: "epub-2",
      saved: true,
    });
    expect(runtime.loadProjectImageImportJobs()).toEqual([{ id: "img-import-1" }]);
    expect(runtime.isProjectImageImportJobStorageAvailable()).toBe(true);
    expect(runtime.upsertProjectImageImportJob({ id: "img-import-2" })).toEqual({
      id: "img-import-2",
      saved: true,
    });
    expect(runtime.loadProjectImageExportJobs()).toEqual([{ id: "img-export-1" }]);
    expect(runtime.isProjectImageExportJobStorageAvailable()).toBe(true);
    expect(runtime.upsertProjectImageExportJob({ id: "img-export-2" })).toEqual({
      id: "img-export-2",
      saved: true,
    });
    expect(runtime.loadSecretRotations()).toEqual([{ id: "rotation-1" }]);
    expect(runtime.appendSecretRotation({ id: "rotation-2" })).toEqual({
      id: "rotation-2",
      saved: true,
    });
  });

  it("returns safe fallbacks when repository methods are unavailable", async () => {
    const runtime = createDataRepositoryAdaptersRuntime({ dataRepository: {} });

    expect(runtime.loadSecurityEvents()).toEqual([]);
    expect(runtime.upsertSecurityEvent({ id: "event" })).toBeNull();
    expect(runtime.loadAdminExportJobs()).toEqual([]);
    expect(runtime.upsertAdminExportJob({ id: "job" })).toBeNull();
    expect(runtime.loadWebhookDeliveries()).toEqual([]);
    expect(runtime.findWebhookDelivery("x")).toBeNull();
    expect(runtime.upsertWebhookDelivery({ id: "x" })).toBeNull();
    await expect(runtime.claimWebhookDelivery({ workerId: "x" })).resolves.toBeNull();
    expect(runtime.loadWebhookState("x")).toBeNull();
    expect(runtime.writeWebhookState("x", {})).toBeNull();
    expect(runtime.loadEpubImportJobs()).toEqual([]);
    expect(runtime.isEpubImportJobStorageAvailable()).toBe(false);
    expect(runtime.upsertEpubImportJob({ id: "x" })).toBeNull();
    expect(runtime.loadProjectImageImportJobs()).toEqual([]);
    expect(runtime.isProjectImageImportJobStorageAvailable()).toBe(false);
    expect(runtime.upsertProjectImageImportJob({ id: "x" })).toBeNull();
    expect(runtime.loadProjectImageExportJobs()).toEqual([]);
    expect(runtime.isProjectImageExportJobStorageAvailable()).toBe(false);
    expect(runtime.upsertProjectImageExportJob({ id: "x" })).toBeNull();
    expect(runtime.loadSecretRotations()).toEqual([]);
    expect(runtime.appendSecretRotation({ id: "x" })).toBeNull();
  });
});
