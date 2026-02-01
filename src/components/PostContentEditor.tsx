import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  onOpenColorDialog: (type: "text" | "background") => void;
  onOpenGradientDialog: () => void;
  onOpenImageDialog: () => void;
  onOpenLinkDialog: () => void;
  onInsertCover: () => void;
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
  previewMeta?: ReactNode;
  toolbarExtra?: ReactNode;
  imagePanel?: ReactNode;
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
  onOpenColorDialog,
  onOpenGradientDialog,
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
      <Tabs value={format} onValueChange={(value) => onFormatChange(value === "html" ? "html" : "markdown")}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => onApplyWrap("**")} title="Negrito">
              <Bold className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => onApplyWrap("*")} title="Itálico">
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
            <Button type="button" variant="ghost" size="icon" onClick={() => onApplyWrap("~~")} title="Tachado">
              <Strikethrough className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onApplyHeading} title="Título">
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onApplyUnorderedList} title="Lista">
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
            <Button type="button" variant="ghost" size="icon" onClick={() => onAlign("left")} title="Alinhar à esquerda">
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => onAlign("center")} title="Centralizar">
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => onAlign("right")} title="Alinhar à direita">
              <AlignRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onOpenColorDialog("text")}
              title="Cor do texto"
              className="border-border/60 bg-secondary/40 text-primary hover:border-primary/60"
            >
              <Type className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onOpenColorDialog("background")}
              title="Cor de fundo"
              className="border-border/60 bg-secondary/40 text-primary hover:border-primary/60"
            >
              <PaintBucket className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onOpenGradientDialog}
              title="Gradiente"
              className="border-border/60 bg-gradient-to-br from-primary/20 via-background to-accent/20 text-primary hover:border-primary/60"
            >
              <Palette className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onOpenImageDialog} title="Imagem">
              <FileImage className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onOpenLinkDialog} title="Inserir link">
              <LinkIcon className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onEmbedVideo} title="Incorporar vídeo">
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
      {coverImageUrl ? (
        <Button type="button" variant="outline" className="gap-2" onClick={onInsertCover}>
          <LinkIcon className="h-4 w-4" />
          Inserir capa no texto
        </Button>
      ) : null}
    </div>

    {showPreview ? (
      <div className="rounded-2xl border border-border/60 bg-card/80 p-6">
        <h2 className="text-lg font-semibold text-foreground">Preview</h2>
        <div className="mt-6 space-y-6">
          {previewMeta}
          <h3 className="text-2xl font-semibold text-foreground">{title || "Sem título"}</h3>
          {excerpt ? <p className="text-sm text-muted-foreground">{excerpt}</p> : null}
          <div className="overflow-hidden rounded-2xl border border-border">
            <img
              src={coverImageUrl || "/placeholder.svg"}
              alt={coverAlt || title || "Capa"}
              className="aspect-[3/2] w-full object-cover"
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

