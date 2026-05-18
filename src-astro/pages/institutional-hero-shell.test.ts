import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readPageSource = (filename: string) =>
  readFileSync(new URL(`./${filename}`, import.meta.url), "utf8");

describe("institutional Astro hero shell", () => {
  it("keeps the team hero in the Astro page shell", () => {
    const source = readPageSource("equipe.astro");

    expect(source).toContain('import PublicPageHero from "../components/PublicPageHero.astro"');
    expect(source).toContain("<PublicPageHero");
    expect(source).toContain("badge={teamPage.heroBadge}");
    expect(source).toContain("title={teamPage.heroTitle}");
    expect(source).toContain("subtitle={teamPage.heroSubtitle}");
  });

  it("keeps the donations hero in the Astro page shell", () => {
    const source = readPageSource("doacoes.astro");

    expect(source).toContain('import PublicPageHero from "../components/PublicPageHero.astro"');
    expect(source).toContain("<PublicPageHero");
    expect(source).toContain("title={donations.heroTitle}");
    expect(source).toContain("subtitle={donations.heroSubtitle}");
  });
});
