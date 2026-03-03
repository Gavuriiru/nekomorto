import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

describe("AccordionTrigger", () => {
  it("aplica headerClassName no header e preserva o toggle", () => {
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <AccordionTrigger headerClassName="flex-1 min-w-0">
            <span>Primeiro item</span>
          </AccordionTrigger>
          <AccordionContent>Conteúdo</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );

    const trigger = screen.getByRole("button", { name: /primeiro item/i });
    const header = trigger.closest("h3");

    expect(header).toHaveClass("flex-1", "min-w-0");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
