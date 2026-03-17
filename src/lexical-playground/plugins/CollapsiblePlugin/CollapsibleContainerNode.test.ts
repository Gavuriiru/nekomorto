import { describe, expect, it, vi } from "vitest";

vi.mock("@lexical/utils", () => ({
  IS_CHROME: true,
}));

import { CollapsibleContainerNode } from "@/lexical-playground/plugins/CollapsiblePlugin/CollapsibleContainerNode";

describe("CollapsibleContainerNode", () => {
  it("nao aplica o atributo open no createDOM quando o colapsavel nasce fechado no chrome", () => {
    const element = CollapsibleContainerNode.prototype.createDOM.call(
      {
        __open: false,
      } as CollapsibleContainerNode,
      {} as never,
      {} as never,
    );

    expect(element.tagName).toBe("DIV");
    expect(element.hasAttribute("open")).toBe(false);
  });

  it("aplica o atributo open no createDOM quando o colapsavel nasce aberto no chrome", () => {
    const element = CollapsibleContainerNode.prototype.createDOM.call(
      {
        __open: true,
      } as CollapsibleContainerNode,
      {} as never,
      {} as never,
    );

    expect(element.tagName).toBe("DIV");
    expect(element.hasAttribute("open")).toBe(true);
  });

  it("omite o atributo open quando o colapsavel esta fechado", () => {
    const element = CollapsibleContainerNode.prototype.exportDOM.call({
      __open: false,
    } as CollapsibleContainerNode).element;

    expect(element.hasAttribute("open")).toBe(false);
  });

  it("mantem o atributo open quando o colapsavel esta aberto", () => {
    const element = CollapsibleContainerNode.prototype.exportDOM.call({
      __open: true,
    } as CollapsibleContainerNode).element;

    expect(element.hasAttribute("open")).toBe(true);
  });
});
