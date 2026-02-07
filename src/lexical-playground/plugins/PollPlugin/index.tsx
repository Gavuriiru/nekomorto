/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {JSX} from 'react';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$wrapNodeInElement} from '@lexical/utils';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_EDITOR,
  createCommand,
  LexicalCommand,
  LexicalEditor,
} from 'lexical';
import {useEffect, useState} from 'react';
import * as React from 'react';

import {
  $createPollNode,
  createPollOption,
  PollNode,
} from '../../nodes/PollNode';
import Button from '../../ui/Button';
import {DialogActions} from '../../ui/Dialog';
import TextInput from '../../ui/TextInput';

export const INSERT_POLL_COMMAND: LexicalCommand<string> = createCommand(
  'INSERT_POLL_COMMAND',
);

export function InsertPollDialog({
  activeEditor,
  fallbackEditor,
  onClose,
}: {
  activeEditor: LexicalEditor;
  fallbackEditor?: LexicalEditor;
  onClose: () => void;
}): JSX.Element {
  const [question, setQuestion] = useState('');

  const onClick = () => {
    const handled = activeEditor.dispatchCommand(INSERT_POLL_COMMAND, question);
    if (!handled && fallbackEditor && fallbackEditor !== activeEditor) {
      fallbackEditor.dispatchCommand(INSERT_POLL_COMMAND, question);
    }
    onClose();
  };

  return (
    <>
      <TextInput label="Pergunta" onChange={setQuestion} value={question} />
      <DialogActions>
        <Button disabled={question.trim() === ''} onClick={onClick}>
          Confirmar
        </Button>
      </DialogActions>
    </>
  );
}

export default function PollPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!editor.hasNodes([PollNode])) {
      throw new Error('PollPlugin: PollNode not registered on editor');
    }

    return editor.registerCommand<string>(
      INSERT_POLL_COMMAND,
      (payload) => {
        const pollNode = $createPollNode(payload, [
          createPollOption(),
          createPollOption(),
        ]);
        const selection = $getSelection();
        if (selection === null) {
          const root = $getRoot();
          root.append(pollNode);
          $wrapNodeInElement(pollNode, $createParagraphNode).selectEnd();
        } else {
          $insertNodes([pollNode]);
          if ($isRootOrShadowRoot(pollNode.getParentOrThrow())) {
            $wrapNodeInElement(pollNode, $createParagraphNode).selectEnd();
          }
        }

        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor]);
  return null;
}
