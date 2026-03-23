import { Cloud, Download, HardDrive, Link2, Send } from "lucide-react";
import { useMemo } from "react";

import ThemedSvgLogo from "@/components/ThemedSvgLogo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSiteSettings } from "@/hooks/use-site-settings";
import {
  getDownloadSourceOptions,
  type DownloadSourceOption,
} from "@/lib/project-download-sources";

const renderDownloadSourceIcon = (
  iconKey: string | undefined,
  color: string,
  label?: string,
  tintIcon = true,
) => {
  if (
    iconKey &&
    (iconKey.startsWith("http") || iconKey.startsWith("data:") || iconKey.startsWith("/uploads/"))
  ) {
    if (!tintIcon) {
      return <img src={iconKey} alt={label || ""} className="h-4 w-4" />;
    }
    return (
      <ThemedSvgLogo
        url={iconKey}
        label={label || "Fonte de download"}
        className="h-4 w-4"
        color={color}
      />
    );
  }

  const normalized = String(iconKey || "").toLowerCase();
  if (normalized === "google-drive") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" style={{ color }}>
        <path fill="currentColor" d="M7.5 3h9l4.5 8-4.5 8h-9L3 11z" />
      </svg>
    );
  }

  if (normalized === "mega") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <circle cx="12" cy="12" r="10" fill={color} />
        <path
          fill="#fff"
          d="M7.2 16.4V7.6h1.6l3.2 4.2 3.2-4.2h1.6v8.8h-1.6V10l-3.2 4.1L8.8 10v6.4z"
        />
      </svg>
    );
  }

  const iconMap: Record<string, typeof Download> = {
    telegram: Send,
    mediafire: Cloud,
    torrent: HardDrive,
    link: Link2,
    download: Download,
  };
  const Icon = iconMap[normalized] || Download;
  return <Icon className="h-4 w-4" style={{ color }} />;
};

type DownloadSourceSelectProps = {
  value?: string | null;
  onValueChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  legacyLabels?: Array<string | null | undefined>;
  triggerClassName?: string;
};

const DownloadSourceSelect = ({
  value,
  onValueChange,
  id,
  ariaLabel,
  placeholder = "Fonte",
  disabled = false,
  legacyLabels = [],
  triggerClassName,
}: DownloadSourceSelectProps) => {
  const { settings } = useSiteSettings();
  const currentLabel = String(value || "").trim();
  const options = useMemo(
    () => getDownloadSourceOptions(settings.downloads.sources, [currentLabel, ...legacyLabels]),
    [currentLabel, legacyLabels, settings.downloads.sources],
  );

  return (
    <Select value={currentLabel} onValueChange={onValueChange}>
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        disabled={disabled}
        className={triggerClassName}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option: DownloadSourceOption) => (
          <SelectItem key={option.label} value={option.label}>
            <span className="flex items-center gap-2">
              {renderDownloadSourceIcon(
                option.icon,
                option.color,
                option.label,
                option.tintIcon,
              )}
              <span>{option.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default DownloadSourceSelect;
