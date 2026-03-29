import { describe, expect, it, vi } from "vitest";

import {
  createDiscordAvatarUrl,
  createRouteGuards,
  createRuntimeMetadataBuilder,
  normalizeTags,
} from "../../server/lib/root-composition-helpers.js";

describe("root composition helpers", () => {
  it("normalizes tags from arrays and comma-separated strings", () => {
    expect(normalizeTags(["alpha", "", null, "beta"])).toEqual(["alpha", "beta"]);
    expect(normalizeTags("alpha, beta , ,gamma")).toEqual(["alpha", "beta", "gamma"]);
    expect(normalizeTags(null)).toEqual([]);
  });

  it("builds discord avatar urls only when an avatar hash exists", () => {
    expect(createDiscordAvatarUrl({ id: "123", avatar: "abc" })).toBe(
      "https://cdn.discordapp.com/avatars/123/abc.png?size=128",
    );
    expect(createDiscordAvatarUrl({ id: "123", avatar: "" })).toBeNull();
    expect(createDiscordAvatarUrl(null)).toBeNull();
  });

  it("creates runtime metadata builders that merge build metadata", () => {
    const getBuildMetadata = vi.fn(() => ({ commit: "abc123" }));
    const buildRuntimeMetadata = createRuntimeMetadataBuilder({
      apiVersion: "v1",
      getBuildMetadata,
    });

    expect(buildRuntimeMetadata()).toEqual({
      apiVersion: "v1",
      commit: "abc123",
    });
    expect(getBuildMetadata).toHaveBeenCalledTimes(1);
  });

  it("creates auth guards using the provided ownership predicates", () => {
    const isOwner = vi.fn((userId) => userId === "owner-1");
    const isPrimaryOwner = vi.fn((userId) => userId === "primary-1");
    const { requireAuth, requireOwner, requirePrimaryOwner } = createRouteGuards({
      isOwner,
      isPrimaryOwner,
    });

    const createResponse = () => {
      const res = {
        json: vi.fn(() => res),
        status: vi.fn(() => res),
      };
      return res;
    };

    const next = vi.fn();
    const unauthorizedRes = createResponse();
    requireAuth({ session: {} }, unauthorizedRes, next);
    expect(unauthorizedRes.status).toHaveBeenCalledWith(401);

    const ownerRes = createResponse();
    requireOwner({ session: { user: { id: "viewer" } } }, ownerRes, next);
    expect(ownerRes.status).toHaveBeenCalledWith(403);
    expect(isOwner).toHaveBeenCalledWith("viewer");

    const primaryOwnerRes = createResponse();
    requirePrimaryOwner({ session: { user: { id: "primary-1" } } }, primaryOwnerRes, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(isPrimaryOwner).toHaveBeenCalledWith("primary-1");
  });
});
