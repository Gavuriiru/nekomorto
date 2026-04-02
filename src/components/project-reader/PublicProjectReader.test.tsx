import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublicProjectReader from "@/components/project-reader/PublicProjectReader";

const useProjectReaderPreferencesMock = vi.hoisted(() => vi.fn());
const updateConfigMock = vi.hoisted(() => vi.fn());
const MENU_TRIGGER_INITIAL_VISIBLE_MS = 5000;
const MENU_TRIGGER_HIDE_DELAY_MS = 180;
const MENU_TRIGGER_EXIT_TRANSITION_MS = 320;
const PROGRESS_OVERLAY_TRANSITION_MS = 180;
const HORIZONTAL_PAGE_URL_SYNC_SETTLE_MS = 220;

vi.mock("@/components/project-reader/use-project-reader-preferences", () => ({
  useProjectReaderPreferences: (...args: unknown[]) => useProjectReaderPreferencesMock(...args),
}));

const baseProps = {
  projectTitle: "Projeto Teste",
  projectType: "manga",
  chapterTitle: "Capitulo 1",
  chapterLabel: "Cap 1",
  synopsis: "Resumo do capitulo",
  volume: 1,
  pages: [
    { position: 0, imageUrl: "/page-1.jpg" },
    { position: 1, imageUrl: "/page-2.jpg" },
  ],
  baseConfig: {},
  currentUserId: null,
  chapterOptions: [
    { value: "1", label: "Capitulo 1", href: "/projeto/projeto-teste/leitura/1" },
    { value: "2", label: "Capitulo 2", href: "/projeto/projeto-teste/leitura/2" },
  ],
  currentChapterValue: "1",
  onNavigateChapter: vi.fn(),
  backHref: "/projeto/projeto-teste",
};

const setReaderConfig = (config: Record<string, unknown>) => {
  updateConfigMock.mockReset();
  useProjectReaderPreferencesMock.mockReturnValue({
    isLoaded: true,
    resolvedConfig: {
      direction: "rtl",
      layout: "single",
      imageFit: "both",
      background: "theme",
      progressStyle: "default",
      progressPosition: "bottom",
      firstPageSingle: true,
      siteHeaderVariant: "static",
      ...config,
    },
    updateConfig: updateConfigMock,
  });
};

const setVisualViewport = ({
  width = 1280,
  height = 640,
  offsetTop = 0,
}: {
  width?: number;
  height?: number;
  offsetTop?: number;
}) => {
  const viewport = new EventTarget() as EventTarget & {
    width: number;
    height: number;
    offsetTop: number;
    offsetLeft: number;
    pageTop: number;
    pageLeft: number;
    scale: number;
  };
  viewport.width = width;
  viewport.height = height;
  viewport.offsetTop = offsetTop;
  viewport.offsetLeft = 0;
  viewport.pageTop = 0;
  viewport.pageLeft = 0;
  viewport.scale = 1;

  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    writable: true,
    value: viewport,
  });

  return viewport;
};

const ReaderLocationProbe = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const preserveScroll =
    typeof location.state === "object" && location.state !== null
      ? String((location.state as { preserveScroll?: boolean }).preserveScroll === true)
      : "false";

  return (
    <>
      <div data-testid="reader-location-search">{location.search}</div>
      <div data-testid="reader-location-hash">{location.hash}</div>
      <div data-testid="reader-location-action">{navigationType}</div>
      <div data-testid="reader-location-preserve-scroll">{preserveScroll}</div>
    </>
  );
};

const renderReader = (
  config: Record<string, unknown>,
  props: Partial<Parameters<typeof PublicProjectReader>[0]> = {},
  options: {
    initialEntries?: string[];
  } = {},
) => {
  setReaderConfig(config);

  return render(
    <MemoryRouter initialEntries={options.initialEntries}>
      <PublicProjectReader {...baseProps} {...props} />
      <ReaderLocationProbe />
    </MemoryRouter>,
  );
};

const setBrowserLocation = (path: string, state: unknown = null) => {
  window.history.replaceState(state, "", path);
  return window.history.state;
};

const mockElementRect = (
  element: Element,
  {
    top,
    bottom,
    left = 0,
    right = 1200,
    width = right - left,
    height = bottom - top,
  }: {
    top: number;
    bottom: number;
    left?: number;
    right?: number;
    width?: number;
    height?: number;
  },
) =>
  vi.spyOn(element, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        x: left,
        y: top,
        top,
        bottom,
        left,
        right,
        width,
        height,
        toJSON: () => ({}),
      }) as DOMRect,
  );

const mockRectsByTestId = (
  rects: Record<
    string,
    {
      top: number;
      bottom: number;
      left?: number;
      right?: number;
      width?: number;
      height?: number;
    }
  >,
) =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const testId = this.getAttribute("data-testid");
    const rect = testId ? rects[testId] : undefined;
    if (!rect) {
      return {
        x: 0,
        y: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    }

    const left = rect.left ?? 0;
    const right = rect.right ?? left + (rect.width ?? 0);
    const width = rect.width ?? Math.max(right - left, 0);
    const height = rect.height ?? Math.max(rect.bottom - rect.top, 0);

    return {
      x: left,
      y: rect.top,
      top: rect.top,
      bottom: rect.bottom,
      left,
      right,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect;
  });

const setElementSize = (
  element: Element,
  {
    clientWidth,
    clientHeight,
    offsetHeight,
    scrollHeight,
    scrollWidth,
  }: {
    clientWidth?: number;
    clientHeight?: number;
    offsetHeight?: number;
    scrollHeight?: number;
    scrollWidth?: number;
  },
) => {
  if (typeof clientWidth === "number") {
    Object.defineProperty(element, "clientWidth", {
      configurable: true,
      value: clientWidth,
    });
  }

  if (typeof clientHeight === "number") {
    Object.defineProperty(element, "clientHeight", {
      configurable: true,
      value: clientHeight,
    });
  }

  if (typeof offsetHeight === "number") {
    Object.defineProperty(element, "offsetHeight", {
      configurable: true,
      value: offsetHeight,
    });
  }

  if (typeof scrollWidth === "number") {
    Object.defineProperty(element, "scrollWidth", {
      configurable: true,
      value: scrollWidth,
    });
  }

  if (typeof scrollHeight === "number") {
    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      value: scrollHeight,
    });
  }
};

const clickPaginatedTarget = ({
  clientX,
  offsetX,
  target,
  stageRect = {
    top: 0,
    bottom: 600,
    left: 0,
    right: 1000,
  },
}: {
  clientX: number;
  offsetX?: number;
  target?: Element;
  stageRect?: {
    top: number;
    bottom: number;
    left?: number;
    right?: number;
    width?: number;
    height?: number;
  };
}) => {
  const stageButton = screen.getByRole("button", { name: /paginada/i });
  mockElementRect(stageButton, stageRect);
  fireEvent.click(target ?? stageButton, {
    clientX,
    ...(typeof offsetX === "number" ? { offsetX } : {}),
  });
};

const goToNextPaginatedPage = () => {
  clickPaginatedTarget({ clientX: 100 });
};

const goToLastPaginatedPage = () => {
  goToNextPaginatedPage();
};

const getRootFontSizePx = () =>
  Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize || "16") || 16;

const getProgressContainerLength = (
  progressPosition: "bottom" | "left" | "right",
  {
    width = window.innerWidth,
    height = window.innerHeight,
  }: {
    width?: number;
    height?: number;
  } = {},
) => (progressPosition === "bottom" ? width : height) - 24;

const getProgressLabelInsetPx = (progressPosition: "bottom" | "left" | "right") =>
  progressPosition === "bottom" ? 20 : 14;

const mockProgressTrackRect = (element: Element, progressPosition: "bottom" | "left" | "right") =>
  mockElementRect(
    element,
    progressPosition === "bottom"
      ? {
          left: 12,
          right: window.innerWidth - 12,
          top: window.innerHeight - 80,
          bottom: window.innerHeight,
        }
      : {
          left: progressPosition === "left" ? 12 : window.innerWidth - 100,
          right: progressPosition === "left" ? 100 : window.innerWidth - 12,
          top: 12,
          bottom: window.innerHeight - 12,
        },
  );

