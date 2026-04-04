import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DashboardReaderPresetCard from "@/components/dashboard/DashboardReaderPresetCard";

const mojibakePattern = /(?:\u00C3.|\u00E2.|\uFFFD)/;
const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

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

    const rtlBadgeReveal = screen.getByText("RTL").parentElement?.parentElement;
    const singleBadgeReveal = screen.getByText("Única").parentElement?.parentElement;

    expect(rtlBadgeReveal).not.toBeNull();
    expect(classTokens(rtlBadgeReveal as HTMLElement)).not.toContain("reveal");
    expect(rtlBadgeReveal).not.toHaveAttribute("data-reveal");

    expect(singleBadgeReveal).not.toBeNull();
    expect(classTokens(singleBadgeReveal as HTMLElement)).not.toContain("reveal");
    expect(singleBadgeReveal).not.toHaveAttribute("data-reveal");
  });

  it("renders the new reader config controls and updates the site visibility switches", () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const onUpdate = vi.fn();
    const preset = {
      direction: "rtl" as const,
      layout: "single" as const,
      imageFit: "both" as const,
      background: "theme" as const,
      progressStyle: "default" as const,
      progressPosition: "bottom" as const,
      firstPageSingle: true,
      chromeMode: "default" as const,
      viewportMode: "viewport" as const,
      siteHeaderVariant: "fixed" as const,
      showSiteFooter: true,
      previewLimit: null,
      purchaseUrl: "",
      purchasePrice: "",
    };

    render(
      <DashboardReaderPresetCard
        cardClassName=""
        preset={preset}
        presetMeta={{
          key: "webtoon",
          title: "Webtoon",
          description: "Preset de teste",
          projectType: "webtoon",
        }}
        onUpdate={onUpdate}
      />,
    );

    const card = screen.getByTestId("reader-preset-webtoon");
    expect(
      within(card).getByRole("combobox", {
        name: "Selecionar chrome do leitor",
      }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("combobox", {
        name: "Selecionar fluxo do viewport",
      }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("combobox", {
        name: "Selecionar comportamento do header do site",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(card).getByRole("combobox", {
        name: "Selecionar comportamento do header do site",
      }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Estática" }));
    expect(onUpdate).toHaveBeenCalledWith("webtoon", expect.any(Function));
    const headerUpdater = onUpdate.mock.calls.at(-1)?.[1] as
      | ((value: typeof preset) => unknown)
      | undefined;
    expect(headerUpdater?.(preset)).toMatchObject({
      siteHeaderVariant: "static",
    });

    fireEvent.click(within(card).getByRole("switch", { name: /Rodap.* do site/i }));
    const footerUpdater = onUpdate.mock.calls.at(-1)?.[1] as
      | ((value: typeof preset) => unknown)
      | undefined;
    expect(footerUpdater?.(preset)).toMatchObject({
      showSiteFooter: false,
    });
  });

  it("does not contain mojibake in the source file", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/components/dashboard/DashboardReaderPresetCard.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(mojibakePattern);
  });
});
