import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, BookOpenText, Menu, PencilLine, X } from "lucide-react";
import { Link } from "react-router-dom";

import ProjectReadingInfoBar from "@/components/project-reader/ProjectReadingInfoBar";
import {
  buildReaderDisplayPages,
  buildReaderPageItems,
  buildReaderSlots,
  findSlotIndexForPage,
  formatVisiblePageLabel,
  getReaderVisualState,
  isPaginatedReaderLayout,
  pickMostVisiblePage,
  resolvePaginatedPointerAction,
  type ReaderRenderablePage,
} from "@/components/project-reader/project-reader-state";
import { useProjectReaderPreferences } from "@/components/project-reader/use-project-reader-preferences";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ReaderPage = {
  position: number;
  imageUrl: string;
  spreadPairId?: string;
};

type ReaderChapterOption = {
  value: string;
  label: string;
  href: string;
};

type ReaderChromeMode = "default" | "cinema";

type PublicProjectReaderProps = {
  projectTitle: string;
  projectType: string;
  chapterTitle: string;
  chapterLabel: string;
  synopsis?: string;
  volume?: number;
  pages: ReaderPage[];
  baseConfig: Record<string, unknown>;
  currentUserId?: string | null;
  editHref?: string;
  chapterOptions: ReaderChapterOption[];
  currentChapterValue: string;
  onNavigateChapter: (href: string) => void;
  backHref: string;
  chromeMode?: ReaderChromeMode;
};

const PAGE_WRAPPER_BASE_CLASS = "relative flex min-w-0 justify-center";
const SIDEBAR_SECTION_CLASS_NAME = "rounded-3xl border border-border/70 bg-card/40 p-4 shadow-sm";
const SIDEBAR_SECTION_HEADER_CLASS_NAME = "flex items-start gap-3";
const SIDEBAR_SECTION_ICON_CLASS_NAME =
  "mt-0.5 h-9 w-9 shrink-0 rounded-2xl border border-border/70 bg-background/40 p-2 text-primary";
const PROGRESS_EDGE_OFFSET_PX = 12;
const HIDDEN_PROGRESS_ZONE_SIZE_PX = 48;
const HIDDEN_PROGRESS_HIDE_DELAY_MS = 1000;

const getVisibleViewportMetrics = () => {
  if (typeof window === "undefined") {
    return {
      width: 1024,
      height: 768,
      offsetTop: 0,
    };
  }

  const viewport = window.visualViewport;
  return {
    width: Math.round(viewport?.width ?? window.innerWidth),
    height: Math.round(viewport?.height ?? window.innerHeight),
    offsetTop: Math.round(viewport?.offsetTop ?? 0),
  };
};

const getWindowWidth = () => getVisibleViewportMetrics().width;
const getVisibleViewportHeight = () => getVisibleViewportMetrics().height;

const getStageToneClassName = (background: string) => {
  if (background === "black") {
    return "bg-black text-white";
  }
  if (background === "white") {
    return "bg-white text-slate-900";
  }
  return "bg-background text-foreground";
};

const getPurchaseToneClassName = (background: string) => {
  if (background === "black") {
    return "border-white/10 bg-black/80";
  }
  if (background === "white") {
    return "border-slate-200 bg-white";
  }
  return "border-border/60 bg-card/40";
};

const getImageClassName = (imageFit: string) => {
  if (imageFit === "height") {
    return "block h-full w-auto max-h-full max-w-none object-contain";
  }
  if (imageFit === "none") {
    return "block h-auto w-auto max-h-none max-w-none object-contain";
  }
  return "block h-auto w-auto max-h-full max-w-full object-contain";
};

const getPageWrapperClassName = (imageFit: string) => {
  if (imageFit === "none") {
    return "w-auto max-w-none shrink-0 items-start";
  }
  return "w-full items-center";
};

const getPageSurfaceClassName = (imageFit: string) => {
  if (imageFit === "none") {
    return "inline-flex h-auto w-auto max-w-none shrink-0 items-start justify-center";
  }
  return "flex w-full items-center justify-center";
};

const usesViewportBoundedHeight = (imageFit: string) =>
  imageFit === "both" || imageFit === "height";

const resolveEffectiveImageFit = (imageFit: string) => (imageFit === "width" ? "none" : imageFit);

const getSafeAreaInset = (edge: "top" | "right" | "bottom" | "left") =>
  `calc(env(safe-area-inset-${edge}, 0px) + ${PROGRESS_EDGE_OFFSET_PX}px)`;

const getProgressOverlayContainerStyle = (position: "bottom" | "left" | "right"): CSSProperties => {
  if (position === "bottom") {
    return {
      left: getSafeAreaInset("left"),
      right: getSafeAreaInset("right"),
      bottom: getSafeAreaInset("bottom"),
      height: "2.5rem",
    };
  }

  return position === "left"
    ? {
        left: getSafeAreaInset("left"),
        top: getSafeAreaInset("top"),
        bottom: getSafeAreaInset("bottom"),
        width: "4.5rem",
      }
    : {
        right: getSafeAreaInset("right"),
        top: getSafeAreaInset("top"),
        bottom: getSafeAreaInset("bottom"),
        width: "4.5rem",
      };
};

