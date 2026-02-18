import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DashboardAutosaveStatus from "@/components/DashboardAutosaveStatus";

const classTokens = (element: HTMLElement) => String(element.className).split(/\s+/).filter(Boolean);

describe("DashboardAutosaveStatus mobile layout", () => {
  it("usa container em coluna no mobile e linha no desktop", () => {
    const onToggleMock = vi.fn();
    const onManualSaveMock = vi.fn();
    const { container } = render(
      <DashboardAutosaveStatus
        title="Autosave das paginas"
        status="idle"
        enabled
        onEnabledChange={onToggleMock}
        lastSavedAt={null}
        onManualSave={onManualSaveMock}
        manualActionLabel="Salvar alteracoes"
      />,
    );

    const root = container.firstElementChild as HTMLElement | null;
    expect(root).not.toBeNull();

    const rootTokens = classTokens(root as HTMLElement);
    expect(rootTokens).toContain("flex-col");
    expect(rootTokens).toContain("w-full");
    expect(rootTokens).toContain("max-w-full");
    expect(rootTokens).toContain("sm:w-auto");
    expect(rootTokens).toContain("sm:flex-row");
  });

  it("mantem toggle e botao manual com largura responsiva", () => {
    const onToggleMock = vi.fn();
    const onManualSaveMock = vi.fn();
    render(
      <DashboardAutosaveStatus
        title="Autosave das configuracoes"
        status="saved"
        enabled
        onEnabledChange={onToggleMock}
        lastSavedAt={Date.now()}
        onManualSave={onManualSaveMock}
        manualActionLabel="Salvar ajustes"
      />,
    );

    const autosaveSwitch = screen.getByRole("switch", { name: "Alternar autosave" });
    expect(autosaveSwitch).toBeInTheDocument();

    const manualButton = screen.getByRole("button", { name: /Salvar ajustes|Salvo/i });
    const buttonTokens = classTokens(manualButton);
    expect(buttonTokens).toContain("w-full");
    expect(buttonTokens).toContain("sm:w-42");
  });

  it("usa tom discreto no mobile quando autosave esta ativo e sem erro", () => {
    const onToggleMock = vi.fn();
    const onManualSaveMock = vi.fn();
    render(
      <DashboardAutosaveStatus
        title="Autosave das configuracoes"
        status="saved"
        enabled
        onEnabledChange={onToggleMock}
        lastSavedAt={Date.now()}
        onManualSave={onManualSaveMock}
        manualActionLabel="Salvar ajustes"
      />,
    );

    const manualButton = screen.getByRole("button", { name: /Salvar ajustes|Salvo/i });
    const buttonTokens = classTokens(manualButton);
    expect(buttonTokens).toContain("bg-secondary");
    expect(buttonTokens).toContain("shadow-none");
  });

  it("destaca o botao no mobile quando status esta em erro", () => {
    const onToggleMock = vi.fn();
    const onManualSaveMock = vi.fn();
    render(
      <DashboardAutosaveStatus
        title="Autosave das configuracoes"
        status="error"
        enabled
        onEnabledChange={onToggleMock}
        lastSavedAt={Date.now()}
        onManualSave={onManualSaveMock}
        manualActionLabel="Salvar ajustes"
      />,
    );

    const manualButton = screen.getByRole("button", { name: /Salvar ajustes|Salvo/i });
    const buttonTokens = classTokens(manualButton);
    expect(buttonTokens).not.toContain("bg-secondary");
    expect(buttonTokens).toContain("shadow-md");
  });

  it("destaca o botao no mobile quando autosave esta desativado", () => {
    const onToggleMock = vi.fn();
    const onManualSaveMock = vi.fn();
    render(
      <DashboardAutosaveStatus
        title="Autosave das configuracoes"
        status="idle"
        enabled={false}
        onEnabledChange={onToggleMock}
        lastSavedAt={Date.now()}
        onManualSave={onManualSaveMock}
        manualActionLabel="Salvar ajustes"
      />,
    );

    const manualButton = screen.getByRole("button", { name: /Salvar ajustes|Salvo/i });
    const buttonTokens = classTokens(manualButton);
    expect(buttonTokens).not.toContain("bg-secondary");
    expect(buttonTokens).toContain("shadow-md");
  });
});
