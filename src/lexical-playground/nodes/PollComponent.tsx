/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {Option, Options, PollNode} from './PollNode';
import type {JSX} from 'react';

import './PollNode.css';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {useLexicalNodeSelection} from '@lexical/react/useLexicalNodeSelection';
import {useLexicalEditable} from '@lexical/react/useLexicalEditable';
import {mergeRegister} from '@lexical/utils';
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  BaseSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  NodeKey,
} from 'lexical';
import {useEffect, useMemo, useRef, useState} from 'react';

import Button from '../ui/Button';
import joinClasses from '../utils/joinClasses';
import {usePollContext} from '../context/PollContext';
import {$isPollNode, createPollOption} from './PollNode';

function getTotalVotes(options: Options): number {
  return options.reduce((totalVotes, next) => {
    return totalVotes + next.votes.length;
  }, 0);
}

function PollOptionComponent({
  option,
  index,
  options,
  totalVotes,
  withPollNode,
  isEditable,
  onVote,
}: {
  index: number;
  option: Option;
  options: Options;
  totalVotes: number;
  withPollNode: (
    cb: (pollNode: PollNode) => void,
    onSelect?: () => void,
  ) => void;
  isEditable: boolean;
  onVote?: (option: Option, checked: boolean) => void;
}): JSX.Element {
  const pollContext = usePollContext();
  const username = pollContext.voterId || 'local';
  const checkboxRef = useRef(null);
  const votesArray = option.votes;
  const checkedIndex = votesArray.indexOf(username);
  const checked = checkedIndex !== -1;
  const votes = votesArray.length;
  const text = option.text;

  return (
    <div className="PollNode__optionContainer">
      <div
        className={joinClasses(
          'PollNode__optionCheckboxWrapper',
          checked && 'PollNode__optionCheckboxChecked',
        )}>
        <input
          ref={checkboxRef}
          className="PollNode__optionCheckbox"
          type="checkbox"
          onChange={(e) => {
            const nextChecked = e.target.checked;
            withPollNode((node) => {
              node.toggleVote(option, username);
            });
            onVote?.(option, nextChecked);
          }}
          checked={checked}
        />
      </div>
      <div className="PollNode__optionInputWrapper">
        <div
          className="PollNode__optionInputVotes"
          style={{width: `${votes === 0 ? 0 : (votes / totalVotes) * 100}%`}}
        />
        <span className="PollNode__optionInputVotesCount">
          {votes > 0 && (votes === 1 ? '1 voto' : `${votes} votos`)}
        </span>
        <input
          className="PollNode__optionInput"
          type="text"
          value={text}
          readOnly={!isEditable}
          onChange={
            isEditable
              ? (e) => {
                  const target = e.target;
                  const value = target.value;
                  const selectionStart = target.selectionStart;
                  const selectionEnd = target.selectionEnd;
                  withPollNode(
                    (node) => {
                      node.setOptionText(option, value);
                    },
                    () => {
                      target.selectionStart = selectionStart;
                      target.selectionEnd = selectionEnd;
                    },
                  );
                }
              : undefined
          }
          placeholder={`Opção ${index + 1}`}
        />
      </div>
      {isEditable ? (
        <button
          disabled={options.length < 3}
          className={joinClasses(
            'PollNode__optionDelete',
            options.length < 3 && 'PollNode__optionDeleteDisabled',
          )}
          aria-label="Remover"
          onClick={() => {
            withPollNode((node) => {
              node.deleteOption(option);
            });
          }}
        />
      ) : null}
    </div>
  );
}

export default function PollComponent({
  question,
  options,
  nodeKey,
}: {
  nodeKey: NodeKey;
  options: Options;
  question: string;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const pollContext = usePollContext();
  const totalVotes = useMemo(() => getTotalVotes(options), [options]);
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey);
  const [selection, setSelection] = useState<BaseSelection | null>(null);
  const ref = useRef(null);
  const isEditable = useLexicalEditable();

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({editorState}) => {
        setSelection(editorState.read(() => $getSelection()));
      }),
      editor.registerCommand<MouseEvent>(
        CLICK_COMMAND,
        (payload) => {
          const event = payload;

          if (event.target === ref.current) {
            if (!event.shiftKey) {
              clearSelection();
            }
            setSelected(!isSelected);
            return true;
          }

          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [clearSelection, editor, isSelected, nodeKey, setSelected]);

  const withPollNode = (
    cb: (node: PollNode) => void,
    onUpdate?: () => void,
  ): void => {
    editor.update(
      () => {
        const node = $getNodeByKey(nodeKey);
        if ($isPollNode(node)) {
          cb(node);
        }
      },
      {onUpdate},
    );
  };

  const addOption = () => {
    withPollNode((node) => {
      node.addOption(createPollOption());
    });
  };

  const isFocused = $isNodeSelection(selection) && isSelected;
  const shouldPersistVotes = !isEditable && Boolean(pollContext.persistVote);

  return (
    <div
      className={`PollNode__container ${isFocused ? 'focused' : ''} ${
        !isEditable ? 'readonly' : ''
      }`}
      ref={ref}>
      <div className="PollNode__inner">
        <h2 className="PollNode__heading">{question}</h2>
        {options.map((option, index) => {
          const key = option.uid;
          return (
            <PollOptionComponent
              key={key}
              withPollNode={withPollNode}
              option={option}
              index={index}
              options={options}
              totalVotes={totalVotes}
              isEditable={isEditable}
              onVote={(selectedOption, checked) => {
                if (!shouldPersistVotes) {
                  return;
                }
                pollContext.persistVote?.({
                  question,
                  optionUid: selectedOption.uid,
                  optionText: selectedOption.text,
                  checked,
                });
              }}
            />
          );
        })}
        {isEditable ? (
          <div className="PollNode__footer">
            <Button onClick={addOption} small={true}>
              Adicionar opção
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
