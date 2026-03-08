import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$isTableCellNode, TableCellNode} from '@lexical/table';
import {$getNodeByKey, type LexicalEditor, type NodeKey} from 'lexical';
import {useEffect} from 'react';

export function syncTableCellBackgroundColor(
  cellNode: Pick<TableCellNode, 'getBackgroundColor'>,
  element: HTMLElement,
): void {
  const backgroundColor = cellNode.getBackgroundColor();

  if (backgroundColor == null) {
    element.style.removeProperty('background-color');
    return;
  }

  element.style.backgroundColor = backgroundColor;
}

export default function TableThemeSyncPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!editor.hasNodes([TableCellNode])) {
      throw new Error(
        'TableThemeSyncPlugin: TableCellNode is not registered on editor',
      );
    }

    return editor.registerMutationListener(
      TableCellNode,
      (mutations) => {
        editor.getEditorState().read(() => {
          for (const [nodeKey, mutation] of mutations) {
            if (mutation === 'destroyed') {
              continue;
            }

            syncTableCellBackgroundForNode(editor, nodeKey);
          }
        });
      },
      {skipInitialization: false},
    );
  }, [editor]);

  return null;
}

function syncTableCellBackgroundForNode(
  editor: Pick<LexicalEditor, 'getElementByKey'>,
  nodeKey: NodeKey,
): void {
  const cellNode = $getNodeByKey(nodeKey);
  const element = editor.getElementByKey(nodeKey);

  if (!$isTableCellNode(cellNode) || !(element instanceof HTMLElement)) {
    return;
  }

  syncTableCellBackgroundColor(cellNode, element);
}
