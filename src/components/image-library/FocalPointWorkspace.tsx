import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";

import type { LibraryImageItem } from "@/components/image-library/types";
import {
  computeUploadContainFitRect,
  UPLOAD_FOCAL_PRESET_KEYS,
  UPLOAD_VARIANT_PRESET_DIMENSIONS,
  normalizeUploadFocalCropRect,
  type UploadFocalCropRect,
  type UploadFocalCrops,
  type UploadFocalPresetKey,
} from "@/lib/upload-focal-points";

import { toEffectiveName } from "./utils";

const buildFocalPreviewImageStyle = ({ rect }: { rect: UploadFocalCropRect }) => ({
  width: `${(1 / Math.max(rect.width, Number.EPSILON)) * 100}%`,
  height: `${(1 / Math.max(rect.height, Number.EPSILON)) * 100}%`,
  left: `-${(rect.left / Math.max(rect.width, Number.EPSILON)) * 100}%`,
  top: `-${(rect.top / Math.max(rect.height, Number.EPSILON)) * 100}%`,
});

const areFocalCropRectsEqual = (left: UploadFocalCropRect, right: UploadFocalCropRect) =>
  Math.abs(left.left - right.left) < 0.0001 &&
  Math.abs(left.top - right.top) < 0.0001 &&
  Math.abs(left.width - right.width) < 0.0001 &&
  Math.abs(left.height - right.height) < 0.0001;

const MIN_FOCAL_CROP_DISPLAY_PX = 32;
const FOCAL_CROP_BORDER_OFFSET_PX = 2;
const FOCAL_CROP_HANDLE_KEYS = ["nw", "ne", "sw", "se"] as const;

type FocalCropHandle = (typeof FOCAL_CROP_HANDLE_KEYS)[number];

type FocalCropInteraction =
  | {
      mode: "move";
      pointerId: number | null;
      startClientX: number;
      startClientY: number;
      startCrop: UploadFocalCropRect;
    }
  | {
      mode: "resize";
      pointerId: number | null;
      handle: FocalCropHandle;
      startCrop: UploadFocalCropRect;
    };

const getFocalCropHandleStyle = (handle: FocalCropHandle): CSSProperties => {
  if (handle === "nw") {
    return {
      left: -FOCAL_CROP_BORDER_OFFSET_PX,
      top: -FOCAL_CROP_BORDER_OFFSET_PX,
      cursor: "nwse-resize",
      transform: "translate(-50%, -50%)",
    };
  }
  if (handle === "ne") {
    return {
      right: -FOCAL_CROP_BORDER_OFFSET_PX,
      top: -FOCAL_CROP_BORDER_OFFSET_PX,
      cursor: "nesw-resize",
      transform: "translate(50%, -50%)",
    };
  }
  if (handle === "sw") {
    return {
      left: -FOCAL_CROP_BORDER_OFFSET_PX,
      bottom: -FOCAL_CROP_BORDER_OFFSET_PX,
      cursor: "nesw-resize",
      transform: "translate(-50%, 50%)",
    };
  }
  return {
    right: -FOCAL_CROP_BORDER_OFFSET_PX,
    bottom: -FOCAL_CROP_BORDER_OFFSET_PX,
    cursor: "nwse-resize",
    transform: "translate(50%, 50%)",
  };
};

export type FocalPointWorkspaceProps = {
  item: LibraryImageItem;
  renderUrl: string;
  draft: UploadFocalCrops;
  activePreset: UploadFocalPresetKey;
  onDraftChange: (next: UploadFocalCrops) => void;
  onActivePresetChange: (preset: UploadFocalPresetKey) => void;
};

