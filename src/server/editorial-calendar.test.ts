import { describe, expect, it } from "vitest";

import { buildEditorialCalendarItems } from "../../server/lib/editorial-calendar.js";

describe("editorial calendar helper", () => {
  it("inclui scheduled e published, exclui draft e deletados, respeita range e ordena por data", () => {
    const items = buildEditorialCalendarItems(
      [
        {
          id: "draft-1",
          title: "Draft",
          slug: "draft",
          status: "draft",
          publishedAt: "2026-02-10T10:00:00.000Z",
          deletedAt: null,
        },
        {
          id: "deleted-1",
          title: "Deleted",
          slug: "deleted",
          status: "published",
          publishedAt: "2026-02-10T11:00:00.000Z",
          deletedAt: "2026-02-10T12:00:00.000Z",
        },
        {
          id: "pub-1",
          title: "Publicado",
          slug: "publicado",
          status: "published",
          publishedAt: "2026-02-10T12:00:00.000Z",
          scheduledAt: "2026-02-10T08:00:00.000Z",
          deletedAt: null,
        },
        {
          id: "sched-1",
          title: "Agendado",
          slug: "agendado",
          status: "scheduled",
          publishedAt: "2026-02-10T14:00:00.000Z",
          scheduledAt: "2026-02-10T13:00:00.000Z",
          deletedAt: null,
        },
      ],
      {
        fromMs: Date.parse("2026-02-10T00:00:00.000Z"),
        toMs: Date.parse("2026-02-10T23:59:59.999Z"),
      },
    );

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.id)).toEqual(["pub-1", "sched-1"]);
    expect(items[0]?.status).toBe("published");
    expect(items[0]?.scheduledAt).toBeNull();
    expect(items[1]?.status).toBe("scheduled");
    expect(items[1]?.scheduledAt).toBe("2026-02-10T13:00:00.000Z");
  });

  it("exclui itens fora do range com base na data de exibicao", () => {
    const items = buildEditorialCalendarItems(
      [
        {
          id: "sched-out",
          title: "Agendado fora",
          slug: "agendado-fora",
          status: "scheduled",
          publishedAt: "2026-02-11T10:00:00.000Z",
          scheduledAt: "2026-02-11T10:00:00.000Z",
          deletedAt: null,
        },
        {
          id: "pub-in",
          title: "Publicado dentro",
          slug: "pub-in",
          status: "published",
          publishedAt: "2026-02-10T10:00:00.000Z",
          deletedAt: null,
        },
      ],
      {
        fromMs: Date.parse("2026-02-10T00:00:00.000Z"),
        toMs: Date.parse("2026-02-10T23:59:59.999Z"),
      },
    );

    expect(items.map((item) => item.id)).toEqual(["pub-in"]);
  });
});

