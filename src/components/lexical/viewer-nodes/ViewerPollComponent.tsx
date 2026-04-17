import type { ViewerPollOption, ViewerPollOptions } from "./ViewerPollNode";
import { ViewerPollNode } from "./ViewerPollNode";

import "./ViewerPoll.css";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, type NodeKey } from "lexical";

import { useViewerPollContext } from "./ViewerPollContext";

const getTotalVotes = (options: ViewerPollOptions) =>
  options.reduce((totalVotes, next) => totalVotes + next.votes.length, 0);

const ViewerPollOptionRow = ({
  index,
  onVote,
  option,
  question,
  totalVotes,
}: {
  index: number;
  onVote: (option: ViewerPollOption, checked: boolean) => void;
  option: ViewerPollOption;
  question: string;
  totalVotes: number;
}) => {
  const pollContext = useViewerPollContext();
  const username = pollContext.voterId || "local";
  const checked = option.votes.includes(username);
  const votes = option.votes.length;
  const text = option.text;

  return (
    <div className="PollNode__optionContainer">
      <div
        className={`PollNode__optionCheckboxWrapper ${
          checked ? "PollNode__optionCheckboxChecked" : ""
        }`}
      >
        <input
          className="PollNode__optionCheckbox"
          type="checkbox"
          aria-label={`${question}: ${text || `Opção ${index + 1}`}`}
          checked={checked}
          onChange={(event) => {
            onVote(option, event.target.checked);
          }}
        />
      </div>
      <div className="PollNode__optionInputWrapper">
        <div
          className="PollNode__optionInputVotes"
          style={{ width: `${votes === 0 ? 0 : (votes / totalVotes) * 100}%` }}
        />
        <span className="PollNode__optionInputVotesCount">
          {votes > 0 && (votes === 1 ? "1 voto" : `${votes} votos`)}
        </span>
        <span className="PollNode__optionInput" aria-hidden="true">
          {text}
        </span>
      </div>
    </div>
  );
};

const ViewerPollComponent = ({
  nodeKey,
  options,
  question,
}: {
  nodeKey: NodeKey;
  options: ViewerPollOptions;
  question: string;
}) => {
  const [editor] = useLexicalComposerContext();
  const pollContext = useViewerPollContext();
  const totalVotes = getTotalVotes(options);
  const username = pollContext.voterId || "local";

  const withPollNode = (callback: (node: ViewerPollNode) => void) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node instanceof ViewerPollNode) {
        callback(node);
      }
    });
  };

  return (
    <div className="PollNode__container">
      <div className="PollNode__inner">
        <h2 className="PollNode__heading">{question}</h2>
        {options.map((option, index) => (
          <ViewerPollOptionRow
            key={option.uid}
            index={index}
            option={option}
            question={question}
            totalVotes={totalVotes}
            onVote={(selectedOption, checked) => {
              withPollNode((node) => {
                node.toggleVote(selectedOption, username);
              });
              pollContext.persistVote?.({
                checked,
                optionText: selectedOption.text,
                optionUid: selectedOption.uid,
                question,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ViewerPollComponent;
