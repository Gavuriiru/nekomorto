import type { CSSProperties } from "react";

import type { UploadFocalCropRect } from "@/lib/upload-focal-points";

export const FOCAL_CROP_BORDER_OFFSET_PX = 2;
export const MIN_FOCAL_CROP_DISPLAY_PX = 32;
export const FOCAL_CROP_HANDLE_KEYS = ["nw", "ne", "sw", "se"] as const;

export type FocalCropHandle = (typeof FOCAL_CROP_HANDLE_KEYS)[number];

export const areFocalCropRectsEqual = (left: UploadFocalCropRect, right: UploadFocalCropRect) =>
  Math.abs(left.left - right.left) < 0.0001 &&
  Math.abs(left.top - right.top) < 0.0001 &&
  Math.abs(left.width - right.width) < 0.0001 &&
  Math.abs(left.height - right.height) < 0.0001;

export const buildFocalPreviewImageStyle = ({ rect }: { rect: UploadFocalCropRect }) => ({
  width: `${(1 / Math.max(rect.width, Number.EPSILON)) * 100}%`,
  height: `${(1 / Math.max(rect.height, Number.EPSILON)) * 100}%`,
  left: `-${(rect.left / Math.max(rect.width, Number.EPSILON)) * 100}%`,
  top: `-${(rect.top / Math.max(rect.height, Number.EPSILON)) * 100}%`,
});

export const buildMovedFocalCrop = ({
  clientX,
  clientY,
  fitRectHeight,
  fitRectWidth,
  startClientX,
  startClientY,
  startCrop,
}: {
  clientX: number;
  clientY: number;
  fitRectHeight: number;
  fitRectWidth: number;
  startClientX: number;
  startClientY: number;
  startCrop: UploadFocalCropRect;
}): UploadFocalCropRect => {
  const deltaXNorm = (clientX - startClientX) / fitRectWidth;
  const deltaYNorm = (clientY - startClientY) / fitRectHeight;
  return {
    left: Math.min(1 - startCrop.width, Math.max(0, startCrop.left + deltaXNorm)),
    top: Math.min(1 - startCrop.height, Math.max(0, startCrop.top + deltaYNorm)),
    width: startCrop.width,
    height: startCrop.height,
  };
};

export const buildResizedFocalCrop = ({
  activeAspectRatio,
  clientX,
  clientY,
  fitRectHeight,
  fitRectLeft,
  fitRectTop,
  fitRectWidth,
  frameLeft,
  frameTop,
  handle,
  startCrop,
}: {
  activeAspectRatio: number;
  clientX: number;
  clientY: number;
  fitRectHeight: number;
  fitRectLeft: number;
  fitRectTop: number;
  fitRectWidth: number;
  frameLeft: number;
  frameTop: number;
  handle: FocalCropHandle;
  startCrop: UploadFocalCropRect;
}): UploadFocalCropRect => {
  const localX = Math.min(fitRectWidth, Math.max(0, clientX - frameLeft - fitRectLeft));
  const localY = Math.min(fitRectHeight, Math.max(0, clientY - frameTop - fitRectTop));
  const startLeftPx = startCrop.left * fitRectWidth;
  const startTopPx = startCrop.top * fitRectHeight;
  const startWidthPx = startCrop.width * fitRectWidth;
  const startHeightPx = startCrop.height * fitRectHeight;
  const startRightPx = startLeftPx + startWidthPx;
  const startBottomPx = startTopPx + startHeightPx;
  const anchorX = handle === "nw" || handle === "sw" ? startRightPx : startLeftPx;
  const anchorY = handle === "nw" || handle === "ne" ? startBottomPx : startTopPx;
  const maxWidthPx = handle === "nw" || handle === "sw" ? anchorX : fitRectWidth - anchorX;
  const maxHeightPx = handle === "nw" || handle === "ne" ? anchorY : fitRectHeight - anchorY;
  const minWidthPx = Math.min(fitRectWidth, MIN_FOCAL_CROP_DISPLAY_PX);
  const minHeightPx = Math.min(fitRectHeight, MIN_FOCAL_CROP_DISPLAY_PX);
  const maxAllowedWidthPx = Math.max(0, Math.min(maxWidthPx, maxHeightPx * activeAspectRatio));
  const minAllowedWidthPx = Math.min(
    maxAllowedWidthPx,
    Math.max(minWidthPx, minHeightPx * activeAspectRatio),
  );
  const rawWidthPx = Math.abs(localX - anchorX);
  const rawHeightPx = Math.abs(localY - anchorY);
  const requestedWidthPx = Math.min(rawWidthPx, rawHeightPx * activeAspectRatio, maxAllowedWidthPx);
  const nextWidthPx = Math.max(minAllowedWidthPx, requestedWidthPx);
  const nextHeightPx = nextWidthPx / activeAspectRatio;
  let nextLeftPx = anchorX;
  let nextTopPx = anchorY;

  if (handle === "nw") {
    nextLeftPx = anchorX - nextWidthPx;
    nextTopPx = anchorY - nextHeightPx;
  } else if (handle === "ne") {
    nextTopPx = anchorY - nextHeightPx;
  } else if (handle === "sw") {
    nextLeftPx = anchorX - nextWidthPx;
  }

  return {
    left: nextLeftPx / fitRectWidth,
    top: nextTopPx / fitRectHeight,
    width: nextWidthPx / fitRectWidth,
    height: nextHeightPx / fitRectHeight,
  };
};

export const getFocalCropHandleStyle = (handle: FocalCropHandle): CSSProperties => {
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
