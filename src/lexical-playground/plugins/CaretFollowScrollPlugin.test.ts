import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  findCaretScrollRoot,
  getCaretTopOffset,
  scrollCaretRectIntoView,
} from "@/lexical-playground/plugins/CaretFollowScrollPlugin";

const createRect = (top: number, bottom = top + 20): DOMRect =>
  ({
    bottom,
    height: bottom - top,
    left: 0,
    right: 400,
    toJSON: () => ({}),
    top,
    width: 400,
    x: 0,
    y: top,
  }) as DOMRect;

describe("CaretFollowScrollPlugin helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 600,
    });
  });

  it("usa o project-editor-scroll-shell mais proximo como scroll root", () => {
    const scrollShell = document.createElement("div");
    scrollShell.className = "project-editor-scroll-shell";
    const rootElement = document.createElement("div");
    scrollShell.append(rootElement);
    document.body.append(scrollShell);

    expect(findCaretScrollRoot(rootElement)).toBe(scrollShell);
  });

  it("usa window quando o editor nao esta em um modal com scroll shell", () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);

    expect(findCaretScrollRoot(rootElement)).toBe(window);
  });

  it("faz scroll da janela quando o caret sai da viewport", () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const scrollBySpy = vi.fn();
    Object.defineProperty(window, "scrollBy", {
      configurable: true,
      value: scrollBySpy,
    });

    const didScroll = scrollCaretRectIntoView({
      caretRect: createRect(620, 660),
      rootElement,
      scrollRoot: window,
    });

    expect(didScroll).toBe(true);
    expect(scrollBySpy).toHaveBeenCalledWith({ behavior: "auto", top: 72 });
  });

  it("faz scroll do container e respeita o offset da toolbar sticky", () => {
    const playground = document.createElement("div");
    playground.className = "lexical-playground";
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const scrollShell = document.createElement("div");
    scrollShell.className = "project-editor-scroll-shell";
    const rootElement = document.createElement("div");

    playground.append(toolbar);
    playground.append(scrollShell);
    scrollShell.append(rootElement);
    document.body.append(playground);

    scrollShell.scrollTop = 200;
    vi.spyOn(scrollShell, "getBoundingClientRect").mockReturnValue(
      createRect(100, 500),
    );
    vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue(
      createRect(100, 140),
    );

    expect(getCaretTopOffset(rootElement, scrollShell)).toBe(52);

    const didScroll = scrollCaretRectIntoView({
      caretRect: createRect(120, 140),
      rootElement,
      scrollRoot: scrollShell,
    });

    expect(didScroll).toBe(true);
    expect(scrollShell.scrollTop).toBe(168);
  });

  it("nao faz scroll quando o caret ja esta visivel", () => {
    const scrollShell = document.createElement("div");
    scrollShell.className = "project-editor-scroll-shell";
    const rootElement = document.createElement("div");
    scrollShell.append(rootElement);
    document.body.append(scrollShell);

    scrollShell.scrollTop = 120;
    vi.spyOn(scrollShell, "getBoundingClientRect").mockReturnValue(
      createRect(100, 500),
    );

    const didScroll = scrollCaretRectIntoView({
      caretRect: createRect(220, 240),
      rootElement,
      scrollRoot: scrollShell,
    });

    expect(didScroll).toBe(false);
    expect(scrollShell.scrollTop).toBe(120);
  });
});
