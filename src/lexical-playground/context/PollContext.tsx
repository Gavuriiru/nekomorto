import type { ReactNode } from "react";

import * as React from "react";

export type PollTarget =
  | { type: "post"; slug: string }
  | { type: "chapter"; projectId: string; chapterNumber: number; volume?: number };

export type PersistPollVote = (payload: {
  question: string;
  optionUid: string;
  optionText: string;
  checked: boolean;
}) => void | Promise<void>;

type PollContextValue = {
  target?: PollTarget;
  voterId?: string;
  persistVote?: PersistPollVote;
};

const PollContext = React.createContext<PollContextValue>({});

export const PollProvider = ({
  value,
  children,
}: {
  value: PollContextValue;
  children: ReactNode;
}) => {
  return <PollContext.Provider value={value}>{children}</PollContext.Provider>;
};

export const usePollContext = () => React.useContext(PollContext);

