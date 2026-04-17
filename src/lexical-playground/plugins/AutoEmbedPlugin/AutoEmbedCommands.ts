/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { LexicalCommand } from "lexical";

import { createCommand } from "lexical";

import type { RangeSelectionSnapshot } from "../ImagesPlugin/selectionSnapshot";
import type { PlaygroundEmbedConfig } from "./AutoEmbedConfig";

export type OpenEmbedModalCommandPayload = Readonly<{
  selectionSnapshot?: RangeSelectionSnapshot | null;
  type: PlaygroundEmbedConfig["type"];
}>;

const OPEN_EMBED_MODAL_WITH_SELECTION_COMMAND_KEY =
  "__lexicalPlaygroundOpenEmbedModalWithSelectionCommand__";

const globalObject = globalThis as typeof globalThis &
  Record<string, LexicalCommand<OpenEmbedModalCommandPayload> | undefined>;

export const OPEN_EMBED_MODAL_WITH_SELECTION_COMMAND =
  globalObject[OPEN_EMBED_MODAL_WITH_SELECTION_COMMAND_KEY] ??
  (globalObject[OPEN_EMBED_MODAL_WITH_SELECTION_COMMAND_KEY] = createCommand(
    "OPEN_EMBED_MODAL_WITH_SELECTION_COMMAND",
  ));
