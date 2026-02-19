import { useMemo } from "react";
import { isIconUrlSource, sanitizeIconSource } from "@/lib/url-safety";

type ThemedSvgLogoProps = {
  url: string;
  label: string;
  className?: string;
  color?: string;
};

const ThemedSvgLogo = ({ url, label, className, color }: ThemedSvgLogoProps) => {
  const safeUrl = useMemo(() => {
    const sanitized = sanitizeIconSource(url);
    if (!sanitized || !isIconUrlSource(sanitized)) {
      return null;
    }
    return sanitized;
  }, [url]);
  const wrapperStyle = color ? { color } : undefined;

  if (!safeUrl) {
    return null;
  }

  return (
    <img
      src={safeUrl}
      alt={label}
      className={className}
      style={wrapperStyle}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
    />
  );
};

export default ThemedSvgLogo;
