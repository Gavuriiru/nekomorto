import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Heart, Sparkles, Users } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardLightSelect from "@/components/dashboard/DashboardLightSelect";

const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

const baseOptions = [
  { value: "sparkles", label: "Sparkles", icon: Sparkles },
  { value: "heart", label: "Heart", icon: Heart },
  { value: "users", label: "Users", icon: Users },
];

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

describe("DashboardLightSelect", () => {
  beforeEach(() => {
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it("abre e fecha por clique e seleciona uma opcao", async () => {
    const Harness = () => {
      const [value, setValue] = React.useState("sparkles");

      return (
        <DashboardLightSelect
          ariaLabel="Selecao principal"
          value={value}
          options={baseOptions}
          onValueChange={setValue}
        />
      );
    };

    render(<Harness />);

    const trigger = screen.getByRole("combobox", { name: "Selecao principal" });
    fireEvent.click(trigger);

    expect(
      await screen.findByRole("option", { name: "Heart" }),
    ).toBeInTheDocument();
    expect(classTokens(screen.getByRole("listbox"))).toContain(
      "shadow-[0_18px_54px_-42px_rgba(0,0,0,0.55)]",
    );

    fireEvent.click(screen.getByRole("option", { name: "Heart" }));

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.queryByRole("option", { name: "Heart" }),
      ).not.toBeInTheDocument();
    });
    expect(trigger).toHaveTextContent("Heart");
  });

  it("fecha ao clicar fora", async () => {
    const Harness = () => {
      const [value, setValue] = React.useState("sparkles");

      return (
        <div>
          <DashboardLightSelect
            ariaLabel="Selecao com outside"
            value={value}
            options={baseOptions}
            onValueChange={setValue}
          />
          <button type="button">Fora</button>
        </div>
      );
    };

    render(<Harness />);

    const trigger = screen.getByRole("combobox", {
      name: "Selecao com outside",
    });
    fireEvent.click(trigger);
    expect(
      await screen.findByRole("option", { name: "Sparkles" }),
    ).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Fora" }));

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.queryByRole("option", { name: "Sparkles" }),
      ).not.toBeInTheDocument();
    });
  });

  it("navega com setas, confirma com Enter e fecha com Escape devolvendo foco", async () => {
    const Harness = () => {
      const [value, setValue] = React.useState("sparkles");

      return (
        <DashboardLightSelect
          ariaLabel="Selecao teclado"
          value={value}
          options={baseOptions}
          onValueChange={setValue}
        />
      );
    };

    render(<Harness />);

    const trigger = screen.getByRole("combobox", { name: "Selecao teclado" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });

    const firstOption = await screen.findByRole("option", { name: "Sparkles" });
    expect(firstOption).toHaveFocus();

    fireEvent.keyDown(firstOption, { key: "ArrowDown", code: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Heart" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("option", { name: "Heart" }), {
      key: "Enter",
      code: "Enter",
    });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
    expect(trigger).toHaveTextContent("Heart");

    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Heart" })).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole("option", { name: "Heart" }), {
      key: "Escape",
      code: "Escape",
    });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveFocus();
    });
  });

  it("mantem apenas um dropdown aberto por vez", async () => {
    const Harness = () => {
      const [firstValue, setFirstValue] = React.useState("sparkles");
      const [secondValue, setSecondValue] = React.useState("users");

      return (
        <div>
          <DashboardLightSelect
            ariaLabel="Primeiro select"
            value={firstValue}
            options={baseOptions}
            onValueChange={setFirstValue}
          />
          <DashboardLightSelect
            ariaLabel="Segundo select"
            value={secondValue}
            options={[
              { value: "users", label: "Users", icon: Users },
              { value: "heart", label: "Heart", icon: Heart },
            ]}
            onValueChange={setSecondValue}
          />
        </div>
      );
    };

    render(<Harness />);

    const firstTrigger = screen.getByRole("combobox", {
      name: "Primeiro select",
    });
    const secondTrigger = screen.getByRole("combobox", {
      name: "Segundo select",
    });

    fireEvent.click(firstTrigger);
    expect(
      await screen.findByRole("option", { name: "Sparkles" }),
    ).toBeInTheDocument();

    fireEvent.click(secondTrigger);

    await waitFor(() => {
      expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
      expect(
        screen.queryByRole("option", { name: "Sparkles" }),
      ).not.toBeInTheDocument();
    });
    expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    expect(
      await screen.findByRole("option", { name: "Users" }),
    ).toBeInTheDocument();
  });
});
