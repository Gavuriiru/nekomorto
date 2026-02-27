import fs from "fs";
import os from "os";
import path from "path";

import { describe, expect, it } from "vitest";

import {
  encodeRowsToCsv,
  encodeRowsToJsonl,
  filterByDateRange,
  normalizeExportDataset,
  normalizeExportFilters,
  normalizeExportFormat,
  writeExportFile,
} from "../../server/lib/admin-exports.js";

describe("admin-exports", () => {
  it("normalizes dataset/format and filter payload", () => {
    expect(normalizeExportDataset("users")).toBe("users");
    expect(normalizeExportDataset("invalid")).toBe("audit_log");
    expect(normalizeExportFormat("jsonl")).toBe("jsonl");
    expect(normalizeExportFormat("xml")).toBe("csv");

    const filters = normalizeExportFilters({
      dateFrom: "2026-01-01T00:00:00.000Z",
      dateTo: "2026-01-02T00:00:00.000Z",
      actorUserId: " 42 ",
      status: " OPEN ",
    });
    expect(filters.actorUserId).toBe("42");
    expect(filters.status).toBe("open");
  });

  it("filters entries by date range", () => {
    const rows = [
      { id: "a", ts: "2026-01-01T00:00:00.000Z" },
      { id: "b", ts: "2026-01-03T00:00:00.000Z" },
    ];
    const filtered = filterByDateRange(rows, {
      dateFrom: "2026-01-02T00:00:00.000Z",
      dateTo: "2026-01-04T00:00:00.000Z",
      tsAccessor: (entry) => entry.ts,
    });
    expect(filtered.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("encodes csv/jsonl and writes export file", () => {
    const rows = [{ id: "1", action: 'say \"hello\"' }];
    const csv = encodeRowsToCsv({ rows, headers: ["id", "action"] });
    const jsonl = encodeRowsToJsonl({ rows });

    expect(csv.includes("id,action")).toBe(true);
    expect(csv.includes('\"\"hello\"\"')).toBe(true);
    expect(jsonl.trim()).toBe(JSON.stringify(rows[0]));

    const exportsDir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-export-test-"));
    const filePath = writeExportFile({
      exportsDir,
      fileName: "audit-log-test",
      format: "csv",
      rows,
      headers: ["id", "action"],
    });

    expect(fs.existsSync(filePath)).toBe(true);
    expect(path.extname(filePath)).toBe(".csv");
  });
});
