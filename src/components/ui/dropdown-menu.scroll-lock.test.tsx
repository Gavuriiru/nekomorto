import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

const removeClassName = (className: string) => {
  document.body.className = document.body.className
    .split(/\s+/)
    .filter((token) => token && token !== className)
    .join(" ");
};

const TestDropdownMenu = ({ modal }: { modal?: boolean }) => (
  <DropdownMenu modal={modal}>
    <DropdownMenuTrigger asChild>
      <button type="button">Abrir menu</button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem>Perfil</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

describe("DropdownMenu scroll lock", () => {
  beforeEach(() => {
    document.body.removeAttribute("data-scroll-locked");
    removeClassName("with-scroll-bars-hidden");
    document.body.style.marginRight = "";
  });

  it("nao aplica lock de scroll por padrao (modal=false)", async () => {
    const user = userEvent.setup();

    render(<TestDropdownMenu />);

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const menu = await screen.findByRole("menu");
    expect(classTokens(menu)).toContain("shadow-[0_18px_54px_-42px_rgba(0,0,0,0.55)]");

    await waitFor(() => {
      expect(document.body.getAttribute("data-scroll-locked")).toBeNull();
    });
  });

  it("aplica lock de scroll quando modal=true", async () => {
    const user = userEvent.setup();

    render(<TestDropdownMenu modal />);

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const menu = await screen.findByRole("menu");
    expect(classTokens(menu)).toContain("shadow-[0_18px_54px_-42px_rgba(0,0,0,0.55)]");

    await waitFor(() => {
      const lockCount = Number.parseInt(document.body.getAttribute("data-scroll-locked") || "", 10);
      expect(Number.isFinite(lockCount)).toBe(true);
      expect(lockCount).toBeGreaterThan(0);
    });
  });
});
