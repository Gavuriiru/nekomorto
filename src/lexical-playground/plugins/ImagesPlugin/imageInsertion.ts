import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRootOrShadowRoot,
} from 'lexical';
import {$wrapNodeInElement} from '@lexical/utils';
import type {LexicalEditor} from 'lexical';

import {
  $createImageNode,
  type ImagePayload,
} from '../../nodes/ImageNode';
import {
  restoreRangeSelectionSnapshot,
  type RangeSelectionSnapshot,
} from './selectionSnapshot';

export type InsertImagePayload = Readonly<ImagePayload>;

export const insertImagePayloadAtCurrentSelection = (
  payload: InsertImagePayload,
) => {
  const imageNode = $createImageNode(payload);
  $insertNodes([imageNode]);

  if ($isRootOrShadowRoot(imageNode.getParentOrThrow())) {
    $wrapNodeInElement(imageNode, $createParagraphNode).selectEnd();
  }
};

export const insertImagesIntoEditor = (
  editor: LexicalEditor,
  payloads: readonly InsertImagePayload[],
  selectionSnapshot?: RangeSelectionSnapshot | null,
) => {
  if (payloads.length === 0) {
    return;
  }

  editor.update(() => {
    const selectionRestored = restoreRangeSelectionSnapshot(selectionSnapshot);

    if (!selectionRestored && $getSelection() === null) {
      $getRoot().selectEnd();
    }

    payloads.forEach((payload) => {
      insertImagePayloadAtCurrentSelection(payload);
    });
  });
};
