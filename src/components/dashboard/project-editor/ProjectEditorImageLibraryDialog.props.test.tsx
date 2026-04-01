import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProjectEditorImageLibraryDialog from "@/components/dashboard/project-editor/ProjectEditorImageLibraryDialog";

const { lazyDialogPropsSpy } = vi.hoisted(() => ({
  lazyDialogPropsSpy: vi.fn(),
}));

vi.mock("@/components/lazy/LazyImageLibraryDialog", () => ({
  default: (props: unknown) => {
    lazyDialogPropsSpy(props);
    return null;
  },
}));

describe("ProjectEditorImageLibraryDialog selection memoization", () => {
  it("mantem currentSelectionUrls estavel quando a selecao nao muda", () => {
    const activeLibraryOptions = {
      uploadFolder: "projects/project-1",
      listFolders: ["projects/project-1", "projects/project-1/episodes"],
      listAll: false,
      includeProjectImages: true,
      projectImageProjectIds: ["project-1"],
      projectImagesView: "by-project" as const,
    };

    const { rerender } = render(
      <ProjectEditorImageLibraryDialog
        activeLibraryOptions={activeLibraryOptions}
        apiBase="http://api.local"
        currentLibrarySelection="/uploads/projects/project-1/banner.png"
        isOpen
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />,
    );

    const firstProps = lazyDialogPropsSpy.mock.calls.at(-1)?.[0] as {
      currentSelectionUrls?: string[];
    };

    rerender(
      <ProjectEditorImageLibraryDialog
        activeLibraryOptions={activeLibraryOptions}
        apiBase="http://api.local"
        currentLibrarySelection="/uploads/projects/project-1/banner.png"
        isOpen
        onOpenChange={() => undefined}
        onSave={() => undefined}
      />,
    );

    const secondProps = lazyDialogPropsSpy.mock.calls.at(-1)?.[0] as {
      currentSelectionUrls?: string[];
    };

    expect(firstProps.currentSelectionUrls).toBe(secondProps.currentSelectionUrls);
    expect(secondProps.currentSelectionUrls).toEqual([
      "/uploads/projects/project-1/banner.png",
    ]);
  });
});
