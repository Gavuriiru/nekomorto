import { useEffect, useMemo, useState } from "react";
import { isIconUrlSource, sanitizeIconSource } from "@/lib/url-safety";

type ThemedSvgMaskIconProps = {
  url: string;
  label: string;
  className?: string;
  color?: string;
};

const isSvgUrl = (value: string) => {
  const withoutHash = value.split("#")[0] || "";
  const withoutQuery = withoutHash.split("?")[0] || "";
  return withoutQuery.toLowerCase().endsWith(".svg");
};

const hasMaskSupport = () => {
  if (typeof window === "undefined" || typeof window.CSS?.supports !== "function") {
    return false;
  }
  return (
    window.CSS.supports("mask-image", "url('data:image/svg+xml,<svg></svg>')") ||
    window.CSS.supports("-webkit-mask-image", "url('data:image/svg+xml,<svg></svg>')")
  );
};

const ThemedSvgMaskIcon = ({ url, label, className, color }: ThemedSvgMaskIconProps) => {
  const safeUrl = useMemo(() => {
    const sanitized = sanitizeIconSource(url);
    if (!sanitized || !isIconUrlSource(sanitized)) {
      return null;
    }
    return sanitized;
  }, [url]);

  const shouldTryMask = useMemo(() => {
    if (!safeUrl || !isSvgUrl(safeUrl)) {
      return false;
    }
    return hasMaskSupport();
  }, [safeUrl]);

  const [maskReady, setMaskReady] = useState(false);

  useEffect(() => {
    if (!safeUrl || !shouldTryMask) {
      setMaskReady(false);
      return;
    }

    let isActive = true;
    const probe = new Image();
    probe.referrerPolicy = "no-referrer";
    probe.onload = () => {
      if (isActive) {
        setMaskReady(true);
      }
    };
    probe.onerror = () => {
      if (isActive) {
        setMaskReady(false);
      }
    };
    probe.src = safeUrl;

    return () => {
      isActive = false;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [safeUrl, shouldTryMask]);

  if (!safeUrl) {
    return null;
  }

  if (shouldTryMask && maskReady) {
    const maskUrl = `url("${safeUrl}")`;
    return (
      <span
        role="img"
        aria-label={label}
        className={className ? `inline-block ${className}` : "inline-block"}
        style={{
          backgroundColor: color || "currentColor",
          maskImage: maskUrl,
          WebkitMaskImage: maskUrl,
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
        }}
      />
    );
  }

  return (
    <img
      src={safeUrl}
      alt={label}
      className={className}
      style={color ? { color } : undefined}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
};

export default ThemedSvgMaskIcon;
