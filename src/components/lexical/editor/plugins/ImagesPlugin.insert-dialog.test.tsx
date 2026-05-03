import { render } from "@testing-library/react";
import type { LexicalEditor } from "lexical";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { imageLibraryPropsSpy, insertImagesIntoEditorSpy } = vi.hoisted(() => ({
  imageLibraryPropsSpy: vi.fn(),
  insertImagesIntoEditorSpy: vi.fn(),
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: (props: unknown) => {
    imageLibraryPropsSpy(props);
    return <div data-testid="mock-image-library-dialog" />;
  },
}));

vi.mock("@/lib/api-base", () => ({
  getApiBase: () => "http://api.local",
}));

vi.mock("@/components/lexical/editor/plugins/ImagesPlugin/imageInsertion", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/lexical/editor/plugins/ImagesPlugin/imageInsertion")
  >("@/components/lexical/editor/plugins/ImagesPlugin/imageInsertion");

  return {
    ...actual,
    insertImagesIntoEditor: insertImagesIntoEditorSpy,
  };
});

import {
  InsertImageDialog,
  getNewImageInsertPayloads,
} from "@/components/lexical/editor/plugins/ImagesPlugin";

describe("InsertImageDialog", () => {
  beforeEach(() => {
    imageLibraryPropsSpy.mockReset();
    insertImagesIntoEditorSpy.mockReset();
  });

  it("repassa projectImagesView e currentSelectionUrls para a biblioteca", () => {
    const activeEditor = {} as LexicalEditor;
    const onRequestNavigateToUploads = vi.fn();

    render(
      <InsertImageDialog
        activeEditor={activeEditor}
        onClose={() => undefined}
        imageLibraryOptions={{
          uploadFolder: "posts",
          listFolders: ["posts", "shared"],
          listAll: false,
          includeProjectImages: true,
          projectImageProjectIds: [],
          projectImagesView: "by-project",
          currentSelectionUrls: ["/uploads/posts/a.png"],
          onRequestNavigateToUploads,
        }}
      />,
    );

    const props = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      currentSelectionUrls?: string[];
      projectImagesView?: "flat" | "by-project";
      onRequestNavigateToUploads?: () => boolean | Promise<boolean>;
    };

    expect(props.projectImagesView).toBe("by-project");
    expect(props.currentSelectionUrls).toEqual(["/uploads/posts/a.png"]);
    expect(props.onRequestNavigateToUploads).toBe(onRequestNavigateToUploads);
  });

  it("filtra imagens ja selecionadas e duplicadas, preservando a ordem das novas", () => {
    expect(
      getNewImageInsertPayloads(
        [
          { url: "/uploads/posts/a.png", name: "Imagem A" },
          {
            url: "http://localhost:8080/uploads/posts/a.png?cache=1",
            name: "Imagem A equivalente",
          },
          { url: "/uploads/posts/b.png", name: "Imagem B" },
          { url: "/uploads/posts/b.png?cache=2", name: "Imagem B duplicada" },
          { url: "/uploads/posts/c.png", label: "Imagem C" },
        ],
        new Set(["/uploads/posts/a.png"]),
      ),
    ).toEqual([
      { altText: "Imagem B", src: "/uploads/posts/b.png" },
      { altText: "Imagem C", src: "/uploads/posts/c.png" },
    ]);
  });

  it("insere as imagens novas em uma unica chamada com snapshot explicito", () => {
    const activeEditor = {} as LexicalEditor;
    const selectionSnapshot = {
      anchor: { key: "a" },
      focus: { key: "b" },
    } as never;

    render(
      <InsertImageDialog
        activeEditor={activeEditor}
        onClose={() => undefined}
        selectionSnapshot={selectionSnapshot}
        imageLibraryOptions={{
          currentSelectionUrls: ["/uploads/posts/a.png"],
        }}
      />,
    );

    const props = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      onSave: (payload: {
        items: Array<{
          label?: string;
          name?: string;
          source: "project" | "upload";
          url: string;
        }>;
      }) => void;
    };

    props.onSave({
      items: [
        { source: "upload", url: "/uploads/posts/a.png", name: "Imagem A" },
        { source: "upload", url: "/uploads/posts/b.png", name: "Imagem B" },
        { source: "upload", url: "/uploads/posts/c.png", label: "Imagem C" },
      ],
    });

    expect(insertImagesIntoEditorSpy).toHaveBeenCalledTimes(1);
    expect(insertImagesIntoEditorSpy).toHaveBeenCalledWith(
      activeEditor,
      [
        { altText: "Imagem B", src: "/uploads/posts/b.png" },
        { altText: "Imagem C", src: "/uploads/posts/c.png" },
      ],
      selectionSnapshot,
    );
  });

  it("nao tenta inserir nada quando nao ha imagens novas", () => {
    const activeEditor = {} as LexicalEditor;

    render(
      <InsertImageDialog
        activeEditor={activeEditor}
        onClose={() => undefined}
        imageLibraryOptions={{
          currentSelectionUrls: ["/uploads/posts/a.png"],
        }}
      />,
    );

    const props = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      onSave: (payload: {
        items: Array<{
          label?: string;
          name?: string;
          source: "project" | "upload";
          url: string;
        }>;
      }) => void;
    };

    props.onSave({
      items: [{ source: "upload", url: "/uploads/posts/a.png", name: "Imagem A" }],
    });

    expect(insertImagesIntoEditorSpy).not.toHaveBeenCalled();
  });
});
