import * as React from "react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  FileImage,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  PaintBucket,
  Type,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Video,
} from "lucide-react";
import { normalizeAssetUrl } from "@/lib/asset-url";

type PostContentEditorProps = {
  format: "markdown" | "html";
  value: string;
  onFormatChange: (value: "markdown" | "html") => void;
  onChange: (value: string) => void;
  onApplyWrap: (before: string, after?: string) => void;
  onApplyHeading: () => void;
  onApplyUnorderedList: () => void;
  onApplyOrderedList: () => void;
  onAlign: (align: "left" | "center" | "right") => void;
  onColor: (color: string, type: "text" | "background") => void;
  textColorValue: string;
  backgroundColorValue: string;
  onPickTextColor: (color: string) => void;
  onPickBackgroundColor: (color: string) => void;
  gradientStart: string;
  gradientEnd: string;
  gradientAngle: number;
  gradientTarget: "text" | "background";
  onGradientStartChange: (value: string) => void;
  onGradientEndChange: (value: string) => void;
  onGradientAngleChange: (value: number) => void;
  onGradientTargetChange: (value: "text" | "background") => void;
  onApplyGradient: () => void;
  onOpenImageDialog: () => void;
  onOpenLinkDialog: () => void;
  onInsertCover?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onEmbedVideo: () => void;
  onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onDrop: React.DragEventHandler<HTMLTextAreaElement>;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  previewHtml: string;
  coverImageUrl?: string | null;
  coverAlt?: string;
  title?: string;
  excerpt?: string;
  previewMeta?: React.ReactNode;
  toolbarExtra?: React.ReactNode;
  imagePanel?: React.ReactNode;
  onPreviewClick?: React.MouseEventHandler<HTMLDivElement>;
  onPreviewDragStart?: React.DragEventHandler<HTMLDivElement>;
  onPreviewDrop?: React.DragEventHandler<HTMLDivElement>;
  onPreviewDragOver?: React.DragEventHandler<HTMLDivElement>;
  showPreview?: boolean;
};

