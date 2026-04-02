import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";

import type { LibraryImageItem } from "@/components/image-library/types";
import {
  computeUploadContainFitRect,
  normalizeUploadFocalCropRect,
  UPLOAD_VARIANT_PRESET_DIMENSIONS,
  type UploadFocalCropRect,
  type UploadFocalCrops,
  type UploadFocalPresetKey,
} from "@/lib/upload-focal-points";

import type { FocalCropHandle } from "./focal-point-workspace";

const MIN_FOCAL_CROP_DISPLAY_PX = 32;

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

const areFocalCropRectsEqual = (left: UploadFocalCropRect, right: UploadFocalCropRect) =>
  Math.abs(left.left - right.left) < 0.0001 &&
  Math.abs(left.top - right.top) < 0.0001 &&
  Math.abs(left.width - right.width) < 0.0001 &&
  Math.abs(left.height - right.height) < 0.0001;

type UseFocalPointWorkspaceParams = {
  activePreset: UploadFocalPresetKey;
  draft: UploadFocalCrops;
  item: LibraryImageItem;
  onDraftChange: (next: UploadFocalCrops) => void;
  renderUrl: string;
};

export const useFocalPointWorkspace = ({
  activePreset,
  draft,
  item,
  onDraftChange,
  renderUrl,
}: UseFocalPointWorkspaceParams) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState(() => ({
    width: typeof item.width === "number" ? Math.max(0, item.width) : 0,
    height: typeof item.height === "number" ? Math.max(0, item.height) : 0,
  }));
  const [interaction, setInteraction] = useState<FocalCropInteraction | null>(null);

  const activeCrop = draft[activePreset];

  const activePresetDimensions = useMemo(
    () => UPLOAD_VARIANT_PRESET_DIMENSIONS[activePreset],
    [activePreset],
  );

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
      const activeAspectRatio = activePresetDimensions.width / activePresetDimensions.height;
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
    [activePresetDimensions.height, activePresetDimensions.width, fitRect.height, fitRect.left, fitRect.top, fitRect.width, interaction, updateActivePresetCrop],
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

  return {
    activeCropDisplayRect,
    beginMoveInteraction,
    beginResizeInteraction,
    fitRect,
    frameRef,
    handleImageLoad,
    handleStagePointerEnd,
    handleStagePointerMove,
    interactionMode: interaction?.mode ?? null,
  };
};

export default useFocalPointWorkspace;
