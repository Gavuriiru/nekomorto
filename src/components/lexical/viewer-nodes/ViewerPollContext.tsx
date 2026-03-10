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

type ViewerPollContextValue = {
  persistVote?: PersistPollVote;
  target?: PollTarget;
  voterId?: string;
};

const ViewerPollContext = React.createContext<ViewerPollContextValue>({});

export const ViewerPollProvider = ({
  value,
  children,
}: {
  value: ViewerPollContextValue;
  children: ReactNode;
}) => <ViewerPollContext.Provider value={value}>{children}</ViewerPollContext.Provider>;

export const useViewerPollContext = () => React.useContext(ViewerPollContext);
