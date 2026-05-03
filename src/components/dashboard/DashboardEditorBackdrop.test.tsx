import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardEditorBackdrop from "@/components/dashboard/DashboardEditorBackdrop";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const classTokens = (element: HTMLElement) =>
  String(element.className).split(/\s+/).filter(Boolean);

describe("DashboardEditorBackdrop", () => {
  it("renderiza no portal com camada acima do header do dashboard", async () => {
    render(
      <>
        <div
          data-testid="dashboard-header"
          className="fixed left-0 right-0 top-0 z-40 bg-sidebar"
        />
        <Dialog open modal={false}>
          <DashboardEditorBackdrop />
          <DialogContent>
            <div>Editor aberto</div>
          </DialogContent>
        </Dialog>
      </>,
    );

    const backdrop = await screen.findByTestId("dashboard-editor-backdrop");
    const header = screen.getByTestId("dashboard-header");

    expect(backdrop.parentElement).toBe(document.body);
    expect(classTokens(backdrop)).toEqual(
      expect.arrayContaining(["pointer-events-auto", "fixed", "inset-0", "z-[45]", "bg-black/80"]),
    );
    expect(classTokens(header)).toContain("z-40");
  });
});
