const normalizeMetricName = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_:]/g, "_");

const normalizeLabelKey = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_");

const escapeLabelValue = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");

const toSortedLabelEntries = (labels = {}) =>
  Object.entries(labels || {})
    .map(([key, value]) => [normalizeLabelKey(key), String(value)])
    .filter(([key]) => key.length > 0)
    .sort((a, b) => a[0].localeCompare(b[0], "en"));

const buildSeriesKey = (labels = {}) =>
  toSortedLabelEntries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join("|");

const buildPrometheusLabelBlock = (labels = {}) => {
  const entries = toSortedLabelEntries(labels);
  if (entries.length === 0) {
    return "";
  }
  const content = entries.map(([key, value]) => `${key}="${escapeLabelValue(value)}"`).join(",");
  return `{${content}}`;
};

export const createMetricsRegistry = ({ defaultLabels = {} } = {}) => {
  const counters = new Map();
  const gauges = new Map();
  const histograms = new Map();

  const mergeLabels = (labels = {}) => ({ ...defaultLabels, ...(labels || {}) });

  const ensureSeries = (store, metric, labels) => {
    const metricName = normalizeMetricName(metric);
    const labelsMerged = mergeLabels(labels);
    const seriesKey = buildSeriesKey(labelsMerged);
    const key = `${metricName}::${seriesKey}`;
    if (!store.has(key)) {
      store.set(key, { metricName, labels: labelsMerged, value: 0 });
    }
    return store.get(key);
  };

  return {
    inc(metric, labels = {}, value = 1) {
      const amount = Number(value);
      if (!Number.isFinite(amount)) {
        return;
      }
      const series = ensureSeries(counters, metric, labels);
      series.value += amount;
    },
    setGauge(metric, labels = {}, value = 0) {
      const amount = Number(value);
      if (!Number.isFinite(amount)) {
        return;
      }
      const series = ensureSeries(gauges, metric, labels);
      series.value = amount;
    },
    observe(metric, labels = {}, value = 0) {
      const amount = Number(value);
      if (!Number.isFinite(amount)) {
        return;
      }
      const metricName = normalizeMetricName(metric);
      const labelsMerged = mergeLabels(labels);
      const seriesKey = buildSeriesKey(labelsMerged);
      const key = `${metricName}::${seriesKey}`;
      const current = histograms.get(key) || {
        metricName,
        labels: labelsMerged,
        count: 0,
        sum: 0,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
      };
      current.count += 1;
      current.sum += amount;
      current.min = Math.min(current.min, amount);
      current.max = Math.max(current.max, amount);
      histograms.set(key, current);
    },
    createTimer(metric, labels = {}) {
      const startedAt = process.hrtime.bigint();
      return () => {
        const endedAt = process.hrtime.bigint();
        const durationMs = Number(endedAt - startedAt) / 1_000_000;
        this.observe(metric, labels, durationMs);
        return durationMs;
      };
    },
    snapshot() {
      return {
        counters: Array.from(counters.values()).map((entry) => ({ ...entry })),
        gauges: Array.from(gauges.values()).map((entry) => ({ ...entry })),
        histograms: Array.from(histograms.values()).map((entry) => ({ ...entry })),
      };
    },
    renderPrometheus() {
      const lines = [];

      const renderSeries = (entry, metricName, value) => {
        lines.push(`${metricName}${buildPrometheusLabelBlock(entry.labels)} ${Number(value)}`);
      };

      Array.from(counters.values())
        .sort((a, b) => `${a.metricName}${buildSeriesKey(a.labels)}`.localeCompare(`${b.metricName}${buildSeriesKey(b.labels)}`, "en"))
        .forEach((entry) => renderSeries(entry, entry.metricName, entry.value));

      Array.from(gauges.values())
        .sort((a, b) => `${a.metricName}${buildSeriesKey(a.labels)}`.localeCompare(`${b.metricName}${buildSeriesKey(b.labels)}`, "en"))
        .forEach((entry) => renderSeries(entry, entry.metricName, entry.value));

      Array.from(histograms.values())
        .sort((a, b) => `${a.metricName}${buildSeriesKey(a.labels)}`.localeCompare(`${b.metricName}${buildSeriesKey(b.labels)}`, "en"))
        .forEach((entry) => {
          renderSeries(entry, `${entry.metricName}_count`, entry.count);
          renderSeries(entry, `${entry.metricName}_sum`, entry.sum);
          if (Number.isFinite(entry.min)) {
            renderSeries(entry, `${entry.metricName}_min`, entry.min);
          }
          if (Number.isFinite(entry.max)) {
            renderSeries(entry, `${entry.metricName}_max`, entry.max);
          }
        });

      return `${lines.join("\n")}\n`;
    },
  };
};
