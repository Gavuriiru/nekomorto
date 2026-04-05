import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

const TestSelect = ({
  label,
  placeholder,
  options,
  open,
  onOpenChange,
}: {
  label: string;
  placeholder: string;
  options: string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => (
  <Select open={open} onOpenChange={onOpenChange}>
    <SelectTrigger aria-label={label}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      {options.map((option) => (
        <SelectItem key={option} value={option}>
          {option}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const UncontrolledHarness = () => (
  <div>
    <TestSelect
      label="Primeiro select"
      placeholder="Primeira opção"
      options={["Alpha", "Beta"]}
    />
    <TestSelect
      label="Segundo select"
      placeholder="Segunda opção"
      options={["Gamma", "Delta"]}
    />
    <button type="button">Fora dos dropdowns</button>
  </div>
);

const ControlledHarness = () => {
  const [firstOpen, setFirstOpen] = React.useState(false);

  return (
    <div>
      <TestSelect
        label="Primeiro select controlado"
        placeholder="Primeira opção"
        options={["Alpha", "Beta"]}
        open={firstOpen}
        onOpenChange={setFirstOpen}
      />
      <TestSelect
        label="Segundo select"
        placeholder="Segunda opção"
        options={["Gamma", "Delta"]}
      />
    </div>
  );
};

const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
const originalHasPointerCapture = window.HTMLElement.prototype.hasPointerCapture;
const originalSetPointerCapture = window.HTMLElement.prototype.setPointerCapture;
const originalReleasePointerCapture = window.HTMLElement.prototype.releasePointerCapture;

describe("Select exclusive open behavior", () => {
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

  it("keeps only one uncontrolled select open at a time", async () => {
    render(<UncontrolledHarness />);

    const firstTrigger = screen.getByRole("combobox", { name: "Primeiro select" });
    const secondTrigger = screen.getByRole("combobox", { name: "Segundo select" });

    firstTrigger.focus();
    fireEvent.keyDown(firstTrigger, { key: "ArrowDown", code: "ArrowDown" });

    await waitFor(() => {
      expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
    });
    expect(await screen.findByRole("option", { name: "Alpha" })).toBeInTheDocument();
    expect(classTokens(screen.getByRole("listbox"))).toContain(
      "shadow-[0_18px_54px_-42px_rgba(0,0,0,0.55)]",
    );

    secondTrigger.focus();
    fireEvent.keyDown(secondTrigger, { key: "ArrowDown", code: "ArrowDown" });

    await waitFor(() => {
      expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("option", { name: "Alpha" })).not.toBeInTheDocument();
    });

    expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("option", { name: "Gamma" })).toBeInTheDocument();
  });

  it("closes a controlled select when another select opens", async () => {
    render(<ControlledHarness />);

    const firstTrigger = screen.getByRole("combobox", { name: "Primeiro select controlado" });
    const secondTrigger = screen.getByRole("combobox", { name: "Segundo select" });

    firstTrigger.focus();
    fireEvent.keyDown(firstTrigger, { key: "ArrowDown", code: "ArrowDown" });

    await waitFor(() => {
      expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
    });
    expect(await screen.findByRole("option", { name: "Alpha" })).toBeInTheDocument();
    expect(classTokens(screen.getByRole("listbox"))).toContain(
      "shadow-[0_18px_54px_-42px_rgba(0,0,0,0.55)]",
    );

    secondTrigger.focus();
    fireEvent.keyDown(secondTrigger, { key: "ArrowDown", code: "ArrowDown" });

    await waitFor(() => {
      expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("option", { name: "Alpha" })).not.toBeInTheDocument();
    });

    expect(secondTrigger).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("option", { name: "Gamma" })).toBeInTheDocument();
  });

  it("still closes the active select on Escape", async () => {
    render(<UncontrolledHarness />);

    const trigger = screen.getByRole("combobox", { name: "Primeiro select" });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown" });
    expect(await screen.findByRole("option", { name: "Alpha" })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape", code: "Escape" });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("option", { name: "Alpha" })).not.toBeInTheDocument();
    });
  });
});
