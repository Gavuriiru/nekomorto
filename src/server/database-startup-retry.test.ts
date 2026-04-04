import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDatabaseStartupRetryConfig,
  isRetryableDatabaseStartupError,
  withDatabaseStartupRetry,
} from "../../server/lib/database-startup-retry.js";

const ORIGINAL_ENV = { ...process.env };

describe("database startup retry", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("detects retryable database startup errors from Prisma and Postgres signals", () => {
    expect(
      isRetryableDatabaseStartupError({
        message: "Can't reach database server at postgres:5432",
        code: "P1001",
      }),
    ).toBe(true);

    expect(
      isRetryableDatabaseStartupError("FATAL: the database system is starting up"),
    ).toBe(true);
  });

  it("does not retry non-transient database errors", () => {
    expect(
      isRetryableDatabaseStartupError("password authentication failed for user nekomorto_app"),
    ).toBe(false);
  });

  it("retries transient startup failures until the task succeeds", async () => {
    vi.useFakeTimers();

    const task = vi
      .fn()
      .mockRejectedValueOnce(new Error("Can't reach database server at postgres:5432"))
      .mockResolvedValueOnce("ok");
    const onRetry = vi.fn();

    const promise = withDatabaseStartupRetry(task, {
      maxAttempts: 3,
      onRetry,
      retryDelayMs: 25,
    });

    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        maxAttempts: 3,
        retryDelayMs: 25,
      }),
    );
  });

  it("fails fast for non-retryable errors", async () => {
    const task = vi
      .fn()
      .mockRejectedValue(new Error("password authentication failed for user nekomorto_app"));

    await expect(
      withDatabaseStartupRetry(task, {
        maxAttempts: 4,
        retryDelayMs: 25,
      }),
    ).rejects.toThrow(/password authentication failed/i);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("reads retry config from env with safe defaults", () => {
    process.env.DB_STARTUP_MAX_ATTEMPTS = "7";
    process.env.DB_STARTUP_RETRY_DELAY_MS = "4500";

    expect(getDatabaseStartupRetryConfig()).toEqual({
      maxAttempts: 7,
      retryDelayMs: 4500,
    });
  });
});
