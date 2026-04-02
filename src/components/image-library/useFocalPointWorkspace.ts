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
import {
  areFocalCropRectsEqual,
  buildMovedFocalCrop,
  buildResizedFocalCrop,
  type FocalCropHandle,
} from "./focal-point-workspace";

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
        updateActivePresetCrop(
          buildMovedFocalCrop({
            clientX,
            clientY,
            fitRectHeight: fitRect.height,
            fitRectWidth: fitRect.width,
            startClientX: interaction.startClientX,
            startClientY: interaction.startClientY,
            startCrop: interaction.startCrop,
          }),
        );
        return;
      }

      const frame = frameRef.current;
      if (!frame) {
        return;
      }

      const frameRect = frame.getBoundingClientRect();
      updateActivePresetCrop(
        buildResizedFocalCrop({
          activeAspectRatio: activePresetDimensions.width / activePresetDimensions.height,
          clientX,
          clientY,
          fitRectHeight: fitRect.height,
          fitRectLeft: fitRect.left,
          fitRectTop: fitRect.top,
          fitRectWidth: fitRect.width,
          frameLeft: frameRect.left,
          frameTop: frameRect.top,
          handle: interaction.handle,
          startCrop: interaction.startCrop,
        }),
      );
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
