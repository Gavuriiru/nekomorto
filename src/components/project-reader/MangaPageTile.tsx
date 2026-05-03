import { motion, type Transition } from "framer-motion";
import { Columns2, Link2Off, Star, Trash2 } from "lucide-react";
import {
  type FocusEvent,
  type KeyboardEvent,
  memo,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import UploadPicture from "@/components/UploadPicture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UploadMediaVariantsMap } from "@/lib/upload-variants";
import { cn } from "@/lib/utils";

type InputModality = "keyboard" | "pointer";

type MangaPageTileProps = {
  testIdPrefix: string;
  src: string;
  actionId?: string;
  alt: string;
  displayName: string;
  index: number;
  spreadPairId?: string;
  isCover: boolean;
  isSpread: boolean;
  isDragged: boolean;
  isPreviewTarget: boolean;
  isPressed?: boolean;
  disabled: boolean;
  mediaVariants?: UploadMediaVariantsMap | null;
  canJoinWithNext?: boolean;
  reorderMotion: "spring" | "reduced";
  reorderTransition: Transition;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>, index: number) => void;
  onPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture?: (event: PointerEvent<HTMLDivElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>, index: number) => void;
  onJoinSpread?: (event: MouseEvent<HTMLButtonElement>, index: number) => void;
  onUnsetSpread?: (
    event: MouseEvent<HTMLButtonElement>,
    index: number,
    spreadPairId: string,
  ) => void;
  onSetCover?: (event: MouseEvent<HTMLButtonElement>, index: number, actionId: string) => void;
  onRemove: (event: MouseEvent<HTMLButtonElement>, index: number, actionId: string) => void;
};

let currentInputModality: InputModality = "pointer";
const inputModalitySubscribers = new Set<(modality: InputModality) => void>();
let stopInputModalityTracking: null | (() => void) = null;

const publishInputModality = (modality: InputModality) => {
  currentInputModality = modality;
  inputModalitySubscribers.forEach((notify) => notify(modality));
};

const ensureInputModalityTracking = () => {
  if (stopInputModalityTracking || typeof window === "undefined") {
    return;
  }

  const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey) {
      return;
    }
    publishInputModality("keyboard");
  };

  const handleWindowPointerDown = () => {
    publishInputModality("pointer");
  };

  window.addEventListener("keydown", handleWindowKeyDown, true);
  window.addEventListener("pointerdown", handleWindowPointerDown, true);

  stopInputModalityTracking = () => {
    window.removeEventListener("keydown", handleWindowKeyDown, true);
    window.removeEventListener("pointerdown", handleWindowPointerDown, true);
    stopInputModalityTracking = null;
  };
};

const subscribeToInputModality = (notify: (modality: InputModality) => void) => {
  ensureInputModalityTracking();
  inputModalitySubscribers.add(notify);
  notify(currentInputModality);

  return () => {
    inputModalitySubscribers.delete(notify);
    if (!inputModalitySubscribers.size) {
      stopInputModalityTracking?.();
      currentInputModality = "pointer";
    }
  };
};

const matchesFocusVisible = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.matches(":focus-visible");

const isKeyboardFocus = (target: EventTarget | null, modality: InputModality) =>
  modality === "keyboard" || matchesFocusVisible(target);

