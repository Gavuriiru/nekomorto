import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CompactPagination from "@/components/ui/compact-pagination";

const stubImmediateAnimationFrame = () => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
};

const stubBlur = (link: HTMLAnchorElement) => {
  const blurSpy = vi.fn();
  Object.defineProperty(link, "blur", {
    configurable: true,
    value: blurSpy,
  });
  return blurSpy;
};

describe("CompactPagination", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza todas as paginas quando o total e pequeno", () => {
    const onPageChange = vi.fn();

    render(<CompactPagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);

    expect(screen.getByRole("link", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "5" })).toBeInTheDocument();
    expect(screen.queryByText("Mais p\u00E1ginas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "5" }));

    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it("renderiza uma janela compacta no meio da faixa", () => {
    render(<CompactPagination currentPage={10} totalPages={20} onPageChange={vi.fn()} />);

    expect(screen.getByRole("link", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "9" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "10" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "11" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "20" })).toBeInTheDocument();
    expect(screen.getAllByText("Mais p\u00E1ginas")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "2" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "15" })).not.toBeInTheDocument();
  });

  it("expande a janela perto do inicio e do fim", () => {
    const { rerender } = render(
      <CompactPagination currentPage={4} totalPages={20} onPageChange={vi.fn()} />,
    );

    expect(screen.getByRole("link", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "5" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "6" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Mais p\u00E1ginas")).toHaveLength(1);

    rerender(<CompactPagination currentPage={17} totalPages={20} onPageChange={vi.fn()} />);

    expect(screen.getByRole("link", { name: "16" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "19" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "15" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Mais p\u00E1ginas")).toHaveLength(1);
  });

  it("remove o foco residual quando um link recebe foco por interacao de ponteiro", () => {
    stubImmediateAnimationFrame();
    const onPageChange = vi.fn();

    render(<CompactPagination currentPage={3} totalPages={5} onPageChange={onPageChange} />);

    const nextLink = screen.getByRole("link", {
      name: "Ir para a pr\u00F3xima p\u00E1gina",
    }) as HTMLAnchorElement;
    const blurSpy = stubBlur(nextLink);

    fireEvent.pointerDown(nextLink);
    fireEvent.focusIn(nextLink);
    fireEvent.click(nextLink);

    expect(blurSpy).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("mantem o foco quando o link recebe foco sem interacao de ponteiro", () => {
    stubImmediateAnimationFrame();

    render(<CompactPagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />);

    const pageFourLink = screen.getByRole("link", { name: "4" }) as HTMLAnchorElement;
    const blurSpy = stubBlur(pageFourLink);

    fireEvent.focusIn(pageFourLink);

    expect(blurSpy).not.toHaveBeenCalled();
  });

  it("limpa a modalidade de ponteiro apos keydown para preservar o foco de teclado", () => {
    stubImmediateAnimationFrame();

    render(<CompactPagination currentPage={3} totalPages={5} onPageChange={vi.fn()} />);

    const nextLink = screen.getByRole("link", {
      name: "Ir para a pr\u00F3xima p\u00E1gina",
    }) as HTMLAnchorElement;
    const blurSpy = stubBlur(nextLink);

    fireEvent.pointerDown(nextLink);
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.focusIn(nextLink);

    expect(blurSpy).not.toHaveBeenCalled();
  });

  it("desabilita navegacao e impede cliques enquanto disabled estiver ativo", () => {
    const onPageChange = vi.fn();

    render(
      <CompactPagination
        currentPage={1}
        totalPages={3}
        disabled
        onPageChange={onPageChange}
      />,
    );

    const previousLink = screen.getByRole("link", { name: "Ir para a p\u00E1gina anterior" });
    const nextLink = screen.getByRole("link", { name: "Ir para a pr\u00F3xima p\u00E1gina" });
    const pageTwoLink = screen.getByRole("link", { name: "2" });

    expect(previousLink).toHaveAttribute("aria-disabled", "true");
    expect(previousLink).toHaveAttribute("tabindex", "-1");
    expect(previousLink).toHaveClass("pointer-events-none", "opacity-50");
    expect(nextLink).toHaveAttribute("aria-disabled", "true");
    expect(pageTwoLink).toHaveAttribute("aria-disabled", "true");
    expect(pageTwoLink).toHaveAttribute("tabindex", "-1");
    expect(pageTwoLink).toHaveClass("pointer-events-none", "opacity-50");

    fireEvent.click(nextLink);
    fireEvent.click(pageTwoLink);

    expect(onPageChange).not.toHaveBeenCalled();
  });
});
