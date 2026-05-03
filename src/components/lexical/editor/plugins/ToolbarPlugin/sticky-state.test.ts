import { describe, expect, it } from "vitest";

import {
  getToolbarAvailableContentWidth,
  isToolbarStickyStuck,
  measureToolbarRequiredWidth,
} from "./sticky-state";

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

describe("measureToolbarRequiredWidth", () => {
  it("measures visible child widths without counting auto spacer width", () => {
    const toolbar = document.createElement("div");
    Object.defineProperty(toolbar, "clientWidth", {
      configurable: true,
      value: 400,
    });
    toolbar.style.columnGap = "4px";
    toolbar.style.paddingLeft = "6px";
    toolbar.style.paddingRight = "6px";

    const makeChild = (width: number, marginRight = "0px", marginLeft = "0px") => {
      const child = document.createElement("button");
      if (marginLeft === "auto") {
        child.classList.add("toolbar-group-right");
      }
      child.style.marginLeft = marginLeft;
      child.style.marginRight = marginRight;
      child.getBoundingClientRect = () =>
        ({
          width,
        }) as DOMRect;
      toolbar.appendChild(child);
    };

    makeChild(32, "2px");
    makeChild(136);
    makeChild(34, "0px", "auto");

    expect(measureToolbarRequiredWidth(toolbar)).toBe(212);
    expect(getToolbarAvailableContentWidth(toolbar)).toBe(388);
  });
});
