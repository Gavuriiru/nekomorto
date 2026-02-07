import { createEditor, $getRoot, $createParagraphNode } from "lexical";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { lexicalNodes } from "@/lib/lexical/nodes";

const createLexicalEditor = () =>
  createEditor({
    nodes: lexicalNodes,
  });

export const safeParseLexicalJson = (value: string) => {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return value;
    }
  } catch {
    return null;
  }
  return null;
};

export const renderLexicalJsonToHtml = (serialized: string) => {
  const editor = createLexicalEditor();
  const safe = safeParseLexicalJson(serialized);
  if (!safe) {
    return "";
  }
  const editorState = editor.parseEditorState(safe);
  editor.setEditorState(editorState);
  let html = "";
  editor.update(
    () => {
      html = $generateHtmlFromNodes(editor);
    },
    { discrete: true },
  );
  return html;
};

export const htmlToLexicalJson = (html: string) => {
  const editor = createLexicalEditor();
  const parser = new DOMParser();
  const dom = parser.parseFromString(html || "", "text/html");
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      const nodes = $generateNodesFromDOM(editor, dom);
      if (nodes.length === 0) {
        root.append($createParagraphNode());
      } else {
        root.append(...nodes);
      }
    },
    { discrete: true },
  );
  return JSON.stringify(editor.getEditorState().toJSON());
};
