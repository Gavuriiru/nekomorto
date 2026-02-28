import type { ImgHTMLAttributes } from "react";

import { normalizeAssetUrl } from "@/lib/asset-url";
import {
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
};

const UploadPicture = ({
  src,
  alt,
  preset,
  mediaVariants,
  className,
  imgClassName,
  loading = "lazy",
  decoding = "async",
  ...imgProps
}: UploadPictureProps) => {
  const variantSources = resolveUploadVariantSources({ src, preset, mediaVariants });
  const avifSrc = normalizeAssetUrl(variantSources.avif);
  const webpSrc = normalizeAssetUrl(variantSources.webp);
  const fallbackSrc = normalizeAssetUrl(variantSources.fallback || src) || "/placeholder.svg";

  return (
    <picture className={className}>
      {avifSrc ? <source type="image/avif" srcSet={avifSrc} /> : null}
      {webpSrc ? <source type="image/webp" srcSet={webpSrc} /> : null}
      <img
        {...imgProps}
        src={fallbackSrc}
        alt={alt || ""}
        className={imgClassName}
        loading={loading}
        decoding={decoding}
      />
    </picture>
  );
};

export default UploadPicture;

