import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "@/hooks/use-autosave";

const flushMicrotasks = async () => {
  await Promise.resolve();
};

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

describe("useAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("salva uma vez após várias edições rápidas dentro do debounce", async () => {
    const save = vi.fn(async () => undefined);
    const { rerender } = renderHook(
      ({ value }) =>
        useAutosave({
          value,
          onSave: save,
          isReady: true,
          debounceMs: 1200,
          retryMax: 0,
          retryBaseMs: 1,
        }),
      { initialProps: { value: { text: "inicial" } } },
    );

    rerender({ value: { text: "primeira" } });
    rerender({ value: { text: "segunda" } });
    rerender({ value: { text: "final" } });

    await act(async () => {
      vi.advanceTimersByTime(1199);
      await flushMicrotasks();
    });
    expect(save).toHaveBeenCalledTimes(0);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await flushMicrotasks();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ text: "final" });
  });

  it("quando há request em voo, salva novamente apenas o snapshot mais recente", async () => {
    const firstSave = createDeferred<void>();
    const secondSave = createDeferred<void>();
    const save = vi
      .fn()
      .mockImplementationOnce(async () => firstSave.promise)
      .mockImplementationOnce(async () => secondSave.promise);

    const { rerender } = renderHook(
      ({ value }) =>
        useAutosave({
          value,
          onSave: save,
          isReady: true,
          debounceMs: 1200,
          retryMax: 0,
          retryBaseMs: 1,
        }),
      { initialProps: { value: 0 } },
    );

    rerender({ value: 1 });
    await act(async () => {
      vi.advanceTimersByTime(1200);
      await flushMicrotasks();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenNthCalledWith(1, 1);

    rerender({ value: 2 });
    await act(async () => {
      firstSave.resolve();
      await flushMicrotasks();
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenNthCalledWith(2, 2);

    await act(async () => {
      secondSave.resolve();
      await flushMicrotasks();
    });
  });

  it("respeita retry máximo e encerra em erro após falhas consecutivas", async () => {
    const save = vi.fn(async () => {
      throw new Error("boom");
    });
    const { result, rerender } = renderHook(
      ({ value }) =>
        useAutosave({
          value,
          onSave: save,
          isReady: true,
          debounceMs: 1200,
          retryMax: 2,
          retryBaseMs: 1500,
        }),
      { initialProps: { value: "base" } },
    );

    rerender({ value: "alterado" });
    await act(async () => {
      vi.advanceTimersByTime(1200);
      await flushMicrotasks();
    });
    await act(async () => {
      await vi.runAllTimersAsync();
      await flushMicrotasks();
    });

    expect(save).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe("error");
  });

  it("flushNow ignora debounce e salva imediatamente", async () => {
    const save = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(
      ({ value }) =>
        useAutosave({
          value,
          onSave: save,
          isReady: true,
          debounceMs: 1200,
          retryMax: 0,
          retryBaseMs: 1,
        }),
      { initialProps: { value: 10 } },
    );

    rerender({ value: 11 });
    await act(async () => {
      const ok = await result.current.flushNow();
      expect(ok).toBe(true);
      await flushMicrotasks();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(11);

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await flushMicrotasks();
    });
    expect(save).toHaveBeenCalledTimes(1);
  });
});
