import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PostContentEditor from "./PostContentEditor";

const createProps = () => ({
  format: "markdown" as const,
  value: "conteudo",
  onFormatChange: vi.fn(),
  onChange: vi.fn(),
  onApplyWrap: vi.fn(),
  onApplyHeading: vi.fn(),
  onApplyUnorderedList: vi.fn(),
  onApplyOrderedList: vi.fn(),
  onAlign: vi.fn(),
  onColor: vi.fn(),
  textColorValue: "#111111",
  backgroundColorValue: "#ffffff",
  onPickTextColor: vi.fn(),
  onPickBackgroundColor: vi.fn(),
  gradientStart: "#111111",
  gradientEnd: "#222222",
  gradientAngle: 90,
  gradientTarget: "text" as const,
  onGradientStartChange: vi.fn(),
  onGradientEndChange: vi.fn(),
  onGradientAngleChange: vi.fn(),
  onGradientTargetChange: vi.fn(),
  onApplyGradient: vi.fn(),
  onOpenImageDialog: vi.fn(),
  onOpenLinkDialog: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onEmbedVideo: vi.fn(),
  onKeyDown: vi.fn(),
  onDrop: vi.fn(),
  previewHtml: "<p>Preview seguro</p>",
  title: "Titulo",
  excerpt: "Resumo",
});

const findToolbarColorPickerButtons = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("button")).filter((button) =>
    String(button.className).includes("bg-secondary/40"),
  );

describe("PostContentEditor color pickers", () => {
  it("aplica a cor do texto sem travar o scroll da pagina", async () => {
    const user = userEvent.setup();
    const props = createProps();
    const { container } = render(<PostContentEditor {...props} />);

    const colorButtons = findToolbarColorPickerButtons(container);
    expect(colorButtons).toHaveLength(2);

    await user.click(colorButtons[0] as HTMLButtonElement);

    const hexInput = await screen.findByLabelText("Hex");
    await user.clear(hexInput);
    await user.type(hexInput, "#123456");
    await user.tab();

    await waitFor(() => {
      expect(props.onPickTextColor).toHaveBeenCalled();
      expect(props.onPickTextColor).toHaveBeenLastCalledWith("#123456");
      expect(props.onColor).toHaveBeenCalled();
      expect(props.onColor).toHaveBeenLastCalledWith("#123456", "text");
      expect(document.body.getAttribute("data-scroll-locked")).toBeNull();
      expect(document.documentElement.style.overflow).not.toBe("hidden");
    });
  });

  it("mantem o popover de gradiente aberto ao usar os color pickers internos", async () => {
    const user = userEvent.setup();
    const props = createProps();
    const { container } = render(<PostContentEditor {...props} />);

    const gradientButton = container.querySelector('button[title="Gradiente"]');
    expect(gradientButton).not.toBeNull();

    await user.click(gradientButton as HTMLButtonElement);

    expect(await screen.findByRole("button", { name: /Aplicar gradiente/i })).toBeInTheDocument();

    const startButtonLabel = screen.getByText(/^In/i);
    const startButton = startButtonLabel.closest("button");
    expect(startButton).not.toBeNull();

    await user.click(startButton as HTMLButtonElement);

    const hexInputs = await screen.findAllByLabelText("Hex");
    const nestedHexInput = hexInputs[hexInputs.length - 1];
    await user.clear(nestedHexInput);
    await user.type(nestedHexInput, "#abcdef");
    await user.tab();

    await waitFor(() => {
      expect(props.onGradientStartChange).toHaveBeenCalled();
      expect(props.onGradientStartChange.mock.lastCall?.[0]).toMatch(/^#abcdef$/i);
      expect(screen.getByRole("button", { name: /Aplicar gradiente/i })).toBeInTheDocument();
      expect(document.body.getAttribute("data-scroll-locked")).toBeNull();
      expect(document.documentElement.style.overflow).not.toBe("hidden");
    });
  });
});
