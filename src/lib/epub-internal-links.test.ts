import { describe, expect, it } from "vitest";

import {
  buildEpubAnchorHash,
  buildEpubInternalChapterHref,
  parseEpubInternalChapterHref,
  resolveEpubInternalProjectReadingHref,
  resolveEpubViewerLinkAction,
} from "@/lib/epub-internal-links";

describe("epub internal links", () => {
  it("faz roundtrip do href interno de capitulo com hash codificado", () => {
    const href = buildEpubInternalChapterHref(12, 3, "nota 1");

    expect(href).toBe("epub-internal://chapter/12?volume=3#nota%201");
    expect(parseEpubInternalChapterHref(href)).toEqual({
      chapterNumber: 12,
      volume: 3,
      fragment: "nota 1",
    });
  });

  it("resolve a rota publica de leitura preservando volume e ancora", () => {
    const href = resolveEpubInternalProjectReadingHref(
      "epub-internal://chapter/2?volume=4#note-1",
      "Minha Novel",
      [
        { number: 1, volume: 4 },
        { number: 2, volume: 4 },
      ],
    );

    expect(href).toBe("/projeto/minha-novel/leitura/2?volume=4#note-1");
  });

  it("usa a ancora codificada ao resolver a rota publica", () => {
    const href = resolveEpubInternalProjectReadingHref(
      buildEpubInternalChapterHref(5, undefined, "nota especial"),
      "Projeto Teste",
      [{ number: 5 }],
    );

    expect(href).toBe(
      `/projeto/projeto-teste/leitura/5${buildEpubAnchorHash("nota especial")}`,
    );
  });

  it("classifica href interno de capitulo para navegacao do viewer", () => {
    expect(resolveEpubViewerLinkAction("epub-internal://chapter/2?volume=1#note-1")).toEqual({
      kind: "internal-chapter",
      href: "epub-internal://chapter/2?volume=1#note-1",
    });
  });

  it("bloqueia href cru de xhtml quando o viewer esta em modo de navegacao interna", () => {
    expect(
      resolveEpubViewerLinkAction("chapter002.xhtml#note-1", {
        allowInternalChapterNavigation: true,
      }),
    ).toEqual({
      kind: "block-raw-epub",
      href: "chapter002.xhtml#note-1",
    });
  });
});
