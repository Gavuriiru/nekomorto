import { describe, expect, it } from "vitest";

import { parseAniListMediaId } from "./anilist";

describe("parseAniListMediaId", () => {
  it("accepts positive numeric ids", () => {
    expect(parseAniListMediaId("97894")).toBe(97894);
    expect(parseAniListMediaId(" 97894 ")).toBe(97894);
  });

  it("accepts AniList anime and manga urls", () => {
    expect(parseAniListMediaId("https://anilist.co/manga/97894/Imouto-sae-Ireba-Ii/")).toBe(97894);
    expect(parseAniListMediaId("https://anilist.co/anime/97894/example?foo=bar#section")).toBe(
      97894,
    );
    expect(parseAniListMediaId("http://www.anilist.co/manga/97894")).toBe(97894);
  });

  it("rejects invalid, non-positive, or non-AniList inputs", () => {
    expect(parseAniListMediaId("0")).toBeNull();
    expect(parseAniListMediaId("-1")).toBeNull();
    expect(parseAniListMediaId("https://anilist.co/manga/0/example")).toBeNull();
    expect(parseAniListMediaId("https://example.com/manga/97894/example")).toBeNull();
    expect(parseAniListMediaId("https://anilist.co/character/97894/example")).toBeNull();
    expect(parseAniListMediaId("https://anilist.co/manga/example")).toBeNull();
    expect(parseAniListMediaId("")).toBeNull();
  });
});
