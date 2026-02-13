import { render } from "@testing-library/react";
import type { LexicalEditor } from "lexical";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { INSERT_IMAGE_COMMAND, InsertImageDialog } from "@/lexical-playground/plugins/ImagesPlugin";

const { imageLibraryPropsSpy } = vi.hoisted(() => ({
  imageLibraryPropsSpy: vi.fn(),
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

describe("InsertImageDialog", () => {
  beforeEach(() => {
    imageLibraryPropsSpy.mockReset();
  });

  it("repassa projectImagesView e currentSelectionUrls para a biblioteca", () => {
    const activeEditor = { dispatchCommand: vi.fn() } as unknown as LexicalEditor;

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
        }}
      />,
    );

    const props = imageLibraryPropsSpy.mock.calls.at(-1)?.[0] as {
      projectImagesView?: "flat" | "by-project";
      currentSelectionUrls?: string[];
    };
    expect(props.projectImagesView).toBe("by-project");
    expect(props.currentSelectionUrls).toEqual(["/uploads/posts/a.png"]);
  });

  it("insere apenas imagens novas ao salvar", () => {
    const dispatchCommand = vi.fn();
    const activeEditor = { dispatchCommand } as unknown as LexicalEditor;

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
        urls: string[];
        items: Array<{ source: "upload" | "project"; url: string; name?: string; label?: string }>;
      }) => void;
    };

    props.onSave({
      urls: [
        "/uploads/posts/a.png",
        "https://rainbow-dashboard-public-site.onrender.com/uploads/posts/a.png?cache=1",
        "/uploads/posts/b.png",
      ],
      items: [
        { source: "upload", url: "/uploads/posts/a.png", name: "Imagem A" },
        {
          source: "upload",
          url: "https://rainbow-dashboard-public-site.onrender.com/uploads/posts/a.png?cache=1",
          name: "Imagem A equivalente",
        },
        { source: "upload", url: "/uploads/posts/b.png", name: "Imagem B" },
        { source: "upload", url: "/uploads/posts/b.png?cache=2", name: "Imagem B duplicada" },
      ],
    });

    expect(dispatchCommand).toHaveBeenCalledTimes(1);
    expect(dispatchCommand).toHaveBeenCalledWith(
      INSERT_IMAGE_COMMAND,
      expect.objectContaining({ src: "/uploads/posts/b.png" }),
    );
  });
});
