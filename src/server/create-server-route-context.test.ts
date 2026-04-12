import { describe, expect, it } from "vitest";

import { createServerRouteContext } from "../../server/bootstrap/create-server-route-context.js";

describe("createServerRouteContext", () => {
  it("groups route dependencies by domain and keeps app at the root", () => {
    const app = { get: () => {} };
    const context = createServerRouteContext({
      app,
      appendAuditLog: "appendAuditLog",
      PRIMARY_APP_ORIGIN: "https://nekomata.moe",
      PUBLIC_UPLOADS_DIR: "/uploads",
      canManageUploads: "canManageUploads",
      loadComments: "loadComments",
      loadLinkTypes: "loadLinkTypes",
      loadPages: "loadPages",
      loadPosts: "loadPosts",
      loadProjects: "loadProjects",
      loadSiteSettings: "loadSiteSettings",
      loadUpdates: "loadUpdates",
      loadUploads: "loadUploads",
      loadUsers: "loadUsers",
      normalizeUploadScopeUserId: "normalizeUploadScopeUserId",
      requireAuth: "requireAuth",
      resolveRequestUploadAccessScope: "resolveRequestUploadAccessScope",
      resolveThemeColor: "resolveThemeColor",
      unknownDependency: "ignore-me",
    });

    expect(context.app).toBe(app);
    expect(context.admin.appendAuditLog).toBe("appendAuditLog");
    expect(context.content.PRIMARY_APP_ORIGIN).toBe("https://nekomata.moe");
    expect(context.upload.PRIMARY_APP_ORIGIN).toBe("https://nekomata.moe");
    expect(context.upload.PUBLIC_UPLOADS_DIR).toBe("/uploads");
    expect(context.upload.canManageUploads).toBe("canManageUploads");
    expect(context.upload.loadComments).toBe("loadComments");
    expect(context.upload.loadLinkTypes).toBe("loadLinkTypes");
    expect(context.upload.loadPages).toBe("loadPages");
    expect(context.upload.loadPosts).toBe("loadPosts");
    expect(context.upload.loadProjects).toBe("loadProjects");
    expect(context.upload.loadSiteSettings).toBe("loadSiteSettings");
    expect(context.upload.loadUpdates).toBe("loadUpdates");
    expect(context.upload.loadUploads).toBe("loadUploads");
    expect(context.upload.loadUsers).toBe("loadUsers");
    expect(context.upload.normalizeUploadScopeUserId).toBe("normalizeUploadScopeUserId");
    expect(context.upload.resolveRequestUploadAccessScope).toBe("resolveRequestUploadAccessScope");
    expect(context.site.resolveThemeColor).toBe("resolveThemeColor");
    expect(context.user.requireAuth).toBe("requireAuth");
    expect(context).not.toHaveProperty("appendAuditLog");
    expect(context).not.toHaveProperty("PUBLIC_UPLOADS_DIR");
    expect(context).not.toHaveProperty("loadUploads");
    expect(context).not.toHaveProperty("unknownDependency");
  });
});
