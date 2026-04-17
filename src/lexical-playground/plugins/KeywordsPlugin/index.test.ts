import { describe, expect, it } from "vitest";

import { getKeywordMatchForText } from "./index";

describe("KeywordsPlugin matcher", () => {
  it("matches keywords at start, middle, and end boundaries", () => {
    expect(getKeywordMatchForText("congrats")).toEqual({ start: 0, end: 8 });
    expect(getKeywordMatchForText("well, congrats!")).toEqual({
      start: 6,
      end: 14,
    });
    expect(getKeywordMatchForText("wow congrats")).toEqual({
      start: 4,
      end: 12,
    });
  });

  it("does not match keywords embedded in a word", () => {
    expect(getKeywordMatchForText("xcongrats")).toBeNull();
    expect(getKeywordMatchForText("congratsx")).toBeNull();
  });
});
