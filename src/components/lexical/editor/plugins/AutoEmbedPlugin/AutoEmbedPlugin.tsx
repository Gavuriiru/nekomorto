/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { JSX } from "react";

import { AutoEmbedOption, LexicalAutoEmbedPlugin } from "@lexical/react/LexicalAutoEmbedPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_EDITOR } from "lexical";
import { useCallback, useEffect } from "react";
import * as ReactDOM from "react-dom";

import useModal from "../../hooks/useModal";
import type { RangeSelectionSnapshot } from "../ImagesPlugin/selectionSnapshot";
import {
  OPEN_EMBED_MODAL_WITH_SELECTION_COMMAND,
  type OpenEmbedModalCommandPayload,
} from "./AutoEmbedCommands";
import { EmbedConfigs, type PlaygroundEmbedConfig } from "./AutoEmbedConfig";
import { AutoEmbedDialog } from "./AutoEmbedDialog";

function AutoEmbedMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  option: AutoEmbedOption;
}) {
  let className = "item";
  if (isSelected) {
    className += " selected";
  }
  return (
    <li
      key={option.key}
      tabIndex={-1}
      className={className}
      ref={option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={"typeahead-item-" + index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <span className="text">{option.title}</span>
    </li>
  );
}

function AutoEmbedMenu({
  options,
  selectedItemIndex,
  onOptionClick,
  onOptionMouseEnter,
}: {
  selectedItemIndex: number | null;
  onOptionClick: (option: AutoEmbedOption, index: number) => void;
  onOptionMouseEnter: (index: number) => void;
  options: Array<AutoEmbedOption>;
}) {
  return (
    <div className="typeahead-popover">
      <ul>
        {options.map((option: AutoEmbedOption, i: number) => (
          <AutoEmbedMenuItem
            index={i}
            isSelected={selectedItemIndex === i}
            onClick={() => onOptionClick(option, i)}
            onMouseEnter={() => onOptionMouseEnter(i)}
            key={option.key}
            option={option}
          />
        ))}
      </ul>
    </div>
  );
}

export default function AutoEmbedPlugin(): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [modal, showModal] = useModal();

  const openEmbedModal = useCallback(
    (embedConfig: PlaygroundEmbedConfig, selectionSnapshot?: RangeSelectionSnapshot | null) => {
      showModal(`Embed ${embedConfig.contentName}`, (onClose) => (
        <AutoEmbedDialog
          embedConfig={embedConfig}
          onClose={onClose}
          selectionSnapshot={selectionSnapshot}
        />
      ));
    },
    [showModal],
  );

  useEffect(() => {
    return editor.registerCommand<OpenEmbedModalCommandPayload>(
      OPEN_EMBED_MODAL_WITH_SELECTION_COMMAND,
      (payload) => {
        const embedConfig = EmbedConfigs.find((config) => config.type === payload.type);

        if (!embedConfig) {
          return false;
        }

        openEmbedModal(embedConfig, payload.selectionSnapshot);
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    );
  }, [editor, openEmbedModal]);

  const getMenuOptions = (
    activeEmbedConfig: PlaygroundEmbedConfig,
    embedFn: () => void,
    dismissFn: () => void,
  ) => {
    return [
      new AutoEmbedOption("Dismiss", {
        onSelect: dismissFn,
      }),
      new AutoEmbedOption(`Embed ${activeEmbedConfig.contentName}`, {
        onSelect: embedFn,
      }),
    ];
  };

  return (
    <>
      {modal}
      <LexicalAutoEmbedPlugin<PlaygroundEmbedConfig>
        embedConfigs={EmbedConfigs}
        onOpenEmbedModalForConfig={openEmbedModal}
        getMenuOptions={getMenuOptions}
        menuRenderFn={(
          anchorElementRef,
          { selectedIndex, options, selectOptionAndCleanUp, setHighlightedIndex },
        ) =>
          anchorElementRef.current
            ? ReactDOM.createPortal(
                <div
                  className="typeahead-popover auto-embed-menu"
                  style={{
                    marginLeft: `${Math.max(
                      parseFloat(anchorElementRef.current.style.width) - 200,
                      0,
                    )}px`,
                    width: 200,
                  }}
                >
                  <AutoEmbedMenu
                    options={options}
                    selectedItemIndex={selectedIndex}
                    onOptionClick={(option: AutoEmbedOption, index: number) => {
                      setHighlightedIndex(index);
                      selectOptionAndCleanUp(option);
                    }}
                    onOptionMouseEnter={(index: number) => {
                      setHighlightedIndex(index);
                    }}
                  />
                </div>,
                anchorElementRef.current,
              )
            : null
        }
      />
    </>
  );
}
