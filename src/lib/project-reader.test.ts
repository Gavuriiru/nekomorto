import { describe, expect, it } from "vitest";

import { normalizeProjectEpisodePages } from "../../shared/project-reader.js";

describe("normalizeProjectEpisodePages", () => {
  it("preserva spreadPairId valido em duas paginas adjacentes apos reindexacao", () => {
    expect(
      normalizeProjectEpisodePages([
        { position: 4, imageUrl: "/uploads/page-4.jpg" },
        { position: 2, imageUrl: "/uploads/page-2.jpg", spreadPairId: "spread-1" },
        { position: 1, imageUrl: "/uploads/page-1.jpg", spreadPairId: "spread-1" },
      ]),
    ).toEqual([
      { position: 0, imageUrl: "/uploads/page-1.jpg", spreadPairId: "spread-1" },
      { position: 1, imageUrl: "/uploads/page-2.jpg", spreadPairId: "spread-1" },
      { position: 2, imageUrl: "/uploads/page-4.jpg" },
    ]);
  });

  it("remove spreadPairId invalido quando fica orfao, repetido ou nao adjacente", () => {
    expect(
      normalizeProjectEpisodePages([
        { position: 0, imageUrl: "/uploads/page-1.jpg", spreadPairId: "spread-gap" },
        { position: 1, imageUrl: "/uploads/page-2.jpg" },
        { position: 2, imageUrl: "/uploads/page-3.jpg", spreadPairId: "spread-gap" },
        { position: 3, imageUrl: "/uploads/page-4.jpg", spreadPairId: "spread-many" },
        { position: 4, imageUrl: "/uploads/page-5.jpg", spreadPairId: "spread-many" },
        { position: 5, imageUrl: "/uploads/page-6.jpg", spreadPairId: "spread-many" },
        { position: 6, imageUrl: "/uploads/page-7.jpg", spreadPairId: "spread-lone" },
      ]),
    ).toEqual([
      { position: 0, imageUrl: "/uploads/page-1.jpg" },
      { position: 1, imageUrl: "/uploads/page-2.jpg" },
      { position: 2, imageUrl: "/uploads/page-3.jpg" },
      { position: 3, imageUrl: "/uploads/page-4.jpg" },
      { position: 4, imageUrl: "/uploads/page-5.jpg" },
      { position: 5, imageUrl: "/uploads/page-6.jpg" },
      { position: 6, imageUrl: "/uploads/page-7.jpg" },
    ]);
  });
});