const PostContentEditor = ({
  format,
  value,
  onFormatChange,
  onChange,
  onApplyWrap,
  onApplyHeading,
  onApplyUnorderedList,
  onApplyOrderedList,
  onAlign,
  onColor,
  textColorValue,
  backgroundColorValue,
  onPickTextColor,
  onPickBackgroundColor,
  gradientStart,
  gradientEnd,
  gradientAngle,
  gradientTarget,
  onGradientStartChange,
  onGradientEndChange,
  onGradientAngleChange,
  onGradientTargetChange,
  onApplyGradient,
  onOpenImageDialog,
  onOpenLinkDialog,
  onInsertCover,
  onUndo,
  onRedo,
  onEmbedVideo,
  onKeyDown,
  onDrop,
  textareaRef,
  previewHtml,
  coverImageUrl,
  coverAlt,
  title,
  excerpt,
  previewMeta,
  toolbarExtra,
  imagePanel,
  onPreviewClick,
  onPreviewDragStart,
  onPreviewDrop,
  onPreviewDragOver,
  showPreview = true,
}: PostContentEditorProps) => (
  <div className="space-y-8">
    <div className="space-y-4">
      <Tabs
        value={format}
        onValueChange={(value) => onFormatChange(value === "html" ? "html" : "markdown")}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onApplyWrap("**")}
              title="Negrito"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onApplyWrap("*")}
              title="Itálico"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onApplyWrap("<u>", "</u>")}
              title="Sublinhado"
            >
              <Underline className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onApplyWrap("~~")}
              title="Tachado"
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onApplyHeading}
              title="Título"
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onApplyUnorderedList}
              title="Lista"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onApplyOrderedList}
              title="Lista numerada"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onAlign("left")}
              title="Alinhar à esquerda"
            >
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onAlign("center")}
              title="Centralizar"
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onAlign("right")}
              title="Alinhar à direita"
            >
              <AlignRight className="h-4 w-4" />
            </Button>
            <ColorPicker
              label="Cor do texto"
              value={textColorValue}
              onChange={(color) => {
                const next = color.toString("hex");
                onPickTextColor(next);
                onColor(next, "text");
              }}
              trigger={<Type className="h-4 w-4" />}
              showSwatch={false}
              buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-secondary/40 text-primary transition hover:border-primary/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <ColorPicker
              label="Cor de fundo"
              value={backgroundColorValue}
              onChange={(color) => {
                const next = color.toString("hex");
                onPickBackgroundColor(next);
                onColor(next, "background");
              }}
              trigger={<PaintBucket className="h-4 w-4" />}
              showSwatch={false}
              buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-secondary/40 text-primary transition hover:border-primary/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Gradiente"
                  className="border-border/60 bg-linear-to-br from-primary/20 via-background to-accent/20 text-primary hover:border-primary/60"
                >
                  <Palette className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 space-y-3">
                <div
                  className="h-14 w-full rounded-lg border border-border/60"
                  style={{
                    background: `linear-gradient(${gradientAngle}deg, ${gradientStart}, ${gradientEnd})`,
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <ColorPicker
                    label="Início"
                    value={gradientStart}
                    onChange={(color) => onGradientStartChange(color.toString("hex"))}
                  />
                  <ColorPicker
                    label="Fim"
                    value={gradientEnd}
                    onChange={(color) => onGradientEndChange(color.toString("hex"))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Ângulo</Label>
                  <Input
                    type="number"
                    min={0}
                    max={360}
                    value={gradientAngle}
                    onChange={(event) => onGradientAngleChange(Number(event.target.value || 0))}
                    className="h-8"
                  />
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      type="button"
                      variant={gradientTarget === "text" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => onGradientTargetChange("text")}
                    >
                      Texto
                    </Button>
                    <Button
                      type="button"
                      variant={gradientTarget === "background" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => onGradientTargetChange("background")}
                    >
                      Fundo
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" size="sm" onClick={onApplyGradient}>
                    Aplicar gradiente
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onOpenImageDialog}
              title="Imagem"
            >
              <FileImage className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onOpenLinkDialog}
              title="Inserir link"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onEmbedVideo}
              title="Incorporar vídeo"
            >
              <Video className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onUndo} title="Desfazer">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onRedo} title="Refazer">
              <Redo2 className="h-4 w-4" />
            </Button>
            {toolbarExtra}
          </div>
        </div>
        <TabsContent value={format}>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onDrop={onDrop}
            onDragOver={(event) => event.preventDefault()}
            placeholder="Escreva o conteúdo do post..."
            className="min-h-[320px]"
          />
        </TabsContent>
      </Tabs>
      {imagePanel}
      {coverImageUrl && onInsertCover ? (
        <Button type="button" variant="outline" className="gap-2" onClick={onInsertCover}>
          <LinkIcon className="h-4 w-4" />
          Inserir capa no texto
        </Button>
      ) : null}
    </div>

    {showPreview ? (
      <div className="rounded-2xl border border-border/60 bg-card/80 p-6">
        <h2 className="text-lg font-semibold text-foreground">Prévia</h2>
        <div className="mt-6 space-y-6">
          {previewMeta}
          <h3 className="text-2xl font-semibold text-foreground">{title || "Sem título"}</h3>
          {excerpt ? <p className="text-sm text-muted-foreground">{excerpt}</p> : null}
          <div className="overflow-hidden rounded-2xl border border-border">
            <img
              src={normalizeAssetUrl(coverImageUrl) || "/placeholder.svg"}
              alt={coverAlt || title || "Capa"}
              className="aspect-3/2 w-full object-cover"
            />
          </div>
          <div
            className="post-content space-y-4 text-sm text-muted-foreground"
            onClick={onPreviewClick}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    ) : null}
  </div>
);

export default PostContentEditor;
