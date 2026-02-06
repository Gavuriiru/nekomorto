import { useEffect, useMemo, useState } from "react";

type ThemedSvgLogoProps = {
  url: string;
  label: string;
  className?: string;
};

const isSvgUrl = (value: string) =>
  value.includes("image/svg+xml") || value.toLowerCase().endsWith(".svg");

const decodeDataSvg = (value: string) => {
  const [, meta, data] = value.match(/^data:(image\/svg\+xml)(;base64)?,(.+)$/i) || [];
  if (!meta || !data) {
    return null;
  }
  try {
    if (value.includes(";base64,")) {
      return atob(data);
    }
    return decodeURIComponent(data);
  } catch {
    return null;
  }
};

const parseStyleValue = (style: string, key: string) => {
  const match = style.match(new RegExp(`${key}\\s*:\\s*([^;]+)`, "i"));
  return match ? match[1]?.trim() : "";
};

const parseColor = (value: string) => {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  if (normalized.startsWith("#")) {
    const hex = normalized.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b, a: 1 };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b, a: 1 };
    }
  }
  const rgbMatch =
    normalized.match(/^rgba?\((\d+),(\d+),(\d+)(?:,([0-9.]+))?\)$/);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    const a = rgbMatch[4] ? Number(rgbMatch[4]) : 1;
    return { r, g, b, a };
  }
  if (normalized === "white") {
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  return null;
};

const isWhiteFill = (value: string) => {
  const parsed = parseColor(value);
  if (!parsed) {
    return false;
  }
  if (parsed.a !== undefined && parsed.a < 0.1) {
    return false;
  }
  return parsed.r >= 240 && parsed.g >= 240 && parsed.b >= 240;
};

const getSvgSize = (svg: SVGSVGElement) => {
  const viewBox = svg.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const width = parseFloat(svg.getAttribute("width") || "");
  const height = parseFloat(svg.getAttribute("height") || "");
  if (Number.isFinite(width) && Number.isFinite(height)) {
    return { width, height };
  }
  return null;
};

const shouldRemoveRect = (rect: SVGRectElement, svgSize: { width: number; height: number } | null) => {
  const widthAttr = rect.getAttribute("width") || "";
  const heightAttr = rect.getAttribute("height") || "";
  const widthIsFull = widthAttr === "100%" || (svgSize && parseFloat(widthAttr) >= svgSize.width);
  const heightIsFull = heightAttr === "100%" || (svgSize && parseFloat(heightAttr) >= svgSize.height);
  if (!widthIsFull || !heightIsFull) {
    return false;
  }
  const fillAttr = rect.getAttribute("fill") || "";
  const styleAttr = rect.getAttribute("style") || "";
  const styleFill = parseStyleValue(styleAttr, "fill");
  const fill = styleFill || fillAttr;
  return isWhiteFill(fill);
};

const shouldRemoveCircle = (circle: SVGCircleElement, svgSize: { width: number; height: number } | null) => {
  if (!svgSize) {
    return false;
  }
  const r = parseFloat(circle.getAttribute("r") || "");
  if (!Number.isFinite(r)) {
    return false;
  }
  const fillAttr = circle.getAttribute("fill") || "";
  const styleAttr = circle.getAttribute("style") || "";
  const styleFill = parseStyleValue(styleAttr, "fill");
  const fill = styleFill || fillAttr;
  if (!isWhiteFill(fill)) {
    return false;
  }
  const minDim = Math.min(svgSize.width, svgSize.height);
  return r >= minDim * 0.45;
};

const shouldRemoveEllipse = (ellipse: SVGEllipseElement, svgSize: { width: number; height: number } | null) => {
  if (!svgSize) {
    return false;
  }
  const rx = parseFloat(ellipse.getAttribute("rx") || "");
  const ry = parseFloat(ellipse.getAttribute("ry") || "");
  if (!Number.isFinite(rx) || !Number.isFinite(ry)) {
    return false;
  }
  const fillAttr = ellipse.getAttribute("fill") || "";
  const styleAttr = ellipse.getAttribute("style") || "";
  const styleFill = parseStyleValue(styleAttr, "fill");
  const fill = styleFill || fillAttr;
  if (!isWhiteFill(fill)) {
    return false;
  }
  const minDim = Math.min(svgSize.width, svgSize.height);
  return rx >= minDim * 0.45 && ry >= minDim * 0.45;
};

