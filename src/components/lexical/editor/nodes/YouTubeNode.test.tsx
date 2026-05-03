import type { ReactNode } from "react";

import { render } from "@testing-library/react";
import { createEditor } from "lexical";
import { describe, expect, it, vi } from "vitest";

vi.mock("@lexical/react/LexicalBlockWithAlignableContents", () => ({
  BlockWithAlignableContents: ({ children }: { children: ReactNode }) => (
    <div data-testid="youtube-block">{children}</div>
  ),
}));

import { YouTubeNode } from "@/components/lexical/editor/nodes/YouTubeNode";

describe("YouTubeNode", () => {
  it("renderiza o embed sem limitar a largura maxima do wrapper", () => {
    const editor = createEditor({
      namespace: "YouTubeNodeTest",
      nodes: [YouTubeNode],
      onError: (error) => {
        throw error;
      },
    });

    let decoratedElement: ReturnType<YouTubeNode["decorate"]> | null = null;

    editor.update(() => {
      const node = new YouTubeNode("dQw4w9WgXcQ");
      decoratedElement = node.decorate(
        {} as never,
        {
          theme: {
            embedBlock: {
              base: "embed-base",
              focus: "embed-focus",
            },
          },
        } as never,
      );
    });

    const { container } = render(decoratedElement);
    const wrapper = container.querySelector(".lexical-youtube") as HTMLElement | null;
    const iframe = container.querySelector(
      'iframe[data-lexical-youtube-iframe="true"]',
    ) as HTMLIFrameElement | null;

    expect(wrapper).not.toBeNull();
    expect(iframe).not.toBeNull();
    expect(wrapper?.style.width).toBe("100%");
    expect(wrapper?.style.maxWidth).toBe("");
    expect(iframe?.style.width).toBe("100%");
    expect(iframe?.style.maxWidth).toBe("100%");
    expect(iframe?.style.aspectRatio).toBe("16 / 9");
  });
});