const FocalPointWorkspace = ({
  item,
  renderUrl,
  draft,
  activePreset,
  onDraftChange,
  onActivePresetChange,
}: FocalPointWorkspaceProps) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState(() => ({
    width: typeof item.width === "number" ? Math.max(0, item.width) : 0,
    height: typeof item.height === "number" ? Math.max(0, item.height) : 0,
  }));
  const [interaction, setInteraction] = useState<FocalCropInteraction | null>(null);
  const activeCrop = draft[activePreset];
  const activePresetDimensions = UPLOAD_VARIANT_PRESET_DIMENSIONS[activePreset];
  const activeAspectRatio = activePresetDimensions.width / activePresetDimensions.height;

  const syncStageMetrics = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    const frameRect = frame.getBoundingClientRect();
    const nextSize = {
      width: Math.max(0, frameRect.width),
      height: Math.max(0, frameRect.height),
    };
    setStageSize((prev) =>
      prev.width === nextSize.width && prev.height === nextSize.height ? prev : nextSize,
    );
  }, []);

  const handleImageLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      const naturalWidth = Number(image.naturalWidth || 0);
      const naturalHeight = Number(image.naturalHeight || 0);
      if (naturalWidth > 0 && naturalHeight > 0) {
        setNaturalSize((prev) =>
          prev.width === naturalWidth && prev.height === naturalHeight
            ? prev
            : { width: naturalWidth, height: naturalHeight },
        );
      }
      syncStageMetrics();
    },
    [syncStageMetrics],
  );

  useEffect(() => {
    setNaturalSize({
      width: typeof item.width === "number" ? Math.max(0, item.width) : 0,
      height: typeof item.height === "number" ? Math.max(0, item.height) : 0,
    });
  }, [item.height, item.width, renderUrl]);

  useEffect(() => {
    setInteraction(null);
  }, [activePreset, renderUrl]);

  useEffect(() => {
    const frame = frameRef.current;
    const rafId = window.requestAnimationFrame(() => {
      syncStageMetrics();
    });
    if (!frame) {
      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => {
        syncStageMetrics();
      });
      observer.observe(frame);
      return () => {
        window.cancelAnimationFrame(rafId);
        observer.disconnect();
      };
    }

    window.addEventListener("resize", syncStageMetrics);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", syncStageMetrics);
    };
  }, [renderUrl, syncStageMetrics]);

  const updateActivePresetCrop = useCallback(
    (nextCrop: UploadFocalCropRect) => {
      const normalizedCrop = normalizeUploadFocalCropRect(nextCrop, draft[activePreset]);
      if (areFocalCropRectsEqual(draft[activePreset], normalizedCrop)) {
        return;
      }
      onDraftChange({
        ...draft,
        [activePreset]: normalizedCrop,
      });
    },
    [activePreset, draft, onDraftChange],
  );

  const sourceWidth = naturalSize.width > 0 ? naturalSize.width : 1;
  const sourceHeight = naturalSize.height > 0 ? naturalSize.height : 1;
  const fitRect = useMemo(
    () =>
      computeUploadContainFitRect({
        stageWidth: stageSize.width,
        stageHeight: stageSize.height,
        sourceWidth,
        sourceHeight,
      }),
    [sourceHeight, sourceWidth, stageSize.height, stageSize.width],
  );

  const activeCropDisplayRect = useMemo(() => {
    if (fitRect.width <= 0 || fitRect.height <= 0) {
      return null;
    }
    return {
      left: activeCrop.left * fitRect.width,
      top: activeCrop.top * fitRect.height,
      width: activeCrop.width * fitRect.width,
      height: activeCrop.height * fitRect.height,
    };
  }, [
    activeCrop.height,
    activeCrop.left,
    activeCrop.top,
    activeCrop.width,
    fitRect.height,
    fitRect.width,
  ]);

  const syncInteractionFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!interaction || fitRect.width <= 0 || fitRect.height <= 0) {
        return;
      }

      if (interaction.mode === "move") {
        const deltaXNorm = (clientX - interaction.startClientX) / fitRect.width;
        const deltaYNorm = (clientY - interaction.startClientY) / fitRect.height;
        updateActivePresetCrop({
          left: Math.min(
            1 - interaction.startCrop.width,
            Math.max(0, interaction.startCrop.left + deltaXNorm),
          ),
          top: Math.min(
            1 - interaction.startCrop.height,
            Math.max(0, interaction.startCrop.top + deltaYNorm),
          ),
          width: interaction.startCrop.width,
          height: interaction.startCrop.height,
        });
        return;
      }

      const frame = frameRef.current;
      if (!frame) {
        return;
      }

      const frameRect = frame.getBoundingClientRect();
      const localX = Math.min(fitRect.width, Math.max(0, clientX - frameRect.left - fitRect.left));
      const localY = Math.min(fitRect.height, Math.max(0, clientY - frameRect.top - fitRect.top));
      const startLeftPx = interaction.startCrop.left * fitRect.width;
      const startTopPx = interaction.startCrop.top * fitRect.height;
      const startWidthPx = interaction.startCrop.width * fitRect.width;
      const startHeightPx = interaction.startCrop.height * fitRect.height;
      const startRightPx = startLeftPx + startWidthPx;
      const startBottomPx = startTopPx + startHeightPx;
      const anchorX =
        interaction.handle === "nw" || interaction.handle === "sw" ? startRightPx : startLeftPx;
      const anchorY =
        interaction.handle === "nw" || interaction.handle === "ne" ? startBottomPx : startTopPx;
      const maxWidthPx =
        interaction.handle === "nw" || interaction.handle === "sw"
          ? anchorX
          : fitRect.width - anchorX;
      const maxHeightPx =
        interaction.handle === "nw" || interaction.handle === "ne"
          ? anchorY
          : fitRect.height - anchorY;
      const minWidthPx = Math.min(fitRect.width, MIN_FOCAL_CROP_DISPLAY_PX);
      const minHeightPx = Math.min(fitRect.height, MIN_FOCAL_CROP_DISPLAY_PX);
      const maxAllowedWidthPx = Math.max(0, Math.min(maxWidthPx, maxHeightPx * activeAspectRatio));
      const minAllowedWidthPx = Math.min(
        maxAllowedWidthPx,
        Math.max(minWidthPx, minHeightPx * activeAspectRatio),
      );
      const rawWidthPx = Math.abs(localX - anchorX);
      const rawHeightPx = Math.abs(localY - anchorY);
      const requestedWidthPx = Math.min(
        rawWidthPx,
        rawHeightPx * activeAspectRatio,
        maxAllowedWidthPx,
      );
      const nextWidthPx = Math.max(minAllowedWidthPx, requestedWidthPx);
      const nextHeightPx = nextWidthPx / activeAspectRatio;
      let nextLeftPx = anchorX;
      let nextTopPx = anchorY;

      if (interaction.handle === "nw") {
        nextLeftPx = anchorX - nextWidthPx;
        nextTopPx = anchorY - nextHeightPx;
      } else if (interaction.handle === "ne") {
        nextTopPx = anchorY - nextHeightPx;
      } else if (interaction.handle === "sw") {
        nextLeftPx = anchorX - nextWidthPx;
      }

      updateActivePresetCrop({
        left: nextLeftPx / fitRect.width,
        top: nextTopPx / fitRect.height,
        width: nextWidthPx / fitRect.width,
        height: nextHeightPx / fitRect.height,
      });
    },
    [
      activeAspectRatio,
      fitRect.height,
      fitRect.left,
      fitRect.top,
      fitRect.width,
      interaction,
      updateActivePresetCrop,
    ],
  );

  const handleStagePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        !interaction ||
        (interaction.pointerId !== null &&
          event.pointerId > 0 &&
          event.pointerId !== interaction.pointerId)
      ) {
        return;
      }
      event.preventDefault();
      syncInteractionFromPointer(event.clientX, event.clientY);
    },
    [interaction, syncInteractionFromPointer],
  );

  const handleStagePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        !interaction ||
        (interaction.pointerId !== null &&
          event.pointerId > 0 &&
          event.pointerId !== interaction.pointerId)
      ) {
        return;
      }
      event.preventDefault();
      const frame = frameRef.current;
      if (frame && interaction.pointerId !== null && interaction.pointerId > 0) {
        try {
          frame.releasePointerCapture(interaction.pointerId);
        } catch {
          // Ignore unsupported pointer-capture environments.
        }
      }
      setInteraction(null);
    },
    [interaction],
  );

  const beginMoveInteraction = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (fitRect.width <= 0 || fitRect.height <= 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const frame = frameRef.current;
      if (frame && event.pointerId > 0) {
        try {
          frame.setPointerCapture(event.pointerId);
        } catch {
          // Ignore unsupported pointer-capture environments.
        }
      }
      setInteraction({
        mode: "move",
        pointerId: event.pointerId > 0 ? event.pointerId : null,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCrop: activeCrop,
      });
    },
    [activeCrop, fitRect.height, fitRect.width],
  );

  const beginResizeInteraction = useCallback(
    (handle: FocalCropHandle, event: ReactPointerEvent<HTMLDivElement>) => {
      if (fitRect.width <= 0 || fitRect.height <= 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const frame = frameRef.current;
      if (frame && event.pointerId > 0) {
        try {
          frame.setPointerCapture(event.pointerId);
        } catch {
          // Ignore unsupported pointer-capture environments.
        }
      }
      setInteraction({
        mode: "resize",
        handle,
        pointerId: event.pointerId > 0 ? event.pointerId : null,
        startCrop: activeCrop,
      });
    },
    [activeCrop, fitRect.height, fitRect.width],
  );

  return (
    <div
      data-testid="focal-layout"
      className="grid min-h-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]"
    >
      <aside
        data-testid="focal-sidebar"
        className="flex min-h-0 flex-col gap-3 rounded-xl border border-border/60 bg-card/60 p-3"
      >
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Presets</p>
          <p className="text-xs text-muted-foreground">
            Selecione um preset para editar. OG e CARDWIDE continuam derivados de CARD.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {UPLOAD_FOCAL_PRESET_KEYS.map((preset) => {
            const dimensions = UPLOAD_VARIANT_PRESET_DIMENSIONS[preset];
            const isActive = preset === activePreset;
            return (
              <button
                key={preset}
                type="button"
                className={`w-full rounded-xl border p-2 text-left transition ${
                  isActive
                    ? "border-primary/60 bg-primary/10 ring-2 ring-primary/40"
                    : "border-border/60 bg-card/60 hover:border-primary/40"
                }`}
                onClick={() => onActivePresetChange(preset)}
              >
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold uppercase text-foreground">{preset}</span>
                  <span>
                    {dimensions.width}x{dimensions.height}
                  </span>
                </div>
                <div
                  data-testid={`focal-preview-${preset}`}
                  className="relative overflow-hidden rounded-lg border border-border/40 bg-background/60"
                  style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
                >
                  <img
                    src={renderUrl}
                    alt=""
                    aria-hidden="true"
                    data-testid={`focal-preview-${preset}-image`}
                    className="pointer-events-none absolute max-w-none select-none"
                    style={buildFocalPreviewImageStyle({ rect: draft[preset] })}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section
        data-testid="focal-editor-panel"
        className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border/60 bg-card/60 p-3 lg:p-4"
      >
        <p className="mb-1 text-sm font-medium text-foreground">
          Preset ativo: {activePreset.toUpperCase()}
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Arraste e redimensione a caixa para definir o enquadramento final.
        </p>
        <div
          ref={frameRef}
          data-testid="focal-stage"
          className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-background/40"
          style={{ height: "min(68vh, 46rem)" }}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerEnd}
          onPointerCancel={handleStagePointerEnd}
        >
          <div
            data-testid="focal-image-shell"
            className="absolute"
            style={{
              left: `${fitRect.left}px`,
              top: `${fitRect.top}px`,
              width: `${fitRect.width}px`,
              height: `${fitRect.height}px`,
            }}
          >
            <img
              src={renderUrl}
              alt={toEffectiveName(item)}
              data-testid="focal-stage-image"
              className="pointer-events-none block h-full w-full select-none object-contain object-center"
              draggable={false}
              onLoad={handleImageLoad}
            />
            {activeCropDisplayRect ? (
              <div
                data-testid="focal-crop-body"
                className="absolute border-2 border-primary/70 bg-primary/10"
                style={{
                  left: `${activeCropDisplayRect.left}px`,
                  top: `${activeCropDisplayRect.top}px`,
                  width: `${activeCropDisplayRect.width}px`,
                  height: `${activeCropDisplayRect.height}px`,
                  cursor: interaction?.mode === "move" ? "grabbing" : "grab",
                  touchAction: "none",
                }}
                onPointerDown={beginMoveInteraction}
              >
                {FOCAL_CROP_HANDLE_KEYS.map((handle) => {
                  return (
                    <div
                      key={handle}
                      data-testid={`focal-crop-handle-${handle}`}
                      className="absolute z-10 h-4 w-4 rounded-full border-2 border-background bg-primary shadow"
                      style={{
                        ...getFocalCropHandleStyle(handle),
                        touchAction: "none",
                      }}
                      onPointerDown={(event) => beginResizeInteraction(handle, event)}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
};

export default FocalPointWorkspace;
