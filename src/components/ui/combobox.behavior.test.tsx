import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Heart, Sparkles, Users } from "lucide-react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

const baseOptions: ComboboxOption[] = [
  { value: "sparkles", label: "Sparkles", icon: Sparkles },
  { value: "heart", label: "Heart", icon: Heart },
  { value: "users", label: "Users", icon: Users },
];

const manyOptions: ComboboxOption[] = Array.from({ length: 24 }, (_, index) => ({
  value: `option-${index + 1}`,
  label: `Option ${index + 1}`,
}));

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
const originalHasPointerCapture = window.HTMLElement.prototype.hasPointerCapture;
const originalSetPointerCapture = window.HTMLElement.prototype.setPointerCapture;
const originalReleasePointerCapture = window.HTMLElement.prototype.releasePointerCapture;

describe("Combobox", () => {
  beforeEach(() => {
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window.HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: vi.fn(() => false),
    });
    Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: originalScrollIntoView,
    });
    Object.defineProperty(window.HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: originalHasPointerCapture,
    });
    Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: originalSetPointerCapture,
    });
    Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: originalReleasePointerCapture,
    });
  });

  it("opens and closes by click while applying the shared visual contract", async () => {
    const Harness = () => {
      const [value, setValue] = React.useState("sparkles");
      return (
        <Combobox
          ariaLabel="Seleção principal"
          value={value}
          options={baseOptions}
          onValueChange={setValue}
          searchable={false}
        />
      );
    };

    render(<Harness />);

    const trigger = screen.getByRole("combobox", { name: "Seleção principal" });
    expect(classTokens(trigger)).toEqual(
      expect.arrayContaining([
        "rounded-xl",
        "border-border/60",
        "bg-background/60",
        "focus-visible:ring-inset",
      ]),
    );
    expect(within(trigger).getByText("Sparkles")).toHaveClass(
      "min-w-0",
      "truncate",
      "whitespace-nowrap",
    );

    fireEvent.click(trigger);

    const listbox = await screen.findByRole("listbox");
    const popover = listbox.parentElement as HTMLElement;
    expect(classTokens(listbox)).toEqual(
      expect.arrayContaining(["no-scrollbar", "max-h-64", "overflow-y-auto", "overscroll-contain"]),
    );
    expect(classTokens(popover)).toEqual(
      expect.arrayContaining(["rounded-2xl", "border-border/70", "bg-popover/95"]),
    );

    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    fireEvent.click(trigger);

    const heartOption = screen.getByRole("option", { name: "Heart" });
    expect(heartOption).toHaveClass("rounded-xl", "py-2", "pl-9", "pr-3");
    expect(classTokens(heartOption)).toContain("combobox-item-interaction-surface");
    expect(classTokens(heartOption)).not.toContain("hover:bg-accent/60");
    fireEvent.click(heartOption);

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("option", { name: "Heart" })).not.toBeInTheDocument();
    });
    expect(trigger).toHaveTextContent("Heart");
  });

  it("uses compact width and spacing when variant is compact", async () => {
    render(
      <Combobox
        ariaLabel="Compacto"
        value="sparkles"
        options={baseOptions}
        onValueChange={vi.fn()}
        searchable={false}
        variant="compact"
        className="w-[108px]"
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Compacto" });
    expect(classTokens(trigger)).toEqual(
      expect.arrayContaining(["min-h-8", "gap-2", "px-2.5", "py-1.5", "w-[108px]"]),
    );

    fireEvent.click(trigger);

    const listbox = await screen.findByRole("listbox");
    const popover = listbox.parentElement as HTMLElement;
    const sparklesOption = await screen.findByRole("option", { name: "Sparkles" });

    expect(classTokens(popover)).toEqual(
      expect.arrayContaining([
        "w-[var(--radix-popover-trigger-width)]",
        "min-w-[var(--radix-popover-trigger-width)]",
        "max-w-[calc(100vw-2rem)]",
        "p-2",
      ]),
    );
    expect(classTokens(popover)).not.toContain("min-w-[min(16rem,calc(100vw-2rem))]");
    expect(classTokens(sparklesOption)).toEqual(
      expect.arrayContaining([
        "py-1.5",
        "pl-8",
        "pr-2",
        "text-xs",
        "data-[state=checked]:bg-accent",
      ]),
    );
  });

  it("supports keyboard navigation, selection, Escape, Home and End", async () => {
    const Harness = () => {
      const [value, setValue] = React.useState("sparkles");
      return (
        <Combobox
          ariaLabel="Seleção teclado"
          value={value}
          options={baseOptions}
          onValueChange={setValue}
          searchable={false}
        />
      );
    };

    render(<Harness />);

    const trigger = screen.getByRole("combobox", { name: "Seleção teclado" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });

    const firstOption = await screen.findByRole("option", { name: "Sparkles" });
    await waitFor(() => {
      expect(firstOption).toHaveFocus();
    });

    fireEvent.keyDown(firstOption, { key: "End", code: "End" });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Users" })).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole("option", { name: "Users" }), {
      key: "Home",
      code: "Home",
    });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Sparkles" })).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole("option", { name: "Sparkles" }), {
      key: "ArrowDown",
      code: "ArrowDown",
    });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Heart" })).toHaveFocus();
    });

    fireEvent.keyDown(screen.getByRole("option", { name: "Heart" }), {
      key: "Enter",
      code: "Enter",
    });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
    expect(trigger).toHaveTextContent("Heart");

    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
    await screen.findByRole("option", { name: "Heart" });
    fireEvent.keyDown(screen.getByRole("option", { name: "Heart" }), {
      key: "Escape",
      code: "Escape",
    });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveFocus();
    });
  });

  it("keeps only one dropdown open at a time, including controlled instances", async () => {
    const Harness = () => {
      const [firstOpen, setFirstOpen] = React.useState(false);
      return (
        <div>
          <Combobox
            ariaLabel="Primeiro"
            value="sparkles"
            options={baseOptions}
            open={firstOpen}
            onOpenChange={setFirstOpen}
            onValueChange={vi.fn()}
            searchable={false}
          />
          <Combobox
            ariaLabel="Segundo"
            value="users"
            options={baseOptions}
            onValueChange={vi.fn()}
            searchable={false}
          />
        </div>
      );
    };

    render(<Harness />);

    const firstTrigger = screen.getByRole("combobox", { name: "Primeiro" });
    const secondTrigger = screen.getByRole("combobox", { name: "Segundo" });

    fireEvent.click(firstTrigger);
    expect(await screen.findByRole("option", { name: "Sparkles" })).toBeInTheDocument();

    fireEvent.click(secondTrigger);

    await waitFor(() => {
      expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.getAllByRole("listbox")).toHaveLength(1);
    });
    expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("option", { name: "Users" })).toBeInTheDocument();
  });

  it("clears pointer highlight when the mouse leaves an option", async () => {
    render(
      <Combobox
        ariaLabel="Hover"
        value="sparkles"
        options={baseOptions}
        onValueChange={vi.fn()}
        searchable={false}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Hover" }));

    const heartOption = await screen.findByRole("option", { name: "Heart" });
    fireEvent.mouseEnter(heartOption);
    expect(heartOption).toHaveAttribute("data-highlighted");

    fireEvent.mouseLeave(heartOption);
    await waitFor(() => {
      expect(heartOption).not.toHaveAttribute("data-highlighted");
    });
  });

  it("renders rich icons in the trigger and listbox", async () => {
    render(
      <Combobox
        ariaLabel="Seleção rica"
        value="heart"
        options={baseOptions}
        onValueChange={vi.fn()}
        searchable={false}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Seleção rica" });
    expect(within(trigger).getByText("Heart").parentElement).toHaveClass(
      "flex",
      "items-center",
      "gap-2",
      "overflow-hidden",
    );

    fireEvent.click(trigger);

    const richOption = await screen.findByRole("option", { name: "Heart" });
    expect(richOption).toHaveAttribute("data-state", "checked");
    expect(classTokens(richOption)).toContain("data-[state=checked]:bg-accent");
    expect(within(richOption).getByText("Heart").parentElement).toHaveClass(
      "flex",
      "items-center",
      "gap-2",
      "overflow-hidden",
    );
  });

  it("renders the search field only for searchable lists with more than 15 options", async () => {
    render(
      <div>
        <Combobox
          ariaLabel="Busca curta"
          value="option-1"
          options={manyOptions.slice(0, 15)}
          onValueChange={vi.fn()}
          searchable
          searchPlaceholder="Buscar opção"
        />
        <Combobox
          ariaLabel="Busca longa"
          value="option-1"
          options={manyOptions}
          onValueChange={vi.fn()}
          searchable
          searchPlaceholder="Buscar opcao"
        />
      </div>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Busca curta" }));
    expect(await screen.findByRole("option", { name: "Option 15" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Buscar opcao")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Busca longa" }));
    const searchInput = await screen.findByPlaceholderText("Buscar opcao");
    fireEvent.change(searchInput, { target: { value: "24" } });

    expect(await screen.findByRole("option", { name: "Option 24" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Option 1" })).not.toBeInTheDocument();
  });

  it("loads more options on scroll instead of rendering a show more button", async () => {
    render(
      <Combobox
        ariaLabel="Rolagem"
        value="option-1"
        options={manyOptions}
        onValueChange={vi.fn()}
        searchable={false}
        initialVisibleCount={8}
        visibleCountStep={8}
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Rolagem" }));

    const listbox = await screen.findByRole("listbox");
    expect(screen.getByRole("option", { name: "Option 8" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Option 16" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mostrar mais/i })).not.toBeInTheDocument();

    Object.defineProperty(listbox, "scrollTop", { configurable: true, value: 180 });
    Object.defineProperty(listbox, "clientHeight", { configurable: true, value: 120 });
    Object.defineProperty(listbox, "scrollHeight", { configurable: true, value: 320 });
    fireEvent.scroll(listbox);

    expect(await screen.findByRole("option", { name: "Option 16" })).toBeInTheDocument();
  });

  it("supports editable custom values with allowCreate", async () => {
    const onCommit = vi.fn();
    const Harness = () => {
      const [inputValue, setInputValue] = React.useState("");
      return (
        <Combobox
          ariaLabel="Membro"
          value={inputValue}
          inputValue={inputValue}
          onInputValueChange={setInputValue}
          onValueChange={onCommit}
          options={[{ value: "Ana", label: "Ana" }]}
          placeholder="Adicionar membro"
          searchable
          allowCreate
          createLabel={(value) => `Adicionar "${value}"`}
        />
      );
    };

    render(<Harness />);

    const input = screen.getByRole("combobox", { name: "Membro" });
    fireEvent.change(input, { target: { value: "Bea" } });

    const createOption = await screen.findByRole("option", { name: 'Adicionar "Bea"' });
    fireEvent.click(createOption);

    expect(onCommit).toHaveBeenCalledWith("Bea");
  });
});
