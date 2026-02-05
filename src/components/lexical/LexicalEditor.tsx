import * as React from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { AutoLinkPlugin, createLinkMatcherWithRegExp } from "@lexical/react/LexicalAutoLinkPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_EDITOR,
} from "lexical";
import { TRANSFORMERS } from "@lexical/markdown";
import LexicalToolbar from "@/components/lexical/LexicalToolbar";
import { lexicalTheme } from "@/lib/lexical/theme";
import { lexicalNodes } from "@/lib/lexical/nodes";
import { INSERT_IMAGE_COMMAND, type ImagePayload, $createImageNode } from "@/components/lexical/nodes/ImageNode";
import { INSERT_VIDEO_COMMAND, type VideoPayload, $createVideoNode } from "@/components/lexical/nodes/VideoNode";
import { $createLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

const URL_MATCHER = createLinkMatcherWithRegExp(/https?:\/\/[^\s]+/g, (text) => text);

const blurEditorRoot = (editor: ReturnType<typeof useLexicalComposerContext>[0]) => {
  editor.blur();
  editor.update(
    () => {
      $setSelection(null);
    },
    { discrete: true },
  );
  const root = editor.getRootElement();
  if (root && document.activeElement === root) {
    root.blur();
  }
};

export type LexicalEditorHandle = {
  insertImage: (payload: ImagePayload) => void;
  insertVideo: (payload: VideoPayload) => void;
  insertLink: (url: string, text?: string) => void;
  focus: () => void;
  blur: () => void;
};

type LexicalEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onRequestImage?: () => void;
  onRequestLink?: () => void;
  onRequestVideo?: () => void;
  readOnly?: boolean;
};

const EditorBridge = React.forwardRef<LexicalEditorHandle>((_props, ref) => {
    const [editor] = useLexicalComposerContext();

    React.useImperativeHandle(ref, () => ({
      insertImage: (payload) => {
        editor.update(() => {
          const imageNode = $createImageNode(payload);
          $insertNodes([imageNode]);
        });
      },
      insertVideo: (payload) => {
        editor.update(() => {
          const videoNode = $createVideoNode(payload);
          $insertNodes([videoNode]);
        });
      },
      insertLink: (url, text) => {
        let didInsert = false;
        editor.update(
          () => {
            const selection = $getSelection();
            if ($isRangeSelection(selection) && selection.isCollapsed()) {
              if (text) {
                const linkNode = $createLinkNode(url);
                linkNode.append($createTextNode(text));
                $insertNodes([linkNode]);
                didInsert = true;
              }
            }
          },
          { discrete: true },
        );
        if (!didInsert) {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
        }
      },
      focus: () => editor.focus(),
      blur: () => blurEditorRoot(editor),
    }));

    React.useEffect(() => {
      return editor.registerCommand(
        INSERT_IMAGE_COMMAND,
        (payload) => {
          const imageNode = $createImageNode(payload);
          $insertNodes([imageNode]);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      );
    }, [editor]);

    React.useEffect(() => {
      return editor.registerCommand(
        INSERT_VIDEO_COMMAND,
        (payload) => {
          const videoNode = $createVideoNode(payload);
          $insertNodes([videoNode]);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      );
    }, [editor]);

    return null;
});

EditorBridge.displayName = "EditorBridge";

const ValuePlugin = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const [editor] = useLexicalComposerContext();
  const isSettingRef = React.useRef(false);
  const lastValueRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!value || value === lastValueRef.current) {
      return;
    }
    try {
      isSettingRef.current = true;
      const state = editor.parseEditorState(value);
      editor.setEditorState(state);
      lastValueRef.current = value;
    } catch {
      editor.update(
        () => {
          const root = $getRoot();
          root.clear();
          root.append($createParagraphNode());
        },
        { discrete: true },
      );
    } finally {
      isSettingRef.current = false;
    }
  }, [editor, value]);

  return (
    <OnChangePlugin
      onChange={(editorState) => {
        if (isSettingRef.current) {
          return;
        }
        const next = JSON.stringify(editorState.toJSON());
        lastValueRef.current = next;
        onChange(next);
      }}
    />
  );
};

type ActionDialogType = "link" | "video" | "table" | null;

const normalizeVideoUrl = (url: string) => {
  if (url.includes("youtube.com/watch?v=")) {
    return url.replace("watch?v=", "embed/");
  }
  if (url.includes("youtu.be/")) {
    return url.replace("youtu.be/", "youtube.com/embed/");
  }
  return url;
};

