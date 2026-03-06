import type { ImgHTMLAttributes, SyntheticEvent } from "react";
import { useEffect, useState } from "react";

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
  const [variantsDisabled, setVariantsDisabled] = useState(false);
  const variantSources = resolveUploadVariantSources({ src, preset, mediaVariants });
  const responsiveVariantSources = resolveUploadVariantResponsiveSources({
    src,
    preset,
    mediaVariants,
  });
  const focalPoint = applyFocalObjectPosition
    ? resolveUploadVariantFocalPoint({ src, preset, mediaVariants })
    : null;
  const normalizedOriginalSrc = normalizeAssetUrl(src) || "/placeholder.svg";
  const avifSrc = normalizeAssetUrl(variantSources.avif);
  const webpSrc = normalizeAssetUrl(variantSources.webp);
  const avifSrcSet = normalizeSrcSet(responsiveVariantSources.avifSrcSet);
  const webpSrcSet = normalizeSrcSet(responsiveVariantSources.webpSrcSet);
  const fallbackSrcSet = normalizeSrcSet(responsiveVariantSources.fallbackSrcSet);
  const variantFallbackSrc = normalizeAssetUrl(variantSources.fallback || src) || "/placeholder.svg";
  const resolvedAvifSrcSet = avifSrcSet || avifSrc;
  const resolvedWebpSrcSet = webpSrcSet || webpSrc;
  const resolvedFallbackSrcSet = fallbackSrcSet || variantFallbackSrc;
  const hasVariantSources = Boolean(
    resolvedAvifSrcSet || resolvedWebpSrcSet || variantFallbackSrc !== normalizedOriginalSrc,
  );
  const shouldUseVariants = hasVariantSources && !variantsDisabled;
  const imgSrc = shouldUseVariants ? variantFallbackSrc : normalizedOriginalSrc;
  const imgSrcSet = shouldUseVariants ? resolvedFallbackSrcSet : imgProps.srcSet;
  const imgStyle = {
    ...(imgProps.style || {}),
    ...(focalPoint
      ? {
          objectPosition: `${focalPoint.x * 100}% ${focalPoint.y * 100}%`,
        }
      : {}),
  };
  const { onError, srcSet: _imgPropsSrcSet, ...restImgProps } = imgProps;

  useEffect(() => {
    setVariantsDisabled(false);
  }, [src, preset, mediaVariants]);

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    if (shouldUseVariants) {
      setVariantsDisabled(true);
      return;
    }
    onError?.(event);
  };

  return (
    <picture className={className}>
      {shouldUseVariants && resolvedAvifSrcSet ? (
        <source type="image/avif" srcSet={resolvedAvifSrcSet} sizes={sizes} />
      ) : null}
      {shouldUseVariants && resolvedWebpSrcSet ? (
        <source type="image/webp" srcSet={resolvedWebpSrcSet} sizes={sizes} />
      ) : null}
      <img
        {...restImgProps}
        src={imgSrc}
        srcSet={imgSrcSet}
        sizes={sizes}
        alt={alt || ""}
        style={imgStyle}
        className={imgClassName}
        loading={loading}
        decoding={decoding}
        onError={handleError}
      />
    </picture>
  );
};

export default UploadPicture;
