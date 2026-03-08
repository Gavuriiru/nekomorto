import { describe, expect, it, vi } from "vitest";

import { loadNormalizedRuntimeStateMap } from "../../server/lib/normalized-domain-store.js";

describe("loadNormalizedRuntimeStateMap", () => {
  it("retorna missing_schema sem consultar a tabela quando to_regclass volta null", async () => {
    const findMany = vi.fn(async () => []);
    const db = {
      $queryRaw: vi.fn(async () => [{ table_name: null }]),
      normalizedRuntimeStateRecord: {
        findMany,
      },
    };

    const state = await loadNormalizedRuntimeStateMap(db);

    expect(state.available).toBe(false);
    expect(state.source).toBe("missing_schema");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("carrega o mapa quando a tabela normalized_runtime_state existe", async () => {
    const db = {
      $queryRaw: vi.fn(async () => [{ table_name: "normalized_runtime_state" }]),
      normalizedRuntimeStateRecord: {
        findMany: vi.fn(async () => [
          {
            domain: "users",
            status: "ready",
            rowCount: 3,
            quarantineCount: 0,
            checksum: "abc123",
            data: { backfilledAt: "2026-03-08T12:00:00.000Z" },
            updatedAt: new Date("2026-03-08T12:00:00.000Z"),
          },
        ]),
      },
    };

    const state = await loadNormalizedRuntimeStateMap(db);

    expect(state.available).toBe(true);
    expect(state.source).toBe("normalized_runtime_state");
    expect(state.get("users")).toEqual({
      domain: "users",
      status: "ready",
      rowCount: 3,
      quarantineCount: 0,
      checksum: "abc123",
      data: { backfilledAt: "2026-03-08T12:00:00.000Z" },
      updatedAt: "2026-03-08T12:00:00.000Z",
    });
  });

  it("retorna source=error quando a leitura da tabela falha", async () => {
    const db = {
      $queryRaw: vi.fn(async () => [{ table_name: "normalized_runtime_state" }]),
      normalizedRuntimeStateRecord: {
        findMany: vi.fn(async () => {
          throw new Error("db_read_failed");
        }),
      },
    };

    const state = await loadNormalizedRuntimeStateMap(db);

    expect(state.available).toBe(false);
    expect(state.source).toBe("error");
  });
});
