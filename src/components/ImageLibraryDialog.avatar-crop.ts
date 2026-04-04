import type { FixedCropperRef } from "react-advanced-cropper";

export const AVATAR_CROPPER_BOUNDARY_SIZE = 320;

const CROPPER_OUTPUT_SIZE = 512;

export type AvatarCropperHandle = Pick<FixedCropperRef, "getCanvas">;

export const resolveAvatarCropStencilSize = (state?: {
  boundary?: { width?: number; height?: number };
}) => {
  const boundaryWidth = Number(state?.boundary?.width);
  const boundaryHeight = Number(state?.boundary?.height);
  const size = Math.max(
    1,
    Math.min(
      AVATAR_CROPPER_BOUNDARY_SIZE,
      Number.isFinite(boundaryWidth) && boundaryWidth > 0
        ? boundaryWidth
        : AVATAR_CROPPER_BOUNDARY_SIZE,
      Number.isFinite(boundaryHeight) && boundaryHeight > 0
        ? boundaryHeight
        : AVATAR_CROPPER_BOUNDARY_SIZE,
    ),
  );
  return {
    width: size,
    height: size,
  };
};

export const renderAvatarCropDataUrl = async (cropper: AvatarCropperHandle | null) => {
  const renderedCanvas = cropper?.getCanvas({
    width: CROPPER_OUTPUT_SIZE,
    height: CROPPER_OUTPUT_SIZE,
    fillColor: "transparent",
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
  });
  if (!renderedCanvas) {
    throw new Error("cropper_canvas_unavailable");
  }
  const normalizedDataUrl = String(renderedCanvas.toDataURL("image/png") || "").trim();
  if (!normalizedDataUrl) {
    throw new Error("empty_crop_result");
  }
  return normalizedDataUrl;
};
