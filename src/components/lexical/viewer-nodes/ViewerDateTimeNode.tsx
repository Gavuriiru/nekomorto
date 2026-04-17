import {
  DecoratorNode,
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";

export type SerializedViewerDateTimeNode = Spread<
  {
    dateTime?: string;
  },
  SerializedLexicalNode
>;

const getDateTimeLabel = (dateTime: Date | undefined) => {
  if (!dateTime || Number.isNaN(dateTime.getTime())) {
    return "Data inválida";
  }

  const hasTime = dateTime.getHours() !== 0 || dateTime.getMinutes() !== 0;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    ...(hasTime ? { timeStyle: "short" } : {}),
  }).format(dateTime);
};

const ViewerDateTime = ({ dateTime }: { dateTime: Date | undefined }) => (
  <time
    className="inline-flex w-fit max-w-full rounded-full border border-border/70 bg-card/70 px-3 py-1 text-sm text-muted-foreground"
    dateTime={dateTime?.toISOString()}
  >
    {getDateTimeLabel(dateTime)}
  </time>
);

const parseDate = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(Date.parse(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const convertDateTimeElement = (domNode: HTMLElement): DOMConversionOutput | null => {
  const dateTimeValue = domNode.getAttribute("data-lexical-datetime");
  if (dateTimeValue) {
    return { node: $createViewerDateTimeNode(parseDate(dateTimeValue)) };
  }
  return null;
};

export class ViewerDateTimeNode extends DecoratorNode<JSX.Element> {
  __dateTime?: string;

  static getType(): string {
    return "datetime";
  }

  static clone(node: ViewerDateTimeNode): ViewerDateTimeNode {
    return new ViewerDateTimeNode(node.__dateTime, node.__key);
  }

  static importJSON(serializedNode: SerializedViewerDateTimeNode): ViewerDateTimeNode {
    return $createViewerDateTimeNode(parseDate(serializedNode.dateTime)).updateFromJSON(
      serializedNode,
    );
  }

  static importDOM() {
    return {
      span: (domNode: HTMLElement) =>
        domNode.getAttribute("data-lexical-datetime") !== null
          ? {
              conversion: convertDateTimeElement,
              priority: 2 as const,
            }
          : null,
    };
  }

  constructor(dateTime?: string, key?: NodeKey) {
    super(key);
    this.__dateTime = dateTime;
  }

  exportJSON(): SerializedViewerDateTimeNode {
    return {
      ...super.exportJSON(),
      dateTime: this.__dateTime,
    };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    if (this.__dateTime) {
      element.setAttribute("data-lexical-datetime", this.__dateTime);
      element.textContent = getDateTimeLabel(parseDate(this.__dateTime));
    }
    return { element };
  }

  createDOM(): HTMLElement {
    const element = document.createElement("span");
    element.style.display = "inline-block";
    if (this.__dateTime) {
      element.setAttribute("data-lexical-datetime", this.__dateTime);
    }
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): boolean {
    return true;
  }

  getTextContent(): string {
    return getDateTimeLabel(parseDate(this.__dateTime));
  }

  decorate(): JSX.Element {
    return <ViewerDateTime dateTime={parseDate(this.__dateTime)} />;
  }
}

export const $createViewerDateTimeNode = (dateTime: Date | undefined) =>
  new ViewerDateTimeNode(dateTime?.toISOString());

export const $isViewerDateTimeNode = (
  node: LexicalNode | null | undefined,
): node is ViewerDateTimeNode => node instanceof ViewerDateTimeNode;
