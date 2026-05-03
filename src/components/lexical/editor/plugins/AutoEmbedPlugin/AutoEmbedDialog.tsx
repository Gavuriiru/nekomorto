/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { JSX } from "react";

import type { EmbedMatchResult } from "@lexical/react/LexicalAutoEmbedPlugin";

import { URL_MATCHER } from "@lexical/react/LexicalAutoEmbedPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useMemo, useState } from "react";

import Button from "../../ui/Button";
import { DialogActions } from "../../ui/Dialog";
import {
  restoreSelectionForInsertion,
  type RangeSelectionSnapshot,
} from "../ImagesPlugin/selectionSnapshot";
import type { PlaygroundEmbedConfig } from "./AutoEmbedConfig";

const debounce = (callback: (text: string) => void, delay: number) => {
  let timeoutId: number;

  return (text: string) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(text);
    }, delay);
  };
};

export function AutoEmbedDialog({
  embedConfig,
  onClose,
  selectionSnapshot,
}: {
  embedConfig: PlaygroundEmbedConfig;
  onClose: () => void;
  selectionSnapshot?: RangeSelectionSnapshot | null;
}): JSX.Element {
  const [text, setText] = useState("");
  const [editor] = useLexicalComposerContext();
  const [embedResult, setEmbedResult] = useState<EmbedMatchResult | null>(null);

  const validateText = useMemo(
    () =>
      debounce((inputText: string) => {
        const urlMatch = URL_MATCHER.exec(inputText);
        if (embedConfig != null && inputText != null && urlMatch != null) {
          Promise.resolve(embedConfig.parseUrl(inputText)).then((parseResult) => {
            setEmbedResult(parseResult);
          });
        } else if (embedResult != null) {
          setEmbedResult(null);
        }
      }, 200),
    [embedConfig, embedResult],
  );

  const onClick = () => {
    if (embedResult != null) {
      editor.update(() => {
        restoreSelectionForInsertion(selectionSnapshot);
        embedConfig.insertNode(editor, embedResult);
      });
      onClose();
    }
  };

  return (
    <div style={{ width: "600px" }}>
      <div className="Input__wrapper">
        <input
          type="text"
          className="Input__input"
          placeholder={embedConfig.exampleUrl}
          value={text}
          data-test-id={`${embedConfig.type}-embed-modal-url`}
          onChange={(e) => {
            const { value } = e.target;
            setText(value);
            validateText(value);
          }}
        />
      </div>
      <DialogActions>
        <Button
          disabled={!embedResult}
          onClick={onClick}
          data-test-id={`${embedConfig.type}-embed-modal-submit-btn`}
        >
          Embed
        </Button>
      </DialogActions>
    </div>
  );
}
