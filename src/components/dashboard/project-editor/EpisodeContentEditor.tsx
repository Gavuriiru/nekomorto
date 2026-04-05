import { memo, useEffect, useRef } from "react";

import type { ImageLibraryOptions } from "@/components/ImageLibraryDialog";
import type { LexicalEditorHandle } from "@/components/lexical/LexicalEditor";
import LexicalEditorSurface from "@/components/lexical/LexicalEditorSurface";

export type EpisodeContentEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onRegister?: (handlers: LexicalEditorHandle | null) => void;
  imageLibraryOptions?: ImageLibraryOptions;
};

const areStringArraysEqual = (left?: string[], right?: string[]) => {
  const leftValues = left ?? [];
  const rightValues = right ?? [];
  return (
    leftValues.length === rightValues.length &&
    leftValues.every((value, index) => value === rightValues[index])
  );
};

const areImageLibraryOptionsEqual = (
  previousValue?: ImageLibraryOptions,
  nextValue?: ImageLibraryOptions,
) => {
  if (!previousValue && !nextValue) {
    return true;
  }
  if (!previousValue || !nextValue) {
    return false;
  }
  return (
    previousValue.uploadFolder === nextValue.uploadFolder &&
    previousValue.listAll === nextValue.listAll &&
    previousValue.includeProjectImages === nextValue.includeProjectImages &&
    previousValue.projectImagesView === nextValue.projectImagesView &&
    previousValue.scopeUserId === nextValue.scopeUserId &&
    previousValue.onRequestNavigateToUploads === nextValue.onRequestNavigateToUploads &&
    areStringArraysEqual(previousValue.listFolders, nextValue.listFolders) &&
    areStringArraysEqual(previousValue.projectImageProjectIds, nextValue.projectImageProjectIds) &&
    areStringArraysEqual(previousValue.currentSelectionUrls, nextValue.currentSelectionUrls)
  );
};

const EpisodeContentEditorComponent = ({
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
      placeholder="Escreva o capítulo..."
      className="lexical-playground--modal"
      imageLibraryOptions={imageLibraryOptions}
      autoFocus={false}
    />
  );
};

const EpisodeContentEditor = memo(
  EpisodeContentEditorComponent,
  (previousProps, nextProps) =>
    previousProps.value === nextProps.value &&
    areImageLibraryOptionsEqual(previousProps.imageLibraryOptions, nextProps.imageLibraryOptions),
);

EpisodeContentEditor.displayName = "EpisodeContentEditor";

export default EpisodeContentEditor;