const MangaPageTile = ({
  testIdPrefix,
  src,
  actionId = src,
  alt,
  displayName,
  index,
  spreadPairId = "",
  isCover,
  isSpread,
  isDragged,
  isPreviewTarget,
  isPressed = false,
  disabled,
  mediaVariants,
  canJoinWithNext = false,
  reorderMotion,
  reorderTransition,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onKeyDown,
  onJoinSpread,
  onUnsetSpread,
  onSetCover,
  onRemove,
}: MangaPageTileProps) => {
  const inputModalityRef = useRef<InputModality>(currentInputModality);
  const [isSurfaceHovered, setIsSurfaceHovered] = useState(false);
  const [isSurfaceFocused, setIsSurfaceFocused] = useState(false);
  const [isActionsHovered, setIsActionsHovered] = useState(false);
  const [isActionsFocused, setIsActionsFocused] = useState(false);

  useEffect(
    () =>
      subscribeToInputModality((modality) => {
        inputModalityRef.current = modality;
      }),
    [],
  );

  const isSurfaceActive =
    (isSurfaceHovered || isSurfaceFocused || isPressed || isDragged) &&
    !isActionsHovered &&
    !isActionsFocused;
  const areActionsVisible =
    isSurfaceHovered || isSurfaceFocused || isActionsHovered || isActionsFocused;
  const areStatusBadgesVisible = !areActionsVisible;

  const clearKeyboardFocusState = () => {
    setIsSurfaceFocused(false);
    setIsActionsFocused(false);
  };

  const handleSurfaceFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (
      event.target === event.currentTarget &&
      isKeyboardFocus(event.currentTarget, inputModalityRef.current)
    ) {
      setIsSurfaceFocused(true);
      return;
    }

    setIsSurfaceFocused(false);
  };

  const handleSurfaceBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      setIsSurfaceFocused(false);
    }
  };

  const handleActionsFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (isKeyboardFocus(event.target, inputModalityRef.current)) {
      setIsActionsFocused(true);
      return;
    }

    setIsActionsFocused(false);
  };

  const handleActionsBlur = (event: FocusEvent<HTMLDivElement>) => {
    const relatedTarget = event.relatedTarget;
    if (!(relatedTarget instanceof Node) || !event.currentTarget.contains(relatedTarget)) {
      setIsActionsFocused(false);
    }
  };

  const handleSurfacePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    clearKeyboardFocusState();
    if (event.pointerType !== "mouse") {
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can fail in older browsers or test environments.
      }
    }
    onPointerDown?.(event, index);
  };

  const handleSurfacePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
  };

  const handleSurfaceMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    onPointerMove?.(event as unknown as PointerEvent<HTMLDivElement>);
  };

  const handleSurfacePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release failures for pointers that were already cancelled.
      }
    }
    onPointerUp?.(event);
  };

  const handleSurfaceMouseUp = (event: MouseEvent<HTMLDivElement>) => {
    onPointerUp?.(event as unknown as PointerEvent<HTMLDivElement>);
  };

  const handleSurfacePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release failures for pointers that were already cancelled.
      }
    }
    onPointerCancel?.(event);
  };

  const handleSurfaceLostPointerCapture = (event: PointerEvent<HTMLDivElement>) => {
    onLostPointerCapture?.(event);
  };

  const handleSurfaceContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const stopActionPointerPropagation = (event: PointerEvent<HTMLButtonElement>) => {
    clearKeyboardFocusState();
    event.stopPropagation();
  };

  const stopActionKeyPropagation = (event: KeyboardEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleSurfaceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown(event, index);
  };

  const handleJoinSpread = (event: MouseEvent<HTMLButtonElement>) => {
    onJoinSpread?.(event, index);
  };

  const handleUnsetSpread = (event: MouseEvent<HTMLButtonElement>) => {
    onUnsetSpread?.(event, index, spreadPairId);
  };

  const handleSetCover = (event: MouseEvent<HTMLButtonElement>) => {
    onSetCover?.(event, index, actionId);
  };

  const handleRemove = (event: MouseEvent<HTMLButtonElement>) => {
    onRemove(event, index, actionId);
  };

  return (
    <motion.article
      layout={isDragged ? false : "position"}
      transition={reorderTransition}
      className="group"
      data-testid={`${testIdPrefix}-card-${index}`}
      data-reorder-layout={!isDragged ? "animated" : "static"}
    >
      <div
        role="button"
        tabIndex={0}
        onKeyDown={handleSurfaceKeyDown}
        onPointerDown={handleSurfacePointerDown}
        onPointerMove={handleSurfacePointerMove}
        onPointerUp={handleSurfacePointerUp}
        onPointerCancel={handleSurfacePointerCancel}
        onLostPointerCapture={handleSurfaceLostPointerCapture}
        onContextMenu={handleSurfaceContextMenu}
        onMouseMove={handleSurfaceMouseMove}
        onMouseUp={handleSurfaceMouseUp}
        onMouseEnter={() => setIsSurfaceHovered(true)}
        onMouseLeave={() => setIsSurfaceHovered(false)}
        onFocus={handleSurfaceFocus}
        onBlur={handleSurfaceBlur}
        aria-label={`Arrastar página ${index + 1} para reordenar. Use Alt+Seta para mover pelo teclado.`}
        data-testid={`${testIdPrefix}-surface-${index}`}
        data-reorder-surface="true"
        data-reorder-scope={testIdPrefix}
        data-reorder-index={index}
        data-reorder-motion={reorderMotion}
        data-reorder-state={isDragged ? "dragging" : isPreviewTarget ? "preview-target" : "idle"}
        data-surface-active={isSurfaceActive ? "true" : "false"}
        className={cn(
          "relative aspect-[1/1.414] overflow-hidden rounded-[22px] border bg-card/75 select-none transition",
          isDragged
            ? "z-10 cursor-grabbing border-primary/60 opacity-85 ring-2 ring-primary/25 shadow-manga-page-dragging"
            : isPreviewTarget
              ? "cursor-grab border-primary/60 ring-2 ring-primary/15"
              : "cursor-grab border-border/50",
          isSurfaceActive ? "shadow-manga-page-active" : "",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        )}
        style={{
          touchAction: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
      >
        <UploadPicture
          src={src}
          alt={alt}
          preset="posterThumb"
          mediaVariants={mediaVariants}
          sizes="(min-width: 1280px) 200px, (min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          className="h-full w-full select-none"
          imgClassName="h-full w-full select-none object-cover object-top"
        />
        <div
          className="pointer-events-none absolute left-3 top-3 flex items-start"
          data-testid={`${testIdPrefix}-top-row-${index}`}
        >
          <Badge
            variant="secondary"
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] uppercase leading-none tracking-[0.12em] shadow-sm"
            data-testid={`${testIdPrefix}-position-badge-${index}`}
          >
            {"Página "}
            {index + 1}
          </Badge>
        </div>
        <div
          className={cn(
            "pointer-events-none absolute right-3 top-3 flex items-start justify-end gap-2 transition-opacity duration-150",
            areStatusBadgesVisible ? "opacity-100" : "opacity-0",
          )}
          data-testid={`${testIdPrefix}-status-badges-${index}`}
          data-status-badges-visible={areStatusBadgesVisible ? "true" : "false"}
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
          className="pointer-events-none absolute right-3 top-3 z-10 flex justify-end"
          data-testid={`${testIdPrefix}-top-actions-${index}`}
          data-actions-visible={areActionsVisible ? "true" : "false"}
        >
          <div
            className={cn(
              "flex items-start gap-2 transition-opacity duration-150",
              areActionsVisible
                ? "pointer-events-auto opacity-100"
                : "pointer-events-none opacity-0",
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
                onClick={handleUnsetSpread}
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
                onClick={handleJoinSpread}
                onPointerDown={stopActionPointerPropagation}
                onKeyDown={stopActionKeyPropagation}
                disabled={disabled}
                className="h-9 w-9 rounded-full border border-border/60 bg-background/90 shadow-sm"
              >
                <Columns2 className="h-4 w-4" />
                <span className="sr-only">Juntar com a próxima</span>
              </Button>
            ) : null}
            {!isCover && onSetCover ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={handleSetCover}
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
              onClick={handleRemove}
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

const areMangaPageTilePropsEqual = (previous: MangaPageTileProps, next: MangaPageTileProps) =>
  previous.testIdPrefix === next.testIdPrefix &&
  previous.src === next.src &&
  previous.actionId === next.actionId &&
  previous.alt === next.alt &&
  previous.displayName === next.displayName &&
  previous.index === next.index &&
  previous.spreadPairId === next.spreadPairId &&
  previous.isCover === next.isCover &&
  previous.isSpread === next.isSpread &&
  previous.isDragged === next.isDragged &&
  previous.isPreviewTarget === next.isPreviewTarget &&
  previous.isPressed === next.isPressed &&
  previous.disabled === next.disabled &&
  previous.mediaVariants === next.mediaVariants &&
  previous.canJoinWithNext === next.canJoinWithNext &&
  previous.reorderMotion === next.reorderMotion &&
  previous.reorderTransition === next.reorderTransition;

export default memo(MangaPageTile, areMangaPageTilePropsEqual);