describe("PublicProjectReader", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    useProjectReaderPreferencesMock.mockReset();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 900,
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    window.history.replaceState(null, "", "/");
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("does not clip the stage and keeps no-limit free from full-width wrappers", async () => {
    renderReader({ imageFit: "none" });

    const stage = screen.getByTestId("project-reading-stage");
    expect(stage).not.toHaveClass("overflow-hidden");

    const page = screen.getByTestId("reader-page-0");
    expect(page).not.toHaveClass("overflow-auto");
    expect(page).toHaveClass("w-auto", "max-w-none", "shrink-0");
    expect(page).not.toHaveClass("w-full");

    await waitFor(() => {
      expect(screen.getByRole("img", { name: /P.gina 1/i }).parentElement?.style.height).toBe("");
    });
  });

  it("makes fit both use an explicit surface height derived from the visible stage", async () => {
    renderReader({ imageFit: "both" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const stage = screen.getByTestId("project-reading-stage");
    const surface = screen.getByTestId("reader-page-surface-0");
    const paginatedArea = screen.getByRole("button", { name: /leitura paginada/i });

    expect(paginatedArea).toHaveClass("flex-1", "min-h-0");
    expect(surface).not.toHaveClass("h-full", "min-h-0");

    await waitFor(() => {
      expect(shell.style.height).toBe(shell.style.minHeight);
      expect(stage.style.height).toBe(stage.style.minHeight);
      expect(surface.style.height).toBe(stage.style.height);
    });
  });

  it("makes fit height use an explicit surface height", async () => {
    renderReader({ imageFit: "height" });

    const stage = screen.getByTestId("project-reading-stage");
    const surface = screen.getByTestId("reader-page-surface-0");

    await waitFor(() => {
      expect(stage.style.height).toBe(stage.style.minHeight);
      expect(surface.style.height).toBe(stage.style.height);
    });
  });

  it.each([
    "both",
    "width",
  ])("anchors double-page spreads to the center seam for fit %s", (imageFit) => {
    renderReader({ layout: "double", imageFit, firstPageSingle: false });
    const paginatedLane = screen.getByTestId("project-reading-paginated-scroll-lane");

    expect(screen.queryByTestId("reader-spread-blank")).not.toBeInTheDocument();
    expect(screen.getByTestId("reader-page-surface-0")).toHaveClass("justify-start");
    expect(screen.getByTestId("reader-page-surface-1")).toHaveClass("justify-end");
    expect(paginatedLane.className).not.toContain("px-2");
    expect(paginatedLane.className).not.toContain("md:px-4");
  });

  it.each([
    "both",
    "width",
  ])("centers the isolated cover slot in double-page mode for fit %s", (imageFit) => {
    renderReader({ layout: "double", imageFit, firstPageSingle: true });

    const coverPage = screen.getByTestId("reader-page-0");
    const coverSurface = screen.getByTestId("reader-page-surface-0");
    const coverImage = within(coverPage).getByRole("img", { name: /P.gina 1/i });

    expect(screen.queryByTestId("reader-spread-blank")).not.toBeInTheDocument();
    expect(coverPage.parentElement).toHaveClass("justify-center");

    if (imageFit === "width") {
      expect(coverPage.parentElement).not.toHaveClass("flex-1", "min-w-0");
      expect(coverPage).toHaveClass("w-auto", "max-w-none", "shrink-0");
      expect(coverPage).not.toHaveClass("w-full", "min-w-0");
      expect(coverSurface).toHaveClass("inline-flex", "h-auto", "w-auto", "max-w-none", "shrink-0");
      expect(coverSurface).not.toHaveClass("w-full", "max-w-full");
      expect(coverImage).toHaveClass("h-auto", "w-auto", "max-h-none", "max-w-none");
      expect(coverImage).not.toHaveClass("w-full", "max-w-full");
    }
  });

  it.each([
    "both",
    "width",
  ])("centers an isolated slot created by a forced spread in double-page mode for fit %s", (imageFit) => {
    renderReader(
      { layout: "double", imageFit, firstPageSingle: false },
      {
        pages: [
          { position: 0, imageUrl: "/page-1.jpg" },
          { position: 1, imageUrl: "/page-2.jpg", spreadPairId: "spread-1" },
          { position: 2, imageUrl: "/page-3.jpg", spreadPairId: "spread-1" },
          { position: 3, imageUrl: "/page-4.jpg" },
        ],
      },
    );

    const isolatedPage = screen.getByTestId("reader-page-0");
    const isolatedSurface = screen.getByTestId("reader-page-surface-0");
    const isolatedImage = within(isolatedPage).getByRole("img", { name: /P.gina 1/i });

    expect(screen.queryByTestId("reader-spread-blank")).not.toBeInTheDocument();
    expect(isolatedPage.parentElement).toHaveClass("justify-center");
    expect(isolatedSurface).toHaveClass("justify-center");

    if (imageFit === "width") {
      expect(isolatedPage.parentElement).not.toHaveClass("flex-1", "min-w-0");
      expect(isolatedPage).toHaveClass("w-auto", "max-w-none", "shrink-0");
      expect(isolatedPage).not.toHaveClass("w-full", "min-w-0");
      expect(isolatedSurface).toHaveClass(
        "inline-flex",
        "h-auto",
        "w-auto",
        "max-w-none",
        "shrink-0",
      );
      expect(isolatedSurface).not.toHaveClass("w-full", "max-w-full");
      expect(isolatedImage).toHaveClass("h-auto", "w-auto", "max-h-none", "max-w-none");
      expect(isolatedImage).not.toHaveClass("w-full", "max-w-full");
    }
  });

  it.each([
    "both",
    "width",
  ])("centers the isolated last slot in double-page mode for fit %s", (imageFit) => {
    renderReader(
      { layout: "double", imageFit, firstPageSingle: false },
      {
        pages: [
          { position: 0, imageUrl: "/page-1.jpg" },
          { position: 1, imageUrl: "/page-2.jpg", spreadPairId: "spread-1" },
          { position: 2, imageUrl: "/page-3.jpg", spreadPairId: "spread-1" },
          { position: 3, imageUrl: "/page-4.jpg" },
        ],
      },
      {
        initialEntries: ["/projeto/projeto-teste/leitura/1?page=4"],
      },
    );

    const isolatedPage = screen.getByTestId("reader-page-3");
    const isolatedSurface = screen.getByTestId("reader-page-surface-3");
    const isolatedImage = within(isolatedPage).getByRole("img", { name: /P.gina 4/i });

    expect(screen.queryByTestId("reader-spread-blank")).not.toBeInTheDocument();
    expect(isolatedPage.parentElement).toHaveClass("justify-center");
    expect(isolatedSurface).toHaveClass("justify-center");

    if (imageFit === "width") {
      expect(isolatedPage.parentElement).not.toHaveClass("flex-1", "min-w-0");
      expect(isolatedPage).toHaveClass("w-auto", "max-w-none", "shrink-0");
      expect(isolatedPage).not.toHaveClass("w-full", "min-w-0");
      expect(isolatedSurface).toHaveClass(
        "inline-flex",
        "h-auto",
        "w-auto",
        "max-w-none",
        "shrink-0",
      );
      expect(isolatedSurface).not.toHaveClass("w-full", "max-w-full");
      expect(isolatedImage).toHaveClass("h-auto", "w-auto", "max-h-none", "max-w-none");
      expect(isolatedImage).not.toHaveClass("w-full", "max-w-full");
    }
  });

  it.each([
    { layout: "scroll-horizontal", imageFit: "both" },
    { layout: "scroll-horizontal", imageFit: "height" },
  ])("uses the visible viewport height in cinema mode for $layout with fit $imageFit", async ({
    layout,
    imageFit,
  }) => {
    setVisualViewport({ height: 640 });
    renderReader({ layout, imageFit }, { chromeMode: "cinema" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const stage = screen.getByTestId("project-reading-stage");
    const surface = screen.getByTestId("reader-page-surface-0");

    await waitFor(() => {
      expect(shell.style.minHeight).toBe("640px");
      expect(shell.style.height).toBe("640px");
      expect(stage.style.minHeight).toBe("640px");
      expect(stage.style.height).toBe("640px");
      expect(surface.style.height).toBe("640px");
    });
  });

  it.each([
    { imageFit: "both" },
    { imageFit: "height" },
  ])("keeps scroll-vertical cinema mode with viewport min-height but no fixed shell height for fit $imageFit", async ({
    imageFit,
  }) => {
    setVisualViewport({ height: 640 });
    renderReader({ layout: "scroll-vertical", imageFit }, { chromeMode: "cinema" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const stage = screen.getByTestId("project-reading-stage");
    const surface = screen.getByTestId("reader-page-surface-0");

    await waitFor(() => {
      expect(shell.style.minHeight).toBe("640px");
      expect(shell.style.height).toBe("");
      expect(stage.style.minHeight).toBe("640px");
      expect(stage.style.height).toBe("");
      expect(surface.style.height).toBe("640px");
    });
  });

  it("falls back to innerHeight in cinema mode for scroll-horizontal", async () => {
    renderReader({ layout: "scroll-horizontal", imageFit: "both" }, { chromeMode: "cinema" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const stage = screen.getByTestId("project-reading-stage");
    const surface = screen.getByTestId("reader-page-surface-0");

    await waitFor(() => {
      expect(shell.style.minHeight).toBe("900px");
      expect(shell.style.height).toBe("900px");
      expect(stage.style.minHeight).toBe("900px");
      expect(stage.style.height).toBe("900px");
      expect(surface.style.height).toBe("900px");
    });
  });

  it("falls back to innerHeight in cinema mode for scroll-vertical without fixing shell height", async () => {
    renderReader({ layout: "scroll-vertical", imageFit: "both" }, { chromeMode: "cinema" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const stage = screen.getByTestId("project-reading-stage");
    const surface = screen.getByTestId("reader-page-surface-0");

    await waitFor(() => {
      expect(shell.style.minHeight).toBe("900px");
      expect(shell.style.height).toBe("");
      expect(stage.style.minHeight).toBe("900px");
      expect(stage.style.height).toBe("");
      expect(surface.style.height).toBe("900px");
    });
  });

  it.each([
    { layout: "single" },
    { layout: "scroll-horizontal" },
    { layout: "scroll-vertical" },
  ])("treats fit width as no-limit for $layout", async ({ layout }) => {
    renderReader({ layout, imageFit: "width" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const stage = screen.getByTestId("project-reading-stage");
    const page = screen.getByTestId("reader-page-0");
    const surface = screen.getByTestId("reader-page-surface-0");
    const image = screen.getByRole("img", { name: /P.gina 1/i });

    await waitFor(() => {
      expect(shell.style.height).toBe("");
      expect(stage.style.height).toBe("");
      expect(surface.style.height).toBe("");
    });

    expect(page).toHaveClass("w-auto", "max-w-none", "shrink-0");
    expect(page).not.toHaveClass("w-full");
    expect(surface).toHaveClass("inline-flex", "h-auto", "w-auto", "max-w-none", "shrink-0");
    expect(image).toHaveClass("h-auto", "w-auto", "max-h-none", "max-w-none");
    expect(image).not.toHaveClass("w-full", "h-full");

    if (layout === "scroll-horizontal") {
      expect(page.parentElement?.style.width).toBe("");
    }

    if (layout === "scroll-vertical") {
      expect(page.parentElement).toHaveClass("w-auto", "max-w-none");
      expect(page.parentElement).not.toHaveClass("w-full");
    }
  });

  it("bounds fit width to the renderable slot in double-page mode", async () => {
    renderReader({ layout: "double", imageFit: "width", firstPageSingle: false });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const stage = screen.getByTestId("project-reading-stage");
    const paginatedLane = screen.getByTestId("project-reading-paginated-scroll-lane");
    const page0 = screen.getByTestId("reader-page-0");
    const page1 = screen.getByTestId("reader-page-1");
    const surface0 = screen.getByTestId("reader-page-surface-0");
    const surface1 = screen.getByTestId("reader-page-surface-1");
    const image0 = within(page0).getByRole("img", { name: /P.gina 1/i });
    const image1 = within(page1).getByRole("img", { name: /P.gina 2/i });

    await waitFor(() => {
      expect(shell.style.height).toBe("");
      expect(stage.style.height).toBe("");
      expect(surface0.style.height).toBe("");
    });

    expect(paginatedLane.className).not.toContain("px-2");
    expect(paginatedLane.className).not.toContain("md:px-4");
    expect(page0.parentElement).toHaveClass("flex-1", "min-w-0");
    expect(page1.parentElement).toHaveClass("flex-1", "min-w-0");
    expect(page0).toHaveClass("w-full", "min-w-0");
    expect(page0).not.toHaveClass("w-auto", "max-w-none", "shrink-0");
    expect(page1).toHaveClass("w-full", "min-w-0");
    expect(page1).not.toHaveClass("w-auto", "max-w-none", "shrink-0");
    expect(surface0).toHaveClass("flex", "h-auto", "w-full", "max-w-full", "justify-start");
    expect(surface0).not.toHaveClass("inline-flex", "max-w-none", "shrink-0");
    expect(surface1).toHaveClass("flex", "h-auto", "w-full", "max-w-full", "justify-end");
    expect(surface1).not.toHaveClass("inline-flex", "max-w-none", "shrink-0");
    expect(image0).toHaveClass("h-auto", "w-full", "max-w-full");
    expect(image0).not.toHaveClass("w-auto", "max-w-none", "max-h-full");
    expect(image1).toHaveClass("h-auto", "w-full", "max-w-full");
    expect(image1).not.toHaveClass("w-auto", "max-w-none", "max-h-full");
  });

  it("keeps horizontal padding in single-page paginated mode", () => {
    renderReader({ layout: "single", imageFit: "both" });

    const paginatedLane = screen.getByTestId("project-reading-paginated-scroll-lane");

    expect(paginatedLane.className).toContain("px-2");
    expect(paginatedLane.className).toContain("md:px-4");
  });

  it.each([
    "both",
    "height",
    "none",
    "width",
  ])("renders scroll-horizontal as a continuous strip without reserved page width for fit %s", (imageFit) => {
    renderReader({ layout: "scroll-horizontal", imageFit });

    const stage = screen.getByTestId("project-reading-stage");
    const horizontalReader = screen.getByTestId("project-reading-horizontal-scroll");
    const externalScrollbarHost = screen.getByTestId("project-reading-horizontal-scrollbar-host");
    const externalScrollbar = screen.getByTestId("project-reading-horizontal-scrollbar");
    const spacer = screen.getByTestId("project-reading-horizontal-scrollbar-spacer");
    const strip = screen.getByTestId("project-reading-horizontal-strip");
    const page0 = screen.getByTestId("reader-page-0");
    const page1 = screen.getByTestId("reader-page-1");
    const surface0 = screen.getByTestId("reader-page-surface-0");

    expect(stage).not.toContain(externalScrollbar);
    expect(horizontalReader).toHaveClass("overflow-x-auto", "overflow-y-hidden");
    expect(horizontalReader).toHaveClass("no-scrollbar");
    expect(horizontalReader).not.toHaveClass("fixed", "sticky");
    expect(externalScrollbarHost).toBeInTheDocument();
    expect(externalScrollbar).toHaveClass("reader-external-scrollbar");
    expect(horizontalReader.className).not.toContain("px-2");
    expect(horizontalReader.className).not.toContain("md:px-4");
    expect(externalScrollbarHost.className).not.toContain("px-2");
    expect(externalScrollbarHost.className).not.toContain("md:px-4");
    expect(spacer.style.minWidth).toBe("100%");
    expect(strip).toHaveClass("gap-0");
    expect(page0).toHaveClass("w-auto", "max-w-none", "shrink-0");
    expect(page1).toHaveClass("w-auto", "max-w-none", "shrink-0");
    expect(page0.style.width).toBe("");
    expect(page1.style.width).toBe("");

    if (imageFit === "both" || imageFit === "height") {
      expect(surface0).toHaveClass("inline-flex", "h-full", "w-auto", "max-w-none", "shrink-0");
      expect(surface0).not.toHaveClass("w-full");
      expect(horizontalReader.className).not.toContain("py-2");
      expect(horizontalReader.className).not.toContain("md:py-4");
    } else {
      expect(surface0).toHaveClass("inline-flex", "h-auto", "w-auto", "max-w-none", "shrink-0");
      expect(horizontalReader.className).toContain("py-2");
      expect(horizontalReader.className).toContain("md:py-4");
    }
  });

  it("syncs scrollLeft between the hidden viewport scrollbar and the external native scrollbar", async () => {
    renderReader({ layout: "scroll-horizontal", imageFit: "both" });

    const horizontalReader = screen.getByTestId("project-reading-horizontal-scroll");
    const externalScrollbar = screen.getByTestId("project-reading-horizontal-scrollbar");
    const strip = screen.getByTestId("project-reading-horizontal-strip");
    const spacer = screen.getByTestId("project-reading-horizontal-scrollbar-spacer");

    setElementSize(horizontalReader, { clientWidth: 900, scrollWidth: 1800 });
    setElementSize(strip, { scrollWidth: 1800 });

    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(spacer.style.width).toBe("1800px");
    });

    horizontalReader.scrollLeft = 320;
    fireEvent.scroll(horizontalReader);
    expect(externalScrollbar.scrollLeft).toBe(320);

    externalScrollbar.scrollLeft = 640;
    fireEvent.scroll(externalScrollbar);
    expect(horizontalReader.scrollLeft).toBe(640);
  });

  it("renders the reader shell with the stable full-bleed info bar", async () => {
    renderReader({ imageFit: "both" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const infoBar = screen.getByTestId("project-reading-info-bar");
    const readerBar = screen.getByTestId("project-reading-reader-bar");
    const projectTitle = screen.getByTestId("project-reading-project-title");
    const chapterContext = screen.getByTestId("project-reading-chapter-context");
    const synopsis = screen.getByTestId("project-reading-synopsis");
    const heading = within(readerBar).getByRole("heading", { name: /Cap.*tulo 1/i });

    expect(shell).toHaveClass("w-full", "flex-1", "min-h-0");
    expect(shell).toHaveClass("gap-2", "md:gap-3");
    expect(readerBar).not.toHaveClass("mx-auto");
    expect(readerBar).toHaveClass("gap-3", "py-2", "md:py-3");
    expect(readerBar.style.maxWidth).toBe("");
    expect(infoBar).toHaveAttribute("data-variant", "reader-full-bleed");
    expect(screen.queryByTestId("project-reading-context-row")).not.toBeInTheDocument();
    expect(screen.queryByText(/^manga$/i)).not.toBeInTheDocument();
    expect(chapterContext).toHaveTextContent(/Cap.*tulo 1/i);
    expect(projectTitle).toHaveTextContent("Projeto Teste");
    expect(projectTitle).toHaveAttribute("href", "/projeto/projeto-teste");
    expect(projectTitle).toHaveClass("project-reading-masthead__overline");
    expect(heading).toHaveClass("project-reading-masthead__title");
    expect(synopsis).toHaveClass("project-reading-masthead__synopsis");
    expect(synopsis).toHaveTextContent("Resumo do capitulo");
    expect(
      projectTitle.compareDocumentPosition(chapterContext) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      chapterContext.compareDocumentPosition(synopsis) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByTestId("project-reading-meta-row")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(shell.style.minHeight).toMatch(/px$/);
    });
  });

  it("renders the hero actions in the full-bleed reader and keeps them out of the sidebar", async () => {
    renderReader(
      { imageFit: "both" },
      {
        editHref: "/dashboard/projetos/projeto-teste/capitulos/1",
        editActionLabel: "Editar extra",
      },
    );

    const infoBar = screen.getByTestId("project-reading-info-bar");
    const actions = within(infoBar).getByTestId("project-reading-actions");
    const backLink = within(actions).getByRole("link", { name: /Voltar ao projeto/i });
    const editLink = within(actions).getByRole("link", { name: /Editar extra/i });

    expect(backLink).toHaveAttribute("href", "/projeto/projeto-teste");
    expect(backLink).toHaveClass(
      "project-reading-action-btn",
      "project-reading-action-btn--secondary",
    );
    expect(editLink).toHaveAttribute("href", "/dashboard/projetos/projeto-teste/capitulos/1");
    expect(editLink).toHaveClass(
      "project-reading-action-btn",
      "project-reading-action-btn--primary",
    );

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));
    const sidebar = await screen.findByTestId("project-reader-sidebar");

    expect(
      within(sidebar).queryByRole("link", { name: /Voltar ao projeto/i }),
    ).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("link", { name: /Editar extra/i })).not.toBeInTheDocument();
    expect(within(sidebar).queryByText(/Navegar pelas/i)).not.toBeInTheDocument();
    expect(
      within(sidebar).queryByRole("button", { name: /Cap.tulo anterior/i }),
    ).not.toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: /Pr.ximo cap.tulo/i })).toBeInTheDocument();
  });

  it("uses the visual viewport in cinema mode and keeps the stage as tall as the shell", async () => {
    setVisualViewport({ height: 640 });
    renderReader({ imageFit: "both" }, { chromeMode: "cinema" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const stage = screen.getByTestId("project-reading-stage");
    const infoBar = screen.getByTestId("project-reading-info-bar");
    const projectTitle = screen.getByTestId("project-reading-project-title");
    const chapterContext = screen.getByTestId("project-reading-chapter-context");
    const synopsis = screen.getByTestId("project-reading-synopsis");
    const heading = within(infoBar).getByRole("heading", { name: /Cap.*tulo 1/i });

    expect(infoBar).toHaveAttribute("data-variant", "reader-cinema");
    expect(shell).toHaveClass("relative", "gap-0");
    expect(screen.queryByTestId("project-reading-context-row")).not.toBeInTheDocument();
    expect(screen.queryByText(/^manga$/i)).not.toBeInTheDocument();
    expect(chapterContext).toHaveTextContent(/Cap.*tulo 1/i);
    expect(projectTitle).toHaveAttribute("href", "/projeto/projeto-teste");
    expect(projectTitle).toHaveClass("project-reading-masthead__overline");
    expect(heading).toHaveClass("project-reading-masthead__title");
    expect(synopsis).toHaveClass("project-reading-masthead__synopsis");
    expect(
      projectTitle.compareDocumentPosition(chapterContext) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      chapterContext.compareDocumentPosition(synopsis) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByTestId("project-reading-meta-row")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(shell.style.minHeight).toBe("640px");
      expect(shell.style.height).toBe("640px");
      expect(stage.style.height).toBe("640px");
    });
  });

  it("renders the hero actions in cinema mode", () => {
    renderReader(
      { imageFit: "both" },
      {
        chromeMode: "cinema",
        editHref: "/dashboard/projetos/projeto-teste/capitulos/1",
        editActionLabel: "Editar capítulo",
      },
    );

    const infoBar = screen.getByTestId("project-reading-info-bar");
    const actions = within(infoBar).getByTestId("project-reading-actions");
    const backLink = within(actions).getByRole("link", { name: /Voltar ao projeto/i });
    const editLink = within(actions).getByRole("link", { name: /Editar cap.tulo/i });

    expect(backLink).toHaveAttribute("href", "/projeto/projeto-teste");
    expect(backLink).toHaveClass(
      "project-reading-action-btn",
      "project-reading-action-btn--secondary",
    );
    expect(editLink).toHaveAttribute("href", "/dashboard/projetos/projeto-teste/capitulos/1");
    expect(editLink).toHaveClass(
      "project-reading-action-btn",
      "project-reading-action-btn--primary",
    );
  });

  it("keeps the default-mode stage tied to the visible viewport even with top chrome above it", async () => {
    setVisualViewport({ height: 640 });
    renderReader({ imageFit: "both" }, { chromeMode: "default" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const infoBar = screen.getByTestId("project-reading-info-bar");
    const stage = screen.getByTestId("project-reading-stage");
    const infoBarWrapper = infoBar.parentElement as HTMLElement;

    mockElementRect(shell, { top: 120, bottom: 856 });
    mockElementRect(infoBarWrapper, { top: 120, bottom: 200 });
    mockElementRect(stage, { top: 216, bottom: 856 });

    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(stage.style.minHeight).toBe("640px");
      expect(stage.style.height).toBe("640px");
      expect(shell.style.minHeight).toBe("736px");
      expect(shell.style.height).toBe("736px");
    });
  });

  it("positions a direct load on the stage instead of leaving the top chrome in view", async () => {
    setVisualViewport({ height: 640 });
    const rectSpy = mockRectsByTestId({
      "project-reading-stage": { top: 260, bottom: 900, width: 1200, height: 640 },
      "reader-page-0": { top: 260, bottom: 900, left: 120, right: 1080, width: 960, height: 640 },
    });

    renderReader({ imageFit: "both" });

    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 260, behavior: "auto" });
    });

    rectSpy.mockRestore();
  });

  it("uses ?page to center the requested page inside the horizontal strip on load", async () => {
    setVisualViewport({ width: 1280, height: 640 });
    const rectSpy = mockRectsByTestId({
      "project-reading-stage": { top: 240, bottom: 880, width: 1200, height: 640 },
      "project-reading-horizontal-scroll": {
        top: 240,
        bottom: 880,
        left: 0,
        right: 800,
        width: 800,
        height: 640,
      },
      "reader-page-0": { top: 240, bottom: 880, left: 0, right: 600, width: 600, height: 640 },
      "reader-page-1": {
        top: 240,
        bottom: 880,
        left: 600,
        right: 1200,
        width: 600,
        height: 640,
      },
    });

    renderReader(
      { layout: "scroll-horizontal", imageFit: "both" },
      {},
      { initialEntries: ["/projeto/projeto-teste/leitura/1?page=2"] },
    );

    const horizontalReader = await screen.findByTestId("project-reading-horizontal-scroll");
    const externalScrollbar = screen.getByTestId("project-reading-horizontal-scrollbar");
    setElementSize(horizontalReader, { clientWidth: 800, scrollWidth: 1400 });
    setElementSize(externalScrollbar, { clientWidth: 800, scrollWidth: 1400 });

    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 240, behavior: "auto" });
      expect(horizontalReader.scrollLeft).toBe(500);
      expect(externalScrollbar.scrollLeft).toBe(500);
    });

    rectSpy.mockRestore();
  });

  it("uses ?page to align the requested page inside the vertical strip on load", async () => {
    setVisualViewport({ height: 640 });
    const rectSpy = mockRectsByTestId({
      "project-reading-stage": { top: 220, bottom: 860, width: 1200, height: 640 },
      "reader-page-0": { top: 220, bottom: 860, width: 1200, height: 640 },
      "reader-page-1": { top: 920, bottom: 1560, width: 1200, height: 640 },
    });

    renderReader(
      { layout: "scroll-vertical", imageFit: "both" },
      {},
      { initialEntries: ["/projeto/projeto-teste/leitura/1?page=2"] },
    );

    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 920, behavior: "auto" });
    });

    rectSpy.mockRestore();
  });

  it("does not reapply the initial stage positioning after normal resize recalculations", async () => {
    setVisualViewport({ height: 640 });
    const rectSpy = mockRectsByTestId({
      "project-reading-stage": { top: 260, bottom: 900, width: 1200, height: 640 },
      "reader-page-0": { top: 260, bottom: 900, width: 1200, height: 640 },
    });

    renderReader({ imageFit: "both" });

    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 260, behavior: "auto" });
    });

    vi.mocked(window.scrollTo).mockClear();
    fireEvent(window, new Event("resize"));

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.scrollTo).not.toHaveBeenCalled();
    rectSpy.mockRestore();
  });

  it("writes ?page=1 to the URL on direct load with replace navigation", async () => {
    renderReader({ imageFit: "both" });

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
      expect(screen.getByTestId("reader-location-action")).toHaveTextContent("REPLACE");
      expect(screen.getByTestId("reader-location-preserve-scroll")).toHaveTextContent("true");
    });
  });

  it("updates ?page in paginated mode as the active page changes", async () => {
    renderReader({ imageFit: "both" });

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
    });

    goToNextPaginatedPage();

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=2");
      expect(screen.getByTestId("reader-location-action")).toHaveTextContent("REPLACE");
      expect(screen.getByTestId("reader-location-preserve-scroll")).toHaveTextContent("true");
    });
  });

  it.each([
    {
      label: "reader-page-surface",
      getTarget: () => screen.getByTestId("reader-page-surface-0"),
    },
    {
      label: "img",
      getTarget: () => screen.getByRole("img", { name: /P.gina 1/i }),
    },
  ])("advances in rtl when clicking the left half of the paginated stage through $label", async ({
    getTarget,
  }) => {
    renderReader({ direction: "rtl", imageFit: "none" });

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
    });

    clickPaginatedTarget({
      target: getTarget(),
      clientX: 250,
      offsetX: 50,
    });

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=2");
    });
  });

  it("uses the full paginated stage width when clicking a nested image in rtl", async () => {
    renderReader({ direction: "rtl", imageFit: "none" });

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
    });

    goToNextPaginatedPage();

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=2");
    });

    clickPaginatedTarget({
      target: screen.getByRole("img", { name: /P.gina 2/i }),
      clientX: 650,
      offsetX: 350,
    });

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
    });
  });

  it("goes to the previous page in ltr when clicking the left half of the paginated stage", async () => {
    renderReader(
      { direction: "ltr", imageFit: "both" },
      {},
      { initialEntries: ["/projeto/projeto-teste/leitura/1?page=2"] },
    );

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=2");
    });

    clickPaginatedTarget({ clientX: 250 });

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
    });
  });

  it("advances in ltr when clicking the right half of the paginated stage", async () => {
    renderReader({ direction: "ltr", imageFit: "both" });

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
    });

    clickPaginatedTarget({ clientX: 750 });

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=2");
    });
  });

  it("updates ?page in the vertical strip as the most visible page changes", async () => {
    setVisualViewport({ height: 640 });
    const rects = {
      "project-reading-stage": { top: 220, bottom: 860, width: 1200, height: 640 },
      "reader-page-0": { top: 220, bottom: 860, width: 1200, height: 640 },
      "reader-page-1": { top: 920, bottom: 1560, width: 1200, height: 640 },
    };
    const rectSpy = mockRectsByTestId(rects);

    renderReader({ layout: "scroll-vertical", imageFit: "both" });

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
    });
    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 220, behavior: "auto" });
    });
    vi.mocked(window.scrollTo).mockClear();

    rects["reader-page-0"] = { top: -680, bottom: -40, width: 1200, height: 640 };
    rects["reader-page-1"] = { top: 24, bottom: 664, width: 1200, height: 640 };
    fireEvent.scroll(window);

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=2");
      expect(screen.getByTestId("reader-location-action")).toHaveTextContent("REPLACE");
      expect(screen.getByTestId("reader-location-preserve-scroll")).toHaveTextContent("true");
    });
    expect(window.scrollTo).not.toHaveBeenCalled();

    rectSpy.mockRestore();
  });

  it("moves the left progress indicator during partial vertical scrolling before ?page changes", async () => {
    setVisualViewport({ height: 640 });
    window.scrollY = 220;
    const rects = {
      "project-reading-stage": { top: 220, bottom: 860, width: 1200, height: 640 },
      "reader-page-0": { top: 220, bottom: 860, width: 1200, height: 640 },
      "reader-page-1": { top: 920, bottom: 1560, width: 1200, height: 640 },
    };
    const rectSpy = mockRectsByTestId(rects);

    renderReader({ layout: "scroll-vertical", imageFit: "both", progressPosition: "left" });

    const indicator = await screen.findByTestId("project-reader-progress-indicator");
    const initialTop = Number.parseFloat(indicator.style.top);

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("1");
    });

    rects["reader-page-0"] = { top: -120, bottom: 520, width: 1200, height: 640 };
    rects["reader-page-1"] = { top: 540, bottom: 1180, width: 1200, height: 640 };
    window.scrollY = 560;
    fireEvent.scroll(window);

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("1");
      expect(
        Number.parseFloat(screen.getByTestId("project-reader-progress-indicator").style.top),
      ).toBeGreaterThan(initialTop + 20);
    });

    rectSpy.mockRestore();
  });

  it("moves the right progress indicator upward during partial reverse vertical scrolling before ?page changes", async () => {
    setVisualViewport({ height: 640 });
    window.scrollY = 920;
    const rects = {
      "project-reading-stage": { top: 220, bottom: 860, width: 1200, height: 640 },
      "reader-page-0": { top: -680, bottom: -40, width: 1200, height: 640 },
      "reader-page-1": { top: 24, bottom: 664, width: 1200, height: 640 },
    };
    const rectSpy = mockRectsByTestId(rects);

    renderReader({ layout: "scroll-vertical", imageFit: "both", progressPosition: "right" });

    const indicator = await screen.findByTestId("project-reader-progress-indicator");
    fireEvent.scroll(window);
    const initialTop = Number.parseFloat(indicator.style.top);

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=2");
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("2");
    });

    rects["reader-page-0"] = { top: -420, bottom: 220, width: 1200, height: 640 };
    rects["reader-page-1"] = { top: 240, bottom: 880, width: 1200, height: 640 };
    window.scrollY = 760;
    fireEvent.scroll(window);

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=2");
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("2");
      expect(
        Number.parseFloat(screen.getByTestId("project-reader-progress-indicator").style.top),
      ).toBeLessThan(initialTop - 20);
    });

    rectSpy.mockRestore();
  });

  it("keeps bottom progress discrete during partial vertical scrolling before ?page changes", async () => {
    setVisualViewport({ height: 640 });
    const rects = {
      "project-reading-stage": { top: 220, bottom: 860, width: 1200, height: 640 },
      "reader-page-0": { top: 220, bottom: 860, width: 1200, height: 640 },
      "reader-page-1": { top: 920, bottom: 1560, width: 1200, height: 640 },
    };
    const rectSpy = mockRectsByTestId(rects);

    renderReader({ layout: "scroll-vertical", imageFit: "both", progressPosition: "bottom" });

    const indicator = await screen.findByTestId("project-reader-progress-indicator");
    const initialLeft = Number.parseFloat(indicator.style.left);

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("1");
    });

    rects["reader-page-0"] = { top: -120, bottom: 520, width: 1200, height: 640 };
    rects["reader-page-1"] = { top: 540, bottom: 1180, width: 1200, height: 640 };
    fireEvent.scroll(window);

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("1");
      expect(
        Number.parseFloat(screen.getByTestId("project-reader-progress-indicator").style.left),
      ).toBeCloseTo(initialLeft, 4);
    });

    rectSpy.mockRestore();
  });

  it("moves the right progress indicator during partial horizontal scrolling before ?page changes", async () => {
    const initialPath = "/projeto/projeto-teste/leitura/1";
    setBrowserLocation(initialPath);
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    setVisualViewport({ width: 1280, height: 640 });
    const rects = {
      "project-reading-stage": { top: 240, bottom: 880, width: 1200, height: 640 },
      "project-reading-horizontal-scroll": {
        top: 240,
        bottom: 880,
        left: 0,
        right: 800,
        width: 800,
        height: 640,
      },
      "reader-page-0": { top: 240, bottom: 880, left: 0, right: 600, width: 600, height: 640 },
      "reader-page-1": {
        top: 240,
        bottom: 880,
        left: 600,
        right: 1200,
        width: 600,
        height: 640,
      },
    };
    const rectSpy = mockRectsByTestId(rects);

    renderReader(
      { layout: "scroll-horizontal", imageFit: "both", progressPosition: "right" },
      {},
      { initialEntries: [initialPath] },
    );

    const horizontalReader = await screen.findByTestId("project-reading-horizontal-scroll");
    const externalScrollbar = screen.getByTestId("project-reading-horizontal-scrollbar");
    setElementSize(horizontalReader, { clientWidth: 800, scrollWidth: 1400 });
    setElementSize(externalScrollbar, { clientWidth: 800, scrollWidth: 1400 });

    const indicator = await screen.findByTestId("project-reader-progress-indicator");
    const initialTop = Number.parseFloat(indicator.style.top);

    await waitFor(() => {
      expect(window.location.search).toBe("?page=1");
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("1");
    });
    replaceStateSpy.mockClear();

    rects["reader-page-0"] = {
      top: 240,
      bottom: 880,
      left: -120,
      right: 480,
      width: 600,
      height: 640,
    };
    rects["reader-page-1"] = {
      top: 240,
      bottom: 880,
      left: 420,
      right: 1020,
      width: 600,
      height: 640,
    };
    horizontalReader.scrollLeft = 120;
    fireEvent.scroll(horizontalReader);

    await waitFor(() => {
      expect(window.location.search).toBe("?page=1");
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("1");
      expect(
        Number.parseFloat(screen.getByTestId("project-reader-progress-indicator").style.top),
      ).toBeGreaterThan(initialTop + 20);
    });
    expect(replaceStateSpy).not.toHaveBeenCalled();

    rectSpy.mockRestore();
  });

  it("moves the right progress indicator upward during partial reverse horizontal scrolling before ?page changes", async () => {
    const initialPath = "/projeto/projeto-teste/leitura/1";
    setBrowserLocation(initialPath);
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    setVisualViewport({ width: 1280, height: 640 });
    const rects = {
      "project-reading-stage": { top: 240, bottom: 880, width: 1200, height: 640 },
      "project-reading-horizontal-scroll": {
        top: 240,
        bottom: 880,
        left: 0,
        right: 800,
        width: 800,
        height: 640,
      },
      "reader-page-0": { top: 240, bottom: 880, left: 0, right: 600, width: 600, height: 640 },
      "reader-page-1": {
        top: 240,
        bottom: 880,
        left: 600,
        right: 1200,
        width: 600,
        height: 640,
      },
    };
    const rectSpy = mockRectsByTestId(rects);

    renderReader(
      { layout: "scroll-horizontal", imageFit: "both", progressPosition: "right" },
      {},
      { initialEntries: [initialPath] },
    );

    const horizontalReader = await screen.findByTestId("project-reading-horizontal-scroll");
    const externalScrollbar = screen.getByTestId("project-reading-horizontal-scrollbar");
    setElementSize(horizontalReader, { clientWidth: 800, scrollWidth: 1400 });
    setElementSize(externalScrollbar, { clientWidth: 800, scrollWidth: 1400 });

    await waitFor(() => {
      expect(window.location.search).toBe("?page=1");
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("1");
    });

    vi.useFakeTimers();
    rects["reader-page-0"] = {
      top: 240,
      bottom: 880,
      left: -260,
      right: 340,
      width: 600,
      height: 640,
    };
    rects["reader-page-1"] = {
      top: 240,
      bottom: 880,
      left: 280,
      right: 880,
      width: 600,
      height: 640,
    };
    horizontalReader.scrollLeft = 260;
    fireEvent.scroll(horizontalReader);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HORIZONTAL_PAGE_URL_SYNC_SETTLE_MS);
    });

    expect(window.location.search).toBe("?page=2");

    const indicator = screen.getByTestId("project-reader-progress-indicator");
    const initialTop = Number.parseFloat(indicator.style.top);
    replaceStateSpy.mockClear();

    rects["reader-page-0"] = {
      top: 240,
      bottom: 880,
      left: -120,
      right: 480,
      width: 600,
      height: 640,
    };
    rects["reader-page-1"] = {
      top: 240,
      bottom: 880,
      left: 420,
      right: 1020,
      width: 600,
      height: 640,
    };
    horizontalReader.scrollLeft = 120;
    fireEvent.scroll(horizontalReader);

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.location.search).toBe("?page=2");
    expect(
      Number.parseFloat(screen.getByTestId("project-reader-progress-indicator").style.top),
    ).toBeLessThan(initialTop - 20);
    expect(replaceStateSpy).not.toHaveBeenCalled();

    rectSpy.mockRestore();
  });

  it("keeps ?page unchanged during slow horizontal scrolling near the boundary and updates after a clear lead", async () => {
    const initialPath = "/projeto/projeto-teste/leitura/1";
    setBrowserLocation(initialPath);
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    setVisualViewport({ width: 1280, height: 640 });
    const rects = {
      "project-reading-stage": { top: 240, bottom: 880, width: 1200, height: 640 },
      "project-reading-horizontal-scroll": {
        top: 240,
        bottom: 880,
        left: 0,
        right: 800,
        width: 800,
        height: 640,
      },
      "reader-page-0": { top: 240, bottom: 880, left: 0, right: 600, width: 600, height: 640 },
      "reader-page-1": {
        top: 240,
        bottom: 880,
        left: 600,
        right: 1200,
        width: 600,
        height: 640,
      },
    };
    const rectSpy = mockRectsByTestId(rects);

    renderReader(
      { layout: "scroll-horizontal", imageFit: "both" },
      {},
      { initialEntries: [initialPath] },
    );

    const horizontalReader = await screen.findByTestId("project-reading-horizontal-scroll");
    const externalScrollbar = screen.getByTestId("project-reading-horizontal-scrollbar");
    setElementSize(horizontalReader, { clientWidth: 800, scrollWidth: 1400 });
    setElementSize(externalScrollbar, { clientWidth: 800, scrollWidth: 1400 });

    await waitFor(() => {
      expect(window.location.search).toBe("?page=1");
    });
    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 240, behavior: "auto" });
    });
    expect(screen.getByTestId("reader-location-search").textContent).toBe("");
    expect(screen.getByTestId("reader-location-action")).toHaveTextContent("POP");
    expect(screen.getByTestId("reader-location-preserve-scroll")).toHaveTextContent("false");
    vi.mocked(window.scrollTo).mockClear();
    replaceStateSpy.mockClear();
    vi.useFakeTimers();

    rects["reader-page-0"] = {
      top: 240,
      bottom: 880,
      left: -120,
      right: 480,
      width: 600,
      height: 640,
    };
    rects["reader-page-1"] = {
      top: 240,
      bottom: 880,
      left: 420,
      right: 1020,
      width: 600,
      height: 640,
    };
    horizontalReader.scrollLeft = 120;
    fireEvent.scroll(horizontalReader);

    expect(window.location.search).toBe("?page=1");
    expect(replaceStateSpy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HORIZONTAL_PAGE_URL_SYNC_SETTLE_MS);
    });

    expect(window.location.search).toBe("?page=1");
    expect(replaceStateSpy).not.toHaveBeenCalled();

    rects["reader-page-0"] = {
      top: 240,
      bottom: 880,
      left: -260,
      right: 340,
      width: 600,
      height: 640,
    };
    rects["reader-page-1"] = {
      top: 240,
      bottom: 880,
      left: 280,
      right: 880,
      width: 600,
      height: 640,
    };
    horizontalReader.scrollLeft = 260;
    fireEvent.scroll(horizontalReader);

    expect(window.location.search).toBe("?page=1");
    expect(replaceStateSpy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HORIZONTAL_PAGE_URL_SYNC_SETTLE_MS - 1);
    });

    expect(window.location.search).toBe("?page=1");
    expect(replaceStateSpy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(window.location.search).toBe("?page=2");
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(String(replaceStateSpy.mock.calls[0]?.[2] || "")).toBe(
      "/projeto/projeto-teste/leitura/1?page=2",
    );
    expect(screen.getByTestId("reader-location-search").textContent).toBe("");
    expect(screen.getByTestId("reader-location-action")).toHaveTextContent("POP");
    expect(screen.getByTestId("reader-location-preserve-scroll")).toHaveTextContent("false");
    expect(horizontalReader.scrollLeft).toBe(260);
    expect(externalScrollbar.scrollLeft).toBe(260);
    expect(window.scrollTo).not.toHaveBeenCalled();

    rectSpy.mockRestore();
  });

  it("commits only the last stabilized page to ?page during rapid horizontal scrolling", async () => {
    const initialBrowserState = { source: "browser-history" };
    const initialPath = "/projeto/projeto-teste/leitura/1?volume=2&foo=bar#comment-42";
    const browserStateSnapshot = setBrowserLocation(initialPath, initialBrowserState);
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    setVisualViewport({ width: 1280, height: 640 });
    const rects = {
      "project-reading-stage": { top: 240, bottom: 880, width: 1800, height: 640 },
      "project-reading-horizontal-scroll": {
        top: 240,
        bottom: 880,
        left: 0,
        right: 800,
        width: 800,
        height: 640,
      },
      "reader-page-0": { top: 240, bottom: 880, left: 0, right: 600, width: 600, height: 640 },
      "reader-page-1": {
        top: 240,
        bottom: 880,
        left: 600,
        right: 1200,
        width: 600,
        height: 640,
      },
      "reader-page-2": {
        top: 240,
        bottom: 880,
        left: 1200,
        right: 1800,
        width: 600,
        height: 640,
      },
    };
    const rectSpy = mockRectsByTestId(rects);

    renderReader(
      { layout: "scroll-horizontal", imageFit: "both" },
      {
        pages: [
          { position: 0, imageUrl: "/page-1.jpg" },
          { position: 1, imageUrl: "/page-2.jpg" },
          { position: 2, imageUrl: "/page-3.jpg" },
        ],
      },
      { initialEntries: [initialPath] },
    );

    const horizontalReader = await screen.findByTestId("project-reading-horizontal-scroll");
    const externalScrollbar = screen.getByTestId("project-reading-horizontal-scrollbar");
    setElementSize(horizontalReader, { clientWidth: 800, scrollWidth: 2000 });
    setElementSize(externalScrollbar, { clientWidth: 800, scrollWidth: 2000 });

    await waitFor(() => {
      expect(window.location.search).toBe("?volume=2&foo=bar&page=1");
    });
    expect(window.location.hash).toBe("#comment-42");
    expect(screen.getByTestId("reader-location-search").textContent).toBe("?volume=2&foo=bar");
    expect(screen.getByTestId("reader-location-action")).toHaveTextContent("POP");
    expect(screen.getByTestId("reader-location-preserve-scroll")).toHaveTextContent("false");
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy.mock.calls[0]?.[0]).toBe(browserStateSnapshot);
    expect(String(replaceStateSpy.mock.calls[0]?.[2] || "")).toBe(
      "/projeto/projeto-teste/leitura/1?volume=2&foo=bar&page=1#comment-42",
    );
    vi.mocked(window.scrollTo).mockClear();
    replaceStateSpy.mockClear();
    vi.useFakeTimers();

    rects["reader-page-0"] = {
      top: 240,
      bottom: 880,
      left: -520,
      right: 80,
      width: 600,
      height: 640,
    };
    rects["reader-page-1"] = {
      top: 240,
      bottom: 880,
      left: 80,
      right: 680,
      width: 600,
      height: 640,
    };
    rects["reader-page-2"] = {
      top: 240,
      bottom: 880,
      left: 680,
      right: 1280,
      width: 600,
      height: 640,
    };
    horizontalReader.scrollLeft = 520;
    fireEvent.scroll(horizontalReader);

    rects["reader-page-0"] = {
      top: 240,
      bottom: 880,
      left: -1120,
      right: -520,
      width: 600,
      height: 640,
    };
    rects["reader-page-1"] = {
      top: 240,
      bottom: 880,
      left: -520,
      right: 80,
      width: 600,
      height: 640,
    };
    rects["reader-page-2"] = {
      top: 240,
      bottom: 880,
      left: 80,
      right: 680,
      width: 600,
      height: 640,
    };
    horizontalReader.scrollLeft = 1120;
    fireEvent.scroll(horizontalReader);

    expect(window.location.search).toBe("?volume=2&foo=bar&page=1");
    expect(replaceStateSpy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(HORIZONTAL_PAGE_URL_SYNC_SETTLE_MS);
    });

    expect(window.location.search).toBe("?volume=2&foo=bar&page=3");
    expect(window.location.hash).toBe("#comment-42");
    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy.mock.calls[0]?.[0]).toBe(browserStateSnapshot);
    expect(String(replaceStateSpy.mock.calls[0]?.[2] || "")).toBe(
      "/projeto/projeto-teste/leitura/1?volume=2&foo=bar&page=3#comment-42",
    );
    expect(screen.getByTestId("reader-location-search").textContent).toBe("?volume=2&foo=bar");
    expect(screen.getByTestId("reader-location-action")).toHaveTextContent("POP");
    expect(screen.getByTestId("reader-location-preserve-scroll")).toHaveTextContent("false");
    expect(horizontalReader.scrollLeft).toBe(1120);
    expect(externalScrollbar.scrollLeft).toBe(1120);

    rectSpy.mockRestore();
  });

  it("keeps the horizontal stage at full visible height while the external scrollbar sits outside the page bounds", async () => {
    setVisualViewport({ height: 640 });
    renderReader({ layout: "scroll-horizontal", imageFit: "both" }, { chromeMode: "default" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const infoBar = screen.getByTestId("project-reading-info-bar");
    const stage = screen.getByTestId("project-reading-stage");
    const scrollbarHost = screen.getByTestId("project-reading-horizontal-scrollbar-host");
    const infoBarWrapper = infoBar.parentElement as HTMLElement;

    mockElementRect(shell, { top: 120, bottom: 904 });
    mockElementRect(infoBarWrapper, { top: 120, bottom: 200 });
    mockElementRect(stage, { top: 216, bottom: 856 });
    mockElementRect(scrollbarHost, { top: 856, bottom: 904, height: 48 });

    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(stage.style.minHeight).toBe("640px");
      expect(stage.style.height).toBe("640px");
      expect(shell.style.minHeight).toBe("736px");
      expect(shell.style.height).toBe("736px");
    });

    expect(scrollbarHost).toHaveClass("absolute", "top-full", "overflow-visible");
  });

  it("keeps the horizontal page surface tied to the stage height when the hidden native scrollbar consumes gutter", async () => {
    setVisualViewport({ height: 640 });
    renderReader({ layout: "scroll-horizontal", imageFit: "both" }, { chromeMode: "default" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const infoBar = screen.getByTestId("project-reading-info-bar");
    const stage = screen.getByTestId("project-reading-stage");
    const horizontalReader = screen.getByTestId("project-reading-horizontal-scroll");
    const surface = screen.getByTestId("reader-page-surface-0");
    const scrollbarHost = screen.getByTestId("project-reading-horizontal-scrollbar-host");
    const infoBarWrapper = infoBar.parentElement as HTMLElement;

    mockElementRect(shell, { top: 120, bottom: 904 });
    mockElementRect(infoBarWrapper, { top: 120, bottom: 200 });
    mockElementRect(stage, { top: 216, bottom: 856 });
    mockElementRect(scrollbarHost, { top: 856, bottom: 904, height: 48 });
    setElementSize(horizontalReader, {
      clientWidth: 1200,
      scrollWidth: 2400,
      clientHeight: 624,
      offsetHeight: 640,
    });

    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(stage.style.minHeight).toBe("640px");
      expect(stage.style.height).toBe("640px");
      expect(shell.style.minHeight).toBe("736px");
      expect(shell.style.height).toBe("736px");
      expect(surface.style.height).toBe("640px");
      expect(horizontalReader.style.minHeight).toBe("656px");
      expect(horizontalReader.style.height).toBe("656px");
    });

    expect(horizontalReader.className).not.toContain("py-2");
    expect(horizontalReader.className).not.toContain("md:py-4");
    expect(horizontalReader.className).not.toContain("px-2");
    expect(horizontalReader.className).not.toContain("md:px-4");
    expect(scrollbarHost.className).not.toContain("px-2");
    expect(scrollbarHost.className).not.toContain("md:px-4");
    expect(scrollbarHost).toHaveClass("absolute", "top-full", "overflow-visible");
  });

  it("preserves existing query params and hash while syncing ?page", async () => {
    renderReader(
      { imageFit: "both" },
      {},
      {
        initialEntries: ["/projeto/projeto-teste/leitura/1?volume=2&foo=bar#comment-42"],
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent(
        "?volume=2&foo=bar&page=1",
      );
      expect(screen.getByTestId("reader-location-hash")).toHaveTextContent("#comment-42");
      expect(screen.getByTestId("reader-location-action")).toHaveTextContent("REPLACE");
      expect(screen.getByTestId("reader-location-preserve-scroll")).toHaveTextContent("true");
    });
  });

  it("falls back to innerHeight when visualViewport is unavailable", async () => {
    renderReader({ imageFit: "both" }, { chromeMode: "cinema" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");

    await waitFor(() => {
      expect(shell.style.minHeight).toBe("900px");
      expect(shell.style.height).toBe("900px");
    });
  });

  it.each([
    { progressPosition: "bottom", edge: "bottom" },
    { progressPosition: "left", edge: "left" },
    { progressPosition: "right", edge: "right" },
  ])("renders the %s default progress overlay inside the sticky stage viewport", async ({
    progressPosition,
    edge,
  }) => {
    renderReader({ progressStyle: "default", progressPosition });

    const stage = screen.getByTestId("project-reading-stage");
    const menuViewport = screen.getByTestId("project-reader-menu-viewport");
    const progressViewport = await screen.findByTestId("project-reader-progress-viewport");
    const progressViewportShell = progressViewport.parentElement as HTMLElement;
    const overlay = await screen.findByTestId("project-reader-progress-overlay");
    const progressTrack = screen.getByTestId("project-reader-progress-track");
    const indicator = screen.getByTestId("project-reader-progress-indicator");
    const label = screen.getByTestId("project-reader-progress-label");
    const hitArea = screen.getByTestId("project-reader-progress-hit-area");

    expect(progressViewportShell.closest('[data-testid="project-reading-stage"]')).toBe(stage);
    expect(progressViewportShell).toHaveClass("sticky", "top-0", "h-0");
    expect(menuViewport).not.toBe(progressViewport);
    expect(within(progressViewport).queryByTestId("project-reader-menu-host")).not.toBeInTheDocument();
    expect(overlay.closest('[data-testid="project-reading-stage"]')).toBe(stage);
    expect(overlay).toHaveClass("absolute");
    expect(overlay.className).not.toContain("fixed");
    expect(overlay.className).not.toContain("inset-0");
    expect(overlay.className).not.toContain("transition-all");
    expect(overlay.style[edge as "bottom" | "left" | "right"]).toContain(`safe-area-inset-${edge}`);
    expect(overlay.style[edge as "bottom" | "left" | "right"]).toContain("12px");
    if (progressPosition === "bottom") {
      expect(overlay.style.top).toBe("");
    }
    if (progressPosition === "left") {
      expect(overlay.style.right).toBe("");
    }
    if (progressPosition === "right") {
      expect(overlay.style.left).toBe("");
    }
    expect(progressTrack).toBeInTheDocument();
    expect(screen.queryByTestId("project-reader-progress-beam")).not.toBeInTheDocument();
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass("bg-accent");
    expect(indicator.className).not.toContain("transition-all");
    expect(label).toHaveClass("bg-accent", "text-accent-foreground", "py-0.5", "opacity-0");
    expect(label.className).not.toContain("transition-all");
    expect(label).toHaveClass(progressPosition === "bottom" ? "bottom-2" : "min-h-7");
    await waitFor(() => {
      expect(overlay).toHaveAttribute("data-state", "visible");
    });

    fireEvent.mouseEnter(hitArea);
    expect(label).toHaveTextContent("1");
    expect(label).toHaveClass("opacity-100");
    if (progressPosition === "left") {
      expect(label).toHaveClass("left-5");
    }
    if (progressPosition === "right") {
      expect(label).toHaveClass("right-5");
    }
  });

  it.each([
    "bottom",
    "left",
    "right",
  ] as const)("keeps the bullet centered in the %s progress track", async (progressPosition) => {
    renderReader(
      { progressStyle: "default", progressPosition },
      {
        pages: [
          { position: 0, imageUrl: "/page-1.jpg" },
          { position: 1, imageUrl: "/page-2.jpg" },
          { position: 2, imageUrl: "/page-3.jpg" },
        ],
      },
    );

    goToNextPaginatedPage();

    await waitFor(() => {
      const indicator = screen.getByTestId("project-reader-progress-indicator");
      const expectedClassName =
        progressPosition === "bottom" ? "-translate-x-1/2" : "-translate-y-1/2";
      const styleKey = progressPosition === "bottom" ? "left" : "top";
      const expectedMiddlePosition = getProgressContainerLength(progressPosition) / 2;

      expect(indicator).toHaveClass(expectedClassName);
      expect(Number.parseFloat(indicator.style[styleKey as "left" | "top"])).toBeCloseTo(
        expectedMiddlePosition,
        4,
      );
    });
  });

  it("centers bottom progress using the stage width instead of the global viewport", async () => {
    renderReader(
      { progressStyle: "default", progressPosition: "bottom" },
      {
        pages: [
          { position: 0, imageUrl: "/page-1.jpg" },
          { position: 1, imageUrl: "/page-2.jpg" },
          { position: 2, imageUrl: "/page-3.jpg" },
        ],
      },
    );

    const stage = screen.getByTestId("project-reading-stage");
    const progressViewport = await screen.findByTestId("project-reader-progress-viewport");
    const stageRectSpy = mockElementRect(stage, {
      top: 120,
      bottom: 760,
      left: 400,
      right: 880,
      width: 480,
      height: 640,
    });

    fireEvent.scroll(window);
    goToNextPaginatedPage();

    expect(progressViewport.style.height).toBe("640px");
    expect(
      Number.parseFloat(screen.getByTestId("project-reader-progress-indicator").style.left),
    ).toBeCloseTo(getProgressContainerLength("bottom", { width: 480, height: 640 }) / 2, 4);

    stageRectSpy.mockRestore();
  });

  it.each([
    "bottom",
    "left",
    "right",
  ] as const)("keeps the first and last bullet positions contained for %s", async (progressPosition) => {
    renderReader({ progressStyle: "default", progressPosition });

    const indicator = await screen.findByTestId("project-reader-progress-indicator");
    const label = screen.getByTestId("project-reader-progress-label");
    const expectedClassName =
      progressPosition === "bottom" ? "-translate-x-1/2" : "-translate-y-1/2";
    const styleKey = progressPosition === "bottom" ? "left" : "top";
    const rootFontSizePx = getRootFontSizePx();
    const indicatorInsetPx = rootFontSizePx * (progressPosition === "bottom" ? 3 : 2.25);
    const labelInsetPx = getProgressLabelInsetPx(progressPosition);
    const containerLength = getProgressContainerLength(progressPosition);

    expect(indicator).toHaveClass(expectedClassName);
    expect(Number.parseFloat(indicator.style[styleKey as "left" | "top"])).toBeCloseTo(
      indicatorInsetPx,
      4,
    );
    expect(label).toHaveClass(expectedClassName);
    expect(Number.parseFloat(label.style[styleKey as "left" | "top"])).toBeCloseTo(labelInsetPx, 4);
    if (progressPosition !== "bottom") {
      expect(indicator.style.bottom).toBe("");
      expect(label.style.bottom).toBe("");
    }

    goToLastPaginatedPage();

    await waitFor(() => {
      expect(screen.getByTestId("project-reader-progress-indicator")).toHaveClass(
        expectedClassName,
      );
      expect(
        Number.parseFloat(
          screen.getByTestId("project-reader-progress-indicator").style[styleKey as "left" | "top"],
        ),
      ).toBeCloseTo(containerLength - indicatorInsetPx, 4);
      expect(screen.getByTestId("project-reader-progress-label")).toHaveClass(expectedClassName);
      expect(
        Number.parseFloat(
          screen.getByTestId("project-reader-progress-label").style[styleKey as "left" | "top"],
        ),
      ).toBeCloseTo(containerLength - labelInsetPx, 4);
    });
  });

  it.each([
    "bottom",
    "left",
    "right",
  ] as const)("navigates to the clicked page through the %s progress track", async (progressPosition) => {
    renderReader(
      { progressStyle: "default", progressPosition },
      {
        pages: [
          { position: 0, imageUrl: "/page-1.jpg" },
          { position: 1, imageUrl: "/page-2.jpg" },
          { position: 2, imageUrl: "/page-3.jpg" },
        ],
      },
    );

    const progressTrack = await screen.findByTestId("project-reader-progress-track");
    const hitArea = screen.getByTestId("project-reader-progress-hit-area");
    const rectSpy = mockProgressTrackRect(progressTrack, progressPosition);

    fireEvent.pointerDown(hitArea, {
      pointerId: 1,
      pointerType: "mouse",
      clientX:
        progressPosition === "bottom"
          ? window.innerWidth - 40
          : progressPosition === "left"
            ? 24
            : window.innerWidth - 24,
      clientY: progressPosition === "bottom" ? window.innerHeight - 24 : window.innerHeight - 24,
    });
    fireEvent.pointerUp(hitArea, {
      pointerId: 1,
      pointerType: "mouse",
      clientX:
        progressPosition === "bottom"
          ? window.innerWidth - 40
          : progressPosition === "left"
            ? 24
            : window.innerWidth - 24,
      clientY: progressPosition === "bottom" ? window.innerHeight - 24 : window.innerHeight - 24,
    });

    await waitFor(() => {
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("3");
    });

    rectSpy.mockRestore();
  });

  it("updates paginated progress live while dragging the progress track", async () => {
    renderReader(
      { progressStyle: "default", progressPosition: "bottom" },
      {
        pages: [
          { position: 0, imageUrl: "/page-1.jpg" },
          { position: 1, imageUrl: "/page-2.jpg" },
          { position: 2, imageUrl: "/page-3.jpg" },
          { position: 3, imageUrl: "/page-4.jpg" },
        ],
      },
    );

    const progressTrack = await screen.findByTestId("project-reader-progress-track");
    const hitArea = screen.getByTestId("project-reader-progress-hit-area");
    const rectSpy = mockProgressTrackRect(progressTrack, "bottom");

    fireEvent.pointerDown(hitArea, {
      pointerId: 2,
      pointerType: "mouse",
      clientX: 24,
      clientY: window.innerHeight - 24,
    });

    await waitFor(() => {
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("1");
    });

    fireEvent.pointerMove(hitArea, {
      pointerId: 2,
      pointerType: "mouse",
      clientX: window.innerWidth * 0.66,
      clientY: window.innerHeight - 24,
    });

    await waitFor(() => {
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("3");
    });

    fireEvent.pointerMove(hitArea, {
      pointerId: 2,
      pointerType: "mouse",
      clientX: window.innerWidth - 32,
      clientY: window.innerHeight - 24,
    });

    await waitFor(() => {
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("4");
    });

    fireEvent.pointerUp(hitArea, {
      pointerId: 2,
      pointerType: "mouse",
      clientX: window.innerWidth - 32,
      clientY: window.innerHeight - 24,
    });

    rectSpy.mockRestore();
  });

  it("reveals hidden progress on mouse proximity and hides it after the delay and transition", async () => {
    renderReader({ progressStyle: "hidden", progressPosition: "bottom" });
    vi.useFakeTimers();

    const stage = screen.getByTestId("project-reading-stage");
    const progressViewport = screen.getByTestId("project-reader-progress-viewport");
    const zone = screen.getByTestId("project-reader-progress-activation-zone");

    expect(progressViewport.closest('[data-testid="project-reading-stage"]')).toBe(stage);
    expect(zone.closest('[data-testid="project-reading-stage"]')).toBe(stage);
    expect(zone.className).not.toContain("fixed");

    expect(screen.queryByTestId("project-reader-progress-overlay")).not.toBeInTheDocument();

    fireEvent.mouseEnter(zone);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });

    const overlay = screen.getByTestId("project-reader-progress-overlay");
    const indicator = screen.getByTestId("project-reader-progress-indicator");
    const label = screen.getByTestId("project-reader-progress-label");

    expect(screen.getByTestId("project-reader-progress-track")).toBeInTheDocument();
    expect(screen.queryByTestId("project-reader-progress-beam")).not.toBeInTheDocument();
    expect(overlay).toHaveAttribute("data-state", "visible");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass("bg-accent");
    expect(label).toHaveClass("bg-accent", "text-accent-foreground");
    expect(label).toHaveTextContent("1");

    fireEvent.mouseLeave(zone);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROGRESS_OVERLAY_TRANSITION_MS);
    });

    expect(screen.getByTestId("project-reader-progress-overlay")).toHaveAttribute(
      "data-state",
      "hidden",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROGRESS_OVERLAY_TRANSITION_MS);
    });

    expect(screen.queryByTestId("project-reader-progress-overlay")).not.toBeInTheDocument();
  });

  it("reveals hidden progress and scrubs top-down from the hidden side zone", async () => {
    renderReader(
      { progressStyle: "hidden", progressPosition: "right" },
      {
        pages: [
          { position: 0, imageUrl: "/page-1.jpg" },
          { position: 1, imageUrl: "/page-2.jpg" },
          { position: 2, imageUrl: "/page-3.jpg" },
        ],
      },
    );

    const zone = screen.getByTestId("project-reader-progress-activation-zone");

    fireEvent.pointerDown(zone, {
      pointerId: 3,
      pointerType: "mouse",
      clientX: window.innerWidth - 24,
      clientY: 24,
    });

    await waitFor(() => {
      expect(screen.getByTestId("project-reader-progress-overlay")).toHaveAttribute(
        "data-state",
        "visible",
      );
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("1");
    });

    fireEvent.pointerMove(zone, {
      pointerId: 3,
      pointerType: "mouse",
      clientX: window.innerWidth - 24,
      clientY: window.innerHeight - 24,
    });

    await waitFor(() => {
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("3");
    });

    fireEvent.pointerUp(zone, {
      pointerId: 3,
      pointerType: "mouse",
      clientX: window.innerWidth - 24,
      clientY: 24,
    });
  });

  it("uses the stage-local fallback rect when hidden progress is revealed before the track mounts", async () => {
    renderReader(
      { progressStyle: "hidden", progressPosition: "bottom" },
      {
        pages: [
          { position: 0, imageUrl: "/page-1.jpg" },
          { position: 1, imageUrl: "/page-2.jpg" },
          { position: 2, imageUrl: "/page-3.jpg" },
          { position: 3, imageUrl: "/page-4.jpg" },
        ],
      },
    );

    const stage = screen.getByTestId("project-reading-stage");
    const progressViewport = screen.getByTestId("project-reader-progress-viewport");
    const zone = screen.getByTestId("project-reader-progress-activation-zone");
    const stageRectSpy = mockElementRect(stage, {
      top: 120,
      bottom: 760,
      left: 400,
      right: 880,
      width: 480,
      height: 640,
    });
    const progressViewportRectSpy = mockElementRect(progressViewport, {
      top: 120,
      bottom: 760,
      left: 400,
      right: 880,
      width: 480,
      height: 640,
    });

    fireEvent.pointerDown(zone, {
      pointerId: 6,
      pointerType: "mouse",
      clientX: 860,
      clientY: 740,
    });

    await waitFor(() => {
      expect(screen.getByTestId("project-reader-progress-overlay")).toHaveAttribute(
        "data-state",
        "visible",
      );
      expect(screen.getByTestId("project-reader-progress-label")).toHaveTextContent("4");
    });

    fireEvent.pointerUp(zone, {
      pointerId: 6,
      pointerType: "mouse",
      clientX: 860,
      clientY: 740,
    });

    stageRectSpy.mockRestore();
    progressViewportRectSpy.mockRestore();
  });

  it("shrinks the sticky progress viewport to the visible slice of the stage near the bottom", async () => {
    renderReader(
      { progressStyle: "default", progressPosition: "left" },
      {
        pages: [
          { position: 0, imageUrl: "/page-1.jpg" },
          { position: 1, imageUrl: "/page-2.jpg" },
          { position: 2, imageUrl: "/page-3.jpg" },
        ],
      },
    );

    const stage = screen.getByTestId("project-reading-stage");
    const progressViewport = await screen.findByTestId("project-reader-progress-viewport");
    const stageRectSpy = mockElementRect(stage, {
      top: 700,
      bottom: 1300,
      left: 240,
      right: 720,
      width: 480,
      height: 600,
    });

    fireEvent.scroll(window);
    goToNextPaginatedPage();
    goToNextPaginatedPage();

    expect(progressViewport.style.height).toBe("200px");
    expect(
      Number.parseFloat(screen.getByTestId("project-reader-progress-indicator").style.top),
    ).toBeCloseTo(
      getProgressContainerLength("left", { width: 480, height: 200 }) - getRootFontSizePx() * 2.25,
      4,
    );

    stageRectSpy.mockRestore();
  });

  it("uses scrollIntoView when scrubbing in continuous mode", async () => {
    renderReader(
      { progressStyle: "default", progressPosition: "bottom", layout: "scroll-vertical" },
      {
        pages: [
          { position: 0, imageUrl: "/page-1.jpg" },
          { position: 1, imageUrl: "/page-2.jpg" },
          { position: 2, imageUrl: "/page-3.jpg" },
        ],
      },
    );

    const targetPage = await screen.findByTestId("reader-page-2");
    const targetScrollSpy = vi.fn();
    Object.defineProperty(targetPage, "scrollIntoView", {
      configurable: true,
      value: targetScrollSpy,
    });

    const progressTrack = screen.getByTestId("project-reader-progress-track");
    const hitArea = screen.getByTestId("project-reader-progress-hit-area");
    const rectSpy = mockProgressTrackRect(progressTrack, "bottom");

    fireEvent.pointerDown(hitArea, {
      pointerId: 4,
      pointerType: "mouse",
      clientX: window.innerWidth - 32,
      clientY: window.innerHeight - 24,
    });
    fireEvent.pointerUp(hitArea, {
      pointerId: 4,
      pointerType: "mouse",
      clientX: window.innerWidth - 32,
      clientY: window.innerHeight - 24,
    });

    await waitFor(() => {
      expect(targetScrollSpy).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
        inline: "nearest",
      });
    });

    rectSpy.mockRestore();
  });

  it("deduplicates repeated scrubs within the same page range", async () => {
    renderReader(
      { progressStyle: "default", progressPosition: "right", layout: "scroll-vertical" },
      {
        pages: [
          { position: 0, imageUrl: "/page-1.jpg" },
          { position: 1, imageUrl: "/page-2.jpg" },
        ],
      },
    );

    const targetPage = await screen.findByTestId("reader-page-1");
    const targetScrollSpy = vi.fn();
    Object.defineProperty(targetPage, "scrollIntoView", {
      configurable: true,
      value: targetScrollSpy,
    });

    const progressTrack = screen.getByTestId("project-reader-progress-track");
    const hitArea = screen.getByTestId("project-reader-progress-hit-area");
    const rectSpy = mockProgressTrackRect(progressTrack, "right");

    fireEvent.pointerDown(hitArea, {
      pointerId: 5,
      pointerType: "mouse",
      clientX: window.innerWidth - 24,
      clientY: window.innerHeight / 2,
    });
    fireEvent.pointerMove(hitArea, {
      pointerId: 5,
      pointerType: "mouse",
      clientX: window.innerWidth - 24,
      clientY: window.innerHeight / 2 + 10,
    });
    fireEvent.pointerMove(hitArea, {
      pointerId: 5,
      pointerType: "mouse",
      clientX: window.innerWidth - 24,
      clientY: window.innerHeight / 2 + 16,
    });
    fireEvent.pointerUp(hitArea, {
      pointerId: 5,
      pointerType: "mouse",
      clientX: window.innerWidth - 24,
      clientY: window.innerHeight / 2 + 16,
    });

    await waitFor(() => {
      expect(targetScrollSpy).toHaveBeenCalledTimes(1);
    });

    rectSpy.mockRestore();
  });

  it("hides the stage-local progress overlay when the stage leaves the viewport", async () => {
    renderReader({ progressStyle: "default", progressPosition: "bottom" });

    const stage = screen.getByTestId("project-reading-stage");
    const rectSpy = mockElementRect(stage, {
      top: -960,
      bottom: -160,
      height: 800,
    });

    const overlay = await screen.findByTestId("project-reader-progress-overlay");
    expect(overlay).toBeInTheDocument();

    fireEvent.scroll(window);

    await waitFor(() => {
      expect(screen.getByTestId("project-reader-progress-overlay")).toHaveAttribute(
        "data-state",
        "hidden",
      );
    });

    await waitFor(() => {
      expect(screen.queryByTestId("project-reader-progress-overlay")).not.toBeInTheDocument();
    });

    rectSpy.mockRestore();
  });

  it("opens a local sticky panel inside the stage when the reader menu button is clicked", async () => {
    renderReader({ imageFit: "both" });

    const infoBar = screen.getByTestId("project-reading-info-bar");
    const stage = screen.getByTestId("project-reading-stage");
    const menuViewport = screen.getByTestId("project-reader-menu-viewport");
    const progressViewport = screen.getByTestId("project-reader-progress-viewport");
    const menuHost = screen.getByTestId("project-reader-menu-host");
    const menuButton = screen.getByTestId("project-reader-menu-button");
    expect(stage.contains(menuButton)).toBe(true);
    expect(stage.contains(menuHost)).toBe(true);
    expect(stage.contains(menuViewport)).toBe(true);
    expect(menuViewport).not.toBe(progressViewport);
    expect(menuViewport.contains(menuHost)).toBe(true);
    expect(infoBar.contains(menuButton)).toBe(false);
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);

    const sidebar = await screen.findByTestId("project-reader-sidebar");
    const sidebarHeader = within(sidebar).getByText("Leitor").closest("div")?.parentElement as HTMLElement;
    expect(sidebar.tagName).toBe("ASIDE");
    expect(stage.contains(sidebar)).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("project-reader-menu-button-shell")).toHaveAttribute(
        "data-state",
        "hidden",
      );
    });
    expect(sidebar).toHaveClass("top-0");
    expect(sidebar.style.width).toBe("21rem");
    expect(sidebar.style.maxWidth).toBe("calc(100% - 0.75rem)");
    expect(sidebar.style.maxHeight).toMatch(/px$/);
    expect(sidebar.style.height).toMatch(/px$/);
    expect(within(sidebar).getByTestId("project-reader-menu-scroll-area").style.height).toMatch(
      /px$/,
    );
    expect(sidebar.className).not.toContain("transition-all");
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(within(sidebar).getByText("Leitor")).toBeInTheDocument();
    expect(sidebarHeader).not.toHaveTextContent(/\bCap 1\b/);
    expect(sidebarHeader).not.toHaveTextContent(/P.gina 1/i);
    expect(within(sidebar).getByRole("button", { name: "Fechar menu do leitor" })).toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole("button", { name: "Fechar menu do leitor" }));

    await waitFor(() => {
      expect(screen.queryByTestId("project-reader-sidebar")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("project-reader-menu-button")).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the mobile reader menu as a responsive in-stage overlay with a simplified header", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 640,
    });

    renderReader({ imageFit: "both" });

    const stage = screen.getByTestId("project-reading-stage");
    const menuViewport = screen.getByTestId("project-reader-menu-viewport");
    const menuHost = screen.getByTestId("project-reader-menu-host");
    const menuButton = screen.getByTestId("project-reader-menu-button");
    fireEvent.click(menuButton);

    const sidebar = await screen.findByTestId("project-reader-sidebar");
    const sidebarHeader = within(sidebar).getByText("Leitor").closest("div")?.parentElement as HTMLElement;
    expect(sidebar.tagName).toBe("ASIDE");
    expect(stage.contains(sidebar)).toBe(true);
    expect(stage.contains(menuHost)).toBe(true);
    expect(stage.contains(menuViewport)).toBe(true);
    expect(menuViewport.contains(menuHost)).toBe(true);
    await waitFor(() => {
      const menuButtonShell = screen.queryByTestId("project-reader-menu-button-shell");
      expect(
        menuButtonShell === null || menuButtonShell.getAttribute("data-state") === "hidden",
      ).toBe(true);
    });
    expect(sidebar).toHaveClass("top-0");
    expect(sidebar.style.width).toBe("20.5rem");
    expect(sidebar.style.maxWidth).toBe("calc(100% - 0.75rem)");
    expect(sidebar.style.maxHeight).toMatch(/px$/);
    expect(sidebar.style.height).toMatch(/px$/);
    expect(sidebar).toHaveClass("bg-background/92", "text-foreground");
    expect(within(sidebar).getByTestId("project-reader-menu-scroll-area").style.height).toMatch(
      /px$/,
    );
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(within(sidebar).getByText("Leitor")).toBeInTheDocument();
    expect(sidebarHeader).not.toHaveTextContent(/\bCap 1\b/);
    expect(sidebarHeader).not.toHaveTextContent(/P.gina 1/i);
    expect(within(sidebar).getByRole("button", { name: "Fechar menu do leitor" })).toBeInTheDocument();
  });

  it("updates the reader menu viewport height and maxHeight synchronously on scroll", async () => {
    renderReader({ imageFit: "both" });

    const stage = screen.getByTestId("project-reading-stage");
    const menuViewport = screen.getByTestId("project-reader-menu-viewport");
    let stageRect = {
      top: 120,
      bottom: 920,
      left: 0,
      right: 1200,
      width: 1200,
      height: 800,
    };
    const rectSpy = vi.spyOn(stage, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: stageRect.left,
          y: stageRect.top,
          ...stageRect,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));

    const sidebar = await screen.findByTestId("project-reader-sidebar");
    const scrollArea = within(sidebar).getByTestId("project-reader-menu-scroll-area");
    stageRect = {
      top: 250,
      bottom: 980,
      left: 0,
      right: 1200,
      width: 1200,
      height: 730,
    };
    fireEvent.scroll(window);

    expect(menuViewport.style.height).toBe("650px");
    expect(sidebar.style.maxHeight).toBe("622px");
    expect(sidebar.style.height).toBe("622px");
    expect(scrollArea.style.maxHeight).toMatch(/px$/);
    expect(scrollArea.style.height).toMatch(/px$/);

    rectSpy.mockRestore();
  });

  it("restores the original menu height after the stage recovers visible space", async () => {
    renderReader({ imageFit: "both" });

    const stage = screen.getByTestId("project-reading-stage");
    const menuViewport = screen.getByTestId("project-reader-menu-viewport");
    let stageRect = {
      top: 120,
      bottom: 920,
      left: 0,
      right: 1200,
      width: 1200,
      height: 800,
    };
    const rectSpy = vi.spyOn(stage, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: stageRect.left,
          y: stageRect.top,
          ...stageRect,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));

    const sidebar = await screen.findByTestId("project-reader-sidebar");
    const scrollArea = within(sidebar).getByTestId("project-reader-menu-scroll-area");
    const initialViewportHeight = menuViewport.style.height;
    const initialPanelHeight = sidebar.style.height;
    const initialPanelMaxHeight = sidebar.style.maxHeight;
    const initialScrollAreaHeight = scrollArea.style.height;

    stageRect = {
      top: 250,
      bottom: 980,
      left: 0,
      right: 1200,
      width: 1200,
      height: 730,
    };
    fireEvent.scroll(window);

    expect(menuViewport.style.height).toBe("650px");
    expect(sidebar.style.height).toBe("622px");
    expect(scrollArea.style.height).not.toBe(initialScrollAreaHeight);

    scrollArea.scrollTop = 48;

    stageRect = {
      top: 120,
      bottom: 920,
      left: 0,
      right: 1200,
      width: 1200,
      height: 800,
    };
    fireEvent.scroll(window);

    expect(menuViewport.style.height).toBe(initialViewportHeight);
    expect(sidebar.style.height).toBe(initialPanelHeight);
    expect(sidebar.style.maxHeight).toBe(initialPanelMaxHeight);
    expect(scrollArea.style.height).toBe(initialScrollAreaHeight);
    expect(scrollArea.scrollTop).toBe(48);

    rectSpy.mockRestore();
  });

  it("absorbs a tiny residual menu overflow when there is still free space in the stage", async () => {
    renderReader({ imageFit: "both" });

    const stage = screen.getByTestId("project-reading-stage");
    const rectSpy = vi.spyOn(stage, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: 0,
          y: 120,
          top: 120,
          bottom: 920,
          left: 0,
          right: 1200,
          width: 1200,
          height: 800,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));

    const sidebar = await screen.findByTestId("project-reader-sidebar");
    const scrollArea = within(sidebar).getByTestId("project-reader-menu-scroll-area");

    setElementSize(sidebar, { clientHeight: 730, offsetHeight: 730, scrollHeight: 742 });
    setElementSize(scrollArea, { clientHeight: 646, offsetHeight: 646, scrollHeight: 648 });
    fireEvent.scroll(window);

    expect(scrollArea.style.overflowY).toBe("hidden");
    expect(Number.parseFloat(sidebar.style.height)).toBeGreaterThanOrEqual(732);
    expect(Number.parseFloat(scrollArea.style.height)).toBeGreaterThanOrEqual(648);

    rectSpy.mockRestore();
  });

  it("keeps menu scrolling enabled when the content genuinely exceeds the available stage height", async () => {
    renderReader({ imageFit: "both" });

    const stage = screen.getByTestId("project-reading-stage");
    const rectSpy = vi.spyOn(stage, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: 0,
          y: 250,
          top: 250,
          bottom: 980,
          left: 0,
          right: 1200,
          width: 1200,
          height: 730,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));

    const sidebar = await screen.findByTestId("project-reader-sidebar");
    const scrollArea = within(sidebar).getByTestId("project-reader-menu-scroll-area");

    setElementSize(sidebar, { clientHeight: 622, offsetHeight: 622, scrollHeight: 780 });
    setElementSize(scrollArea, { clientHeight: 538, offsetHeight: 538, scrollHeight: 700 });
    fireEvent.scroll(window);

    expect(sidebar.style.height).toBe("622px");
    expect(scrollArea.style.overflowY).toBe("auto");
    expect(Number.parseFloat(scrollArea.style.height)).toBeLessThanOrEqual(
      Number.parseFloat(sidebar.style.height),
    );

    rectSpy.mockRestore();
  });

  it("keeps menu and progress clamped to the same visible stage slice near the top", async () => {
    renderReader({ imageFit: "both", progressStyle: "default", progressPosition: "right" });

    const stage = screen.getByTestId("project-reading-stage");
    const progressViewport = await screen.findByTestId("project-reader-progress-viewport");
    const menuViewport = screen.getByTestId("project-reader-menu-viewport");
    let stageRect = {
      top: 160,
      bottom: 760,
      left: 240,
      right: 720,
      width: 480,
      height: 600,
    };
    const rectSpy = vi.spyOn(stage, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: stageRect.left,
          y: stageRect.top,
          ...stageRect,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));

    const sidebar = await screen.findByTestId("project-reader-sidebar");
    stageRect = {
      top: -120,
      bottom: 480,
      left: 240,
      right: 720,
      width: 480,
      height: 600,
    };
    fireEvent.scroll(window);

    expect(progressViewport.style.height).toBe("480px");
    expect(menuViewport.style.height).toBe("480px");
    expect(sidebar.style.maxHeight).toBe("452px");

    rectSpy.mockRestore();
  });

  it("collapses menu and progress without a minimum floor when only a tiny slice of the stage is visible", async () => {
    renderReader({ imageFit: "both", progressStyle: "default", progressPosition: "left" });

    const stage = screen.getByTestId("project-reading-stage");
    const progressViewport = await screen.findByTestId("project-reader-progress-viewport");
    const menuViewport = screen.getByTestId("project-reader-menu-viewport");
    let stageRect = {
      top: 160,
      bottom: 760,
      left: 240,
      right: 720,
      width: 480,
      height: 600,
    };
    const rectSpy = vi.spyOn(stage, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          x: stageRect.left,
          y: stageRect.top,
          ...stageRect,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));

    const sidebar = await screen.findByTestId("project-reader-sidebar");
    stageRect = {
      top: 880,
      bottom: 1000,
      left: 240,
      right: 720,
      width: 480,
      height: 120,
    };
    fireEvent.scroll(window);

    expect(progressViewport.style.height).toBe("20px");
    expect(menuViewport.style.height).toBe("20px");
    expect(sidebar.style.maxHeight).toBe("0px");

    rectSpy.mockRestore();
  });

  it("auto-hides the stage menu button after five seconds and reveals it on proximity", async () => {
    vi.useFakeTimers();
    renderReader({ imageFit: "both" });

    const menuButtonShell = screen.getByTestId("project-reader-menu-button-shell");
    const menuButton = screen.getByTestId("project-reader-menu-button");
    const activationWrapper = screen.getByTestId("project-reader-menu-activation-zone")
      .parentElement as HTMLElement;

    expect(menuButtonShell).toHaveAttribute("data-state", "visible");
    expect(menuButton).toHaveAttribute("data-state", "visible");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MENU_TRIGGER_INITIAL_VISIBLE_MS);
    });

    expect(screen.getByTestId("project-reader-menu-button-shell")).toHaveAttribute(
      "data-state",
      "hidden",
    );
    expect(menuButton).toHaveAttribute("data-state", "hidden");

    fireEvent.mouseEnter(activationWrapper);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });
    expect(screen.getByTestId("project-reader-menu-button-shell")).toHaveAttribute(
      "data-state",
      "visible",
    );
    expect(screen.getByTestId("project-reader-menu-button")).toHaveAttribute(
      "data-state",
      "visible",
    );

    fireEvent.mouseLeave(activationWrapper);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MENU_TRIGGER_HIDE_DELAY_MS);
    });

    expect(screen.getByTestId("project-reader-menu-button-shell")).toHaveAttribute(
      "data-state",
      "hidden",
    );
    expect(screen.getByTestId("project-reader-menu-button")).toHaveAttribute("data-state", "hidden");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MENU_TRIGGER_EXIT_TRANSITION_MS);
    });

    expect(screen.queryByTestId("project-reader-menu-button-shell")).not.toBeInTheDocument();
    expect(screen.queryByTestId("project-reader-menu-button")).not.toBeInTheDocument();
  });

  it("opens the in-stage menu from the top-right hotspot on touch after the button auto-hides", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 640,
    });

    renderReader({ imageFit: "both" });

    const menuButton = screen.getByTestId("project-reader-menu-button");
    const activationZone = screen.getByTestId("project-reader-menu-activation-zone");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MENU_TRIGGER_INITIAL_VISIBLE_MS);
    });

    expect(screen.getByTestId("project-reader-menu-button-shell")).toHaveAttribute(
      "data-state",
      "hidden",
    );
    expect(menuButton).toHaveAttribute("data-state", "hidden");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MENU_TRIGGER_EXIT_TRANSITION_MS);
    });

    expect(screen.queryByTestId("project-reader-menu-button-shell")).not.toBeInTheDocument();
    expect(screen.queryByTestId("project-reader-menu-button")).not.toBeInTheDocument();

    fireEvent.pointerDown(activationZone, {
      pointerId: 21,
      pointerType: "touch",
    });

    const sidebar = screen.getByTestId("project-reader-sidebar");
    expect(sidebar).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MENU_TRIGGER_EXIT_TRANSITION_MS);
    });

    expect(screen.queryByTestId("project-reader-menu-button-shell")).not.toBeInTheDocument();
    expect(screen.queryByTestId("project-reader-menu-button")).not.toBeInTheDocument();
  });

  it("closes the in-stage menu when the backdrop is clicked", async () => {
    renderReader({ imageFit: "both" });

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));
    expect(await screen.findByTestId("project-reader-sidebar")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("project-reader-menu-backdrop"));

    await waitFor(() => {
      expect(screen.queryByTestId("project-reader-sidebar")).not.toBeInTheDocument();
    });
  });

  it("closes the in-stage menu when Escape is pressed", async () => {
    renderReader({ imageFit: "both" });

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));
    expect(await screen.findByTestId("project-reader-sidebar")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });

    await waitFor(() => {
      expect(screen.queryByTestId("project-reader-sidebar")).not.toBeInTheDocument();
    });
  });

  it("closes the menu after using previous and next chapter actions", async () => {
    const onNavigateChapter = vi.fn();
    const firstRender = renderReader(
      { imageFit: "both" },
      {
        onNavigateChapter,
      },
      { initialEntries: ["/projeto/projeto-teste/leitura/1"] },
    );

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));
    const sidebar = await screen.findByTestId("project-reader-sidebar");
    expect(
      within(sidebar).queryByRole("button", { name: /Cap.tulo anterior/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(sidebar).getByRole("button", { name: /Pr.ximo cap.tulo/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("project-reader-sidebar")).not.toBeInTheDocument();
    });
    expect(onNavigateChapter).toHaveBeenCalledWith("/projeto/projeto-teste/leitura/2");

    firstRender.unmount();

    const secondRender = renderReader(
      { imageFit: "both" },
      {
        onNavigateChapter,
        currentChapterValue: "2",
      },
      { initialEntries: ["/projeto/projeto-teste/leitura/2"] },
    );

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));
    const reopenedSidebar = await screen.findByTestId("project-reader-sidebar");
    expect(
      within(reopenedSidebar).queryByRole("button", { name: /Pr.ximo cap.tulo/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(reopenedSidebar).getByRole("button", { name: /Cap.tulo anterior/i }));

    await waitFor(() => {
      expect(screen.queryByTestId("project-reader-sidebar")).not.toBeInTheDocument();
    });
    expect(onNavigateChapter).toHaveBeenLastCalledWith("/projeto/projeto-teste/leitura/1");

    secondRender.unmount();
  });

  it.skip("shows the site header behavior options in the reader menu", async () => {
    renderReader({ imageFit: "both", siteHeaderVariant: "static" });

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));
    const trigger = await screen.findByRole("combobox", {
      name: "Selecionar comportamento do header do site",
    });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });

    expect(await screen.findByRole("option", { name: "Acompanha a página" })).toBeInTheDocument();
    expect(
      await screen.findByRole("option", { name: "Padrão do site (fixo no topo)" }),
    ).toBeInTheDocument();
  });

  it.skip("updates the saved site header behavior from the reader menu", async () => {
    renderReader({ imageFit: "both", siteHeaderVariant: "static" });

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));
    const trigger = await screen.findByRole("combobox", {
      name: "Selecionar comportamento do header do site",
    });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Padrão do site (fixo no topo)" }));

    expect(updateConfigMock).toHaveBeenCalledWith({ siteHeaderVariant: "fixed" });
  });

  it("shows the renamed site header visibility options in the reader menu", async () => {
    renderReader({ imageFit: "both", siteHeaderVariant: "static" });

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));
    const trigger = await screen.findByRole("combobox", {
      name: "Selecionar comportamento do header do site",
    });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });

    expect(await screen.findByRole("option", { name: "Oculto" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Visível" })).toBeInTheDocument();
  });

  it("updates the saved site header behavior from the renamed reader menu option", async () => {
    renderReader({ imageFit: "both", siteHeaderVariant: "static" });

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));
    const trigger = await screen.findByRole("combobox", {
      name: "Selecionar comportamento do header do site",
    });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Visível" }));

    expect(updateConfigMock).toHaveBeenCalledWith({ siteHeaderVariant: "fixed" });
  });

  it("keeps only one reader dropdown open at a time", async () => {
    renderReader({ imageFit: "both" });

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));

    const chapterTrigger = await screen.findByRole("combobox", {
      name: /Selecionar cap.tulo/i,
    });
    const pageTrigger = screen.getByRole("combobox", {
      name: /Selecionar p.gina/i,
    });

    fireEvent.click(chapterTrigger);
    expect(await screen.findByRole("option", { name: /Cap.tulo 1/i })).toBeInTheDocument();

    fireEvent.click(pageTrigger);

    await waitFor(() => {
      expect(screen.queryByRole("option", { name: /Cap.tulo 1/i })).not.toBeInTheDocument();
    });

    expect(await screen.findByRole("option", { name: /P.gina 1/i })).toBeInTheDocument();
  });

  it("shows only the default and hidden progress options in the reader menu", async () => {
    renderReader({ imageFit: "both" });

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));
    const trigger = await screen.findByRole("combobox", {
      name: "Selecionar estilo do progresso",
    });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });

    expect(await screen.findByRole("option", { name: "Padrão" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Oculto" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Barra/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Brilho|Glow/i })).not.toBeInTheDocument();
  });
});
