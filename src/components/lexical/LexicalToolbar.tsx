import * as React from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createParagraphNode, $getSelection, $isElementNode, $isRangeSelection, FORMAT_ELEMENT_COMMAND, FORMAT_TEXT_COMMAND, REDO_COMMAND, SELECTION_CHANGE_COMMAND, UNDO_COMMAND } from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, INSERT_CHECK_LIST_COMMAND, REMOVE_LIST_COMMAND } from "@lexical/list";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from "@lexical/rich-text";
import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlignCenter, AlignLeft, AlignRight, Bold, CheckSquare, Code, Heading1, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Strikethrough, Table, Underline, Undo2, Image as ImageIcon, Video } from "lucide-react";
import { INSERT_IMAGE_COMMAND } from "@/components/lexical/nodes/ImageNode";
import { INSERT_VIDEO_COMMAND } from "@/components/lexical/nodes/VideoNode";

type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "code";

type LexicalToolbarProps = {
  onRequestImage?: () => void;
  onRequestLink?: () => void;
  onRequestVideo?: () => void;
};

const insertTable = (editor: ReturnType<typeof useLexicalComposerContext>[0]) => {
  const rows = Number(window.prompt("Linhas da tabela", "3"));
  const columns = Number(window.prompt("Colunas da tabela", "3"));
  if (!Number.isFinite(rows) || !Number.isFinite(columns) || rows <= 0 || columns <= 0) {
    return;
  }
  editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows, columns });
};

const normalizeVideoUrl = (url: string) => {
  if (url.includes("youtube.com/watch?v=")) {
    return url.replace("watch?v=", "embed/");
  }
  if (url.includes("youtu.be/")) {
    return url.replace("youtu.be/", "youtube.com/embed/");
  }
  return url;
};

const setBlockType = (editor: ReturnType<typeof useLexicalComposerContext>[0], value: BlockType) => {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }
    if (value === "paragraph") {
      $setBlocksType(selection, () => $createParagraphNode());
      return;
    }
    if (value === "quote") {
      $setBlocksType(selection, () => $createQuoteNode());
      return;
    }
    if (value === "code") {
      $setBlocksType(selection, () => $createCodeNode());
      return;
    }
    if (value === "h1") {
      $setBlocksType(selection, () => $createHeadingNode("h1"));
      return;
    }
    if (value === "h2") {
      $setBlocksType(selection, () => $createHeadingNode("h2"));
      return;
    }
    if (value === "h3") {
      $setBlocksType(selection, () => $createHeadingNode("h3"));
    }
  });
};

const LexicalToolbar = ({ onRequestImage, onRequestLink, onRequestVideo }: LexicalToolbarProps) => {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] = React.useState<BlockType>("paragraph");

  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return;
        }
        const anchorNode = selection.anchor.getNode();
        const element = $isElementNode(anchorNode)
          ? anchorNode
          : anchorNode.getParentOrThrow();
        const topLevel = element.getTopLevelElementOrThrow();
        if ($isHeadingNode(topLevel)) {
          setBlockType(topLevel.getTag());
          return;
        }
        if ($isQuoteNode(topLevel)) {
          setBlockType("quote");
          return;
        }
        if ($isCodeNode(topLevel)) {
          setBlockType("code");
          return;
        }
        setBlockType("paragraph");
      });
    });
  }, [editor]);

  React.useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            return;
          }
          const anchorNode = selection.anchor.getNode();
          const element = $isElementNode(anchorNode)
            ? anchorNode
            : anchorNode.getParentOrThrow();
          const topLevel = element.getTopLevelElementOrThrow();
          if ($isHeadingNode(topLevel)) {
            setBlockType(topLevel.getTag());
            return;
          }
          if ($isQuoteNode(topLevel)) {
            setBlockType("quote");
            return;
          }
          if ($isCodeNode(topLevel)) {
            setBlockType("code");
            return;
          }
          setBlockType("paragraph");
        });
        return false;
      },
      0,
    );
  }, [editor]);

  return (
    <div className="lexical-toolbar">
      <Select value={blockType} onValueChange={(value) => setBlockType(editor, value as BlockType)}>
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue placeholder="Bloco" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="paragraph">Parágrafo</SelectItem>
          <SelectItem value="h1">
            <div className="flex items-center gap-2">
              <Heading1 className="h-4 w-4" />
              H1
            </div>
          </SelectItem>
          <SelectItem value="h2">
            <div className="flex items-center gap-2">
              <Heading2 className="h-4 w-4" />
              H2
            </div>
          </SelectItem>
          <SelectItem value="h3">
            <div className="flex items-center gap-2">
              <Heading3 className="h-4 w-4" />
              H3
            </div>
          </SelectItem>
          <SelectItem value="quote">
            <div className="flex items-center gap-2">
              <Quote className="h-4 w-4" />
              Citação
            </div>
          </SelectItem>
          <SelectItem value="code">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Código
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}>
          <Underline className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}>
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left")}>
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center")}>
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right")}>
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}>
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)}>
          <CheckSquare className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)}>
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            if (onRequestLink) {
              onRequestLink();
              return;
            }
            const url = window.prompt("URL do link", "https://");
            if (!url) {
              return;
            }
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
          }}
        >
          <Link2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            if (onRequestImage) {
              onRequestImage();
              return;
            }
            const url = window.prompt("URL da imagem");
            if (!url) {
              return;
            }
            const alt = window.prompt("Texto alternativo", "Imagem") || "Imagem";
            editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
              src: url,
              altText: alt,
              width: "100%",
              align: "center",
            });
          }}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => {
            if (onRequestVideo) {
              onRequestVideo();
              return;
            }
            const url = window.prompt("URL do vídeo (embed ou link)");
            if (!url) {
              return;
            }
            editor.dispatchCommand(INSERT_VIDEO_COMMAND, { src: normalizeVideoUrl(url), title: "Video" });
          }}
        >
          <Video className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => insertTable(editor)}>
          <Table className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default LexicalToolbar;
