import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

describe("Input line-height contract", () => {
  it("keeps desktop font-size responsive without reintroducing text-sm line-height", () => {
    render(<Input placeholder="Digite EXCLUIR" />);

    const input = screen.getByPlaceholderText("Digite EXCLUIR");
    const tokens = classTokens(input);

    expect(tokens).toContain("h-10");
    expect(tokens).toContain("appearance-none");
    expect(tokens).toContain("py-0");
    expect(tokens).toContain("text-base");
    expect(tokens).toContain("leading-normal");
    expect(tokens).toContain("placeholder:leading-normal");
    expect(tokens).toContain("md:text-[14px]");
    expect(tokens).not.toContain("py-2");
    expect(tokens).not.toContain("leading-5");
    expect(tokens).not.toContain("md:text-sm");
  });
});
