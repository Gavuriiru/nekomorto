import {
  $applyNodeReplacement,
  type EditorConfig,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from "lexical";

export type SerializedViewerAutocompleteNode = Spread<
  {
    uuid: string;
  },
  SerializedTextNode
>;

export class ViewerAutocompleteNode extends TextNode {
  __uuid: string;

  static getType(): "autocomplete" {
    return "autocomplete";
  }

  static clone(node: ViewerAutocompleteNode): ViewerAutocompleteNode {
    return new ViewerAutocompleteNode(node.__text, node.__uuid, node.__key);
  }

  static importJSON(serializedNode: SerializedViewerAutocompleteNode): ViewerAutocompleteNode {
    return $createViewerAutocompleteNode(serializedNode.text, serializedNode.uuid).updateFromJSON(
      serializedNode,
    );
  }

  constructor(text: string, uuid: string, key?: NodeKey) {
    super(text, key);
    this.__uuid = uuid;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    if (config.theme.autocomplete) {
      dom.classList.add(config.theme.autocomplete);
    }
    return dom;
  }

  exportJSON(): SerializedViewerAutocompleteNode {
    return {
      ...super.exportJSON(),
      uuid: this.__uuid,
    };
  }
}

export const $createViewerAutocompleteNode = (text: string, uuid: string) =>
  $applyNodeReplacement(new ViewerAutocompleteNode(text, uuid).setMode("token"));
