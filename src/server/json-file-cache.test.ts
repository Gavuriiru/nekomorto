import { describe, expect, it } from "vitest";

import { createJsonFileCache } from "../../server/lib/json-file-cache.js";

describe("json file cache", () => {
  it("reads values after writing", () => {
    const cache = createJsonFileCache();

    cache.write("posts", [{ slug: "post-teste" }]);

    expect(cache.read("posts")).toEqual([{ slug: "post-teste" }]);
  });

  it("clones values defensively on write and read", () => {
    const cache = createJsonFileCache();
    const original = [{ slug: "post-teste", meta: { views: 1 } }];

    cache.write("posts", original);
    original[0].meta.views = 99;

    const firstRead = cache.read("posts");
    expect(firstRead).toEqual([{ slug: "post-teste", meta: { views: 1 } }]);

    firstRead?.[0]?.meta && (firstRead[0].meta.views = 77);

    expect(cache.read("posts")).toEqual([{ slug: "post-teste", meta: { views: 1 } }]);
  });

  it("invalidates only the requested key", () => {
    const cache = createJsonFileCache();

    cache.write("posts", [{ slug: "post-teste" }]);
    cache.write("projects", [{ id: "project-1" }]);

    expect(cache.invalidate("posts")).toBe(true);
    expect(cache.read("posts")).toBeNull();
    expect(cache.read("projects")).toEqual([{ id: "project-1" }]);
  });

  it("does not throw when invalidating a missing key", () => {
    const cache = createJsonFileCache();

    expect(cache.invalidate("missing")).toBe(false);
  });
});
