import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DashboardReaderPresetCard from "@/components/dashboard/DashboardReaderPresetCard";

const mojibakePattern = /(?:\u00C3.|\u00E2.|\uFFFD)/;

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

    expect(await screen.findByRole("option", { name: "Padrão" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Oculto" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Barra/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Glow|Brilho/i })).not.toBeInTheDocument();
  });

  it("renders corrected reader labels and omits legacy inputs", () => {
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
          description: "Preset global usado por projetos de mangá.",
          projectType: "manga",
        }}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Mangá" })).toBeInTheDocument();
    expect(screen.getByText("Direção")).toBeInTheDocument();
    expect(screen.getByText("Posição do progresso")).toBeInTheDocument();
    expect(screen.getByText("Primeira página isolada")).toBeInTheDocument();
    expect(
      screen.getByText("Útil para capas e páginas ímpares nos layouts paginados."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/Limite de preview/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/URL de compra/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Preço exibido/i)).not.toBeInTheDocument();
  });

  it("does not contain mojibake in the source file", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/components/dashboard/DashboardReaderPresetCard.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(mojibakePattern);
  });
});