const getHiddenProgressZoneStyle = (position: "bottom" | "left" | "right"): CSSProperties => {
  if (position === "bottom") {
    return {
      left: 0,
      right: 0,
      bottom: 0,
      height: `${HIDDEN_PROGRESS_ZONE_SIZE_PX}px`,
    };
  }

  return position === "left"
    ? {
        left: 0,
        top: 0,
        bottom: 0,
        width: `${HIDDEN_PROGRESS_ZONE_SIZE_PX}px`,
      }
    : {
        right: 0,
        top: 0,
        bottom: 0,
        width: `${HIDDEN_PROGRESS_ZONE_SIZE_PX}px`,
      };
};

const getHorizontalAlignmentClassName = (alignment: "center" | "start" | "end") => {
  if (alignment === "start") {
    return "justify-start";
  }
  if (alignment === "end") {
    return "justify-end";
  }
  return "justify-center";
};

const getDoublePageInnerAlignment = ({
  direction,
  pagePosition,
}: {
  direction: "rtl" | "ltr";
  pagePosition: number;
}) => {
  if (direction === "rtl") {
    return pagePosition === 0 ? "start" : "end";
  }
  return pagePosition === 0 ? "end" : "start";
};

const getContinuousHorizontalPageClassName = (imageFit: string) => {
  if (imageFit === "none") {
    return getPageWrapperClassName(imageFit);
  }
  return "w-auto max-w-none shrink-0 items-center";
};

const getContinuousHorizontalSurfaceClassName = (imageFit: string) => {
  if (imageFit === "none") {
    return getPageSurfaceClassName(imageFit);
  }
  return "inline-flex h-full w-auto max-w-none shrink-0 items-center justify-center";
};

const getPaginatedSlotClassName = ({
  layout,
  imageFit,
  direction,
  pagePosition,
}: {
  layout: string;
  imageFit: string;
  direction: "rtl" | "ltr";
  pagePosition: number;
}) => {
  const doubleAlignmentClassName = getHorizontalAlignmentClassName(
    getDoublePageInnerAlignment({
      direction,
      pagePosition,
    }),
  );

  if (layout === "double") {
    return cn(
      imageFit === "none"
        ? "flex shrink-0 flex-none items-start"
        : "flex min-w-0 flex-1 items-center",
      doubleAlignmentClassName,
    );
  }

  return imageFit === "none"
    ? "flex w-auto max-w-none shrink-0 flex-none items-start justify-center"
    : "flex w-full items-center justify-center";
};

const clampIndex = (value: number, max: number) => {
  if (max <= 0) {
    return 0;
  }
  return Math.min(Math.max(value, 0), max - 1);
};