const ActionDialogs = ({
  action,
  setAction,
  linkUrl,
  setLinkUrl,
  linkText,
  setLinkText,
  videoUrl,
  setVideoUrl,
  tableRows,
  setTableRows,
  tableCols,
  setTableCols,
}: {
  action: ActionDialogType;
  setAction: (value: ActionDialogType) => void;
  linkUrl: string;
  setLinkUrl: (value: string) => void;
  linkText: string;
  setLinkText: (value: string) => void;
  videoUrl: string;
  setVideoUrl: (value: string) => void;
  tableRows: string;
  setTableRows: (value: string) => void;
  tableCols: string;
  setTableCols: (value: string) => void;
}) => {
  const [editor] = useLexicalComposerContext();
  const close = () => setAction(null);

  const handleConfirm = () => {
    if (action === "link") {
      const url = linkUrl.trim();
      if (!url) {
        return;
      }
      const text = linkText.trim();
      if (text) {
        editor.update(
          () => {
            const selection = $getSelection();
            if ($isRangeSelection(selection) && selection.isCollapsed()) {
              const linkNode = $createLinkNode(url);
              linkNode.append($createTextNode(text));
              $insertNodes([linkNode]);
            }
          },
          { discrete: true },
        );
      } else {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
      }
      setLinkUrl("");
      setLinkText("");
      close();
      return;
    }

    if (action === "video") {
      const url = videoUrl.trim();
      if (!url) {
        return;
      }
      editor.dispatchCommand(INSERT_VIDEO_COMMAND, { src: normalizeVideoUrl(url), title: "Video" });
      setVideoUrl("");
      close();
      return;
    }

    if (action === "table") {
      const rows = Number(tableRows);
      const columns = Number(tableCols);
      if (!Number.isFinite(rows) || !Number.isFinite(columns) || rows <= 0 || columns <= 0) {
        return;
      }
      editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows, columns });
      setTableRows("3");
      setTableCols("3");
      close();
    }
  };

  const title =
    action === "link" ? "Inserir link" : action === "video" ? "Incorporar vídeo" : "Inserir tabela";
  const description =
    action === "link"
      ? "Adicione um hyperlink no conteúdo."
      : action === "video"
        ? "Cole o link do YouTube ou Vimeo."
        : "Defina a quantidade de linhas e colunas.";

  return (
    <Dialog open={action !== null} onOpenChange={(open) => (open ? null : close())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {action === "link" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Texto</Label>
              <Input value={linkText} onChange={(event) => setLinkText(event.target.value)} />
            </div>
          </div>
        ) : null}
        {action === "video" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL do vídeo</Label>
              <Input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} />
            </div>
          </div>
        ) : null}
        {action === "table" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Linhas</Label>
                <Input value={tableRows} onChange={(event) => setTableRows(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Colunas</Label>
                <Input value={tableCols} onChange={(event) => setTableCols(event.target.value)} />
              </div>
            </div>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>Inserir</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const BlurOnOutsideClick = ({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement>;
}) => {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!containerRef.current || !target) {
        return;
      }
      if (containerRef.current.contains(target)) {
        return;
      }
      blurEditorRoot(editor);
    };
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null;
      if (!containerRef.current || !target) {
        return;
      }
      if (containerRef.current.contains(target)) {
        return;
      }
      blurEditorRoot(editor);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, [editor, containerRef]);

  return null;
};

const LexicalEditor = React.forwardRef<LexicalEditorHandle, LexicalEditorProps>(
  ({ value, onChange, placeholder, className, onRequestImage, onRequestLink, onRequestVideo, readOnly }, ref) => {
    const [action, setAction] = React.useState<ActionDialogType>(null);
    const [linkUrl, setLinkUrl] = React.useState("");
    const [linkText, setLinkText] = React.useState("");
    const [videoUrl, setVideoUrl] = React.useState("");
    const [tableRows, setTableRows] = React.useState("3");
    const [tableCols, setTableCols] = React.useState("3");

    const warn = React.useCallback((title: string) => {
      toast({
        title,
        description: "Use as opções do editor para configurar esse recurso.",
      });
    }, []);

    const handleRequestLink = React.useCallback(() => {
      warn("Link");
      if (onRequestLink) {
        onRequestLink();
        return;
      }
      setAction("link");
    }, [onRequestLink, warn]);

    const handleRequestVideo = React.useCallback(() => {
      warn("Vídeo");
      if (onRequestVideo) {
        onRequestVideo();
        return;
      }
      setAction("video");
    }, [onRequestVideo, warn]);

    const handleRequestTable = React.useCallback(() => {
      warn("Tabela");
      setAction("table");
    }, [warn]);

    const initialConfig = React.useMemo(
      () => ({
        namespace: "RainbowLexicalEditor",
        theme: lexicalTheme,
        onError: (error: Error) => {
          console.error(error);
        },
        nodes: lexicalNodes,
        editable: !readOnly,
      }),
      [readOnly],
    );

    const containerRef = React.useRef<HTMLDivElement | null>(null);

    return (
      <LexicalComposer initialConfig={initialConfig}>
        <div
          ref={containerRef}
          className={`lexical-editor ${className || ""}`}
          onDragStartCapture={(event) => {
            event.stopPropagation();
          }}
        >
          {!readOnly ? (
            <LexicalToolbar
              onRequestImage={onRequestImage}
              onRequestLink={handleRequestLink}
              onRequestVideo={handleRequestVideo}
              onRequestTable={handleRequestTable}
            />
          ) : null}
          <div className="lexical-content-wrapper">
            <RichTextPlugin
              contentEditable={<ContentEditable className="lexical-content" draggable={false} />}
              placeholder={<div className="lexical-placeholder">{placeholder || "Digite o conteúdo..."}</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          <AutoLinkPlugin matchers={[URL_MATCHER]} />
          <TablePlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <ValuePlugin value={value} onChange={onChange} />
          <EditorBridge ref={ref} />
          <BlurOnOutsideClick containerRef={containerRef} />
          <ActionDialogs
            action={action}
            setAction={setAction}
            linkUrl={linkUrl}
            setLinkUrl={setLinkUrl}
            linkText={linkText}
            setLinkText={setLinkText}
            videoUrl={videoUrl}
            setVideoUrl={setVideoUrl}
            tableRows={tableRows}
            setTableRows={setTableRows}
            tableCols={tableCols}
            setTableCols={setTableCols}
          />
        </div>
      </LexicalComposer>
    );
  },
);

LexicalEditor.displayName = "LexicalEditor";

export default LexicalEditor;
