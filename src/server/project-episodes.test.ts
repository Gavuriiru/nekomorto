import { describe, expect, it } from "vitest";

import {
  buildEpisodeKey,
  findDuplicateEpisodeKey,
  resolveEpisodeLookup,
} from "../../server/lib/project-episodes.js";

describe("project episode helpers", () => {
  it("builds stable number+volume keys and detects duplicates", () => {
    expect(buildEpisodeKey(7, 3)).toBe("7:3");
    expect(buildEpisodeKey("7", undefined)).toBe("7:0");
    expect(buildEpisodeKey("abc", 1)).toBe("");

    expect(
      findDuplicateEpisodeKey([
        { number: 1, volume: 1 },
        { number: 1, volume: 2 },
        { number: 1, volume: 1 },
      ]),
    ).toEqual({
      key: "1:1",
      firstIndex: 0,
      secondIndex: 2,
    });
  });

  it("requires volume when the same chapter number exists in multiple volumes", () => {
    const project = {
      episodeDownloads: [
        { number: 5, volume: 1, title: "Cap 5 v1", publicationStatus: "published" },
        { number: 5, volume: 2, title: "Cap 5 v2", publicationStatus: "published" },
      ],
    };

    expect(resolveEpisodeLookup(project, 5, null)).toMatchObject({
      ok: false,
      code: "volume_required",
    });

    expect(resolveEpisodeLookup(project, 5, 2)).toMatchObject({
      ok: true,
      code: "ok",
      key: "5:2",
      episode: expect.objectContaining({
        title: "Cap 5 v2",
      }),
    });
  });
});
