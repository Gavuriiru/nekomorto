import { ImageLibraryDialogLoadingGrid } from "@/components/ImageLibraryDialogLoading";
import type { LibraryImageItem } from "@/components/image-library/types";
import { toEffectiveName, toLibraryItemRenderUrl } from "@/components/image-library/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type ImageLibraryBrowserCardGridProps = {
  allowUploadManagementActions: boolean;
  beginAltTextEdit: (item: LibraryImageItem) => void;
  beginFocalPointEdit: (item: LibraryImageItem) => void;
  cropAvatar: boolean;
  emptyText: string;
  isDeleting: boolean;
  isLoading: boolean;
  items: LibraryImageItem[];
  mode: "single" | "multiple";
  onRequestDelete: (item: LibraryImageItem) => void;
  onRequestRename: (item: LibraryImageItem) => void;
  section: "upload" | "project";
  selectedResolvedUrlSet: Set<string>;
  setCardRef: (url: string, node: HTMLButtonElement | null) => void;
  setSelection: (url: string, options?: { openCrop?: boolean }) => void;
};

const ImageLibraryBrowserCardGrid = ({
  allowUploadManagementActions,
  beginAltTextEdit,
  beginFocalPointEdit,
  cropAvatar,
  emptyText,
  isDeleting,
  isLoading,
  items,
  mode,
  onRequestDelete,
  onRequestRename,
  section,
  selectedResolvedUrlSet,
  setCardRef,
  setSelection,
}: ImageLibraryBrowserCardGridProps) => {
  if (isLoading) {
    return <ImageLibraryDialogLoadingGrid className="mt-3" testId="image-library-loading-grid" />;
  }

  if (items.length === 0) {
    return <p className="mt-3 text-xs text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="mt-3 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {items.map((item) => {
        const isSelected = selectedResolvedUrlSet.has(item.url);
        const itemRenderUrl = toLibraryItemRenderUrl(item);
        const canRename = allowUploadManagementActions && item.source === "upload";
        const canDelete =
          allowUploadManagementActions && item.source === "upload" && Boolean(item.canDelete);
        const canEditFocal =
          allowUploadManagementActions && item.source === "upload" && Boolean(item.id);
        const canEditAltText =
          allowUploadManagementActions && item.source === "upload" && Boolean(item.id);
        const hasManagementActions = canRename || canDelete || canEditFocal || canEditAltText;

        return (
          <ContextMenu key={`${item.source}:${item.url}`} modal={false}>
            <ContextMenuTrigger asChild>
              <button
                ref={(node) => setCardRef(item.url, node)}
                type="button"
                data-library-section={section}
                className={`group min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card/60 text-left transition hover:border-primary/40 ${
                  isSelected ? "border-primary/60 ring-2 ring-inset ring-primary/60" : ""
                }`}
                onClick={() =>
                  setSelection(item.url, {
                    openCrop: cropAvatar && mode === "single",
                  })
                }
              >
                <img
                  src={itemRenderUrl}
                  alt={toEffectiveName(item)}
                  className="h-24 w-full object-cover sm:h-28"
                />
                <div className="line-clamp-2 break-words p-2 text-xs text-muted-foreground">
                  {item.label || toEffectiveName(item)}
                </div>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent className="z-230 w-56">
              <ContextMenuLabel>
                {item.source === "upload" ? "Upload do servidor" : "Imagem de projeto"}
              </ContextMenuLabel>
              <ContextMenuSeparator />
              {cropAvatar && mode === "single" ? (
                <ContextMenuItem
                  onSelect={() => {
                    setSelection(item.url, { openCrop: true });
                  }}
                >
                  Editar avatar
                </ContextMenuItem>
              ) : null}
              {cropAvatar && mode === "single" && hasManagementActions ? (
                <ContextMenuSeparator />
              ) : null}
              {hasManagementActions ? (
                <>
                  <ContextMenuItem
                    disabled={!canEditFocal}
                    onSelect={() => {
                      if (!canEditFocal) {
                        return;
                      }
                      beginFocalPointEdit(item);
                    }}
                  >
                    Definir ponto focal
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={!canEditAltText}
                    onSelect={() => {
                      if (!canEditAltText) {
                        return;
                      }
                      beginAltTextEdit(item);
                    }}
                  >
                    Editar texto alternativo
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={!canRename}
                    onSelect={() => {
                      if (!canRename) {
                        return;
                      }
                      onRequestRename(item);
                    }}
                  >
                    Renomear
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={!canDelete || isDeleting}
                    onSelect={() => {
                      if (!canDelete) {
                        return;
                      }
                      onRequestDelete(item);
                    }}
                  >
                    Excluir
                  </ContextMenuItem>
                  {!canRename || !canDelete || !canEditFocal || !canEditAltText ? (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuLabel className="text-xs font-normal text-muted-foreground">
                        {item.inUse ? "Exclusão bloqueada: imagem em uso." : "Ações indisponíveis."}
                      </ContextMenuLabel>
                    </>
                  ) : null}
                </>
              ) : null}
              {item.source === "project" ? (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuLabel className="text-xs font-normal text-muted-foreground">
                    Item somente leitura (projeto). Texto alternativo editável apenas em uploads.
                  </ContextMenuLabel>
                </>
              ) : null}
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
};

export default ImageLibraryBrowserCardGrid;
