import { motion, type Transition } from "framer-motion";
import { Columns2, Link2Off, Star, Trash2 } from "lucide-react";
import {
  useState,
  type DragEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";

import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MangaPageTileProps = {
  testIdPrefix: string;
  src: string;
  alt: string;
  displayName: string;
  index: number;
  isCover: boolean;
  isSpread: boolean;
  isDragged: boolean;
  isPreviewTarget: boolean;
  disabled: boolean;
  canJoinWithNext?: boolean;
  reorderMotion: "spring" | "reduced";
  reorderTransition: Transition;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onJoinSpread?: (event: MouseEvent<HTMLButtonElement>) => void;
  onUnsetSpread?: (event: MouseEvent<HTMLButtonElement>) => void;
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
  isSpread,
  isDragged,
  isPreviewTarget,
  disabled,
  canJoinWithNext = false,
  reorderMotion,
  reorderTransition,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onKeyDown,
  onJoinSpread,
  onUnsetSpread,
  onSetCover,
  onRemove,
}: MangaPageTileProps) => {
  const [isSurfaceHovered, setIsSurfaceHovered] = useState(false);
  const [isSurfaceFocused, setIsSurfaceFocused] = useState(false);
  const [isActionsHovered, setIsActionsHovered] = useState(false);
  const [isActionsFocused, setIsActionsFocused] = useState(false);

  const isSurfaceActive =
    (isSurfaceHovered || isSurfaceFocused) && !isActionsHovered && !isActionsFocused;
  const areActionsVisible =
    isSurfaceHovered || isSurfaceFocused || isActionsHovered || isActionsFocused;

  const handleSurfaceFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setIsSurfaceFocused(true);
    }
  };

  const handleSurfaceBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setIsSurfaceFocused(false);
    }
  };

  const handleActionsFocus = () => {
    setIsActionsFocused(true);
  };

  const handleActionsBlur = (event: FocusEvent<HTMLDivElement>) => {
    const relatedTarget = event.relatedTarget;
    if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) {
      setIsActionsFocused(false);
    }
  };

  const stopActionPointerPropagation = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const stopActionKeyPropagation = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
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
        onMouseEnter={() => setIsSurfaceHovered(true)}
        onMouseLeave={() => setIsSurfaceHovered(false)}
        onFocus={handleSurfaceFocus}
        onBlur={handleSurfaceBlur}
        aria-label={`Arrastar p\u00E1gina ${index + 1} para reordenar. Use Alt+Seta para mover pelo teclado.`}
        data-testid={`${testIdPrefix}-surface-${index}`}
        data-reorder-motion={reorderMotion}
        data-reorder-state={isDragged ? "dragging" : isPreviewTarget ? "preview-target" : "idle"}
        data-surface-active={isSurfaceActive ? "true" : "false"}
        className={cn(
          "relative aspect-[3/4] overflow-hidden rounded-[22px] border bg-card/75 transition",
          isDragged
            ? "z-10 cursor-grabbing border-primary/60 opacity-85 ring-2 ring-primary/25 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.45)]"
            : isPreviewTarget
              ? "cursor-grab border-primary/60 ring-2 ring-primary/15"
              : "cursor-grab border-border/50",
          isSurfaceActive ? "shadow-[0_18px_46px_-28px_rgba(0,0,0,0.55)]" : "",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        )}
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
              {"P\u00E1gina "}
              {index + 1}
            </Badge>
          </div>
          <div
            className="pointer-events-auto relative flex h-7 min-w-[168px] justify-end"
            data-testid={`${testIdPrefix}-top-actions-${index}`}
            data-actions-visible={areActionsVisible ? "true" : "false"}
          >
            <div
              className={cn(
                "pointer-events-none absolute right-0 top-0 flex items-start justify-end gap-2 transition-opacity duration-150",
                isSurfaceActive ? "opacity-0" : "opacity-100",
              )}
              data-testid={`${testIdPrefix}-status-badges-${index}`}
            >
              {isCover ? (
                <Badge
                  variant="default"
                  className="rounded-full px-2.5 py-1 text-[10px] uppercase leading-none tracking-[0.12em] shadow-sm backdrop-blur-sm"
                  data-testid={`${testIdPrefix}-cover-badge-${index}`}
                >
                  Capa
                </Badge>
              ) : null}
              {isSpread ? (
                <Badge
                  variant="default"
                  className="rounded-full px-2.5 py-1 text-[10px] uppercase leading-none tracking-[0.12em] shadow-sm backdrop-blur-sm"
                  data-testid={`${testIdPrefix}-spread-badge-${index}`}
                >
                  Spread
                </Badge>
              ) : null}
            </div>
            <div
              className={cn(
                "absolute right-0 top-0 z-10 flex items-start gap-2 transition-opacity duration-150",
                areActionsVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
              )}
              data-testid={`${testIdPrefix}-actions-${index}`}
              onMouseEnter={() => setIsActionsHovered(true)}
              onMouseLeave={() => setIsActionsHovered(false)}
              onFocus={handleActionsFocus}
              onBlur={handleActionsBlur}
            >
              {isSpread && onUnsetSpread ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={onUnsetSpread}
                  onPointerDown={stopActionPointerPropagation}
                  onKeyDown={stopActionKeyPropagation}
                  disabled={disabled}
                  className="h-9 w-9 rounded-full border border-border/60 bg-background/90 shadow-sm"
                >
                  <Link2Off className="h-4 w-4" />
                  <span className="sr-only">Desfazer spread</span>
                </Button>
              ) : !isSpread && canJoinWithNext && onJoinSpread ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={onJoinSpread}
                  onPointerDown={stopActionPointerPropagation}
                  onKeyDown={stopActionKeyPropagation}
                  disabled={disabled}
                  className="h-9 w-9 rounded-full border border-border/60 bg-background/90 shadow-sm"
                >
                  <Columns2 className="h-4 w-4" />
                  <span className="sr-only">Juntar com a pr\u00F3xima</span>
                </Button>
              ) : null}
              {!isCover && onSetCover ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={onSetCover}
                  onPointerDown={stopActionPointerPropagation}
                  onKeyDown={stopActionKeyPropagation}
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
                onPointerDown={stopActionPointerPropagation}
                onKeyDown={stopActionKeyPropagation}
                disabled={disabled}
                className="h-9 w-9 rounded-full border border-border/60 bg-background/90 text-destructive shadow-sm hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Remover</span>
              </Button>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-3 pb-3 pt-12 transition duration-150",
            isSurfaceActive ? "opacity-100" : "opacity-0",
          )}
        >
          <span
            className="block truncate text-xs font-medium text-white"
            data-testid={`${testIdPrefix}-filename-${index}`}
          >
            {displayName}
          </span>
        </div>
      </div>
    </motion.article>
  );
};

export default MangaPageTile;
