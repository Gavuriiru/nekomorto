import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LazyImageLibraryDialog from "@/components/lazy/LazyImageLibraryDialog";

const { imageLibraryDialogSpy } = vi.hoisted(() => ({
  imageLibraryDialogSpy: vi.fn(),
}));

vi.mock("@/components/ImageLibraryDialog", () => ({
  default: (props: unknown) => {
    imageLibraryDialogSpy(props);
    return <div data-testid="image-library-dialog" />;
  },
}));

describe("LazyImageLibraryDialog", () => {
  it("nao monta o dialogo quando fechado", () => {
    imageLibraryDialogSpy.mockClear();

    render(
      <LazyImageLibraryDialog
        open={false}
        onOpenChange={vi.fn()}
        apiBase="http://api.local"
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("image-library-dialog")).not.toBeInTheDocument();
    expect(imageLibraryDialogSpy).not.toHaveBeenCalled();
  });

  it("renderiza o dialogo quando aberto", async () => {
    imageLibraryDialogSpy.mockClear();

    render(
      <LazyImageLibraryDialog
        open
        onOpenChange={vi.fn()}
        apiBase="http://api.local"
        onSave={vi.fn()}
      />,
    );

    expect(await screen.findByTestId("image-library-dialog")).toBeInTheDocument();
    expect(imageLibraryDialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        apiBase: "http://api.local",
      }),
    );
  });
});
