import type { ProjectEpisodePage, ProjectReaderConfig } from "../src/data/projects";
import type { SiteSettings } from "../src/types/site-settings";

export const PROJECT_EPISODE_CONTENT_FORMATS: {
  readonly LEXICAL: "lexical";
  readonly IMAGES: "images";
};

export const PROJECT_READER_DIRECTIONS: {
  readonly RTL: "rtl";
  readonly LTR: "ltr";
};

export const PROJECT_READER_LAYOUTS: {
  readonly SINGLE: "single";
  readonly DOUBLE: "double";
  readonly SCROLL_VERTICAL: "scroll-vertical";
  readonly SCROLL_HORIZONTAL: "scroll-horizontal";
};

export const PROJECT_READER_IMAGE_FITS: {
  readonly BOTH: "both";
  readonly NONE: "none";
  readonly WIDTH: "width";
  readonly HEIGHT: "height";
};

export const PROJECT_READER_BACKGROUNDS: {
  readonly THEME: "theme";
  readonly BLACK: "black";
  readonly WHITE: "white";
};

export const PROJECT_READER_PROGRESS_STYLES: {
  readonly DEFAULT: "default";
  readonly HIDDEN: "hidden";
};

export const PROJECT_READER_PROGRESS_POSITIONS: {
  readonly BOTTOM: "bottom";
  readonly LEFT: "left";
  readonly RIGHT: "right";
};

export const PROJECT_READER_CHROME_MODES: {
  readonly DEFAULT: "default";
  readonly CINEMA: "cinema";
};

export const PROJECT_READER_VIEWPORT_MODES: {
  readonly VIEWPORT: "viewport";
  readonly NATURAL: "natural";
};

export const PROJECT_READER_SITE_HEADER_VARIANTS: {
  readonly FIXED: "fixed";
  readonly STATIC: "static";
};

export const PROJECT_READER_VIEW_MODES: {
  readonly PAGE: "page";
  readonly SCROLL: "scroll";
};

export const PROJECT_READER_TYPE_KEYS: {
  readonly MANGA: "manga";
  readonly WEBTOON: "webtoon";
  readonly DEFAULT: "default";
};

export type NormalizedProjectEpisodeContentFormat =
  (typeof PROJECT_EPISODE_CONTENT_FORMATS)[keyof typeof PROJECT_EPISODE_CONTENT_FORMATS];

export type NormalizedProjectReaderTypeKey =
  (typeof PROJECT_READER_TYPE_KEYS)[keyof typeof PROJECT_READER_TYPE_KEYS];

export type NormalizedProjectReaderConfig = {
  direction: NonNullable<ProjectReaderConfig["direction"]>;
  layout: NonNullable<ProjectReaderConfig["layout"]>;
  imageFit: NonNullable<ProjectReaderConfig["imageFit"]>;
  background: NonNullable<ProjectReaderConfig["background"]>;
  progressStyle: NonNullable<ProjectReaderConfig["progressStyle"]>;
  progressPosition: NonNullable<ProjectReaderConfig["progressPosition"]>;
  firstPageSingle: boolean;
  chromeMode: NonNullable<ProjectReaderConfig["chromeMode"]>;
  viewportMode: NonNullable<ProjectReaderConfig["viewportMode"]>;
  siteHeaderVariant: NonNullable<ProjectReaderConfig["siteHeaderVariant"]>;
  showSiteFooter: boolean;
  previewLimit: number | null;
  purchaseUrl: string;
  purchasePrice: string;
};

export type NormalizedProjectReaderPreferences = {
  projectTypes?: Partial<
    Record<
      Exclude<NormalizedProjectReaderTypeKey, "default">,
      Partial<NormalizedProjectReaderConfig>
    >
  >;
};

export function normalizeProjectEpisodeContentFormat(
  value: unknown,
  fallback?: NormalizedProjectEpisodeContentFormat,
): NormalizedProjectEpisodeContentFormat;

export function normalizeProjectEpisodePages(value: unknown): ProjectEpisodePage[];

export function getProjectEpisodePageCount(
  episode: { pageCount?: unknown; pages?: unknown } | null | undefined,
): number;

export function hasProjectEpisodePages(
  episode: { pageCount?: unknown; pages?: unknown } | null | undefined,
): boolean;

export function hasProjectEpisodeLexicalContent(
  episode: { content?: unknown } | null | undefined,
): boolean;

export function hasProjectEpisodeReadableContent(
  episode:
    | {
        content?: unknown;
        contentFormat?: unknown;
        pageCount?: unknown;
        pages?: unknown;
      }
    | null
    | undefined,
): boolean;

export function normalizeProjectReaderTypeKey(projectType: unknown): NormalizedProjectReaderTypeKey;

export function getProjectReaderPresetByType(projectType: unknown): NormalizedProjectReaderConfig;

export function normalizeProjectReaderConfig(
  value: unknown,
  options?: { projectType?: unknown },
): NormalizedProjectReaderConfig;

export function mergeProjectReaderConfig(
  baseConfig: unknown,
  overrideConfig: unknown,
  options?: { projectType?: unknown },
): NormalizedProjectReaderConfig;

export function getSiteProjectReaderConfig(
  siteSettings: unknown,
  projectType: unknown,
): Record<string, unknown> | null;

export function resolveProjectReaderConfig(options?: {
  projectType?: unknown;
  siteSettings?: unknown;
  siteReaderConfig?: unknown;
  projectReaderConfig?: unknown;
}): NormalizedProjectReaderConfig;

export function normalizeProjectReaderPreferences(
  value: unknown,
): NormalizedProjectReaderPreferences;

export function getProjectReaderPreferenceByType(
  value: unknown,
  projectType: unknown,
): Partial<NormalizedProjectReaderConfig> | null;
