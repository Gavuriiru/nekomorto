import { $getRoot, createEditor } from "lexical";

import PlaygroundNodes from "@/lexical-playground/nodes/PlaygroundNodes";

export const createSlug = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

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

export const getLexicalText = (content: string) => {
  const safe = safeParseLexicalJson(content);
  if (!safe) {
    return "";
  }
  const editor = createEditor({ nodes: PlaygroundNodes });
  const state = editor.parseEditorState(safe);
  editor.setEditorState(state);
  let text = "";
  editor.getEditorState().read(() => {
    text = $getRoot().getTextContent();
  });
  return text;
};

export const estimateReadTime = (content: string) => {
  const text = getLexicalText(content);
  const words = text.split(/\s+/).filter(Boolean);
  const minutes = Math.max(1, Math.ceil(words.length / 200));
  return `${minutes} min de leitura`;
};
