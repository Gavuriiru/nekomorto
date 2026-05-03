import { beforeEach, describe, expect, it, vi } from "vitest";

const { getNodeByKeySpy, getRootSpy, getSelectionSpy, setSelectionSpy } = vi.hoisted(() => ({
  getNodeByKeySpy: vi.fn(),
  getRootSpy: vi.fn(),
  getSelectionSpy: vi.fn(),
  setSelectionSpy: vi.fn(),
}));

vi.mock("lexical", () => ({
  $getNodeByKey: getNodeByKeySpy,
  $getRoot: getRootSpy,
  $getSelection: getSelectionSpy,
  $isRangeSelection: (selection: { kind?: string } | null) => selection?.kind === "range",
  $setSelection: setSelectionSpy,
}));

import {
  restoreRangeSelectionSnapshot,
  restoreSelectionForInsertion,
} from "@/components/lexical/editor/plugins/ImagesPlugin/selectionSnapshot";

describe("selectionSnapshot helpers", () => {
  beforeEach(() => {
    getNodeByKeySpy.mockReset();
    getRootSpy.mockReset();
    getSelectionSpy.mockReset();
    setSelectionSpy.mockReset();
  });

  it("restaura o snapshot valido antes da insercao", () => {
    const rootSelectEndSpy = vi.fn();
    const snapshot = {
      anchor: { key: "anchor-key" },
      clone: vi.fn(() => ({ kind: "range", source: "snapshot" })),
      focus: { key: "focus-key" },
    };

    getNodeByKeySpy.mockReturnValue({});
    getRootSpy.mockReturnValue({ selectEnd: rootSelectEndSpy });

    expect(restoreRangeSelectionSnapshot(snapshot as never)).toBe(true);
    setSelectionSpy.mockClear();

    restoreSelectionForInsertion(snapshot as never);

    expect(setSelectionSpy).toHaveBeenCalledWith({
      kind: "range",
      source: "snapshot",
    });
    expect(rootSelectEndSpy).not.toHaveBeenCalled();
  });

  it("mantem a selecao atual quando o snapshot falha e ainda ha selecao valida", () => {
    const rootSelectEndSpy = vi.fn();

    getNodeByKeySpy.mockReturnValue(null);
    getSelectionSpy.mockReturnValue({ kind: "range" });
    getRootSpy.mockReturnValue({ selectEnd: rootSelectEndSpy });

    restoreSelectionForInsertion({
      anchor: { key: "missing" },
      clone: vi.fn(),
      focus: { key: "missing" },
    } as never);

    expect(setSelectionSpy).not.toHaveBeenCalled();
    expect(rootSelectEndSpy).not.toHaveBeenCalled();
  });

  it("seleciona o fim do documento quando nao ha snapshot restauravel nem selecao atual", () => {
    const rootSelectEndSpy = vi.fn();

    getSelectionSpy.mockReturnValue(null);
    getRootSpy.mockReturnValue({ selectEnd: rootSelectEndSpy });

    restoreSelectionForInsertion(null);

    expect(rootSelectEndSpy).toHaveBeenCalledTimes(1);
  });
});
