import { motion, type Transition } from "framer-motion";
import { Star, Trash2 } from "lucide-react";
import type { DragEvent, KeyboardEvent, MouseEvent } from "react";

import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type MangaPageTileProps = {
  testIdPrefix: string;
  src: string;
  alt: string;
  displayName: string;
  index: number;
  isCover: boolean;
  isDragged: boolean;
  isPreviewTarget: boolean;
  disabled: boolean;
  reorderMotion: "spring" | "reduced";
  reorderTransition: Transition;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onSetCover?: (event: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>) => void;
};

const MangaPageTile = ({
  testIdPrefix,
  src,
  alt,
  displayName,
  index,
  isCover,
  isDragged,
  isPreviewTarget,
  disabled,
  reorderMotion,
  reorderTransition,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onKeyDown,
  onSetCover,
  onRemove,
}: MangaPageTileProps) => (
  <motion.article
    layout={!isDragged}
    transition={reorderTransition}
    className="group"
    data-testid={`${testIdPrefix}-card-${index}`}
    data-reorder-layout={!isDragged ? "animated" : "static"}
  >
    <div
      role="button"
      tabIndex={0}
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onKeyDown={onKeyDown}
      aria-label={`Arrastar pagina ${index + 1} para reordenar. Use Alt+Seta para mover pelo teclado.`}
      title={displayName}
      data-testid={`${testIdPrefix}-surface-${index}`}
      data-reorder-motion={reorderMotion}
      data-reorder-state={isDragged ? "dragging" : isPreviewTarget ? "preview-target" : "idle"}
      className={`relative aspect-[3/4] overflow-hidden rounded-[22px] border bg-card/75 transition ${
        isDragged
          ? "z-10 cursor-grabbing border-primary/60 opacity-85 ring-2 ring-primary/25 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.45)]"
          : isPreviewTarget
            ? "cursor-grab border-primary/60 ring-2 ring-primary/15"
            : "cursor-grab border-border/50"
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`}
    >
      <UploadPicture
        src={src}
        alt={alt}
        preset="poster"
        className="h-full w-full"
        imgClassName="h-full w-full object-cover object-top"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3"
        data-testid={`${testIdPrefix}-top-row-${index}`}
      >
        <div className="flex items-start gap-2">
          <Badge
            variant="secondary"
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] uppercase leading-none tracking-[0.12em] shadow-sm"
            data-testid={`${testIdPrefix}-position-badge-${index}`}
          >
            {"P\u00e1gina "}
            {index + 1}
          </Badge>
        </div>
        <div
          className="pointer-events-auto relative flex h-7 min-w-[84px] justify-end"
          data-testid={`${testIdPrefix}-top-actions-${index}`}
        >
          {isCover ? (
            <Badge
              className="absolute right-0 top-0 rounded-full px-2.5 py-1 text-[10px] uppercase leading-none tracking-[0.12em] shadow-sm transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0"
              data-testid={`${testIdPrefix}-cover-badge-${index}`}
            >
              Capa
            </Badge>
          ) : null}
          <div className="absolute right-0 top-0 flex items-start gap-2 opacity-0 transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            {!isCover && onSetCover ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={onSetCover}
                disabled={disabled}
                className="h-9 w-9 rounded-full border border-border/60 bg-background/90 shadow-sm"
              >
                <Star className="h-4 w-4" />
                <span className="sr-only">Usar capa</span>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={onRemove}
              disabled={disabled}
              className="h-9 w-9 rounded-full border border-border/60 bg-background/90 text-destructive shadow-sm hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remover</span>
            </Button>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-3 pb-3 pt-12 opacity-0 transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <span
          className="block truncate text-xs font-medium text-white"
          title={displayName}
          data-testid={`${testIdPrefix}-filename-${index}`}
        >
          {displayName}
        </span>
      </div>
    </div>
  </motion.article>
);

export default MangaPageTile;
