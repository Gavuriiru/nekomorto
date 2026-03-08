import { describe, expect, it } from "vitest";

import { normalizeLexicalViewerJson } from "@/lib/lexical/viewer";

const COLLAPSIBLE_OPEN_STATE = JSON.stringify({
  root: {
    children: [
      {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: "Titulo",
                type: "text",
                version: 1,
              },
            ],
            direction: null,
            format: "",
            indent: 0,
            textFormat: 0,
            textStyle: "",
            type: "collapsible-title",
            version: 1,
          },
          {
            children: [
              {
                children: [
                  {
                    detail: 0,
                    format: 0,
                    mode: "normal",
                    style: "",
                    text: "Conteudo",
                    type: "text",
                    version: 1,
                  },
                ],
                direction: null,
                format: "",
                indent: 0,
                textFormat: 0,
                textStyle: "",
                type: "paragraph",
                version: 1,
              },
            ],
            direction: null,
            format: "",
            indent: 0,
            type: "collapsible-content",
            version: 1,
          },
        ],
        direction: null,
        format: "",
        indent: 0,
        open: true,
        type: "collapsible-container",
        version: 1,
      },
    ],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
});

describe("normalizeLexicalViewerJson", () => {
  it("fecha colapsaveis no estado do viewer sem alterar o payload original", () => {
    const normalized = normalizeLexicalViewerJson(COLLAPSIBLE_OPEN_STATE);
    const original = JSON.parse(COLLAPSIBLE_OPEN_STATE);
    const parsed = JSON.parse(normalized);

    expect(original.root.children[0].open).toBe(true);
    expect(parsed.root.children[0].open).toBe(false);
  });
});
