import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("PublicProjectReader", () => {
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
    setReaderConfig({ imageFit: "none" });

    render(
      <MemoryRouter>
        <PublicProjectReader {...baseProps} />
      </MemoryRouter>,
    );

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
    setReaderConfig({ imageFit: "both" });

    render(
      <MemoryRouter>
        <PublicProjectReader {...baseProps} />
      </MemoryRouter>,
    );

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
    setReaderConfig({ imageFit: "height" });

    render(
      <MemoryRouter>
        <PublicProjectReader {...baseProps} />
      </MemoryRouter>,
    );

    const stage = screen.getByTestId("project-reading-stage");
    const surface = screen.getByTestId("reader-page-surface-0");

    await waitFor(() => {
      expect(stage.style.height).toBe(stage.style.minHeight);
      expect(surface.style.height).toBe(stage.style.height);
    });
  });

  it("keeps fit width without a fixed stage-driven height", async () => {
    setReaderConfig({ imageFit: "width" });

    render(
      <MemoryRouter>
        <PublicProjectReader {...baseProps} />
      </MemoryRouter>,
    );

    const shell = screen.getByTestId("project-reading-full-bleed-shell");
    const stage = screen.getByTestId("project-reading-stage");

    await waitFor(() => {
      expect(shell.style.height).toBe("");
      expect(stage.style.height).toBe("");
      expect(screen.getByTestId("reader-page-surface-0").style.height).toBe("");
    });
  });

  it("renders the reader shell with the stable full-bleed info bar", async () => {
    setReaderConfig({ imageFit: "both" });

    render(
      <MemoryRouter>
        <PublicProjectReader {...baseProps} />
      </MemoryRouter>,
    );

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
    setReaderConfig({ imageFit: "both" });
    setVisualViewport({ height: 640 });

    render(
      <MemoryRouter>
        <PublicProjectReader {...baseProps} chromeMode="cinema" />
      </MemoryRouter>,
    );

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
    setReaderConfig({ imageFit: "both" });

    render(
      <MemoryRouter>
        <PublicProjectReader {...baseProps} chromeMode="cinema" />
      </MemoryRouter>,
    );

    const shell = screen.getByTestId("project-reading-full-bleed-shell");

    await waitFor(() => {
      expect(shell.style.minHeight).toBe("900px");
      expect(shell.style.height).toBe("900px");
    });
  });

  it("keeps a small inset on the progress indicator", () => {
    setReaderConfig({ progressStyle: "bar", progressPosition: "bottom" });

    render(
      <MemoryRouter>
        <PublicProjectReader {...baseProps} />
      </MemoryRouter>,
    );

    const progressTrack = screen.getByTestId("project-reader-progress-track");
    expect(progressTrack).toHaveClass("left-2", "right-2", "bottom-2");
    expect(progressTrack).not.toHaveClass("inset-x-0", "bottom-0");
  });

  it("opens a local desktop panel when the reader menu button is clicked", async () => {
    setReaderConfig({ imageFit: "both" });

    render(
      <MemoryRouter>
        <PublicProjectReader {...baseProps} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("project-reader-menu-button"));

    const sidebar = await screen.findByTestId("project-reader-sidebar");
    expect(sidebar.tagName).toBe("ASIDE");
    expect(screen.getByText("Menu do leitor")).toBeInTheDocument();
  });
});