const normalizeSvg = (svgText: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) {
    return null;
  }

  svg.querySelectorAll("script, foreignObject").forEach((node) => node.remove());

  const svgStyle = svg.getAttribute("style") || "";
  const rootFill = parseStyleValue(svgStyle, "fill") || svg.getAttribute("fill") || "";
  const rootStroke = parseStyleValue(svgStyle, "stroke") || svg.getAttribute("stroke") || "";

  const svgSize = getSvgSize(svg);
  svg.querySelectorAll("rect").forEach((rect) => {
    if (shouldRemoveRect(rect as SVGRectElement, svgSize)) {
      rect.remove();
    }
  });
  svg.querySelectorAll("circle").forEach((circle) => {
    if (shouldRemoveCircle(circle as SVGCircleElement, svgSize)) {
      circle.remove();
    }
  });
  svg.querySelectorAll("ellipse").forEach((ellipse) => {
    if (shouldRemoveEllipse(ellipse as SVGEllipseElement, svgSize)) {
      ellipse.remove();
    }
  });

  const shapeSelector = "path, circle, rect, ellipse, polygon, polyline, line";
  const transparentShapes: SVGElement[] = [];
  svg.querySelectorAll(shapeSelector).forEach((node) => {
    const el = node as SVGElement;
    const styleAttr = el.getAttribute("style") || "";
    const fillValue =
      parseStyleValue(styleAttr, "fill") ||
      el.getAttribute("fill") ||
      rootFill ||
      "";
    const strokeValue =
      parseStyleValue(styleAttr, "stroke") ||
      el.getAttribute("stroke") ||
      rootStroke ||
      "";
    const hasFill = Boolean(fillValue);
    const hasStroke = Boolean(strokeValue);

    if (!hasFill && !hasStroke) {
      if (rootStroke && rootStroke !== "none") {
        el.setAttribute("stroke", "currentColor");
      } else {
        el.setAttribute("fill", "currentColor");
      }
      return;
    }

    if (fillValue && fillValue !== "none") {
      if (isWhiteFill(fillValue)) {
        transparentShapes.push(el);
      } else {
        el.setAttribute("fill", "currentColor");
      }
    }
    if (strokeValue && strokeValue !== "none") {
      el.setAttribute("stroke", "currentColor");
    }
  });

  transparentShapes.forEach((el) => el.remove());

  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  const existingStyle = svg.getAttribute("style") || "";
  const safeStyle = existingStyle.endsWith(";") || !existingStyle ? existingStyle : `${existingStyle};`;
  svg.setAttribute(
    "style",
    `${safeStyle}color: hsl(var(--primary)); background: transparent;`,
  );

  return new XMLSerializer().serializeToString(svg);
};

const ThemedSvgLogo = ({ url, label, className }: ThemedSvgLogoProps) => {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);

  const shouldInline = useMemo(() => isSvgUrl(url), [url]);

  useEffect(() => {
    let isActive = true;
    if (!shouldInline) {
      setSvgMarkup(null);
      return () => undefined;
    }

    const load = async () => {
      const dataSvg = url.startsWith("data:image/svg+xml") ? decodeDataSvg(url) : null;
      if (dataSvg) {
        const normalized = normalizeSvg(dataSvg);
        if (isActive) {
          setSvgMarkup(normalized);
        }
        return;
      }
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("fetch_failed");
        }
        const text = await response.text();
        const normalized = normalizeSvg(text);
        if (isActive) {
          setSvgMarkup(normalized);
        }
      } catch {
        if (isActive) {
          setSvgMarkup(null);
        }
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [shouldInline, url]);

  if (!shouldInline || !svgMarkup) {
    return <img src={url} alt={label} className={className} />;
  }

  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex items-center justify-center [&_svg]:h-full [&_svg]:w-full [&_svg]:block ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
};

export default ThemedSvgLogo;
