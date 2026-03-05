import type { ImgHTMLAttributes } from "react";

import { normalizeAssetUrl } from "@/lib/asset-url";
import {
  resolveUploadVariantFocalPoint,
  resolveUploadVariantResponsiveSources,
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

const normalizeSrcSet = (value: string | null | undefined) => {
  const srcSet = String(value || "").trim();
  if (!srcSet) {
    return "";
  }
  return srcSet
    .split(",")
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return "";
      }
      const [rawUrl, ...rest] = trimmed.split(/\s+/);
      const normalizedUrl = normalizeAssetUrl(rawUrl);
      const descriptor = rest.join(" ").trim();
      return descriptor ? `${normalizedUrl} ${descriptor}` : normalizedUrl;
    })
    .filter(Boolean)
    .join(", ");
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
  const responsiveVariantSources = resolveUploadVariantResponsiveSources({
    src,
    preset,
    mediaVariants,
  });
  const focalPoint = applyFocalObjectPosition
    ? resolveUploadVariantFocalPoint({ src, preset, mediaVariants })
    : null;
  const avifSrc = normalizeAssetUrl(variantSources.avif);
  const webpSrc = normalizeAssetUrl(variantSources.webp);
  const avifSrcSet = normalizeSrcSet(responsiveVariantSources.avifSrcSet);
  const webpSrcSet = normalizeSrcSet(responsiveVariantSources.webpSrcSet);
  const fallbackSrcSet = normalizeSrcSet(responsiveVariantSources.fallbackSrcSet);
  const fallbackSrc = normalizeAssetUrl(variantSources.fallback || src) || "/placeholder.svg";
  const resolvedAvifSrcSet = avifSrcSet || avifSrc;
  const resolvedWebpSrcSet = webpSrcSet || webpSrc;
  const resolvedFallbackSrcSet = fallbackSrcSet || fallbackSrc;
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
      {resolvedAvifSrcSet ? <source type="image/avif" srcSet={resolvedAvifSrcSet} sizes={sizes} /> : null}
      {resolvedWebpSrcSet ? <source type="image/webp" srcSet={resolvedWebpSrcSet} sizes={sizes} /> : null}
      <img
        {...imgProps}
        src={fallbackSrc}
        srcSet={resolvedFallbackSrcSet}
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
