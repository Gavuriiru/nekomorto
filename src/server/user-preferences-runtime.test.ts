import { describe, expect, it, vi } from "vitest";

import { createUserPreferencesRuntime } from "../../server/lib/user-preferences-runtime.js";

const createDeps = (overrides = {}) => {
  let storedByUserId = {
    "user-1": {
      themeMode: "DARK",
      density: "compact",
      dashboard: {
        homeByRole: {
          admin: {
            widgets: ["overview", "overview", "invalid"],
          },
          guest: {
            widgets: ["overview"],
          },
        },
        notifications: {
          lastSeenAt: "2026-03-28T12:00:00.000Z",
        },
      },
      reader: {
        mode: "paged",
      },
    },
  };

  return {
    dashboardHomeRoleIds: new Set(["admin", "editor"]),
    dashboardWidgetIds: new Set(["overview", "alerts", "queue"]),
    isPlainObject: (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value),
    loadStoredUserPreferences: vi.fn((userId) => storedByUserId[userId] ?? {}),
    normalizeProjectReaderPreferences: (value) => ({
      mode: String(value?.mode || "")
        .trim()
        .toLowerCase(),
    }),
    userPreferencesDensitySet: new Set(["comfortable", "compact"]),
    userPreferencesThemeModeSet: new Set(["light", "dark", "system"]),
    writeStoredUserPreferences: vi.fn((userId, preferences) => {
      storedByUserId[userId] = preferences;
    }),
    __getStored: () => storedByUserId,
    ...overrides,
  };
};

describe("user-preferences-runtime", () => {
  it("fails early when required dependencies are missing", () => {
    expect(() => createUserPreferencesRuntime()).toThrow(/missing required dependencies/i);
  });

  it("normalizes dashboard and reader preferences", () => {
    const runtime = createUserPreferencesRuntime(createDeps());

    expect(
      runtime.normalizeUserPreferences({
        themeMode: " DARK ",
        density: "compact",
        dashboard: {
          homeByRole: {
            admin: {
              widgets: ["overview", "alerts", "overview", "x"],
            },
          },
          notifications: {
            lastSeenAt: "2026-03-28T12:34:56.000Z",
          },
        },
        reader: {
          mode: "SCROLL",
        },
      }),
    ).toEqual({
      themeMode: "dark",
      density: "compact",
      dashboard: {
        homeByRole: {
          admin: {
            widgets: ["overview", "alerts"],
          },
        },
        notifications: {
          lastSeenAt: "2026-03-28T12:34:56.000Z",
        },
      },
      reader: {
        mode: "scroll",
      },
    });
  });

  it("loads stored preferences, normalizes them and writes back when needed", () => {
    const deps = createDeps();
    const runtime = createUserPreferencesRuntime(deps);

    const loaded = runtime.loadUserPreferences("user-1");

    expect(loaded).toEqual({
      themeMode: "dark",
      density: "compact",
      dashboard: {
        homeByRole: {
          admin: {
            widgets: ["overview"],
          },
        },
        notifications: {
          lastSeenAt: "2026-03-28T12:00:00.000Z",
        },
      },
      reader: {
        mode: "paged",
      },
    });
    expect(deps.writeStoredUserPreferences).toHaveBeenCalledWith("user-1", loaded);
  });

  it("writes normalized preferences and ignores empty user ids", () => {
    const deps = createDeps();
    const runtime = createUserPreferencesRuntime(deps);

    expect(
      runtime.writeUserPreferences("user-2", {
        themeMode: "system",
        density: "comfortable",
        dashboard: {
          homeByRole: {
            editor: {
              widgets: ["queue", "queue"],
            },
          },
        },
      }),
    ).toEqual({
      themeMode: "system",
      density: "comfortable",
      dashboard: {
        homeByRole: {
          editor: {
            widgets: ["queue"],
          },
        },
      },
    });
    expect(deps.__getStored()["user-2"]).toEqual({
      themeMode: "system",
      density: "comfortable",
      dashboard: {
        homeByRole: {
          editor: {
            widgets: ["queue"],
          },
        },
      },
    });
    expect(runtime.writeUserPreferences("", { themeMode: "dark" })).toEqual({});
  });
});
