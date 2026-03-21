import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublicProjectReader from "@/components/project-reader/PublicProjectReader";

const useProjectReaderPreferencesMock = vi.hoisted(() => vi.fn());
const updateConfigMock = vi.hoisted(() => vi.fn());
const PROGRESS_OVERLAY_TRANSITION_MS = 180;

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
    scrollWidth,
  }: {
    clientWidth?: number;
    scrollWidth?: number;
  },
) => {
  if (typeof clientWidth === "number") {
    Object.defineProperty(element, "clientWidth", {
      configurable: true,
      value: clientWidth,
    });
  }

  if (typeof scrollWidth === "number") {
    Object.defineProperty(element, "scrollWidth", {
      configurable: true,
      value: scrollWidth,
    });
  }
};

const goToNextPaginatedPage = () => {
  const stageButton = screen.getByRole("button", { name: /paginada/i });
  setElementSize(stageButton, { clientWidth: 1000 });
  fireEvent.click(stageButton, { offsetX: 100 });
};

const goToLastPaginatedPage = () => {
  goToNextPaginatedPage();
};

const getRootFontSizePx = () =>
  Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize || "16") || 16;

const getProgressContainerLength = (progressPosition: "bottom" | "left" | "right") =>
  progressPosition === "bottom" ? window.innerWidth - 24 : window.innerHeight - 24;

const getProgressLabelInsetPx = (progressPosition: "bottom" | "left" | "right") =>
  progressPosition === "bottom" ? 20 : 14;

