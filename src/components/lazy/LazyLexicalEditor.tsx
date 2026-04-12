import { Suspense, forwardRef, lazy, type ReactNode } from "react";

import LexicalEditorFallback from "@/components/lexical/LexicalEditorFallback";
import type { LexicalEditorHandle, LexicalEditorProps } from "@/components/lexical/LexicalEditor";

export const loadLexicalEditor = () => import("@/components/lexical/LexicalEditor");

const LexicalEditor = lazy(loadLexicalEditor);

type LazyLexicalEditorProps = LexicalEditorProps & {
  loadingFallback?: ReactNode;
};

const LazyLexicalEditor = forwardRef<LexicalEditorHandle, LazyLexicalEditorProps>(
  ({ loadingFallback, ...props }, ref) => (
    <Suspense fallback={loadingFallback ?? <LexicalEditorFallback />}>
      <LexicalEditor ref={ref} {...props} />
    </Suspense>
  ),
);

LazyLexicalEditor.displayName = "LazyLexicalEditor";

export default LazyLexicalEditor;
