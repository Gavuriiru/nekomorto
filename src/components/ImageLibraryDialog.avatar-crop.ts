import { drawCroppedArea } from "advanced-cropper";
import type { FixedCropperRef } from "react-advanced-cropper";

export const AVATAR_CROPPER_BOUNDARY_SIZE = 320;

const CROPPER_OUTPUT_SIZE = 512;

export type AvatarCropperHandle = Pick<
  FixedCropperRef,
  "getCoordinates" | "getImage" | "getState"
>;

const loadAvatarCropSourceImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const handleLoad = () => {
      image.onload = null;
      image.onerror = null;
      resolve(image);
    };
    const handleError = () => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("cropper_image_load_failed"));
    };
    image.onload = handleLoad;
    image.onerror = handleError;
    image.src = src;
  });

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

export const renderAvatarCropDataUrl = async (
  cropper: AvatarCropperHandle | null,
  fallbackSrc = "",
) => {
  const state = cropper?.getState();
  const coordinates = cropper?.getCoordinates();
  const cropperImage = cropper?.getImage();
  const imageSrc = String(cropperImage?.src || fallbackSrc || "").trim();
  if (!state || !coordinates || !cropperImage || !imageSrc) {
    throw new Error("cropper_state_unavailable");
  }
  if (coordinates.width <= 0 || coordinates.height <= 0) {
    throw new Error("cropper_coordinates_invalid");
  }
  const sourceImage = await loadAvatarCropSourceImage(imageSrc);
  const resultCanvas = document.createElement("canvas");
  const spareCanvas = document.createElement("canvas");
  const renderedCanvas = drawCroppedArea(
    {
      ...state,
      coordinates,
      transforms: state.transforms || cropperImage.transforms,
    },
    sourceImage,
    resultCanvas,
    spareCanvas,
    {
      width: CROPPER_OUTPUT_SIZE,
      height: CROPPER_OUTPUT_SIZE,
      fillColor: "transparent",
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    },
  );
  const normalizedDataUrl = String(renderedCanvas?.toDataURL("image/png") || "").trim();
  if (!normalizedDataUrl) {
    throw new Error("empty_crop_result");
  }
  return normalizedDataUrl;
};
