import { describe, expect, it } from "vitest";

import { CollapsibleContainerNode } from "@/lexical-playground/plugins/CollapsiblePlugin/CollapsibleContainerNode";

describe("CollapsibleContainerNode exportDOM", () => {
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
