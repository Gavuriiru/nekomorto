const DEFAULT_CONCURRENCY = 1;
const DEFAULT_HISTORY_SIZE = 100;

const normalizePositiveInteger = (value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(parsed), min), max);
};

export const createJobQueue = ({
  name = "default",
  concurrency = DEFAULT_CONCURRENCY,
  historySize = DEFAULT_HISTORY_SIZE,
  onError,
} = {}) => {
  const normalizedName = String(name || "default").trim() || "default";
  const maxConcurrency = normalizePositiveInteger(concurrency, DEFAULT_CONCURRENCY, 1, 32);
  const maxHistory = normalizePositiveInteger(historySize, DEFAULT_HISTORY_SIZE, 10, 1000);
  const pending = [];
  const running = new Map();
  const history = [];
  let sequence = 0;
  let draining = false;

  const pushHistory = (entry) => {
    history.push(entry);
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }
  };

  const runJob = async (job) => {
    const startedAt = Date.now();
    running.set(job.id, {
      id: job.id,
      type: job.type,
      enqueuedAt: job.enqueuedAt,
      startedAt,
      payload: job.payload,
    });
    try {
      const value = await job.run();
      const finishedAt = Date.now();
      running.delete(job.id);
      pushHistory({
        id: job.id,
        type: job.type,
        status: "completed",
        enqueuedAt: job.enqueuedAt,
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt,
      });
      job.resolve(value);
    } catch (error) {
      const finishedAt = Date.now();
      running.delete(job.id);
      pushHistory({
        id: job.id,
        type: job.type,
        status: "failed",
        enqueuedAt: job.enqueuedAt,
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt,
        error: String(error?.message || error || "unknown_error"),
      });
      if (typeof onError === "function") {
        onError({
          queue: normalizedName,
          jobId: job.id,
          type: job.type,
          error,
        });
      }
      job.reject(error);
    } finally {
      queueMicrotask(drain);
    }
  };

  const drain = () => {
    if (draining) {
      return;
    }
    draining = true;
    try {
      while (running.size < maxConcurrency && pending.length > 0) {
        const job = pending.shift();
        if (!job) {
          continue;
        }
        void runJob(job);
      }
    } finally {
      draining = false;
    }
  };

  return {
    enqueue({ type = "job", payload = {}, run } = {}) {
      if (typeof run !== "function") {
        return Promise.reject(new Error("job_run_function_required"));
      }
      const id = `${normalizedName}-${Date.now()}-${(sequence += 1)}`;
      const enqueuedAt = Date.now();
      return new Promise((resolve, reject) => {
        pending.push({
          id,
          type: String(type || "job").trim() || "job",
          payload:
            payload && typeof payload === "object" && !Array.isArray(payload)
              ? { ...payload }
              : payload,
          enqueuedAt,
          run,
          resolve,
          reject,
        });
        queueMicrotask(drain);
      });
    },
    snapshot() {
      return {
        name: normalizedName,
        pending: pending.length,
        running: running.size,
        activeJobs: Array.from(running.values()).map((job) => ({
          id: job.id,
          type: job.type,
          enqueuedAt: job.enqueuedAt,
          startedAt: job.startedAt,
          runtimeMs: Math.max(0, Date.now() - Number(job.startedAt || Date.now())),
        })),
        recent: [...history],
      };
    },
  };
};
