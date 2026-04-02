import type { CSSProperties } from "react";

import type { UploadFocalCropRect } from "@/lib/upload-focal-points";

export const FOCAL_CROP_BORDER_OFFSET_PX = 2;
export const FOCAL_CROP_HANDLE_KEYS = ["nw", "ne", "sw", "se"] as const;

export type FocalCropHandle = (typeof FOCAL_CROP_HANDLE_KEYS)[number];

export const buildFocalPreviewImageStyle = ({ rect }: { rect: UploadFocalCropRect }) => ({
  width: `${(1 / Math.max(rect.width, Number.EPSILON)) * 100}%`,
  height: `${(1 / Math.max(rect.height, Number.EPSILON)) * 100}%`,
  left: `-${(rect.left / Math.max(rect.width, Number.EPSILON)) * 100}%`,
  top: `-${(rect.top / Math.max(rect.height, Number.EPSILON)) * 100}%`,
});

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
