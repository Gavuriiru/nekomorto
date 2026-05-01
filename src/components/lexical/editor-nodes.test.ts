import { describe, expect, it } from "vitest";

import { editorNodes } from "@/components/lexical/editor-nodes";
import PlaygroundNodes from "@/components/lexical/editor/nodes/PlaygroundNodes";

const getNodeTypes = (nodes: typeof editorNodes) =>
  nodes.map((node) => node.getType()).sort((left, right) => left.localeCompare(right));

describe("editorNodes", () => {
  it("mantem paridade com os nodes legados persistidos pelo playground", () => {
    expect(getNodeTypes(editorNodes)).toEqual(getNodeTypes(PlaygroundNodes));
  });
});