const mockProgressTrackRect = (
  element: Element,
  progressPosition: "bottom" | "left" | "right",
) =>
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
    Object.defineProperty(window, "visualViewport", {
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

  it("anchors double-page spreads to the center seam", () => {
    renderReader({ layout: "double", imageFit: "both", firstPageSingle: false });

    expect(screen.queryByTestId("reader-spread-blank")).not.toBeInTheDocument();
    expect(screen.getByTestId("reader-page-surface-0")).toHaveClass("justify-start");
    expect(screen.getByTestId("reader-page-surface-1")).toHaveClass("justify-end");
  });

  it("centers the isolated cover slot in double-page mode", () => {
    renderReader({ layout: "double", imageFit: "both", firstPageSingle: true });

    const coverPage = screen.getByTestId("reader-page-0");

    expect(screen.queryByTestId("reader-spread-blank")).not.toBeInTheDocument();
    expect(coverPage.parentElement).toHaveClass("justify-center");
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
  ])(
    "keeps scroll-vertical cinema mode with viewport min-height but no fixed shell height for fit $imageFit",
    async ({ imageFit }) => {
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
    },
  );

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
    { layout: "double" },
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
    expect(spacer.style.minWidth).toBe("100%");
    expect(strip).toHaveClass("gap-0");
    expect(page0).toHaveClass("w-auto", "max-w-none", "shrink-0");
    expect(page1).toHaveClass("w-auto", "max-w-none", "shrink-0");
    expect(page0.style.width).toBe("");
    expect(page1.style.width).toBe("");

    if (imageFit === "both" || imageFit === "height") {
      expect(surface0).toHaveClass("inline-flex", "h-full", "w-auto", "max-w-none", "shrink-0");
      expect(surface0).not.toHaveClass("w-full");
    } else {
      expect(surface0).toHaveClass("inline-flex", "h-auto", "w-auto", "max-w-none", "shrink-0");
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
    const readerBar = screen.getByTestId("project-reading-reader-bar");

    expect(shell).toHaveClass("w-full", "flex-1", "min-h-0");
    expect(readerBar).not.toHaveClass("mx-auto");
    expect(readerBar.style.maxWidth).toBe("");
    expect(screen.getByTestId("project-reading-info-bar")).toHaveAttribute(
      "data-variant",
      "reader-full-bleed",
    );
    expect(screen.getByText("Resumo do capitulo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Capitulo 1" })).toHaveClass("line-clamp-2");

    await waitFor(() => {
      expect(shell.style.minHeight).toMatch(/px$/);
    });
  });

  it("uses the visual viewport in cinema mode and keeps the stage as tall as the shell", async () => {
    setVisualViewport({ height: 640 });
    renderReader({ imageFit: "both" }, { chromeMode: "cinema" });

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const stage = screen.getByTestId("project-reading-stage");
    const infoBar = screen.getByTestId("project-reading-info-bar");

    expect(infoBar).toHaveAttribute("data-variant", "reader-cinema");
    expect(shell).toHaveClass("relative", "gap-0");

    await waitFor(() => {
      expect(shell.style.minHeight).toBe("640px");
      expect(shell.style.height).toBe("640px");
      expect(stage.style.height).toBe("640px");
    });
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

  it("updates ?page in the horizontal strip as the active strip page changes", async () => {
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

    renderReader({ layout: "scroll-horizontal", imageFit: "both" });

    const horizontalReader = await screen.findByTestId("project-reading-horizontal-scroll");
    const externalScrollbar = screen.getByTestId("project-reading-horizontal-scrollbar");
    setElementSize(horizontalReader, { clientWidth: 800, scrollWidth: 1400 });
    setElementSize(externalScrollbar, { clientWidth: 800, scrollWidth: 1400 });

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=1");
    });
    vi.mocked(window.scrollTo).mockClear();

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
    horizontalReader.scrollLeft = 520;
    fireEvent.scroll(horizontalReader);

    await waitFor(() => {
      expect(screen.getByTestId("reader-location-search")).toHaveTextContent("?page=2");
      expect(screen.getByTestId("reader-location-action")).toHaveTextContent("REPLACE");
      expect(screen.getByTestId("reader-location-preserve-scroll")).toHaveTextContent("true");
    });
    expect(horizontalReader.scrollLeft).toBe(520);
    expect(externalScrollbar.scrollLeft).toBe(520);
    expect(window.scrollTo).not.toHaveBeenCalled();

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
  ])("renders the fixed %s default progress overlay with safe-area inset", async ({
    progressPosition,
    edge,
  }) => {
    renderReader({ progressStyle: "default", progressPosition });

    const overlay = await screen.findByTestId("project-reader-progress-overlay");
    const progressTrack = screen.getByTestId("project-reader-progress-track");
    const indicator = screen.getByTestId("project-reader-progress-indicator");
    const label = screen.getByTestId("project-reader-progress-label");
    const hitArea = screen.getByTestId("project-reader-progress-hit-area");

    expect(overlay).toHaveClass("fixed");
    expect(overlay.style[edge as "bottom" | "left" | "right"]).toContain(`safe-area-inset-${edge}`);
    expect(overlay.style[edge as "bottom" | "left" | "right"]).toContain("12px");
    expect(progressTrack).toBeInTheDocument();
    expect(screen.queryByTestId("project-reader-progress-beam")).not.toBeInTheDocument();
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveClass("bg-accent");
    expect(label).toHaveClass("bg-accent", "text-accent-foreground", "py-0.5", "opacity-0");
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
  ])("keeps the bullet centered in the %s progress track", async (progressPosition) => {
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

  it.each([
    "bottom",
    "left",
    "right",
  ])("keeps the first and last bullet positions contained for %s", async (progressPosition) => {
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
    expect(Number.parseFloat(label.style[styleKey as "left" | "top"])).toBeCloseTo(
      labelInsetPx,
      4,
    );
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
          screen.getByTestId("project-reader-progress-indicator").style[
            styleKey as "left" | "top"
          ],
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
  ])("navigates to the clicked page through the %s progress track", async (progressPosition) => {
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

    const zone = screen.getByTestId("project-reader-progress-activation-zone");

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

    expect(screen.getByTestId("project-reader-progress-overlay")).toHaveAttribute("data-state", "hidden");

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

  it("hides the fixed progress overlay when the stage leaves the viewport", async () => {
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

  it("opens a local desktop panel when the reader menu button is clicked", async () => {
    renderReader({ imageFit: "both" });

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));

    const sidebar = await screen.findByTestId("project-reader-sidebar");
    expect(sidebar.tagName).toBe("ASIDE");
    expect(screen.getByText("Menu do leitor")).toBeInTheDocument();
  });

  it("shows the site header behavior options in the reader menu", async () => {
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

  it("updates the saved site header behavior from the reader menu", async () => {
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

  it("shows only the default and hidden progress options in the reader menu", async () => {
    renderReader({ imageFit: "both" });

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));
    const trigger = await screen.findByRole("combobox", {
      name: "Selecionar estilo do progresso",
    });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });

    expect(await screen.findByRole("option", { name: /Padr/i })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Oculto" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Barra/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Brilho|Glow/i })).not.toBeInTheDocument();
  });
});
