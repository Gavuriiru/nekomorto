import * as React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DownloadSourceSelect from "@/components/project-reader/DownloadSourceSelect";

const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
const originalHasPointerCapture = window.HTMLElement.prototype.hasPointerCapture;
const originalSetPointerCapture = window.HTMLElement.prototype.setPointerCapture;
const originalReleasePointerCapture = window.HTMLElement.prototype.releasePointerCapture;

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettings: () => ({
    settings: {
      downloads: {
        sources: [
          { label: "Google Drive", icon: "google-drive", color: "#7c3aed" },
          { label: "MEGA", icon: "mega", color: "#ef4444" },
          { label: "Telegram", icon: "telegram", color: "#38bdf8" },
        ],
      },
    },
  }),
}));

describe("DownloadSourceSelect", () => {
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

  it("mantem o conteudo rico visivel e usa o contrato visual compartilhado", async () => {
    const onValueChange = vi.fn();
    const Harness = () => {
      const [value, setValue] = React.useState("");

      return (
        <DownloadSourceSelect
          ariaLabel="Fonte de download"
          value={value}
          onValueChange={(nextValue) => {
            onValueChange(nextValue);
            setValue(nextValue);
          }}
        />
      );
    };

    render(<Harness />);

    const trigger = screen.getByRole("combobox", { name: "Fonte de download" });
    expect(trigger).toHaveClass("rounded-xl", "border-border/60", "bg-background/60");

    fireEvent.click(trigger);

    const megaOption = await screen.findByRole("option", { name: "MEGA" });
    const googleDriveOption = screen.getByRole("option", { name: "Google Drive" });
    const megaLabel = within(megaOption).getByText("MEGA");

    expect(megaOption).toHaveClass("rounded-xl", "py-2", "pl-9", "pr-3");
    expect(megaLabel).toHaveClass("min-w-0", "truncate", "whitespace-nowrap");
    expect(megaLabel.parentElement).toHaveClass(
      "flex",
      "min-w-0",
      "max-w-full",
      "flex-nowrap",
      "items-center",
      "gap-2",
      "overflow-hidden",
    );
    expect(megaLabel.parentElement?.querySelector("svg")).not.toBeNull();
    expect(googleDriveOption.querySelector("svg")).not.toBeNull();

    fireEvent.click(megaOption);

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith("MEGA");
      expect(trigger).toHaveTextContent("MEGA");
    });

    const selectedTriggerLabel = within(trigger).getByText("MEGA");
    expect(selectedTriggerLabel).toHaveClass("min-w-0", "truncate", "whitespace-nowrap");
    expect(selectedTriggerLabel.parentElement).toHaveClass(
      "flex",
      "min-w-0",
      "max-w-full",
      "flex-nowrap",
      "items-center",
      "gap-2",
      "overflow-hidden",
    );
    expect(selectedTriggerLabel.parentElement?.querySelector("svg")).not.toBeNull();
  });
});
