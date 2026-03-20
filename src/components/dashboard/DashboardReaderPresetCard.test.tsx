import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DashboardReaderPresetCard from "@/components/dashboard/DashboardReaderPresetCard";

describe("DashboardReaderPresetCard", () => {
  it("shows only the default and hidden progress styles", async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();

    render(
      <DashboardReaderPresetCard
        cardClassName=""
        preset={{
          direction: "rtl",
          layout: "single",
          imageFit: "both",
          background: "theme",
          progressStyle: "default",
          progressPosition: "bottom",
          firstPageSingle: true,
          previewLimit: null,
          purchaseUrl: "",
          purchasePrice: "",
        }}
        presetMeta={{
          key: "manga",
          title: "Mangá",
          description: "Preset de teste",
          projectType: "manga",
        }}
        onUpdate={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("combobox", {
      name: "Selecionar estilo do progresso",
    });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });

    expect(await screen.findByRole("option", { name: /Padr/i })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Oculto" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Barra/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Glow|Brilho/i })).not.toBeInTheDocument();
  });
});
