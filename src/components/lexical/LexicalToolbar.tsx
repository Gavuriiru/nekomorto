import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "@/components/ui/use-toast";
import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Table,
  Underline,
  Undo2,
  Video,
} from "lucide-react";
import * as React from "react";

type BlockType = "paragraph" | "h1" | "h2" | "h3" | "quote" | "code";

const blockTypeOptions = [
  { value: "paragraph", label: "Parágrafo" },
  { value: "h1", label: "H1", icon: Heading1 },
  { value: "h2", label: "H2", icon: Heading2 },
  { value: "h3", label: "H3", icon: Heading3 },
  { value: "quote", label: "Citação", icon: Quote },
  { value: "code", label: "Código", icon: Code },
];

type LexicalToolbarProps = {
  onRequestImage?: () => void;
  onRequestLink?: () => void;
  onRequestVideo?: () => void;
  onRequestTable?: () => void;
};

const applyBlockType = (
  editor: ReturnType<typeof useLexicalComposerContext>[0],
  value: BlockType,
) => {
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

const toSupportedBlockType = (tag: string): BlockType =>
  tag === "h1" || tag === "h2" || tag === "h3" ? tag : "paragraph";

const LexicalToolbar = ({
  onRequestImage,
  onRequestLink,
  onRequestVideo,
  onRequestTable,
}: LexicalToolbarProps) => {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] = React.useState<BlockType>("paragraph");
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
        const element = $isElementNode(anchorNode) ? anchorNode : anchorNode.getParentOrThrow();
        const topLevel = element.getTopLevelElementOrThrow();
        if ($isHeadingNode(topLevel)) {
          setBlockType(toSupportedBlockType(topLevel.getTag()));
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
          const element = $isElementNode(anchorNode) ? anchorNode : anchorNode.getParentOrThrow();
          const topLevel = element.getTopLevelElementOrThrow();
          if ($isHeadingNode(topLevel)) {
            setBlockType(toSupportedBlockType(topLevel.getTag()));
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
      <Combobox
        value={blockType}
        onValueChange={(value) => {
          const next = value as BlockType;
          setBlockType(next);
          applyBlockType(editor, next);
        }}
        ariaLabel="Bloco"
        options={blockTypeOptions}
        placeholder="Bloco"
        searchable={false}
        className="h-9 w-[160px]"
      />

      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
          title="Negrito"
          aria-label="Negrito"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
          title="Itálico"
          aria-label="Itálico"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
          title="Sublinhado"
          aria-label="Sublinhado"
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}
          title="Tachado"
          aria-label="Tachado"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left")}
          title="Alinhar à esquerda"
          aria-label="Alinhar à esquerda"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center")}
          title="Centralizar"
          aria-label="Centralizar"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right")}
          title="Alinhar à direita"
          aria-label="Alinhar à direita"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => requireSelection(INSERT_UNORDERED_LIST_COMMAND)}
          title="Lista com marcadores"
          aria-label="Lista com marcadores"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => requireSelection(INSERT_ORDERED_LIST_COMMAND)}
          title="Lista numerada"
          aria-label="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRequestLink?.()}
          title="Inserir link"
          aria-label="Inserir link"
        >
          <Link2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRequestImage?.()}
          title="Inserir imagem"
          aria-label="Inserir imagem"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRequestVideo?.()}
          title="Inserir vídeo"
          aria-label="Inserir vídeo"
        >
          <Video className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRequestTable?.()}
          title="Inserir tabela"
          aria-label="Inserir tabela"
        >
          <Table className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          title="Desfazer"
          aria-label="Desfazer"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          title="Refazer"
          aria-label="Refazer"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default LexicalToolbar;
