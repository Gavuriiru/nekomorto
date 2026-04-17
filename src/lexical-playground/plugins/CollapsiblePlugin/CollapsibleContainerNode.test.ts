import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let CollapsibleContainerNode: typeof import("@/lexical-playground/plugins/CollapsiblePlugin/CollapsibleContainerNode").CollapsibleContainerNode;

beforeAll(async () => {
  vi.resetModules();
  vi.doMock("@lexical/utils", () => ({
    IS_CHROME: true,
  }));
  ({ CollapsibleContainerNode } =
    await import("@/lexical-playground/plugins/CollapsiblePlugin/CollapsibleContainerNode"));
});

afterAll(() => {
  vi.doUnmock("@lexical/utils");
  vi.resetModules();
});

describe("CollapsibleContainerNode", () => {
  it("nao aplica o atributo open no createDOM quando o colapsavel nasce fechado no chrome", () => {
    const element = CollapsibleContainerNode.prototype.createDOM.call(
      {
        __open: false,
      } as never,
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
      } as never,
      {} as never,
      {} as never,
    );

    expect(element.tagName).toBe("DIV");
    expect(element.hasAttribute("open")).toBe(true);
  });

  it("omite o atributo open quando o colapsavel esta fechado", () => {
    const element = CollapsibleContainerNode.prototype.exportDOM.call({
      __open: false,
    } as never).element;

    expect(element).not.toBeNull();
    if (!(element instanceof HTMLElement)) {
      throw new Error("Expected exported collapsible element");
    }
    expect(element.hasAttribute("open")).toBe(false);
  });

  it("mantem o atributo open quando o colapsavel esta aberto", () => {
    const element = CollapsibleContainerNode.prototype.exportDOM.call({
      __open: true,
    } as never).element;

    expect(element).not.toBeNull();
    if (!(element instanceof HTMLElement)) {
      throw new Error("Expected exported collapsible element");
    }
    expect(element.hasAttribute("open")).toBe(true);
  });
});
