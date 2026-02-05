import * as React from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createParagraphNode, $getRoot, $getSelection, $isElementNode, $isRangeSelection, FORMAT_ELEMENT_COMMAND, FORMAT_TEXT_COMMAND, REDO_COMMAND, SELECTION_CHANGE_COMMAND, UNDO_COMMAND } from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from "@lexical/rich-text";
import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { AlignCenter, AlignLeft, AlignRight, Bold, Code, Heading1, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Strikethrough, Table, Underline, Undo2, Image as ImageIcon, Video } from "lucide-react";

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
  onRequestTable?: () => void;
};

const applyBlockType = (editor: ReturnType<typeof useLexicalComposerContext>[0], value: BlockType) => {
  editor.focus();
  editor.update(() => {
    let selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      $getRoot().selectStart();
      selection = $getSelection();
    }
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

const LexicalToolbar = ({ onRequestImage, onRequestLink, onRequestVideo, onRequestTable }: LexicalToolbarProps) => {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] = React.useState<BlockType>("paragraph");
  const blockLabel = React.useMemo(() => {
    switch (blockType) {
      case "h1":
        return "H1";
      case "h2":
        return "H2";
      case "h3":
        return "H3";
      case "quote":
        return "Citação";
      case "code":
        return "Código";
      default:
        return "Parágrafo";
    }
  }, [blockType]);
  const requireSelection = React.useCallback(
    (command: Parameters<typeof editor.dispatchCommand>[0]) => {
      let hasRange = false;
      editor.focus();
      editor.update(
        () => {
          const selection = $getSelection();
          hasRange = $isRangeSelection(selection);
        },
        { discrete: true },
      );
      if (!hasRange) {
        toast({ title: "Clique no texto para posicionar o cursor." });
        return;
      }
      editor.focus();
      editor.dispatchCommand(command, undefined);
    },
    [editor],
  );

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

  React.useEffect(() => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        $getRoot().selectStart();
      }
    });
  }, [editor]);

  return (
    <div className="lexical-toolbar">
      <Select
        value={blockType}
        onValueChange={(value) => {
          const next = value as BlockType;
          setBlockType(next);
          applyBlockType(editor, next);
        }}
      >
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue placeholder="Bloco">{blockLabel}</SelectValue>
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
        <Button type="button" variant="ghost" size="icon" onClick={() => requireSelection(INSERT_UNORDERED_LIST_COMMAND)}>
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => requireSelection(INSERT_ORDERED_LIST_COMMAND)}>
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRequestLink?.()}
        >
          <Link2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRequestImage?.()}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRequestVideo?.()}
        >
          <Video className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={() => onRequestTable?.()}>
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
