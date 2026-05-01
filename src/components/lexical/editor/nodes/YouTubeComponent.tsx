/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type { ElementFormatType, NodeKey } from "lexical";

import { BlockWithAlignableContents } from "@lexical/react/LexicalBlockWithAlignableContents";

export type YouTubeComponentProps = Readonly<{
  className: Readonly<{
    base: string;
    focus: string;
  }>;
  format: ElementFormatType | null;
  nodeKey: NodeKey;
  videoID: string;
}>;

export default function YouTubeComponent({
  className,
  format,
  nodeKey,
  videoID,
}: YouTubeComponentProps) {
  return (
    <BlockWithAlignableContents
      className={className}
      format={format}
      nodeKey={nodeKey}
    >
      <div
        className="lexical-youtube"
        data-lexical-youtube-embed="true"
        style={{ display: "block", width: "100%" }}
      >
        <iframe
          data-lexical-youtube-iframe="true"
          width="560"
          height="315"
          src={`https://www.youtube-nocookie.com/embed/${videoID}`}
          style={{
            aspectRatio: "16 / 9",
            border: 0,
            display: "block",
            height: "auto",
            maxWidth: "100%",
            width: "100%",
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen={true}
          title="Vídeo do YouTube"
        />
      </div>
    </BlockWithAlignableContents>
  );
}
