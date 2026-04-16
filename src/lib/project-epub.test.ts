import { describe, expect, it } from "vitest";

import { extractEpubTempImportIdsFromPayload } from "@/lib/project-epub";

describe("project EPUB helpers", () => {
  it("extracts temporary import ids before query, hash, and path boundaries", () => {
    expect(
      extractEpubTempImportIdsFromPayload({
        cover: "/uploads/tmp/epub-imports/user-1/import-1?cache=1#cover",
        nested: [
          "/uploads/tmp/epub-imports/user-1/import-2#fragment",
          "/uploads/tmp/epub-imports/user-1/import-3/image.jpg?size=large",
        ],
      }),
    ).toEqual(["import-1", "import-2", "import-3"]);
  });
});
