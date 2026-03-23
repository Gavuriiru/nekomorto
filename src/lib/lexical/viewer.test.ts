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

const COLLAPSIBLE_WITH_EMPTY_LINES_STATE = JSON.stringify({
  root: {
    children: [
      {
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
                type: "paragraph",
                version: 1,
              },
              {
                children: [],
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
            textFormat: 0,
            textStyle: "",
            type: "collapsible-title",
            version: 1,
          },
          {
            children: [
              {
                children: [],
                direction: null,
                format: "",
                indent: 0,
                textFormat: 0,
                textStyle: "",
                type: "paragraph",
                version: 1,
              },
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
              {
                children: [],
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

  it("remove linhas vazias dentro de titulos e conteudos de colapsaveis", () => {
    const normalized = normalizeLexicalViewerJson(COLLAPSIBLE_WITH_EMPTY_LINES_STATE);
    const parsed = JSON.parse(normalized);
    const collapsible = parsed.root.children[0];

    expect(collapsible.children[0].children).toHaveLength(1);
    expect(collapsible.children[1].children).toHaveLength(1);
    expect(collapsible.children[0].children[0].children[0].text).toBe("Titulo");
    expect(collapsible.children[1].children[0].children[0].text).toBe("Conteudo");
  });
});
