import { forwardRef, type CSSProperties } from "react";

import LazyLexicalEditor from "@/components/lazy/LazyLexicalEditor";
import type { LexicalEditorHandle, LexicalEditorProps } from "@/components/lexical/LexicalEditor";
import LexicalEditorFallback from "@/components/lexical/LexicalEditorFallback";

type LexicalEditorSurfaceProps = LexicalEditorProps & {
  fallbackVariant?: "compact" | "chapter" | "post";
  fallbackMinHeightClassName?: string;
  fallbackClassName?: string;
  fallbackTestId?: string;
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
  wrapperTestId?: string;
};

const LexicalEditorSurface = forwardRef<LexicalEditorHandle, LexicalEditorSurfaceProps>(
  (
    {
      fallbackVariant = "compact",
      fallbackMinHeightClassName,
      fallbackClassName,
      fallbackTestId,
      wrapperClassName,
      wrapperStyle,
      wrapperTestId,
      ...props
    },
    ref,
  ) => (
    <div className={wrapperClassName} style={wrapperStyle} data-testid={wrapperTestId}>
      <LazyLexicalEditor
        ref={ref}
        loadingFallback={
          <LexicalEditorFallback
            variant={fallbackVariant}
            minHeightClassName={fallbackMinHeightClassName}
            className={fallbackClassName}
            testId={fallbackTestId}
          />
        }
        {...props}
      />
    </div>
  ),
);

LexicalEditorSurface.displayName = "LexicalEditorSurface";

export default LexicalEditorSurface;
