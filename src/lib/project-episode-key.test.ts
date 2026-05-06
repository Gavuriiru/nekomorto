import { describe, expect, it } from "vitest";

import { buildEpisodeKey, resolveEpisodeLookup } from "./project-episode-key";

describe("project episode key (TypeScript)", () => {
  it("builds stable number+volume keys", () => {
    expect(buildEpisodeKey(7, 3)).toBe("7:3");
    expect(buildEpisodeKey("7", undefined)).toBe("7:none");
    expect(buildEpisodeKey("abc", 1)).toBe("");
  });

  it("resolves chapter without volume when same number exists with and without volume", () => {
    const chapters = [
      { number: 1, volume: undefined, title: "Cap 1 sem volume" },
      { number: 1, volume: 1, title: "Cap 1 v1" },
    ];

    expect(resolveEpisodeLookup(chapters, 1, undefined)).toMatchObject({
      ok: true,
      code: "ok",
      key: "1:none",
      episode: expect.objectContaining({
        title: "Cap 1 sem volume",
      }),
    });

    expect(resolveEpisodeLookup(chapters, 1, null)).toMatchObject({
      ok: true,
      code: "ok",
      key: "1:none",
      episode: expect.objectContaining({
        title: "Cap 1 sem volume",
      }),
    });

    expect(resolveEpisodeLookup(chapters, 1, 1)).toMatchObject({
      ok: true,
      code: "ok",
      key: "1:1",
      episode: expect.objectContaining({
        title: "Cap 1 v1",
      }),
    });
  });

  it("requires volume when same chapter number exists in multiple volumes (with volumes)", () => {
    const chapters = [
      { number: 5, volume: 1, title: "Cap 5 v1" },
      { number: 5, volume: 2, title: "Cap 5 v2" },
    ];

    expect(resolveEpisodeLookup(chapters, 5, null)).toMatchObject({
      ok: false,
      code: "volume_required",
    });

    expect(resolveEpisodeLookup(chapters, 5, 2)).toMatchObject({
      ok: true,
      code: "ok",
      key: "5:2",
      episode: expect.objectContaining({
        title: "Cap 5 v2",
      }),
    });
  });
});
