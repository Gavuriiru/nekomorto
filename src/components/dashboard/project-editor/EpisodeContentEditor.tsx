import { useEffect, useRef } from "react";

import type { ImageLibraryOptions } from "@/components/ImageLibraryDialog";
import type { LexicalEditorHandle } from "@/components/lexical/LexicalEditor";
import LexicalEditorSurface from "@/components/lexical/LexicalEditorSurface";

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
    <LexicalEditorSurface
      ref={editorRef}
      value={value}
      onChange={onChange}
      placeholder="Escreva o capÃ­tulo..."
      className="lexical-playground--modal"
      imageLibraryOptions={imageLibraryOptions}
      autoFocus={false}
    />
  );
};

export default EpisodeContentEditor;
