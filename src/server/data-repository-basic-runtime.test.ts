import { describe, expect, it, vi } from "vitest";

import { createDataRepositoryBasicRuntime } from "../../server/lib/data-repository-basic-runtime.js";

const createRepository = () => ({
  loadAllowedUsers: vi.fn(() => ["user-1"]),
  loadLinkTypes: vi.fn(() => [
    { id: "discord", label: "Discord", icon: "discord" },
    { id: "discord", label: "Discord 2", icon: "" },
    { id: "site", label: "Site", icon: "" },
  ]),
  loadOwnerIds: vi.fn(() => ["owner-2", "owner-1"]),
  loadUsers: vi.fn(() => [{ id: "user-1", displayName: "Alice" }]),
  writeAllowedUsers: vi.fn(),
  writeLinkTypes: vi.fn(),
  writeOwnerIds: vi.fn(),
  writeUsers: vi.fn(),
});

describe("data-repository-basic-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createDataRepositoryBasicRuntime()).toThrow(/missing required dependencies/i);
  });

  it("delegates owner, user and link-type repository helpers with lazy normalizers", () => {
    const dataRepository = createRepository();
    let normalizeUsersImpl = null;
    let normalizeUploadsDeepImpl = null;

    const runtime = createDataRepositoryBasicRuntime({
      dataRepository,
      getNormalizeUploadsDeep: () => normalizeUploadsDeepImpl,
      getNormalizeUsers: () => normalizeUsersImpl,
      ownerIds: ["owner-1"],
      sanitizeIconSource: (value) => String(value || "").trim().toLowerCase(),
    });

    normalizeUsersImpl = vi.fn((users) =>
      users.map((user) => ({
        ...user,
        normalized: true,
      })),
    );
    normalizeUploadsDeepImpl = vi.fn((value) => ({
      wrapped: value,
    }));

    expect(runtime.loadOwnerIds()).toEqual(["owner-1", "owner-2"]);
    runtime.writeOwnerIds([" owner-3 ", "owner-3", ""]);
    expect(dataRepository.writeOwnerIds).toHaveBeenCalledWith(["owner-3"]);
    expect(runtime.isOwner("owner-2")).toBe(true);
    expect(runtime.getPrimaryOwnerId()).toBe("owner-1");
    expect(runtime.isPrimaryOwner("owner-1")).toBe(true);

    expect(runtime.loadAllowedUsers()).toEqual(["user-1"]);
    runtime.writeAllowedUsers(["user-2"]);
    expect(dataRepository.writeAllowedUsers).toHaveBeenCalledWith(["user-2"]);

    expect(runtime.loadUsers()).toEqual([{ id: "user-1", displayName: "Alice", normalized: true }]);
    expect(normalizeUsersImpl).toHaveBeenCalledWith([{ id: "user-1", displayName: "Alice" }]);
    expect(dataRepository.writeUsers).toHaveBeenCalledWith({
      wrapped: [{ id: "user-1", displayName: "Alice", normalized: true }],
    });

    runtime.writeUsers([{ id: "user-2" }]);
    expect(dataRepository.writeUsers).toHaveBeenLastCalledWith({
      wrapped: [{ id: "user-2" }],
    });

    expect(runtime.normalizeLinkTypes(dataRepository.loadLinkTypes())).toEqual([
      { id: "discord", label: "Discord", icon: "discord" },
      { id: "site", label: "Site", icon: "globe" },
    ]);
    expect(runtime.loadLinkTypes()).toEqual([
      { id: "discord", label: "Discord", icon: "discord" },
      { id: "site", label: "Site", icon: "globe" },
    ]);
    expect(dataRepository.writeLinkTypes).toHaveBeenCalledWith([
      { id: "discord", label: "Discord", icon: "discord" },
      { id: "site", label: "Site", icon: "globe" },
    ]);
  });

  it("returns safe fallbacks when repository methods are unavailable", () => {
    const runtime = createDataRepositoryBasicRuntime({
      dataRepository: {},
      getNormalizeUploadsDeep: () => (value) => value,
      getNormalizeUsers: () => (value) => value,
      ownerIds: ["owner-1"],
      sanitizeIconSource: () => "",
    });

    expect(runtime.loadOwnerIds()).toEqual(["owner-1"]);
    expect(runtime.getPrimaryOwnerId()).toBe("owner-1");
    expect(runtime.isOwner("owner-1")).toBe(true);
    expect(runtime.loadAllowedUsers()).toEqual([]);
    expect(runtime.loadUsers()).toEqual([]);
    expect(runtime.loadLinkTypes()).toEqual([]);
  });

  it("fails fast when a lazy normalizer is called before it resolves", () => {
    const runtime = createDataRepositoryBasicRuntime({
      dataRepository: {
        loadUsers: () => [{ id: "user-1" }],
      },
      getNormalizeUploadsDeep: () => (value) => value,
      getNormalizeUsers: () => undefined,
      ownerIds: ["owner-1"],
      sanitizeIconSource: () => "",
    });

    expect(() => runtime.loadUsers()).toThrow(/getNormalizeUsers/);
  });
});
