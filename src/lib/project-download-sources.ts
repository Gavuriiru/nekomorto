import type { DownloadSource } from "@/data/projects";
import type { SiteSettings } from "@/types/site-settings";

export type DownloadSourceOption = {
  label: string;
  color: string;
  icon?: string;
  tintIcon: boolean;
  isLegacy?: boolean;
};

const DEFAULT_DOWNLOAD_SOURCE_COLOR = "#64748B";

const FALLBACK_DOWNLOAD_SOURCE_OPTIONS: DownloadSourceOption[] = [
  {
    label: "Google Drive",
    color: "#34A853",
    icon: "google-drive",
    tintIcon: true,
  },
  {
    label: "MEGA",
    color: "#D9272E",
    icon: "mega",
    tintIcon: true,
  },
  {
    label: "Torrent",
    color: "#7C3AED",
    icon: "torrent",
    tintIcon: true,
  },
  {
    label: "Mediafire",
    color: "#2563EB",
    icon: "mediafire",
    tintIcon: true,
  },
  {
    label: "Telegram",
    color: "#0EA5E9",
    icon: "telegram",
    tintIcon: true,
  },
  {
    label: "Outro",
    color: DEFAULT_DOWNLOAD_SOURCE_COLOR,
    icon: "link",
    tintIcon: true,
  },
];

const normalizeOptionKey = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeOptionLabel = (value: unknown) => String(value || "").trim();

const dedupeDownloadSourceOptions = (options: DownloadSourceOption[]) => {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = normalizeOptionKey(option.label);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const normalizeConfiguredSource = (
  source: SiteSettings["downloads"]["sources"][number],
): DownloadSourceOption | null => {
  const label = normalizeOptionLabel(source?.label);
  if (!label) {
    return null;
  }
  return {
    label,
    color: String(source?.color || "").trim() || DEFAULT_DOWNLOAD_SOURCE_COLOR,
    icon: String(source?.icon || "").trim() || undefined,
    tintIcon: source?.tintIcon !== false,
  };
};

export const getDownloadSourceOptions = (
  configuredSources: SiteSettings["downloads"]["sources"] | null | undefined,
  legacyLabels: Array<string | null | undefined> = [],
) => {
  const configuredOptions = Array.isArray(configuredSources)
    ? configuredSources.map(normalizeConfiguredSource).filter((option): option is DownloadSourceOption => Boolean(option))
    : [];

  const baseOptions = configuredOptions.length
    ? dedupeDownloadSourceOptions(configuredOptions)
    : FALLBACK_DOWNLOAD_SOURCE_OPTIONS;

  const legacyOptions = legacyLabels
    .map((label) => normalizeOptionLabel(label))
    .filter(Boolean)
    .map((label) => ({
      label,
      color: DEFAULT_DOWNLOAD_SOURCE_COLOR,
      icon: "link",
      tintIcon: true,
      isLegacy: true,
    }));

  return dedupeDownloadSourceOptions([...baseOptions, ...legacyOptions]);
};

export const isBlankDownloadSource = (source: DownloadSource | null | undefined) => {
  const label = normalizeOptionLabel(source?.label);
  const url = normalizeOptionLabel(source?.url);
  return !label && !url;
};

export const isIncompleteDownloadSource = (source: DownloadSource | null | undefined) => {
  const label = normalizeOptionLabel(source?.label);
  const url = normalizeOptionLabel(source?.url);
  return (Boolean(label) || Boolean(url)) && (!label || !url);
};

export const findIncompleteDownloadSourceIndex = (
  sources: DownloadSource[] | null | undefined,
) => {
  const normalizedSources = Array.isArray(sources) ? sources : [];
  const index = normalizedSources.findIndex((source) => isIncompleteDownloadSource(source));
  return index >= 0 ? index : -1;
};
