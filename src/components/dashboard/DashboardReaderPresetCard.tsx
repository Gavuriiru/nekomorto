import DashboardFieldStack from "@/components/dashboard/DashboardFieldStack";
import DashboardPageBadge from "@/components/dashboard/DashboardPageBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { SiteSettings } from "@/types/site-settings";
import {
  PROJECT_READER_BACKGROUNDS,
  PROJECT_READER_DIRECTIONS,
  PROJECT_READER_IMAGE_FITS,
  PROJECT_READER_LAYOUTS,
  PROJECT_READER_PROGRESS_POSITIONS,
  PROJECT_READER_PROGRESS_STYLES,
  normalizeProjectReaderConfig,
} from "../../../shared/project-reader.js";

type ReaderProjectTypeKey = keyof SiteSettings["reader"]["projectTypes"];

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

  return (
    <Card
      lift={false}
      className={cardClassName}
      data-testid={`reader-preset-${presetMeta.key}`}
    >
      <CardContent className="space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{presetMeta.title}</h2>
            <p className="text-xs text-foreground/70">{presetMeta.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DashboardPageBadge>
              {preset.direction === PROJECT_READER_DIRECTIONS.RTL ? "RTL" : "LTR"}
            </DashboardPageBadge>
            <DashboardPageBadge>{resolveLayoutBadgeLabel(String(preset.layout || ""))}</DashboardPageBadge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DashboardFieldStack>
            <Label>Direção</Label>
            <Select
              value={preset.direction}
              onValueChange={(value) =>
                applyUpdate({
                  direction:
                    value === PROJECT_READER_DIRECTIONS.LTR
                      ? PROJECT_READER_DIRECTIONS.LTR
                      : PROJECT_READER_DIRECTIONS.RTL,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROJECT_READER_DIRECTIONS.RTL}>
                  Direita para esquerda
                </SelectItem>
                <SelectItem value={PROJECT_READER_DIRECTIONS.LTR}>
                  Esquerda para direita
                </SelectItem>
              </SelectContent>
            </Select>
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label>Layout</Label>
            <Select
              value={preset.layout}
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
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROJECT_READER_LAYOUTS.SINGLE}>Página única</SelectItem>
                <SelectItem value={PROJECT_READER_LAYOUTS.DOUBLE}>Página dupla</SelectItem>
                <SelectItem value={PROJECT_READER_LAYOUTS.SCROLL_VERTICAL}>
                  Scroll vertical
                </SelectItem>
                <SelectItem value={PROJECT_READER_LAYOUTS.SCROLL_HORIZONTAL}>
                  Scroll horizontal
                </SelectItem>
              </SelectContent>
            </Select>
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label>Ajuste da imagem</Label>
            <Select
              value={preset.imageFit}
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
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROJECT_READER_IMAGE_FITS.BOTH}>
                  Largura e altura
                </SelectItem>
                <SelectItem value={PROJECT_READER_IMAGE_FITS.WIDTH}>Ajustar à largura</SelectItem>
                <SelectItem value={PROJECT_READER_IMAGE_FITS.HEIGHT}>Ajustar à altura</SelectItem>
                <SelectItem value={PROJECT_READER_IMAGE_FITS.NONE}>Tamanho natural</SelectItem>
              </SelectContent>
            </Select>
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label>Fundo do palco</Label>
            <Select
              value={preset.background}
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
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROJECT_READER_BACKGROUNDS.THEME}>Tema do site</SelectItem>
                <SelectItem value={PROJECT_READER_BACKGROUNDS.BLACK}>Preto</SelectItem>
                <SelectItem value={PROJECT_READER_BACKGROUNDS.WHITE}>Branco</SelectItem>
              </SelectContent>
            </Select>
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label>Estilo do progresso</Label>
            <Select
              value={preset.progressStyle}
              onValueChange={(value) =>
                applyUpdate({
                  progressStyle:
                    value === PROJECT_READER_PROGRESS_STYLES.HIDDEN
                      ? PROJECT_READER_PROGRESS_STYLES.HIDDEN
                      : value === PROJECT_READER_PROGRESS_STYLES.GLOW
                        ? PROJECT_READER_PROGRESS_STYLES.GLOW
                        : PROJECT_READER_PROGRESS_STYLES.BAR,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROJECT_READER_PROGRESS_STYLES.BAR}>Barra</SelectItem>
                <SelectItem value={PROJECT_READER_PROGRESS_STYLES.GLOW}>Glow</SelectItem>
                <SelectItem value={PROJECT_READER_PROGRESS_STYLES.HIDDEN}>Oculto</SelectItem>
              </SelectContent>
            </Select>
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label>Posição do progresso</Label>
            <Select
              value={preset.progressPosition}
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
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROJECT_READER_PROGRESS_POSITIONS.BOTTOM}>
                  Inferior
                </SelectItem>
                <SelectItem value={PROJECT_READER_PROGRESS_POSITIONS.LEFT}>Esquerda</SelectItem>
                <SelectItem value={PROJECT_READER_PROGRESS_POSITIONS.RIGHT}>Direita</SelectItem>
              </SelectContent>
            </Select>
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label htmlFor={`reader-preview-limit-${presetMeta.key}`}>Limite de preview</Label>
            <Input
              id={`reader-preview-limit-${presetMeta.key}`}
              type="number"
              min="1"
              value={preset.previewLimit ?? ""}
              placeholder="Opcional"
              onChange={(event) =>
                applyUpdate({
                  previewLimit: event.target.value.trim()
                    ? Math.max(1, Number(event.target.value))
                    : null,
                })
              }
            />
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label htmlFor={`reader-purchase-url-${presetMeta.key}`}>URL de compra</Label>
            <Input
              id={`reader-purchase-url-${presetMeta.key}`}
              value={preset.purchaseUrl || ""}
              placeholder="https://..."
              onChange={(event) =>
                applyUpdate({
                  purchaseUrl: event.target.value,
                })
              }
            />
          </DashboardFieldStack>

          <DashboardFieldStack>
            <Label htmlFor={`reader-purchase-price-${presetMeta.key}`}>Preço exibido</Label>
            <Input
              id={`reader-purchase-price-${presetMeta.key}`}
              value={preset.purchasePrice || ""}
              placeholder="R$ 0,00"
              onChange={(event) =>
                applyUpdate({
                  purchasePrice: event.target.value,
                })
              }
            />
          </DashboardFieldStack>
        </div>

        <label className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-3 text-sm">
          <span className="space-y-1">
            <span className="block font-medium text-foreground">Primeira página isolada</span>
            <span className="block text-xs text-foreground/70">
              Útil para capas e páginas ímpares nos layouts paginados.
            </span>
          </span>
          <Switch
            checked={preset.firstPageSingle !== false}
            onCheckedChange={(checked) =>
              applyUpdate({
                firstPageSingle: checked,
              })
            }
          />
        </label>
      </CardContent>
    </Card>
  );
};

export default DashboardReaderPresetCard;
