import { Suspense, lazy, useEffect, useRef } from "react";

import type { ImageLibraryOptions } from "@/components/ImageLibraryDialog";
import type { LexicalEditorHandle } from "@/components/lexical/LexicalEditor";
import LexicalEditorFallback from "@/components/lexical/LexicalEditorFallback";

const LexicalEditor = lazy(() => import("@/components/lexical/LexicalEditor"));

export type EpisodeContentEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onRegister?: (handlers: LexicalEditorHandle | null) => void;
  imageLibraryOptions?: ImageLibraryOptions;
};

const EpisodeContentEditor = ({
  value,
  onChange,
  onRegister,
  imageLibraryOptions,
}: EpisodeContentEditorProps) => {
  const editorRef = useRef<LexicalEditorHandle | null>(null);

  useEffect(() => {
    if (!onRegister) {
      return;
    }
    onRegister(editorRef.current);
  }, [onRegister]);

  return (
    <Suspense fallback={<LexicalEditorFallback />}>
      <LexicalEditor
        ref={editorRef}
        value={value}
        onChange={onChange}
        placeholder="Escreva o capítulo..."
        className="lexical-playground--modal"
        imageLibraryOptions={imageLibraryOptions}
        autoFocus={false}
      />
    </Suspense>
  );
};

export default EpisodeContentEditor;
