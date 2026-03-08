import {render} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

const {
  editor,
  nodeMap,
  elementMap,
  getMutationListener,
  tableCellNodeClass,
} = vi.hoisted(() => {
  const nodeMap = new Map<string, {getBackgroundColor: () => string | null}>();
  const elementMap = new Map<string, HTMLElement>();
  let mutationListener:
    | ((mutations: Map<string, 'created' | 'updated' | 'destroyed'>) => void)
    | null = null;
  const tableCellNodeClass = class {};
  const editor = {
    hasNodes: vi.fn(() => true),
    registerMutationListener: vi.fn(
      (
        _nodeClass: unknown,
        listener: (
          mutations: Map<string, 'created' | 'updated' | 'destroyed'>,
        ) => void,
      ) => {
        mutationListener = listener;
        return vi.fn();
      },
    ),
    getEditorState: vi.fn(() => ({
      read: (callback: () => void) => callback(),
    })),
    getElementByKey: vi.fn((key: string) => elementMap.get(key) ?? null),
  };

  return {
    editor,
    nodeMap,
    elementMap,
    getMutationListener: () => mutationListener,
    tableCellNodeClass,
  };
});

vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [editor],
}));

vi.mock('@lexical/table', () => ({
  $isTableCellNode: (node: unknown) =>
    typeof (node as {getBackgroundColor?: unknown} | null)?.getBackgroundColor ===
    'function',
  TableCellNode: tableCellNodeClass,
}));

vi.mock('lexical', () => ({
  $getNodeByKey: (key: string) => nodeMap.get(key) ?? null,
}));

import TableThemeSyncPlugin, {
  syncTableCellBackgroundColor,
} from '@/lexical-playground/plugins/TableThemeSyncPlugin';

describe('TableThemeSyncPlugin', () => {
  it('remove o background inline padrao quando a celula nao tem cor explicita', () => {
    render(<TableThemeSyncPlugin />);

    const cellElement = document.createElement('th');
    cellElement.style.backgroundColor = '#f2f3f5';
    elementMap.set('header', cellElement);
    nodeMap.set('header', {
      getBackgroundColor: () => null,
    });

    const mutationListener = getMutationListener();
    expect(mutationListener).toBeTruthy();

    mutationListener?.(new Map([['header', 'created']]));

    expect(cellElement.style.backgroundColor).toBe('');
    expect(editor.registerMutationListener).toHaveBeenCalledWith(
      tableCellNodeClass,
      expect.any(Function),
      {skipInitialization: false},
    );
  });

  it('preserva a cor explicita da celula quando ela existe', () => {
    const cellElement = document.createElement('td');

    syncTableCellBackgroundColor(
      {
        getBackgroundColor: () => '#ff0000',
      } as never,
      cellElement,
    );

    expect(cellElement.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });
});
