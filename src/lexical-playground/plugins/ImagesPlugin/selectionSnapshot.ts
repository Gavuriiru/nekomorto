import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  type LexicalEditor,
  type RangeSelection,
} from 'lexical';

export type RangeSelectionSnapshot = RangeSelection;

export const cloneCurrentRangeSelection = (): RangeSelectionSnapshot | null => {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return null;
  }
  return selection.clone();
};

export const captureCurrentRangeSelection = (
  editor: LexicalEditor,
): RangeSelectionSnapshot | null => {
  let snapshot: RangeSelectionSnapshot | null = null;
  editor.getEditorState().read(() => {
    snapshot = cloneCurrentRangeSelection();
  });
  return snapshot;
};

export const restoreRangeSelectionSnapshot = (
  snapshot: RangeSelectionSnapshot | null | undefined,
) => {
  if (!snapshot) {
    return false;
  }

  if (
    $getNodeByKey(snapshot.anchor.key) === null ||
    $getNodeByKey(snapshot.focus.key) === null
  ) {
    return false;
  }

  $setSelection(snapshot.clone());
  return true;
};

export const restoreSelectionForInsertion = (
  snapshot: RangeSelectionSnapshot | null | undefined,
) => {
  const selectionRestored = restoreRangeSelectionSnapshot(snapshot);

  if (!selectionRestored && $getSelection() === null) {
    $getRoot().selectEnd();
  }
};
