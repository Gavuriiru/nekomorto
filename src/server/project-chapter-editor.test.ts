import { describe, expect, it } from "vitest";

import { applyProjectChapterUpdate } from "../../server/lib/project-chapter-editor.js";

describe("project chapter editor", () => {
  it("força capítulos de mangá para imagens mesmo quando o payload pede lexical", () => {
    const result = applyProjectChapterUpdate({
      project: {
        id: "project-1",
        type: "Mangá",
        episodeDownloads: [
          {
            number: 1,
            title: "Capitulo 1",
            content: "{\"root\":{\"children\":[]}}",
            contentFormat: "lexical",
            pages: [{ position: 0, imageUrl: "/uploads/projects/1/page-1.jpg" }],
          },
        ],
      },
      targetNumber: 1,
      targetVolume: undefined,
      chapter: {
        number: 1,
        content: "{\"root\":{\"children\":[{\"type\":\"paragraph\"}]}}",
        contentFormat: "lexical",
        pages: [{ position: 0, imageUrl: "/uploads/projects/1/page-1.jpg" }],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.chapter.contentFormat).toBe("images");
    expect(result.chapter.content).toBe("");
    expect(result.chapter.pageCount).toBe(1);
  });

  it("mantém capítulos de light novel em lexical", () => {
    const result = applyProjectChapterUpdate({
      project: {
        id: "project-1",
        type: "Light Novel",
        episodeDownloads: [
          {
            number: 1,
            title: "Capitulo 1",
            content: "",
            contentFormat: "lexical",
            pages: [],
          },
        ],
      },
      targetNumber: 1,
      targetVolume: undefined,
      chapter: {
        number: 1,
        content: "{\"root\":{\"children\":[{\"type\":\"paragraph\"}]}}",
        contentFormat: "lexical",
        pages: [],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.chapter.contentFormat).toBe("lexical");
    expect(result.chapter.content).toContain("paragraph");
  });
});