const PublicProjectReader = ({
  projectTitle,
  projectType,
  chapterTitle,
  chapterLabel,
  synopsis = "",
  volume,
  pages,
  baseConfig,
  currentUserId,
  editHref,
  chapterOptions,
  currentChapterValue,
  onNavigateChapter,
  backHref,
  chromeMode = "default",
}: PublicProjectReaderProps) => {
  const {
    isLoaded: hasLoadedPreferences,
    resolvedConfig,
    updateConfig,
  } = useProjectReaderPreferences({
    projectType,
    baseConfig,
    currentUserId,
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(getWindowWidth);
  const [readerViewportHeight, setReaderViewportHeight] = useState<number | null>(null);
  const [stageViewportHeight, setStageViewportHeight] = useState<number | null>(null);
  const [isStageInViewport, setIsStageInViewport] = useState(true);
  const [isHiddenProgressRevealed, setIsHiddenProgressRevealed] = useState(false);
  const horizontalScrollRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const infoBarRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hideHiddenProgressTimeoutRef = useRef<number | null>(null);

  const { originalPages, renderablePages, accessiblePageCount, hasPurchaseGate } = useMemo(
    () =>
      buildReaderDisplayPages({
        pages,
        previewLimit:
          typeof resolvedConfig.previewLimit === "number" ? resolvedConfig.previewLimit : null,
      }),
    [pages, resolvedConfig.previewLimit],
  );
  const layout = String(resolvedConfig.layout || "single");
  const direction = resolvedConfig.direction === "ltr" ? "ltr" : "rtl";
  const paginated = isPaginatedReaderLayout(layout);
  const isDesktopMenu = viewportWidth >= 768;
  const isCinemaMode = chromeMode === "cinema";
  const slots = useMemo(
    () =>
      buildReaderSlots({
        pages: renderablePages,
        layout,
        firstPageSingle: resolvedConfig.firstPageSingle !== false,
      }),
    [layout, renderablePages, resolvedConfig.firstPageSingle],
  );
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [activePageIndex, setActivePageIndex] = useState(0);

  const visualState = getReaderVisualState({
    imageFit: String(resolvedConfig.imageFit || "both"),
    background: String(resolvedConfig.background || "theme"),
    progressStyle: String(resolvedConfig.progressStyle || "bar"),
    progressPosition: String(resolvedConfig.progressPosition || "bottom"),
  });

  const effectiveImageFit = resolveEffectiveImageFit(visualState.imageFit);
  const stageToneClassName = getStageToneClassName(visualState.background);
  const purchaseToneClassName = getPurchaseToneClassName(visualState.background);
  const sidebarToneClassName = cn(
    stageToneClassName,
    visualState.background === "theme"
      ? "border-border/70 bg-background/95"
      : visualState.background === "black"
        ? "border-white/10 bg-black/80"
        : "border-slate-200 bg-white",
  );
  const imageClassName = getImageClassName(effectiveImageFit);

  useEffect(() => {
    const handleResize = () => setViewportWidth(getWindowWidth());
    const viewport = window.visualViewport;
    window.addEventListener("resize", handleResize, { passive: true });
    viewport?.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      viewport?.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    pageRefs.current = [];
  }, [renderablePages.length]);

  const clearHiddenProgressHideTimer = useCallback(() => {
    if (hideHiddenProgressTimeoutRef.current !== null) {
      window.clearTimeout(hideHiddenProgressTimeoutRef.current);
      hideHiddenProgressTimeoutRef.current = null;
    }
  }, []);

  const revealHiddenProgress = useCallback(() => {
    clearHiddenProgressHideTimer();
    setIsHiddenProgressRevealed(true);
  }, [clearHiddenProgressHideTimer]);

  const scheduleHiddenProgressHide = useCallback(() => {
    clearHiddenProgressHideTimer();
    hideHiddenProgressTimeoutRef.current = window.setTimeout(() => {
      setIsHiddenProgressRevealed(false);
      hideHiddenProgressTimeoutRef.current = null;
    }, HIDDEN_PROGRESS_HIDE_DELAY_MS);
  }, [clearHiddenProgressHideTimer]);
  const handleHiddenProgressTouchStart = useCallback(() => {
    revealHiddenProgress();
    scheduleHiddenProgressHide();
  }, [revealHiddenProgress, scheduleHiddenProgressHide]);

  useEffect(() => () => clearHiddenProgressHideTimer(), [clearHiddenProgressHideTimer]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [currentChapterValue, isDesktopMenu]);

  useEffect(() => {
    const updateStageHeight = () => {
      const shell = shellRef.current;
      const infoBar = infoBarRef.current;
      const node = stageRef.current;
      if (!shell || !node) {
        return;
      }
      const shellRect = shell.getBoundingClientRect();
      const stageRect = node.getBoundingClientRect();
      const infoBarRect = infoBar?.getBoundingClientRect();
      const viewportMetrics = getVisibleViewportMetrics();
      const topOffset = Math.max(Math.round(shellRect.top - viewportMetrics.offsetTop), 0);
      const nextReaderHeight = Math.max(Math.round(viewportMetrics.height - topOffset), 320);
      const infoBarHeight = isCinemaMode ? 0 : Math.round(infoBarRect?.height || 0);
      const gapHeight =
        isCinemaMode || !infoBarRect
          ? 0
          : Math.max(Math.round(stageRect.top - infoBarRect.bottom), 0);
      const nextStageHeight = isCinemaMode
        ? Math.max(nextReaderHeight, 240)
        : Math.max(nextReaderHeight - infoBarHeight - gapHeight, 240);
      setReaderViewportHeight(nextReaderHeight);
      setStageViewportHeight(nextStageHeight);
    };

    const frame = window.requestAnimationFrame(updateStageHeight);
    const viewport = window.visualViewport;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateStageHeight()) : null;
    if (shellRef.current) {
      resizeObserver?.observe(shellRef.current);
    }
    if (infoBarRef.current) {
      resizeObserver?.observe(infoBarRef.current);
    }
    if (stageRef.current) {
      resizeObserver?.observe(stageRef.current);
    }
    window.addEventListener("resize", updateStageHeight, { passive: true });
    viewport?.addEventListener("resize", updateStageHeight);
    viewport?.addEventListener("scroll", updateStageHeight);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateStageHeight);
      viewport?.removeEventListener("resize", updateStageHeight);
      viewport?.removeEventListener("scroll", updateStageHeight);
    };
  }, [chapterTitle, isCinemaMode, layout, paginated, projectTitle, synopsis, visualState.imageFit]);

  useEffect(() => {
    const updateStageVisibility = () => {
      const node = stageRef.current;
      if (!node) {
        return;
      }

      const stageRect = node.getBoundingClientRect();
      if (stageRect.height <= 0 && stageRect.width <= 0) {
        setIsStageInViewport(true);
        return;
      }

      const viewportMetrics = getVisibleViewportMetrics();
      const viewportTop = viewportMetrics.offsetTop;
      const viewportBottom = viewportTop + viewportMetrics.height;
      const nextVisible = stageRect.bottom > viewportTop && stageRect.top < viewportBottom;

      setIsStageInViewport((current) => (current === nextVisible ? current : nextVisible));
    };

    const frame = window.requestAnimationFrame(updateStageVisibility);
    const viewport = window.visualViewport;
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateStageVisibility())
        : null;

    if (stageRef.current) {
      resizeObserver?.observe(stageRef.current);
    }

    window.addEventListener("scroll", updateStageVisibility, { passive: true });
    window.addEventListener("resize", updateStageVisibility, { passive: true });
    viewport?.addEventListener("resize", updateStageVisibility);
    viewport?.addEventListener("scroll", updateStageVisibility);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", updateStageVisibility);
      window.removeEventListener("resize", updateStageVisibility);
      viewport?.removeEventListener("resize", updateStageVisibility);
      viewport?.removeEventListener("scroll", updateStageVisibility);
    };
  }, [chapterTitle, layout, projectTitle, visualState.imageFit]);

  useEffect(() => {
    if (paginated) {
      setActiveSlotIndex((current) => clampIndex(current, slots.length));
      return;
    }
    setActivePageIndex((current) => clampIndex(current, Math.max(originalPages.length, 1)));
  }, [originalPages.length, paginated, slots.length]);

  useEffect(() => {
    if (!paginated) {
      return;
    }
    const slot = slots[activeSlotIndex] || slots[0];
    const visiblePage =
      (slot?.pages || []).find((pageIndex) => pageIndex < accessiblePageCount) ?? 0;
    setActivePageIndex(visiblePage);
  }, [accessiblePageCount, activeSlotIndex, paginated, slots]);

  const updateContinuousActivePage = useCallback(() => {
    if (paginated || originalPages.length === 0) {
      return;
    }

    if (layout === "scroll-horizontal") {
      const container = horizontalScrollRef.current;
      if (!container) {
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const nextIndex = pickMostVisiblePage({
        measurements: originalPages
          .map((_, index) => {
            const node = pageRefs.current[index];
            if (!node) {
              return null;
            }
            const rect = node.getBoundingClientRect();
            return {
              index,
              start: rect.left - containerRect.left,
              end: rect.right - containerRect.left,
            };
          })
          .filter(Boolean) as Array<{ index: number; start: number; end: number }>,
        viewportSize: container.clientWidth,
      });
      setActivePageIndex((current) => (current === nextIndex ? current : nextIndex));
      return;
    }

    const nextIndex = pickMostVisiblePage({
      measurements: originalPages
        .map((_, index) => {
          const node = pageRefs.current[index];
          if (!node) {
            return null;
          }
          const rect = node.getBoundingClientRect();
          return {
            index,
            start: rect.top,
            end: rect.bottom,
          };
        })
        .filter(Boolean) as Array<{ index: number; start: number; end: number }>,
      viewportSize: getVisibleViewportHeight(),
    });
    setActivePageIndex((current) => (current === nextIndex ? current : nextIndex));
  }, [layout, originalPages, paginated]);

  useEffect(() => {
    if (paginated) {
      return;
    }

    updateContinuousActivePage();
    const handleScroll = () => updateContinuousActivePage();
    const handleResize = () => updateContinuousActivePage();
    const viewport = window.visualViewport;

    if (layout === "scroll-horizontal") {
      const container = horizontalScrollRef.current;
      container?.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("resize", handleResize, { passive: true });
      viewport?.addEventListener("resize", handleResize);
      viewport?.addEventListener("scroll", handleResize);
      return () => {
        container?.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleResize);
        viewport?.removeEventListener("resize", handleResize);
        viewport?.removeEventListener("scroll", handleResize);
      };
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    viewport?.addEventListener("resize", handleResize);
    viewport?.addEventListener("scroll", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      viewport?.removeEventListener("resize", handleResize);
      viewport?.removeEventListener("scroll", handleResize);
    };
  }, [layout, paginated, updateContinuousActivePage]);

  const goToSlot = useCallback(
    (nextSlotIndex: number) => {
      setActiveSlotIndex(clampIndex(nextSlotIndex, slots.length));
    },
    [slots.length],
  );

  const goToPrevious = useCallback(() => {
    if (!paginated) {
      return;
    }
    goToSlot(activeSlotIndex - 1);
  }, [activeSlotIndex, goToSlot, paginated]);

  const goToNext = useCallback(() => {
    if (!paginated) {
      return;
    }
    goToSlot(activeSlotIndex + 1);
  }, [activeSlotIndex, goToSlot, paginated]);

  const goToPage = useCallback(
    (pageIndex: number) => {
      const clampedPageIndex = clampIndex(pageIndex, Math.max(originalPages.length, 1));
      const targetIndex =
        hasPurchaseGate && clampedPageIndex >= accessiblePageCount
          ? renderablePages.length - 1
          : clampedPageIndex;

      if (paginated) {
        goToSlot(findSlotIndexForPage(slots, targetIndex));
        return;
      }

      const targetNode = pageRefs.current[targetIndex];
      targetNode?.scrollIntoView?.({
        behavior: "smooth",
        block: layout === "scroll-horizontal" ? "nearest" : "start",
        inline: layout === "scroll-horizontal" ? "start" : "nearest",
      });
    },
    [
      accessiblePageCount,
      goToSlot,
      hasPurchaseGate,
      layout,
      originalPages.length,
      paginated,
      renderablePages.length,
      slots,
    ],
  );

  useEffect(() => {
    if (!paginated) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = String(target?.tagName || "").toLowerCase();
      if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (direction === "rtl") {
          goToNext();
        } else {
          goToPrevious();
        }
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (direction === "rtl") {
          goToPrevious();
        } else {
          goToNext();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [direction, goToNext, goToPrevious, paginated]);

  useEffect(() => {
    if (visualState.progressStyle === "hidden" && isStageInViewport) {
      return;
    }

    clearHiddenProgressHideTimer();
    setIsHiddenProgressRevealed(false);
  }, [clearHiddenProgressHideTimer, isStageInViewport, visualState.progressStyle]);

  const pageSummary = useMemo(
    () =>
      formatVisiblePageLabel({
        layout,
        activeSlotIndex,
        slots,
        activePageIndex,
        totalPages: originalPages.length,
        accessiblePageCount,
      }),
    [accessiblePageCount, activePageIndex, activeSlotIndex, layout, originalPages.length, slots],
  );
  const progressPageIndex = Math.min(
    Math.max(activePageIndex + 1, 1),
    accessiblePageCount || originalPages.length || 1,
  );
  const progressPercent =
    originalPages.length > 0 ? (progressPageIndex / originalPages.length) * 100 : 0;
  const clampedProgressPercent = Math.min(Math.max(progressPercent, 0), 100);
  const isViewportBoundedReader = usesViewportBoundedHeight(effectiveImageFit);
  const pageItems = useMemo(
    () =>
      buildReaderPageItems({
        totalPages: originalPages.length,
        accessiblePageCount,
      }),
    [accessiblePageCount, originalPages.length],
  );
  const stageViewportStyle = useMemo(() => {
    if (!stageViewportHeight) {
      return undefined;
    }
    return isViewportBoundedReader
      ? {
          minHeight: `${stageViewportHeight}px`,
          height: `${stageViewportHeight}px`,
        }
      : {
          minHeight: `${stageViewportHeight}px`,
        };
  }, [isViewportBoundedReader, stageViewportHeight]);
  const readerViewportStyle = useMemo(() => {
    if (!readerViewportHeight) {
      return undefined;
    }
    return isViewportBoundedReader
      ? {
          minHeight: `${readerViewportHeight}px`,
          height: `${readerViewportHeight}px`,
        }
      : {
          minHeight: `${readerViewportHeight}px`,
        };
  }, [isViewportBoundedReader, readerViewportHeight]);
  const viewportBoundedSurfaceStyle = useMemo(() => {
    if (!stageViewportHeight || !isViewportBoundedReader) {
      return undefined;
    }
    return {
      height: `${stageViewportHeight}px`,
    };
  }, [isViewportBoundedReader, stageViewportHeight]);
  const progressPosition =
    visualState.progressPosition === "left" || visualState.progressPosition === "right"
      ? visualState.progressPosition
      : "bottom";
  const progressOverlayContainerStyle = useMemo(
    () => getProgressOverlayContainerStyle(progressPosition),
    [progressPosition],
  );
  const hiddenProgressZoneStyle = useMemo(
    () => getHiddenProgressZoneStyle(progressPosition),
    [progressPosition],
  );
  const renderedProgressStyle =
    visualState.progressStyle === "hidden"
      ? isHiddenProgressRevealed
        ? "bar"
        : null
      : visualState.progressStyle;
  const shouldRenderProgressOverlay = isStageInViewport && renderedProgressStyle !== null;

  const renderProgressOverlay = () => {
    if (!shouldRenderProgressOverlay) {
      return null;
    }

    const isBottomProgress = progressPosition === "bottom";
    const interactiveProgress = visualState.progressStyle === "hidden";

    return (
      <div
        data-testid="project-reader-progress-overlay"
        className="pointer-events-none fixed z-10"
        style={progressOverlayContainerStyle}
      >
        <div
          className={cn(
            "relative h-full w-full overflow-visible",
            interactiveProgress ? "pointer-events-auto" : "pointer-events-none",
          )}
          onMouseEnter={interactiveProgress ? revealHiddenProgress : undefined}
          onMouseLeave={interactiveProgress ? scheduleHiddenProgressHide : undefined}
        >
          {renderedProgressStyle === "bar" ? (
            isBottomProgress ? (
              <div
                data-testid="project-reader-progress-track"
                className="absolute inset-x-0 bottom-0 h-1.5 overflow-hidden rounded-full bg-white/10"
              >
                <div
                  className="h-full bg-primary transition-all duration-200"
                  style={{ width: `${clampedProgressPercent}%` }}
                />
              </div>
            ) : (
              <div
                data-testid="project-reader-progress-track"
                className={cn(
                  "absolute bottom-0 top-0 w-1.5 overflow-hidden rounded-full bg-white/10",
                  progressPosition === "left" ? "left-0" : "right-0",
                )}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 bg-primary transition-all duration-200"
                  style={{ height: `${clampedProgressPercent}%` }}
                />
              </div>
            )
          ) : isBottomProgress ? (
            <div
              data-testid="project-reader-progress-track"
              className="absolute inset-x-0 bottom-0 h-full"
            >
              <div className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-white/10" />
              <div
                data-testid="project-reader-progress-indicator"
                className="absolute bottom-0 flex min-w-10 -translate-x-1/2 translate-y-1/3 items-center justify-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground ring-4 ring-primary/20 shadow-lg transition-all duration-200"
                style={{ left: `${clampedProgressPercent}%` }}
              >
                <span data-testid="project-reader-progress-label">{progressPageIndex}</span>
              </div>
            </div>
          ) : (
            <div
              data-testid="project-reader-progress-track"
              className="absolute inset-y-0 h-full w-full"
            >
              <div
                className={cn(
                  "absolute bottom-0 top-0 w-1 rounded-full bg-white/10",
                  progressPosition === "left" ? "left-0" : "right-0",
                )}
              />
              <div
                data-testid="project-reader-progress-indicator"
                className={cn(
                  "absolute flex min-h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground ring-4 ring-primary/20 shadow-lg transition-all duration-200",
                  progressPosition === "left"
                    ? "left-4 translate-y-1/2"
                    : "right-4 translate-y-1/2",
                )}
                style={{ bottom: `${clampedProgressPercent}%` }}
              >
                <span data-testid="project-reader-progress-label">{progressPageIndex}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHiddenProgressZone = () => {
    if (!isStageInViewport || visualState.progressStyle !== "hidden") {
      return null;
    }

    return (
      <div
        data-testid="project-reader-progress-activation-zone"
        className="fixed z-10 bg-transparent"
        style={hiddenProgressZoneStyle}
        onMouseEnter={revealHiddenProgress}
        onMouseLeave={scheduleHiddenProgressHide}
        onTouchStart={handleHiddenProgressTouchStart}
      />
    );
  };

  const renderPurchaseCard = (pageIndex: number, className?: string, surfaceClassName?: string) => (
    <div
      key={`reader-page-node-${pageIndex}`}
      ref={(node) => {
        pageRefs.current[pageIndex] = node;
      }}
      data-testid={`reader-page-${pageIndex}`}
      className={cn(PAGE_WRAPPER_BASE_CLASS, "w-full items-center", className)}
    >
      <div
        data-testid={`reader-page-surface-${pageIndex}`}
        className={cn(
          "mx-auto flex w-full max-w-xl flex-col items-center justify-center rounded-3xl border px-6 py-10 text-center shadow-lg",
          purchaseToneClassName,
          surfaceClassName,
        )}
        style={viewportBoundedSurfaceStyle}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
          Prévia limitada
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">A prévia termina aqui</h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
          Este capítulo tem {originalPages.length} páginas no total e libera {accessiblePageCount}{" "}
          na prévia.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {resolvedConfig.purchaseUrl ? (
            <Button asChild className="rounded-full px-5">
              <a href={String(resolvedConfig.purchaseUrl || "")} target="_blank" rel="noreferrer">
                {resolvedConfig.purchasePrice
                  ? `Comprar ${String(resolvedConfig.purchasePrice)}`
                  : "Comprar e continuar"}
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link to={backHref}>Voltar ao projeto</Link>
          </Button>
        </div>
      </div>
    </div>
  );

  const renderImagePage = (
    page: ReaderRenderablePage,
    pageIndex: number,
    className?: string,
    surfaceClassName?: string,
  ) => {
    if (page.type === "purchase" || page.isPurchasePage) {
      return renderPurchaseCard(pageIndex, className, surfaceClassName);
    }

    return (
      <div
        key={`reader-image-node-${pageIndex}`}
        ref={(node) => {
          pageRefs.current[pageIndex] = node;
        }}
        data-testid={`reader-page-${pageIndex}`}
        className={cn(
          PAGE_WRAPPER_BASE_CLASS,
          getPageWrapperClassName(effectiveImageFit),
          className,
        )}
      >
        <div
          data-testid={`reader-page-surface-${pageIndex}`}
          className={cn(getPageSurfaceClassName(effectiveImageFit), surfaceClassName)}
          style={viewportBoundedSurfaceStyle}
        >
          <img
            src={page.imageUrl || ""}
            alt={`Página ${pageIndex + 1}`}
            loading={pageIndex < 2 ? "eager" : "lazy"}
            decoding="async"
            className={imageClassName}
            draggable={false}
          />
        </div>
      </div>
    );
  };

  const activeSlot = slots[activeSlotIndex] || slots[0];

  const stageContent = paginated ? (
    <button
      type="button"
      className="relative flex w-full min-h-0 flex-1 cursor-default text-left select-none"
      onClick={(event) => {
        const target = event.currentTarget;
        const nextAction = resolvePaginatedPointerAction({
          layout,
          direction,
          pointerRatio: event.nativeEvent.offsetX / Math.max(target.clientWidth, 1),
        });
        if (nextAction === "next") {
          goToNext();
        }
        if (nextAction === "previous") {
          goToPrevious();
        }
      }}
      aria-label="Área de leitura paginada"
    >
      <div
        data-testid="project-reading-paginated-scroll-lane"
        className={cn(
          "flex w-full items-center justify-center overflow-x-auto overflow-y-hidden",
          isCinemaMode ? "px-0" : "px-2 md:px-4",
        )}
      >
        <div
          data-testid="project-reading-paginated-strip"
          className={cn(
            "mx-auto flex items-center justify-center gap-0",
            "w-full",
            layout === "double" && direction === "rtl" ? "md:flex-row-reverse" : "md:flex-row",
          )}
        >
          {layout === "double" && activeSlot?.hasBlank ? (
            <div
              aria-hidden="true"
              data-testid="reader-spread-blank"
              className="hidden md:block md:flex-1"
            />
          ) : null}

          {(activeSlot?.pages || []).map((pageIndex, pagePosition) => {
            const page = renderablePages[pageIndex];
            if (!page) {
              return null;
            }
            const spreadAlignmentClassName =
              layout === "double" && effectiveImageFit !== "none"
                ? getHorizontalAlignmentClassName(
                    getDoublePageInnerAlignment({
                      direction,
                      pagePosition,
                    }),
                  )
                : undefined;
            return (
              <div
                key={`slot-page-${pageIndex}`}
                className={getPaginatedSlotClassName({
                  layout,
                  imageFit: effectiveImageFit,
                  direction,
                  pagePosition,
                })}
              >
                {renderImagePage(page, pageIndex, undefined, spreadAlignmentClassName)}
              </div>
            );
          })}
        </div>
      </div>
    </button>
  ) : layout === "scroll-horizontal" ? (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col",
        isViewportBoundedReader ? "h-full min-h-0" : "",
      )}
    >
      <div
        ref={horizontalScrollRef}
        data-testid="project-reading-horizontal-scroll"
        className={cn(
          "w-full min-w-0 overflow-x-auto overflow-y-hidden",
          isViewportBoundedReader ? "min-h-0 flex-1" : "",
          isCinemaMode ? "px-0 py-0" : "px-2 py-2 md:px-4 md:py-4",
        )}
        style={{ scrollbarGutter: "stable both-edges" }}
        aria-label="Leitura com rolagem horizontal"
      >
        <div
          className={cn(
            "flex w-max min-w-full items-start gap-0",
            isViewportBoundedReader ? "min-h-full" : "",
          )}
        >
          {renderablePages.map((page, pageIndex) =>
            renderImagePage(
              page,
              pageIndex,
              getContinuousHorizontalPageClassName(effectiveImageFit),
              getContinuousHorizontalSurfaceClassName(effectiveImageFit),
            ),
          )}
        </div>
      </div>
    </div>
  ) : (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-0",
        isCinemaMode ? "px-0 py-0" : "mx-auto px-2 py-2 md:px-4 md:py-4",
      )}
    >
      {renderablePages.map((page, pageIndex) => (
        <div
          key={`vertical-page-${pageIndex}`}
          className={effectiveImageFit === "none" ? "w-auto max-w-none" : "w-full"}
        >
          {renderImagePage(page, pageIndex)}
        </div>
      ))}
    </div>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-border/60 px-4 py-4 md:px-5 md:py-5">
        <p className="text-lg font-semibold text-foreground">Menu do leitor</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {currentUserId
            ? "As preferências são salvas automaticamente na sua conta."
            : "As preferências são salvas automaticamente neste navegador."}
          {!hasLoadedPreferences ? " Carregando preferências..." : ""}
        </p>
      </div>

      <div className="space-y-4 px-4 pb-6 pt-4 md:px-5">
        <div className={cn(SIDEBAR_SECTION_CLASS_NAME, "space-y-4")}>
          <div className={SIDEBAR_SECTION_HEADER_CLASS_NAME}>
            <BookOpenText className={SIDEBAR_SECTION_ICON_CLASS_NAME} aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Navegação da leitura</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Mude de capítulo ou salte direto para a página desejada.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Capítulo</Label>
              <Select
                value={currentChapterValue}
                onValueChange={(value) => {
                  const nextChapter = chapterOptions.find((option) => option.value === value);
                  if (!nextChapter) {
                    return;
                  }
                  setIsMenuOpen(false);
                  onNavigateChapter(nextChapter.href);
                }}
              >
                <SelectTrigger aria-label="Selecionar capítulo">
                  <SelectValue placeholder="Selecione um capítulo" />
                </SelectTrigger>
                <SelectContent>
                  {chapterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Página</Label>
              <Select
                value={String(Math.min(activePageIndex, Math.max(originalPages.length - 1, 0)))}
                onValueChange={(value) => {
                  goToPage(Number(value));
                  setIsMenuOpen(false);
                }}
              >
                <SelectTrigger aria-label="Selecionar página">
                  <SelectValue placeholder="Selecione uma página" />
                </SelectTrigger>
                <SelectContent>
                  {pageItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className={cn(SIDEBAR_SECTION_CLASS_NAME, "space-y-4")}>
          <div className={SIDEBAR_SECTION_HEADER_CLASS_NAME}>
            <BookOpenText className={SIDEBAR_SECTION_ICON_CLASS_NAME} aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Ações do capítulo</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Volte ao projeto, edite o capítulo e navegue sem sair da leitura.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link to={backHref}>Voltar ao projeto</Link>
            </Button>

            {editHref ? (
              <Button asChild variant="outline" className="w-full rounded-full">
                <Link to={editHref}>
                  <PencilLine className="h-4 w-4" aria-hidden="true" />
                  <span>Editar capítulo</span>
                </Link>
              </Button>
            ) : null}
          </div>

          {paginated ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  goToPrevious();
                  setIsMenuOpen(false);
                }}
                aria-label="Página anterior"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Página anterior</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  goToNext();
                  setIsMenuOpen(false);
                }}
                aria-label="Próxima página"
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                <span>Próxima página</span>
              </Button>
            </div>
          ) : null}
        </div>

        <div className={cn(SIDEBAR_SECTION_CLASS_NAME, "grid gap-4 md:grid-cols-2")}>
          <div className="space-y-2">
            <Label>Layout</Label>
            <Select
              value={String(resolvedConfig.layout || "single")}
              onValueChange={(value) => updateConfig({ layout: value })}
            >
              <SelectTrigger aria-label="Selecionar layout do leitor">
                <SelectValue placeholder="Selecione um layout" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Página única</SelectItem>
                <SelectItem value="double">Página dupla</SelectItem>
                <SelectItem value="scroll-vertical">Rolagem vertical</SelectItem>
                <SelectItem value="scroll-horizontal">Rolagem horizontal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ajuste da imagem</Label>
            <Select
              value={String(resolvedConfig.imageFit || "both")}
              onValueChange={(value) => updateConfig({ imageFit: value })}
            >
              <SelectTrigger aria-label="Selecionar ajuste da imagem">
                <SelectValue placeholder="Selecione o ajuste" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Largura e altura</SelectItem>
                <SelectItem value="none">Sem ajuste</SelectItem>
                <SelectItem value="width">Ajustar à largura</SelectItem>
                <SelectItem value="height">Ajustar à altura</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Direção</Label>
            <Select
              value={String(resolvedConfig.direction || "rtl")}
              onValueChange={(value) => updateConfig({ direction: value })}
            >
              <SelectTrigger aria-label="Selecionar direção do leitor">
                <SelectValue placeholder="Selecione a direção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rtl">Direita para esquerda</SelectItem>
                <SelectItem value="ltr">Esquerda para direita</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fundo do palco</Label>
            <Select
              value={String(resolvedConfig.background || "theme")}
              onValueChange={(value) => updateConfig({ background: value })}
            >
              <SelectTrigger aria-label="Selecionar fundo do palco">
                <SelectValue placeholder="Selecione o fundo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="theme">Tema do site</SelectItem>
                <SelectItem value="black">Preto</SelectItem>
                <SelectItem value="white">Branco</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Estilo do progresso</Label>
            <Select
              value={String(resolvedConfig.progressStyle || "bar")}
              onValueChange={(value) => updateConfig({ progressStyle: value })}
            >
              <SelectTrigger aria-label="Selecionar estilo do progresso">
                <SelectValue placeholder="Selecione o progresso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hidden">Oculto</SelectItem>
                <SelectItem value="bar">Barra</SelectItem>
                <SelectItem value="glow">Brilho</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Posição do progresso</Label>
            <Select
              value={String(resolvedConfig.progressPosition || "bottom")}
              onValueChange={(value) => updateConfig({ progressPosition: value })}
            >
              <SelectTrigger aria-label="Selecionar posição do progresso">
                <SelectValue placeholder="Selecione a posição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom">Inferior</SelectItem>
                <SelectItem value="left">Esquerda</SelectItem>
                <SelectItem value="right">Direita</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <label className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card/50 px-4 py-4 text-sm">
          <span className="space-y-1">
            <span className="block font-medium text-foreground">Primeira página isolada</span>
            <span className="block text-xs leading-5 text-muted-foreground">
              Mantém a primeira página sozinha quando o layout usa páginas duplas.
            </span>
          </span>
          <Switch
            checked={resolvedConfig.firstPageSingle !== false}
            onCheckedChange={(checked) => updateConfig({ firstPageSingle: checked })}
            aria-label="Alternar primeira página isolada"
          />
        </label>
      </div>
    </div>
  );

  return (
    <div
      ref={shellRef}
      data-testid="project-reading-full-bleed-shell"
      className={cn(
        "project-reading-reader-shell relative flex w-full min-w-0 flex-col",
        isCinemaMode ? "gap-0" : "gap-3 md:gap-4",
        paginated ? "min-h-0 flex-1" : "",
      )}
      style={readerViewportStyle}
    >
      <div
        ref={infoBarRef}
        className={cn("w-full", isCinemaMode ? "absolute inset-x-0 top-0 z-20" : "relative z-10")}
      >
        <ProjectReadingInfoBar
          projectTitle={projectTitle}
          chapterTitle={chapterTitle}
          chapterLabel={chapterLabel}
          projectType={projectType}
          synopsis={synopsis}
          volume={volume}
          pageSummary={pageSummary}
          variant={isCinemaMode ? "reader-cinema" : "reader-full-bleed"}
          actions={
            <Button
              type="button"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-full",
                isCinemaMode ? "border border-border/60 bg-background/80" : "",
              )}
              onClick={() => setIsMenuOpen(true)}
              aria-label="Abrir menu do leitor"
              data-testid="project-reader-menu-button"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </Button>
          }
        />
      </div>

      <div className="relative min-h-0 w-full flex-1">
        <section
          ref={stageRef}
          data-testid="project-reading-stage"
          data-layout={layout}
          data-image-fit={visualState.imageFit}
          data-background={visualState.background}
          data-progress-style={visualState.progressStyle}
          data-progress-position={visualState.progressPosition}
          className={cn(
            "relative isolate w-full min-h-0",
            paginated ? "flex min-h-0 flex-col" : "",
            stageToneClassName,
          )}
          style={stageViewportStyle}
        >
          {stageContent}
        </section>

        {renderHiddenProgressZone()}
        {renderProgressOverlay()}

        {isDesktopMenu && isMenuOpen ? (
          <>
            <button
              type="button"
              className="absolute inset-0 z-20 hidden bg-black/45 md:block"
              onClick={() => setIsMenuOpen(false)}
              aria-label="Fechar menu do leitor"
            />
            <aside
              data-testid="project-reader-sidebar"
              className={cn(
                "absolute right-3 z-30 hidden overflow-hidden rounded-3xl border shadow-xl md:flex md:flex-col",
                sidebarToneClassName,
              )}
              style={{ top: "0.75rem", bottom: "0.75rem", width: "min(calc(100vw - 2rem), 24rem)" }}
            >
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-3 top-3 z-10 rounded-full"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Fechar menu do leitor"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
              {sidebarContent}
            </aside>
          </>
        ) : null}
      </div>

      {!isDesktopMenu ? (
        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetContent
            side="right"
            data-testid="project-reader-sidebar"
            className={cn("w-full max-w-sm p-0", sidebarToneClassName)}
          >
            {sidebarContent}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
};

export default PublicProjectReader;
