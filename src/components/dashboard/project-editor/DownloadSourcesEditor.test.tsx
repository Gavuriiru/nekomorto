import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DownloadSourcesEditor from "@/components/dashboard/project-editor/DownloadSourcesEditor";
import type { DownloadSource } from "@/data/projects";

const buildDataTransfer = () => {
  const store = new Map<string, string>();
  return {
    dropEffect: "",
    effectAllowed: "",
    getData: (type: string) => store.get(type) || "",
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
  };
};

const sources: DownloadSource[] = [
  { label: "Torrent", url: "https://example.com/torrent" },
  { label: "Mega", url: "https://example.com/mega" },
];

describe("DownloadSourcesEditor", () => {
  it("reordena fontes por drag and drop", () => {
    const onChange = vi.fn();
    render(
      <DownloadSourcesEditor
        sources={sources}
        sourceAriaLabelPrefix="Fonte"
        onChange={onChange}
      />,
    );

    const firstHandle = screen.getByLabelText("Reordenar fonte 1");
    const secondHandle = screen.getByLabelText("Reordenar fonte 2");
    const secondCard = secondHandle.parentElement;
    const dataTransfer = buildDataTransfer();

    expect(secondCard).not.toBeNull();

    fireEvent.dragStart(firstHandle, { dataTransfer });
    fireEvent.dragOver(secondCard as HTMLElement, { dataTransfer });
    fireEvent.drop(secondCard as HTMLElement, { dataTransfer });

    expect(onChange).toHaveBeenCalledWith([
      { label: "Mega", url: "https://example.com/mega" },
      { label: "Torrent", url: "https://example.com/torrent" },
    ]);
  });

  it("exibe estado vazio quando nao ha fontes", () => {
    render(
      <DownloadSourcesEditor sources={[]} sourceAriaLabelPrefix="Fonte" onChange={vi.fn()} />,
    );

    expect(screen.getByText("Nenhuma fonte cadastrada.")).toBeInTheDocument();
  });
});
