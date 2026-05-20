import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { navigatePublicDocument } from "@/lib/public-document-navigation";
import usePublicReveal from "@/hooks/use-public-reveal";

const PublicRevealHarness = ({
  initialPath = "/equipe",
  text = "Equipe",
}: {
  initialPath?: string;
  text?: string;
}) => {
  usePublicReveal({ initialPath });

  return (
    <div data-testid="public-reveal-target" data-reveal className="reveal">
      <h1 className="animate-slide-up">{text}</h1>
    </div>
  );
};

describe("usePublicReveal", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/equipe");
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("marca blocos publicos como visiveis no mount", async () => {
    render(<PublicRevealHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("public-reveal-target")).toHaveClass("reveal-visible");
      expect(screen.getByTestId("public-reveal-target")).not.toHaveClass("reveal-hidden");
    });
  });

  it("revela blocos adicionados apos uma navegacao publica suave", async () => {
    const { rerender } = render(<PublicRevealHarness />);

    navigatePublicDocument("/faq");
    rerender(<PublicRevealHarness initialPath="/equipe" text="FAQ" />);

    await waitFor(() => {
      expect(screen.getByTestId("public-reveal-target")).toHaveClass("reveal-visible");
      expect(screen.getByRole("heading", { name: "FAQ" })).toBeInTheDocument();
    });
  });
});
