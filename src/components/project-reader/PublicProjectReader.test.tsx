import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublicProjectReader from "@/components/project-reader/PublicProjectReader";

const useProjectReaderPreferencesMock = vi.hoisted(() => vi.fn());

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
  useProjectReaderPreferencesMock.mockReturnValue({
    isLoaded: true,
    resolvedConfig: {
      direction: "rtl",
      layout: "single",
      imageFit: "both",
      background: "theme",
      progressStyle: "bar",
      progressPosition: "bottom",
      firstPageSingle: true,
      ...config,
    },
    updateConfig: vi.fn(),
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

const renderReader = (
  config: Record<string, unknown>,
  props: Partial<Parameters<typeof PublicProjectReader>[0]> = {},
) => {
  setReaderConfig(config);

  return render(
    <MemoryRouter>
      <PublicProjectReader {...baseProps} {...props} />
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

describe("PublicProjectReader", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    useProjectReaderPreferencesMock.mockReset();
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

  it("keeps a blank virtual spread page anchored to the seam", () => {
    renderReader({ layout: "double", imageFit: "both", firstPageSingle: true });

    expect(screen.getByTestId("reader-spread-blank")).toBeInTheDocument();
    expect(screen.getByTestId("reader-page-surface-0")).toHaveClass("justify-start");
  });

  it.each([
    { layout: "scroll-horizontal", imageFit: "both" },
    { layout: "scroll-horizontal", imageFit: "height" },
    { layout: "scroll-vertical", imageFit: "both" },
    { layout: "scroll-vertical", imageFit: "height" },
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
    "scroll-horizontal",
    "scroll-vertical",
  ])("falls back to innerHeight in cinema mode for %s scroll layout", async (layout) => {
    renderReader({ layout, imageFit: "both" }, { chromeMode: "cinema" });

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

    const horizontalReader = screen.getByTestId("project-reading-horizontal-scroll");
    const strip = horizontalReader.firstElementChild as HTMLElement | null;
    const page0 = screen.getByTestId("reader-page-0");
    const page1 = screen.getByTestId("reader-page-1");
    const surface0 = screen.getByTestId("reader-page-surface-0");

    expect(strip).not.toBeNull();
    expect(horizontalReader).toHaveClass("overflow-x-auto", "overflow-y-hidden");
    expect(horizontalReader).not.toHaveClass("fixed", "sticky");
    expect(horizontalReader.style.scrollbarGutter).toBe("stable both-edges");
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
  ])("renders the fixed %s progress bar with safe-area inset", ({ progressPosition, edge }) => {
    renderReader({ progressStyle: "bar", progressPosition });

    const overlay = screen.getByTestId("project-reader-progress-overlay");
    const progressTrack = screen.getByTestId("project-reader-progress-track");

    expect(overlay).toHaveClass("fixed");
    expect(overlay.style[edge as "bottom" | "left" | "right"]).toContain(`safe-area-inset-${edge}`);
    expect(overlay.style[edge as "bottom" | "left" | "right"]).toContain("12px");
    expect(progressTrack).toBeInTheDocument();
    expect(screen.queryByTestId("project-reader-progress-label")).not.toBeInTheDocument();
  });

  it.each([
    "bottom",
    "left",
    "right",
  ])("renders glow progress with a localized indicator and current page label on %s", (progressPosition) => {
    renderReader({ progressStyle: "glow", progressPosition });

    const overlay = screen.getByTestId("project-reader-progress-overlay");
    const indicator = screen.getByTestId("project-reader-progress-indicator");
    const label = screen.getByTestId("project-reader-progress-label");

    expect(overlay).toHaveClass("fixed");
    expect(indicator).toBeInTheDocument();
    expect(label).toHaveTextContent("1");
  });

  it("reveals hidden progress on mouse proximity and hides it after the delay", async () => {
    renderReader({ progressStyle: "hidden", progressPosition: "bottom" });
    vi.useFakeTimers();

    const zone = screen.getByTestId("project-reader-progress-activation-zone");

    expect(screen.queryByTestId("project-reader-progress-overlay")).not.toBeInTheDocument();

    fireEvent.mouseEnter(zone);
    expect(screen.getByTestId("project-reader-progress-track")).toBeInTheDocument();

    fireEvent.mouseLeave(zone);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.queryByTestId("project-reader-progress-overlay")).not.toBeInTheDocument();
  });

  it("reveals hidden progress on touch proximity and hides it after the delay", async () => {
    renderReader({ progressStyle: "hidden", progressPosition: "right" });
    vi.useFakeTimers();

    const zone = screen.getByTestId("project-reader-progress-activation-zone");

    fireEvent.touchStart(zone);
    expect(screen.getByTestId("project-reader-progress-track")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.queryByTestId("project-reader-progress-overlay")).not.toBeInTheDocument();
  });

  it("hides the fixed progress overlay when the stage leaves the viewport", async () => {
    renderReader({ progressStyle: "bar", progressPosition: "bottom" });

    const stage = screen.getByTestId("project-reading-stage");
    const rectSpy = mockElementRect(stage, {
      top: -960,
      bottom: -160,
      height: 800,
    });

    expect(screen.getByTestId("project-reader-progress-overlay")).toBeInTheDocument();

    fireEvent.scroll(window);

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
});
