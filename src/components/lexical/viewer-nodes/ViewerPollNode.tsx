import type { JSX } from "react";

import * as React from "react";
import {
  $getState,
  $setState,
  buildImportMap,
  createState,
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalNode,
  type SerializedLexicalNode,
  type Spread,
  type StateConfigValue,
  type StateValueOrUpdater,
  DecoratorNode,
} from "lexical";

const ViewerPollComponent = React.lazy(() => import("./ViewerPollComponent"));

export type ViewerPollOption = Readonly<{
  text: string;
  uid: string;
  votes: string[];
}>;

export type ViewerPollOptions = ReadonlyArray<ViewerPollOption>;

export type SerializedViewerPollNode = Spread<
  {
    options: ViewerPollOptions;
    question: string;
  },
  SerializedLexicalNode
>;

const createUID = () =>
  Math.random()
    .toString(36)
    .replace(/[^a-z]+/g, "")
    .substring(0, 5);

export const createViewerPollOption = (text = ""): ViewerPollOption => ({
  text,
  uid: createUID(),
  votes: [],
});

const cloneOption = (option: ViewerPollOption, text: string, votes?: string[]) => ({
  text,
  uid: option.uid,
  votes: votes || Array.from(option.votes),
});

const parseOptions = (json: unknown): ViewerPollOptions => {
  const options = [];
  if (Array.isArray(json)) {
    for (const row of json) {
      if (
        row &&
        typeof row.text === "string" &&
        typeof row.uid === "string" &&
        Array.isArray(row.votes) &&
        row.votes.every((vote: unknown) => typeof vote === "string")
      ) {
        options.push(row);
      }
    }
  }
  return options;
};

const questionState = createState("question", {
  parse: (value) => (typeof value === "string" ? value : ""),
});

const optionsState = createState("options", {
  isEqual: (left, right) =>
    left.length === right.length && JSON.stringify(left) === JSON.stringify(right),
  parse: parseOptions,
});

const convertPollElement = (domNode: HTMLSpanElement): DOMConversionOutput | null => {
  const question = domNode.getAttribute("data-lexical-poll-question");
  const options = domNode.getAttribute("data-lexical-poll-options");
  if (question !== null && options !== null) {
    return { node: $createViewerPollNode(question, JSON.parse(options)) };
  }
  return null;
};

export class ViewerPollNode extends DecoratorNode<JSX.Element> {
  $config() {
    return this.config("poll", {
      extends: DecoratorNode,
      importDOM: buildImportMap({
        span: (domNode) =>
          domNode.getAttribute("data-lexical-poll-question") !== null
            ? {
                conversion: convertPollElement,
                priority: 2,
              }
            : null,
      }),
      stateConfigs: [
        { flat: true, stateConfig: questionState },
        { flat: true, stateConfig: optionsState },
      ],
    });
  }

  getQuestion(): StateConfigValue<typeof questionState> {
    return $getState(this, questionState);
  }

  setQuestion(valueOrUpdater: StateValueOrUpdater<typeof questionState>): this {
    return $setState(this, questionState, valueOrUpdater);
  }

  getOptions(): StateConfigValue<typeof optionsState> {
    return $getState(this, optionsState);
  }

  setOptions(valueOrUpdater: StateValueOrUpdater<typeof optionsState>): this {
    return $setState(this, optionsState, valueOrUpdater);
  }

  toggleVote(option: ViewerPollOption, username: string): this {
    return this.setOptions((previousOptions) => {
      const index = previousOptions.indexOf(option);
      if (index === -1) {
        return previousOptions;
      }

      const votes = Array.from(option.votes);
      const voteIndex = votes.indexOf(username);
      if (voteIndex === -1) {
        votes.push(username);
      } else {
        votes.splice(voteIndex, 1);
      }

      const clonedOption = cloneOption(option, option.text, votes);
      const nextOptions = Array.from(previousOptions);
      nextOptions[index] = clonedOption;
      return nextOptions;
    });
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-lexical-poll-question", this.getQuestion());
    element.setAttribute("data-lexical-poll-options", JSON.stringify(this.getOptions()));
    return { element };
  }

  createDOM(): HTMLElement {
    const element = document.createElement("span");
    element.style.display = "block";
    element.style.width = "100%";
    element.setAttribute("data-lexical-viewer-poll", "true");
    return element;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <ViewerPollComponent
        question={this.getQuestion()}
        options={this.getOptions()}
        nodeKey={this.__key}
      />
    );
  }
}

export const $createViewerPollNode = (question: string, options: ViewerPollOptions) =>
  new ViewerPollNode().setQuestion(question).setOptions(options);

export const $isViewerPollNode = (node: LexicalNode | null | undefined): node is ViewerPollNode =>
  node instanceof ViewerPollNode;
