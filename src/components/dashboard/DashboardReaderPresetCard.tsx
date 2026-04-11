import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import DashboardPageBadge from "@/components/dashboard/DashboardPageBadge";
import { Combobox } from "@/components/dashboard/dashboard-form-controls";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { SiteSettings } from "@/types/site-settings";
import {
  PROJECT_READER_CHROME_MODES,
  normalizeProjectReaderConfig,
  PROJECT_READER_BACKGROUNDS,
  PROJECT_READER_DIRECTIONS,
  PROJECT_READER_IMAGE_FITS,
  PROJECT_READER_LAYOUTS,
  PROJECT_READER_PROGRESS_POSITIONS,
  PROJECT_READER_PROGRESS_STYLES,
  PROJECT_READER_SITE_HEADER_VARIANTS,
  PROJECT_READER_VIEWPORT_MODES,
} from "../../../shared/project-reader.js";

type ReaderProjectTypeKey = keyof SiteSettings["reader"]["projectTypes"];

const directionOptions = [
  { value: PROJECT_READER_DIRECTIONS.RTL, label: "Direita para esquerda" },
  { value: PROJECT_READER_DIRECTIONS.LTR, label: "Esquerda para direita" },
];

const layoutOptions = [
  { value: PROJECT_READER_LAYOUTS.SINGLE, label: "Página única" },
  { value: PROJECT_READER_LAYOUTS.DOUBLE, label: "Página dupla" },
  { value: PROJECT_READER_LAYOUTS.SCROLL_VERTICAL, label: "Scroll vertical" },
  { value: PROJECT_READER_LAYOUTS.SCROLL_HORIZONTAL, label: "Scroll horizontal" },
];

const imageFitOptions = [
  { value: PROJECT_READER_IMAGE_FITS.BOTH, label: "Largura e altura" },
  { value: PROJECT_READER_IMAGE_FITS.WIDTH, label: "Ajustar à largura" },
  { value: PROJECT_READER_IMAGE_FITS.HEIGHT, label: "Ajustar à altura" },
  { value: PROJECT_READER_IMAGE_FITS.NONE, label: "Tamanho natural" },
];

const backgroundOptions = [
  { value: PROJECT_READER_BACKGROUNDS.THEME, label: "Tema do site" },
  { value: PROJECT_READER_BACKGROUNDS.BLACK, label: "Preto" },
  { value: PROJECT_READER_BACKGROUNDS.WHITE, label: "Branco" },
];

const progressStyleOptions = [
  { value: PROJECT_READER_PROGRESS_STYLES.DEFAULT, label: "Padrão" },
  { value: PROJECT_READER_PROGRESS_STYLES.HIDDEN, label: "Oculto" },
];

const progressPositionOptions = [
  { value: PROJECT_READER_PROGRESS_POSITIONS.BOTTOM, label: "Inferior" },
  { value: PROJECT_READER_PROGRESS_POSITIONS.LEFT, label: "Esquerda" },
  { value: PROJECT_READER_PROGRESS_POSITIONS.RIGHT, label: "Direita" },
];

const chromeModeOptions = [
  { value: PROJECT_READER_CHROME_MODES.DEFAULT, label: "Padrão" },
  { value: PROJECT_READER_CHROME_MODES.CINEMA, label: "Cinema" },
];

const viewportModeOptions = [
  { value: PROJECT_READER_VIEWPORT_MODES.VIEWPORT, label: "Altura fixa" },
  { value: PROJECT_READER_VIEWPORT_MODES.NATURAL, label: "Fluxo natural" },
];

const siteHeaderVariantOptions = [
  { value: PROJECT_READER_SITE_HEADER_VARIANTS.FIXED, label: "Fixa" },
  { value: PROJECT_READER_SITE_HEADER_VARIANTS.STATIC, label: "Estática" },
];

type DashboardReaderPresetCardProps = {
  cardClassName: string;
  preset: SiteSettings["reader"]["projectTypes"][ReaderProjectTypeKey];
  presetMeta: {
    key: ReaderProjectTypeKey;
    title: string;
    description: string;
    projectType: string;
  };
  onUpdate: (
    key: ReaderProjectTypeKey,
    updater: (
      current: SiteSettings["reader"]["projectTypes"][ReaderProjectTypeKey],
    ) => SiteSettings["reader"]["projectTypes"][ReaderProjectTypeKey],
  ) => void;
};

