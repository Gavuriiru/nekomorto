import { useEffect, useMemo, useRef } from "react";
import BaseMangaViewer from "@tokagemushi/manga-viewer";

import { buildMangaSpreadSlots } from "@/components/project-reader/manga-spread-slots";

type MangaViewerPage = {
  position: number;
  imageUrl: string;
  spreadPairId?: string;
};

type MangaViewerAdapterProps = {
  title: string;
  backUrl: string;
  shareUrl: string;
  pages: MangaViewerPage[];
  direction: "rtl" | "ltr";
  viewMode: "page" | "scroll";
  firstPageSingle: boolean;
  allowSpread: boolean;
  showFooter: boolean;
  previewLimit?: number | null;
  purchaseUrl?: string;
  purchasePrice?: string;
  onPageChange?: (currentPage: number, totalPages: number) => void;
  className?: string;
};

const SHADOW_OVERRIDES = `
  :host {
    display: block;
    width: 100%;
    height: 100%;
  }

  .mv-loading-screen,
  .mv-container,
  .mv-main,
  .mv-header,
  .mv-footer,
  .mv-zoom-controls,
  .mv-status-bar-cover,
  .mv-toast,
  .mv-help-overlay,
  .mv-purchase-popup,
  .mv-resume-dialog {
    position: absolute !important;
  }

  .mv-loading-screen,
  .mv-container,
  .mv-main,
  .mv-help-overlay,
  .mv-purchase-popup,
  .mv-resume-dialog {
    inset: 0 !important;
  }

  .mv-container {
    height: 100% !important;
    border-radius: 1rem;
    overflow: hidden;
    background:
      radial-gradient(circle at top, rgba(255, 255, 255, 0.06), transparent 40%),
      linear-gradient(180deg, rgba(8, 8, 10, 0.98), rgba(20, 20, 26, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .mv-main {
    background: transparent !important;
  }

  .mv-footer {
    left: 0.75rem !important;
    right: 0.75rem !important;
    bottom: 0.75rem !important;
    border-radius: 0.9rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(10, 10, 12, 0.82) !important;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }

  .mv-footer-info,
  .mv-footer span {
    color: rgba(255, 255, 255, 0.88) !important;
  }

  .mv-page-slider {
    background: rgba(255, 255, 255, 0.16) !important;
  }

  .mv-page-slider::-webkit-slider-thumb {
    background: #f2f2f2 !important;
  }

  .mv-page-slider::-moz-range-thumb {
    background: #f2f2f2 !important;
  }

  .mv-zoom-controls {
    right: 1rem !important;
    bottom: 5.5rem !important;
  }

  .mv-zoom-btn {
    background: rgba(12, 12, 16, 0.82) !important;
    border-color: rgba(255, 255, 255, 0.08) !important;
  }

  .mv-page-slot {
    background: transparent;
  }

  .mv-page-slot img {
    filter: drop-shadow(0 16px 30px rgba(0, 0, 0, 0.35));
  }

  @media (max-width: 768px) {
    .mv-container {
      border-radius: 0.9rem;
    }

    .mv-footer {
      left: 0.5rem !important;
      right: 0.5rem !important;
      bottom: 0.5rem !important;
      background: rgba(248, 248, 250, 0.96) !important;
      border-color: rgba(0, 0, 0, 0.08);
    }

    .mv-footer-info,
    .mv-footer span {
      color: #19191d !important;
    }

    .mv-page-slider {
      background: rgba(0, 0, 0, 0.12) !important;
    }

    .mv-zoom-controls {
      display: none !important;
    }
  }
`;

const MangaViewerBase = BaseMangaViewer as any;

class NekoMangaViewer extends MangaViewerBase {
  _loadProgress() {
    return null;
  }

  _saveProgress() {}

  _showResumeDialog() {}

  _initBookmarks() {}

  _buildSlots() {
    this._slots = buildMangaSpreadSlots({
      pages: Array.isArray(this._pages) ? this._pages : [],
      spreadMode: Boolean(this._spreadMode),
      firstPageSingle: this.opts.firstPageSingle !== false,
    });
  }

  _checkOrientation() {
    if (this.opts.viewMode === "scroll" || this.opts.allowSpread === false) {
      const wasSpread = this._spreadMode;
      this._spreadMode = false;
      if (wasSpread !== this._spreadMode && this._slots.length > 0) {
        const pageIdx = this._getCurrentPageIndex();
        this._buildSlots();
        this._renderSlots();
        this._currentSlotIndex = this._findSlotByPageIndex(pageIdx);
        this._updateTrackPosition(false);
        this._updateUI();
      }
      return;
    }
    super._checkOrientation();
  }
}

const installShadowOverrides = (root: ShadowRoot | null) => {
  if (!root) {
    return;
  }
  let styleTag = root.querySelector<HTMLStyleElement>("style[data-neko-manga-viewer='overrides']");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.dataset.nekoMangaViewer = "overrides";
    root.appendChild(styleTag);
  }
  styleTag.textContent = SHADOW_OVERRIDES;
};

const MangaViewerAdapter = ({
  title,
  backUrl,
  shareUrl,
  pages,
  direction,
  viewMode,
  firstPageSingle,
  allowSpread,
  showFooter,
  previewLimit = null,
  purchaseUrl = "",
  purchasePrice = "",
  onPageChange,
  className = "",
}: MangaViewerAdapterProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<any>(null);

  const viewerPages = useMemo(
    () =>
      pages
        .filter((entry) => Boolean(entry?.imageUrl))
        .map((entry) => ({
          type: "image",
          src: entry.imageUrl,
          spreadPairId: entry.spreadPairId,
        })),
    [pages],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || viewerPages.length === 0) {
      return;
    }

    const viewer = new (NekoMangaViewer as any)({
      container: host,
      pages: viewerPages,
      title,
      backUrl,
      shareUrl,
      direction,
      viewMode,
      firstPageSingle,
      allowSpread,
      showHeader: false,
      showFooter,
      previewLimit,
      purchaseUrl,
      purchasePrice,
      bookmarks: false,
      storageKey: "__disabled__",
      onPageChange,
    });

    viewerRef.current = viewer;
    installShadowOverrides(host.shadowRoot);

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [
    allowSpread,
    backUrl,
    direction,
    firstPageSingle,
    onPageChange,
    viewerPages,
    previewLimit,
    purchasePrice,
    purchaseUrl,
    shareUrl,
    showFooter,
    title,
    viewMode,
  ]);

  return (
    <div
      ref={hostRef}
      className={`relative min-h-[68vh] overflow-hidden rounded-2xl bg-transparent ${className}`.trim()}
      data-testid="manga-viewer-adapter"
    />
  );
};

export default MangaViewerAdapter;
