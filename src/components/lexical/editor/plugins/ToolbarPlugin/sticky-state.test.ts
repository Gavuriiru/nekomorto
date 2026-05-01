import { describe, expect, it } from "vitest";

import { isToolbarStickyStuck } from "./sticky-state";

describe("isToolbarStickyStuck", () => {
  it("returns false when toolbar is below sticky threshold", () => {
    expect(
      isToolbarStickyStuck({
        toolbarTop: 40,
        scrollRootTop: 0,
        stickyTop: 10,
      }),
    ).toBe(false);
  });

  it("returns true when toolbar hits sticky threshold exactly", () => {
    expect(
      isToolbarStickyStuck({
        toolbarTop: 11,
        scrollRootTop: 0,
        stickyTop: 10,
      }),
    ).toBe(true);
  });

  it("returns true when toolbar is above sticky threshold", () => {
    expect(
      isToolbarStickyStuck({
        toolbarTop: 6,
        scrollRootTop: 0,
        stickyTop: 10,
      }),
    ).toBe(true);
  });

  it("respects one pixel tolerance", () => {
    expect(
      isToolbarStickyStuck({
        toolbarTop: 10.9,
        scrollRootTop: 0,
        stickyTop: 10,
      }),
    ).toBe(true);
    expect(
      isToolbarStickyStuck({
        toolbarTop: 11.2,
        scrollRootTop: 0,
        stickyTop: 10,
      }),
    ).toBe(false);
  });
});
