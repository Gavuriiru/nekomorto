import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createImageNodeSpy,
  createParagraphNodeSpy,
  getRootSpy,
  getSelectionSpy,
  insertNodesSpy,
  isRootOrShadowRootSpy,
  restoreRangeSelectionSnapshotSpy,
  wrapNodeInElementSpy,
} = vi.hoisted(() => ({
  createImageNodeSpy: vi.fn(),
  createParagraphNodeSpy: vi.fn(() => ({ type: "paragraph" })),
  getRootSpy: vi.fn(),
  getSelectionSpy: vi.fn(),
  insertNodesSpy: vi.fn(),
  isRootOrShadowRootSpy: vi.fn(),
  restoreRangeSelectionSnapshotSpy: vi.fn(),
  wrapNodeInElementSpy: vi.fn(),
}));

vi.mock("lexical", () => ({
  $createParagraphNode: createParagraphNodeSpy,
  $getRoot: getRootSpy,
  $getSelection: getSelectionSpy,
  $insertNodes: insertNodesSpy,
  $isRootOrShadowRoot: isRootOrShadowRootSpy,
}));

vi.mock("@lexical/utils", () => ({
  $wrapNodeInElement: wrapNodeInElementSpy,
}));

vi.mock("@/components/lexical/editor/nodes/ImageNode", () => ({
  $createImageNode: createImageNodeSpy,
}));

vi.mock("@/components/lexical/editor/plugins/ImagesPlugin/selectionSnapshot", () => ({
  restoreRangeSelectionSnapshot: restoreRangeSelectionSnapshotSpy,
}));

import {
  insertImagePayloadAtCurrentSelection,
  insertImagesIntoEditor,
} from "@/components/lexical/editor/plugins/ImagesPlugin/imageInsertion";

describe("imageInsertion", () => {
  beforeEach(() => {
    createImageNodeSpy.mockReset();
    createParagraphNodeSpy.mockClear();
    getRootSpy.mockReset();
    getSelectionSpy.mockReset();
    insertNodesSpy.mockReset();
    isRootOrShadowRootSpy.mockReset();
    restoreRangeSelectionSnapshotSpy.mockReset();
    wrapNodeInElementSpy.mockReset();
  });

  it("insere varias imagens em uma unica transacao e preserva a ordem", () => {
    const rootSelectEndSpy = vi.fn();
    const selectionSnapshot = {
      anchor: { key: "a" },
      focus: { key: "b" },
    } as never;
    const editor = {
      update: vi.fn((callback: () => void) => callback()),
    };

    restoreRangeSelectionSnapshotSpy.mockReturnValue(true);
    getRootSpy.mockReturnValue({ selectEnd: rootSelectEndSpy });
    getSelectionSpy.mockReturnValue({ type: "range" });
    createImageNodeSpy.mockImplementation((payload) => ({
      getParentOrThrow: () => ({ type: "paragraph" }),
      payload,
    }));
    isRootOrShadowRootSpy.mockReturnValue(false);

    insertImagesIntoEditor(
      editor as never,
      [
        { altText: "Imagem A", src: "/uploads/a.png" },
        { altText: "Imagem B", src: "/uploads/b.png" },
      ],
      selectionSnapshot,
    );

    expect(editor.update).toHaveBeenCalledTimes(1);
    expect(restoreRangeSelectionSnapshotSpy).toHaveBeenCalledWith(
      selectionSnapshot,
    );
    expect(rootSelectEndSpy).not.toHaveBeenCalled();
    expect(createImageNodeSpy).toHaveBeenNthCalledWith(1, {
      altText: "Imagem A",
      src: "/uploads/a.png",
    });
    expect(createImageNodeSpy).toHaveBeenNthCalledWith(2, {
      altText: "Imagem B",
      src: "/uploads/b.png",
    });
    expect(insertNodesSpy).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        payload: { altText: "Imagem A", src: "/uploads/a.png" },
      }),
    ]);
    expect(insertNodesSpy).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        payload: { altText: "Imagem B", src: "/uploads/b.png" },
      }),
    ]);
  });

  it("faz fallback para o fim do documento quando nao ha snapshot restauravel nem selecao atual", () => {
    const rootSelectEndSpy = vi.fn();
    const editor = {
      update: vi.fn((callback: () => void) => callback()),
    };

    restoreRangeSelectionSnapshotSpy.mockReturnValue(false);
    getSelectionSpy.mockReturnValue(null);
    getRootSpy.mockReturnValue({ selectEnd: rootSelectEndSpy });
    createImageNodeSpy.mockImplementation(() => ({
      getParentOrThrow: () => ({ type: "paragraph" }),
    }));
    isRootOrShadowRootSpy.mockReturnValue(false);

    insertImagesIntoEditor(editor as never, [
      { altText: "Imagem A", src: "/uploads/a.png" },
    ]);

    expect(rootSelectEndSpy).toHaveBeenCalledTimes(1);
    expect(rootSelectEndSpy.mock.invocationCallOrder[0]).toBeLessThan(
      insertNodesSpy.mock.invocationCallOrder[0],
    );
  });

  it("mantem a selecao atual quando o snapshot falha mas ainda existe uma selecao valida", () => {
    const rootSelectEndSpy = vi.fn();
    const editor = {
      update: vi.fn((callback: () => void) => callback()),
    };

    restoreRangeSelectionSnapshotSpy.mockReturnValue(false);
    getSelectionSpy.mockReturnValue({ type: "range" });
    getRootSpy.mockReturnValue({ selectEnd: rootSelectEndSpy });
    createImageNodeSpy.mockImplementation(() => ({
      getParentOrThrow: () => ({ type: "paragraph" }),
    }));
    isRootOrShadowRootSpy.mockReturnValue(false);

    insertImagesIntoEditor(editor as never, [
      { altText: "Imagem A", src: "/uploads/a.png" },
    ]);

    expect(rootSelectEndSpy).not.toHaveBeenCalled();
    expect(insertNodesSpy).toHaveBeenCalledTimes(1);
  });

  it("envolve a imagem em paragrafo quando ela entra na raiz", () => {
    const selectEndSpy = vi.fn();
    const imageNode = {
      getParentOrThrow: () => ({ type: "root" }),
    };

    createImageNodeSpy.mockReturnValue(imageNode);
    isRootOrShadowRootSpy.mockReturnValue(true);
    wrapNodeInElementSpy.mockReturnValue({ selectEnd: selectEndSpy });

    insertImagePayloadAtCurrentSelection({
      altText: "Imagem A",
      src: "/uploads/a.png",
    });

    expect(insertNodesSpy).toHaveBeenCalledWith([imageNode]);
    expect(wrapNodeInElementSpy).toHaveBeenCalledWith(
      imageNode,
      createParagraphNodeSpy,
    );
    expect(selectEndSpy).toHaveBeenCalledTimes(1);
  });
});
