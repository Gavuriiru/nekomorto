import { act } from "react";
import { createRoot } from "react-dom/client";
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
  previewHtml: '<img src="x" onerror="alert(1)"><script>alert(2)</script><p>Preview seguro</p>',
  title: "Titulo",
  excerpt: "Resumo",
});

describe("PostContentEditor security", () => {
  it("sanitizes preview HTML before rendering it", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<PostContentEditor {...createProps()} />);
    });

    expect(container.textContent).toContain("Preview seguro");

    const previewRoot = container.querySelector(".post-content");
    const previewImage = previewRoot?.querySelector("img");

    expect(previewRoot?.querySelector("script")).toBeNull();
    expect(previewImage).not.toBeNull();
    expect(previewImage?.getAttribute("onerror")).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
