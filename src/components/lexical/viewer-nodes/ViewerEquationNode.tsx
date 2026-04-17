import katex from "katex";
import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import * as React from "react";

export type SerializedViewerEquationNode = Spread<
  {
    equation: string;
    inline: boolean;
  },
  SerializedLexicalNode
>;

const renderEquationMarkup = (equation: string, inline: boolean) =>
  katex.renderToString(equation, {
    displayMode: !inline,
    errorColor: "#cc0000",
    output: "html",
    strict: "warn",
    throwOnError: false,
    trust: false,
  });

const ViewerEquation = ({ equation, inline }: { equation: string; inline: boolean }) => {
  const html = React.useMemo(() => renderEquationMarkup(equation, inline), [equation, inline]);
  const TagName = inline ? "span" : "div";

  return <TagName dangerouslySetInnerHTML={{ __html: html }} aria-label="Formula matematica" />;
};

const convertEquationElement = (domNode: HTMLElement): DOMConversionOutput | null => {
  const encodedEquation = domNode.getAttribute("data-lexical-equation");
  if (!encodedEquation) {
    return null;
  }
  return {
    node: $createViewerEquationNode(
      atob(encodedEquation),
      domNode.getAttribute("data-lexical-inline") === "true",
    ),
  };
};

export class ViewerEquationNode extends DecoratorNode<JSX.Element> {
  __equation: string;
  __inline: boolean;

  static getType(): string {
    return "equation";
  }

  static clone(node: ViewerEquationNode): ViewerEquationNode {
    return new ViewerEquationNode(node.__equation, node.__inline, node.__key);
  }

  static importJSON(serializedNode: SerializedViewerEquationNode): ViewerEquationNode {
    return $createViewerEquationNode(serializedNode.equation, serializedNode.inline).updateFromJSON(
      serializedNode,
    );
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) =>
        domNode.hasAttribute("data-lexical-equation")
          ? {
              conversion: convertEquationElement,
              priority: 2,
            }
          : null,
      span: (domNode: HTMLElement) =>
        domNode.hasAttribute("data-lexical-equation")
          ? {
              conversion: convertEquationElement,
              priority: 1,
            }
          : null,
    };
  }

  constructor(equation: string, inline = false, key?: NodeKey) {
    super(key);
    this.__equation = equation;
    this.__inline = inline;
  }

  exportJSON(): SerializedViewerEquationNode {
    return {
      ...super.exportJSON(),
      equation: this.__equation,
      inline: this.__inline,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement(this.__inline ? "span" : "div");
    element.setAttribute("data-lexical-equation", btoa(this.__equation));
    element.setAttribute("data-lexical-inline", String(this.__inline));
    element.innerHTML = renderEquationMarkup(this.__equation, this.__inline);
    return { element };
  }

  createDOM(): HTMLElement {
    const element = document.createElement(this.__inline ? "span" : "div");
    element.className = "editor-equation";
    return element;
  }

  updateDOM(prevNode: this): boolean {
    return this.__inline !== prevNode.__inline;
  }

  getTextContent(): string {
    return this.__equation;
  }

  decorate(): JSX.Element {
    return <ViewerEquation equation={this.__equation} inline={this.__inline} />;
  }
}

export const $createViewerEquationNode = (equation = "", inline = false) =>
  $applyNodeReplacement(new ViewerEquationNode(equation, inline));

export const $isViewerEquationNode = (
  node: LexicalNode | null | undefined,
): node is ViewerEquationNode => node instanceof ViewerEquationNode;
