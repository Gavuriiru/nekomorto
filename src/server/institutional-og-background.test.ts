import { beforeEach, describe, expect, it, vi } from "vitest";

const loadProjectOgArtworkDataUrlMock = vi.hoisted(() => vi.fn());
const sharpBlurMock = vi.hoisted(() => vi.fn());
const sharpResizeMock = vi.hoisted(() => vi.fn());
const sharpPngMock = vi.hoisted(() => vi.fn());
const sharpToBufferMock = vi.hoisted(() => vi.fn());

vi.mock("../../server/lib/project-og.js", () => ({
  OG_PROJECT_HEIGHT: 630,
  OG_PROJECT_WIDTH: 1200,
  buildProjectOgFonts: () => [],
  loadProjectOgArtworkDataUrl: loadProjectOgArtworkDataUrlMock,
  resolveProjectOgPalette: () => ({
    accentPrimary: "#3173ff",
    bgBase: "#02050b",
  }),
}));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    resize: sharpResizeMock,
    blur: sharpBlurMock,
    png: sharpPngMock,
    toBuffer: sharpToBufferMock,
  })),
}));

import { loadInstitutionalOgBackgroundDataUrl } from "../../server/lib/institutional-og.js";

describe("institutional og background loader", () => {
  beforeEach(() => {
    loadProjectOgArtworkDataUrlMock.mockReset();
    sharpResizeMock.mockReset();
    sharpBlurMock.mockReset();
    sharpPngMock.mockReset();
    sharpToBufferMock.mockReset();

    loadProjectOgArtworkDataUrlMock.mockResolvedValue("data:image/png;base64,AA==");
    sharpResizeMock.mockImplementation(() => ({
      blur: sharpBlurMock,
      png: sharpPngMock,
      toBuffer: sharpToBufferMock,
    }));
    sharpBlurMock.mockImplementation(() => ({
      png: sharpPngMock,
      toBuffer: sharpToBufferMock,
    }));
    sharpPngMock.mockImplementation(() => ({
      toBuffer: sharpToBufferMock,
    }));
    sharpToBufferMock.mockResolvedValue(Buffer.from("institutional-background"));
  });

  it("applies blur 15 to the processed institutional background", async () => {
    const result = await loadInstitutionalOgBackgroundDataUrl({
      backgroundUrl: "/uploads/about-page.jpg",
      origin: "https://nekomata.moe",
    });

    expect(loadProjectOgArtworkDataUrlMock).toHaveBeenCalledWith({
      artworkUrl: "/uploads/about-page.jpg",
      origin: "https://nekomata.moe",
    });
    expect(sharpResizeMock).toHaveBeenCalledWith(1200, 630, {
      fit: "cover",
      position: "center",
    });
    expect(sharpBlurMock).toHaveBeenCalledWith(15);
    expect(result).toContain("data:image/png;base64,");
  });
});
