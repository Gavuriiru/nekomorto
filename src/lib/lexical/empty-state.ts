const createEmptyParagraphNode = () => ({
  children: [],
  direction: null,
  format: "",
  indent: 0,
  textFormat: 0,
  textStyle: "",
  type: "paragraph",
  version: 1,
});

export const createEmptyLexicalState = () => ({
  root: {
    children: [createEmptyParagraphNode()],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
});

export const EMPTY_LEXICAL_STATE = createEmptyLexicalState();
export const EMPTY_LEXICAL_JSON = JSON.stringify(EMPTY_LEXICAL_STATE);
