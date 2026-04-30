/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {
  EmbedConfig,
  EmbedMatchResult,
} from "@lexical/react/LexicalAutoEmbedPlugin";
import type { LexicalEditor } from "lexical";
import type { JSX } from "react";

import * as React from "react";

import { INSERT_TWEET_COMMAND } from "../TwitterPlugin";
import { INSERT_YOUTUBE_COMMAND } from "../YouTubePlugin";

export interface PlaygroundEmbedConfig extends EmbedConfig {
  contentName: string;
  icon?: JSX.Element;
  exampleUrl: string;
  keywords: Array<string>;
  description?: string;
}

type AutoEmbedConfigRegistry = {
  embedConfigs: PlaygroundEmbedConfig[];
  twitterEmbedConfig: PlaygroundEmbedConfig;
  youtubeEmbedConfig: PlaygroundEmbedConfig;
};

const AUTO_EMBED_CONFIG_REGISTRY_KEY =
  "__lexicalPlaygroundAutoEmbedConfigRegistry__";

const createEmbedIcon = (className: string): JSX.Element =>
  React.createElement("i", { className });

const upsertYoutubeEmbedConfig = (config: PlaygroundEmbedConfig) => {
  Object.assign(config, {
    contentName: "Vídeo do YouTube",
    exampleUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    icon: createEmbedIcon("icon youtube"),
    insertNode: (editor: LexicalEditor, result: EmbedMatchResult) => {
      editor.dispatchCommand(INSERT_YOUTUBE_COMMAND, result.id);
    },
    keywords: ["youtube", "video"],
    parseUrl: async (url: string) => {
      const match =
        /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/.exec(
          url,
        );

      const id = match ? (match?.[2].length === 11 ? match[2] : null) : null;

      if (id != null) {
        return {
          id,
          url,
        };
      }

      return null;
    },
    type: "youtube-video",
  } satisfies PlaygroundEmbedConfig);
};

const upsertTwitterEmbedConfig = (config: PlaygroundEmbedConfig) => {
  Object.assign(config, {
    contentName: "X (Tweet)",
    exampleUrl: "https://x.com/jack/status/20",
    icon: createEmbedIcon("icon x"),
    insertNode: (editor: LexicalEditor, result: EmbedMatchResult) => {
      editor.dispatchCommand(INSERT_TWEET_COMMAND, result.id);
    },
    keywords: ["tweet", "twitter", "x"],
    parseUrl: (text: string) => {
      const match =
        /^https:\/\/(twitter|x)\.com\/(#!\/)?(\w+)\/status(es)*\/(\d+)/.exec(
          text,
        );

      if (match != null) {
        return {
          id: match[5],
          url: match[1],
        };
      }

      return null;
    },
    type: "tweet",
  } satisfies PlaygroundEmbedConfig);
};

const getAutoEmbedConfigRegistry = (): AutoEmbedConfigRegistry => {
  const globalObject = globalThis as typeof globalThis & {
    [AUTO_EMBED_CONFIG_REGISTRY_KEY]?: AutoEmbedConfigRegistry;
  };

  const registry =
    globalObject[AUTO_EMBED_CONFIG_REGISTRY_KEY] ??
    (globalObject[AUTO_EMBED_CONFIG_REGISTRY_KEY] = {
      embedConfigs: [],
      twitterEmbedConfig: {} as PlaygroundEmbedConfig,
      youtubeEmbedConfig: {} as PlaygroundEmbedConfig,
    });

  upsertTwitterEmbedConfig(registry.twitterEmbedConfig);
  upsertYoutubeEmbedConfig(registry.youtubeEmbedConfig);
  registry.embedConfigs.splice(
    0,
    registry.embedConfigs.length,
    registry.twitterEmbedConfig,
    registry.youtubeEmbedConfig,
  );

  return registry;
};

const autoEmbedConfigRegistry = getAutoEmbedConfigRegistry();

export const TwitterEmbedConfig = autoEmbedConfigRegistry.twitterEmbedConfig;
export const YoutubeEmbedConfig = autoEmbedConfigRegistry.youtubeEmbedConfig;
export const EmbedConfigs = autoEmbedConfigRegistry.embedConfigs;
