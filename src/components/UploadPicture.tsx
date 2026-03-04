import type { ImgHTMLAttributes } from "react";

import { normalizeAssetUrl } from "@/lib/asset-url";
import {
  resolveUploadVariantFocalPoint,
  resolveUploadVariantSources,
  type UploadMediaVariantsMap,
  type UploadVariantPresetKey,
} from "@/lib/upload-variants";

type UploadPictureProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  preset: UploadVariantPresetKey;
  mediaVariants?: UploadMediaVariantsMap | null;
  className?: string;
  imgClassName?: string;
  applyFocalObjectPosition?: boolean;
};

const UploadPicture = ({
  src,
  alt,
  preset,
  mediaVariants,
  className,
  imgClassName,
  applyFocalObjectPosition = false,
  loading = "lazy",
  decoding = "async",
  sizes,
  ...imgProps
}: UploadPictureProps) => {
  const variantSources = resolveUploadVariantSources({ src, preset, mediaVariants });
  const focalPoint = applyFocalObjectPosition
    ? resolveUploadVariantFocalPoint({ src, preset, mediaVariants })
    : null;
  const avifSrc = normalizeAssetUrl(variantSources.avif);
  const webpSrc = normalizeAssetUrl(variantSources.webp);
  const fallbackSrc = normalizeAssetUrl(variantSources.fallback || src) || "/placeholder.svg";
  const imgStyle = {
    ...(imgProps.style || {}),
    ...(focalPoint
      ? {
          objectPosition: `${focalPoint.x * 100}% ${focalPoint.y * 100}%`,
        }
      : {}),
  };

  return (
    <picture className={className}>
      {avifSrc ? <source type="image/avif" srcSet={avifSrc} sizes={sizes} /> : null}
      {webpSrc ? <source type="image/webp" srcSet={webpSrc} sizes={sizes} /> : null}
      <img
        {...imgProps}
        src={fallbackSrc}
        srcSet={fallbackSrc}
        sizes={sizes}
        alt={alt || ""}
        style={imgStyle}
        className={imgClassName}
        loading={loading}
        decoding={decoding}
      />
    </picture>
  );
};

export default UploadPicture;