const resolveLayoutBadgeLabel = (layout: string) => {
  if (layout === PROJECT_READER_LAYOUTS.DOUBLE) {
    return "Dupla";
  }
  if (layout === PROJECT_READER_LAYOUTS.SCROLL_VERTICAL) {
    return "Vertical";
  }
  if (layout === PROJECT_READER_LAYOUTS.SCROLL_HORIZONTAL) {
    return "Horizontal";
  }
  return "Única";
};

const DashboardReaderPresetCard = ({
  cardClassName,
  preset,
  presetMeta,
  onUpdate,
}: DashboardReaderPresetCardProps) => {
  const applyUpdate = (nextValue: Record<string, unknown>) =>
    onUpdate(presetMeta.key, (current) => ({
      ...normalizeProjectReaderConfig(current, {
        projectType: presetMeta.projectType,
      }),
      ...nextValue,
    }));
  const normalizedPreset = normalizeProjectReaderConfig(preset, {
    projectType: presetMeta.projectType,
  });

  return (
    <Card lift={false} className={cardClassName} data-testid={`reader-preset-${presetMeta.key}`}>
      <CardContent className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{presetMeta.title}</h2>
            <p className="text-xs text-foreground/70">{presetMeta.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DashboardPageBadge reveal={false}>
              {normalizedPreset.direction === PROJECT_READER_DIRECTIONS.RTL ? "RTL" : "LTR"}
            </DashboardPageBadge>
            <DashboardPageBadge reveal={false}>
              {resolveLayoutBadgeLabel(normalizedPreset.layout)}
            </DashboardPageBadge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DashboardFieldStack>
            <Label>Direção</Label>
            <Combobox
              value={normalizedPreset.direction}
              onValueChange={(value) =>
                applyUpdate({
                  direction:
                    value === PROJECT_READER_DIRECTIONS.LTR
                      ? PROJECT_READER_DIRECTIONS.LTR
                      : PROJECT_READER_DIRECTIONS.RTL,
                })
              }
              ariaLabel="Selecionar direção"
              options={directionOptions}
              searchable={false}
            />
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label>Layout</Label>
            <Combobox
              value={normalizedPreset.layout}
              onValueChange={(value) =>
                applyUpdate({
                  layout:
                    value === PROJECT_READER_LAYOUTS.DOUBLE
                      ? PROJECT_READER_LAYOUTS.DOUBLE
                      : value === PROJECT_READER_LAYOUTS.SCROLL_VERTICAL
                        ? PROJECT_READER_LAYOUTS.SCROLL_VERTICAL
                        : value === PROJECT_READER_LAYOUTS.SCROLL_HORIZONTAL
                          ? PROJECT_READER_LAYOUTS.SCROLL_HORIZONTAL
                          : PROJECT_READER_LAYOUTS.SINGLE,
                })
              }
              ariaLabel="Selecionar layout"
              options={layoutOptions}
              searchable={false}
            />
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label>Ajuste da imagem</Label>
            <Combobox
              value={normalizedPreset.imageFit}
              onValueChange={(value) =>
                applyUpdate({
                  imageFit:
                    value === PROJECT_READER_IMAGE_FITS.WIDTH
                      ? PROJECT_READER_IMAGE_FITS.WIDTH
                      : value === PROJECT_READER_IMAGE_FITS.HEIGHT
                        ? PROJECT_READER_IMAGE_FITS.HEIGHT
                        : value === PROJECT_READER_IMAGE_FITS.NONE
                          ? PROJECT_READER_IMAGE_FITS.NONE
                          : PROJECT_READER_IMAGE_FITS.BOTH,
                })
              }
              ariaLabel="Selecionar ajuste da imagem"
              options={imageFitOptions}
              searchable={false}
            />
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label>Fundo do palco</Label>
            <Combobox
              value={normalizedPreset.background}
              onValueChange={(value) =>
                applyUpdate({
                  background:
                    value === PROJECT_READER_BACKGROUNDS.BLACK
                      ? PROJECT_READER_BACKGROUNDS.BLACK
                      : value === PROJECT_READER_BACKGROUNDS.WHITE
                        ? PROJECT_READER_BACKGROUNDS.WHITE
                        : PROJECT_READER_BACKGROUNDS.THEME,
                })
              }
              ariaLabel="Selecionar fundo do palco"
              options={backgroundOptions}
              searchable={false}
            />
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label>Estilo do progresso</Label>
            <Combobox
              value={normalizedPreset.progressStyle}
              onValueChange={(value) =>
                applyUpdate({
                  progressStyle:
                    value === PROJECT_READER_PROGRESS_STYLES.HIDDEN
                      ? PROJECT_READER_PROGRESS_STYLES.HIDDEN
                      : PROJECT_READER_PROGRESS_STYLES.DEFAULT,
                })
              }
              ariaLabel="Selecionar estilo do progresso"
              options={progressStyleOptions}
              searchable={false}
            />
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label>Posição do progresso</Label>
            <Combobox
              value={normalizedPreset.progressPosition}
              onValueChange={(value) =>
                applyUpdate({
                  progressPosition:
                    value === PROJECT_READER_PROGRESS_POSITIONS.LEFT
                      ? PROJECT_READER_PROGRESS_POSITIONS.LEFT
                      : value === PROJECT_READER_PROGRESS_POSITIONS.RIGHT
                        ? PROJECT_READER_PROGRESS_POSITIONS.RIGHT
                        : PROJECT_READER_PROGRESS_POSITIONS.BOTTOM,
                })
              }
              ariaLabel="Selecionar posicao do progresso"
              options={progressPositionOptions}
              searchable={false}
            />
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label>Chrome do leitor</Label>
            <Combobox
              value={normalizedPreset.chromeMode}
              onValueChange={(value) =>
                applyUpdate({
                  chromeMode:
                    value === PROJECT_READER_CHROME_MODES.CINEMA
                      ? PROJECT_READER_CHROME_MODES.CINEMA
                      : PROJECT_READER_CHROME_MODES.DEFAULT,
                })
              }
              ariaLabel="Selecionar chrome do leitor"
              options={chromeModeOptions}
              searchable={false}
            />
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label>Fluxo do viewport</Label>
            <Combobox
              value={normalizedPreset.viewportMode}
              onValueChange={(value) =>
                applyUpdate({
                  viewportMode:
                    value === PROJECT_READER_VIEWPORT_MODES.NATURAL
                      ? PROJECT_READER_VIEWPORT_MODES.NATURAL
                      : PROJECT_READER_VIEWPORT_MODES.VIEWPORT,
                })
              }
              ariaLabel="Selecionar fluxo do viewport"
              options={viewportModeOptions}
              searchable={false}
            />
          </DashboardFieldStack>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-3 text-sm">
            <span className="space-y-1">
              <span className="block font-medium text-foreground">Primeira página isolada</span>
              <span className="block text-xs text-foreground/70">
                Útil para capas e páginas ímpares nos layouts paginados.
              </span>
            </span>
            <Switch
              checked={normalizedPreset.firstPageSingle}
              onCheckedChange={(checked) =>
                applyUpdate({
                  firstPageSingle: checked,
                })
              }
            />
          </label>

          <div className="space-y-2 rounded-xl border border-border/70 bg-background px-3 py-3 text-sm">
            <div className="space-y-1">
              <span className="block font-medium text-foreground">Header do site</span>
              <span className="block text-xs text-foreground/70">
                Define se a barra do site fica fixa no leitor ou segue o fluxo normal da página.
              </span>
            </div>
            <Combobox
              value={normalizedPreset.siteHeaderVariant}
              onValueChange={(value) =>
                applyUpdate({
                  siteHeaderVariant:
                    value === PROJECT_READER_SITE_HEADER_VARIANTS.STATIC
                      ? PROJECT_READER_SITE_HEADER_VARIANTS.STATIC
                      : PROJECT_READER_SITE_HEADER_VARIANTS.FIXED,
                })
              }
              ariaLabel="Selecionar comportamento do header do site"
              options={siteHeaderVariantOptions}
              searchable={false}
            />
          </div>

          <label className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-3 text-sm">
            <span className="space-y-1">
              <span className="block font-medium text-foreground">Rodapé do site</span>
              <span className="block text-xs text-foreground/70">
                Exibe o footer público após o leitor e comentários.
              </span>
            </span>
            <Switch
              checked={normalizedPreset.showSiteFooter}
              onCheckedChange={(checked) =>
                applyUpdate({
                  showSiteFooter: checked,
                })
              }
            />
          </label>
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardReaderPresetCard;
