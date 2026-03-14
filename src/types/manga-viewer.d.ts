declare module "@tokagemushi/manga-viewer" {
  export type MangaViewerOptions = {
    container?: string | HTMLElement;
    pages?: Array<string | Record<string, unknown>>;
    direction?: "rtl" | "ltr";
    firstPageSingle?: boolean;
    viewMode?: "page" | "scroll";
    adsense?: { client: string; slot: string } | null;
    previewLimit?: number | null;
    onPageChange?: ((currentPage: number, totalPages: number) => void) | null;
    onComplete?: (() => void) | null;
    storageKey?: string;
    title?: string;
    backUrl?: string;
    showHeader?: boolean;
    showFooter?: boolean;
    shareUrl?: string;
    purchaseUrl?: string;
    purchasePrice?: string;
    loadingText?: string;
    bookmarks?: boolean;
    allowSpread?: boolean;
  };

  export default class MangaViewer {
    constructor(options?: MangaViewerOptions);
    readonly currentPage: number;
    readonly totalPages: number;
    destroy(): void;
    goToPage(page: number): void;
    goToSlot(slot: number): void;
    zoomIn(): void;
    resetZoom(): void;
  }
}
