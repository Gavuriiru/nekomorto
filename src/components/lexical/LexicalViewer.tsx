import * as React from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createParagraphNode, $getRoot } from "lexical";

import Editor from "@/lexical-playground/Editor";
import PlaygroundNodes from "@/lexical-playground/nodes/PlaygroundNodes";
import PlaygroundEditorTheme from "@/lexical-playground/themes/PlaygroundEditorTheme";
import { SettingsContext } from "@/lexical-playground/context/SettingsContext";
import { SharedHistoryContext } from "@/lexical-playground/context/SharedHistoryContext";
import { ToolbarContext } from "@/lexical-playground/context/ToolbarContext";
import { TableContext } from "@/lexical-playground/plugins/TablePlugin";
import { FlashMessageContext } from "@/lexical-playground/context/FlashMessageContext";
import { PollProvider, type PollTarget } from "@/lexical-playground/context/PollContext";
import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";

import "@/lexical-playground/playground.css";
import "@/lexical-playground/playground-overrides.css";

type LexicalViewerProps = {
  value: string;
  className?: string;
  pollTarget?: PollTarget;
};

const POLL_VOTER_STORAGE_KEY = "rainbow_poll_voter_id";

const getOrCreatePollVoterId = () => {
  if (typeof window === "undefined") {
    return "local";
  }
  const existing = window.localStorage.getItem(POLL_VOTER_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const generated =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `guest-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  window.localStorage.setItem(POLL_VOTER_STORAGE_KEY, generated);
  return generated;
};

const safeParseLexicalJson = (value: string) => {
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

const ValuePlugin = ({ value }: { value: string }) => {
  const [editor] = useLexicalComposerContext();
  const lastValueRef = React.useRef<string | null>(null);
  const pendingValueRef = React.useRef<string | null>(null);
  const scheduledRef = React.useRef(false);

  React.useEffect(() => {
    if (value === lastValueRef.current) {
      return;
    }
    pendingValueRef.current = value;
    if (scheduledRef.current) {
      return;
    }
    scheduledRef.current = true;
    const schedule =
      typeof queueMicrotask === "function"
        ? queueMicrotask
        : (cb: () => void) => Promise.resolve().then(cb);
    schedule(() => {
      scheduledRef.current = false;
      const nextValue = pendingValueRef.current;
      pendingValueRef.current = null;
      if (nextValue == null || nextValue === lastValueRef.current) {
        return;
      }
      if (!nextValue) {
        editor.update(
          () => {
            const root = $getRoot();
            root.clear();
            root.append($createParagraphNode());
          },
          { discrete: true },
        );
        lastValueRef.current = nextValue;
        return;
      }
      const safe = safeParseLexicalJson(nextValue);
      if (!safe) {
        editor.update(
          () => {
            const root = $getRoot();
            root.clear();
            root.append($createParagraphNode());
          },
          { discrete: true },
        );
        lastValueRef.current = nextValue;
        return;
      }
      try {
        const state = editor.parseEditorState(safe);
        editor.setEditorState(state);
        lastValueRef.current = nextValue;
      } catch {
        editor.update(
          () => {
            const root = $getRoot();
            root.clear();
            root.append($createParagraphNode());
          },
          { discrete: true },
        );
        lastValueRef.current = nextValue;
      }
    });
  }, [editor, value]);

  return null;
};

const EditablePlugin = () => {
  const [editor] = useLexicalComposerContext();
  React.useEffect(() => {
    editor.setEditable(false);
  }, [editor]);
  return null;
};

const LexicalViewer = ({ value, className, pollTarget }: LexicalViewerProps) => {
  const apiBase = getApiBase();
  const voterId = React.useMemo(() => getOrCreatePollVoterId(), []);
  const persistVote = React.useCallback(
    async (payload: {
      question: string;
      optionUid: string;
      optionText: string;
      checked: boolean;
    }) => {
      if (!pollTarget) {
        return;
      }
      const base =
        pollTarget.type === "post"
          ? `/api/public/posts/${pollTarget.slug}/polls/vote`
          : `/api/public/projects/${pollTarget.projectId}/chapters/${pollTarget.chapterNumber}/polls/vote`;
      const volumeQuery =
        pollTarget.type === "chapter" && Number.isFinite(pollTarget.volume)
          ? `?volume=${pollTarget.volume}`
          : "";
      try {
        await apiFetch(apiBase, `${base}${volumeQuery}`, {
          method: "POST",
          json: {
            ...payload,
            voterId,
          },
        });
      } catch {
        // Ignore vote persistence errors on public view
      }
    },
    [apiBase, pollTarget, voterId],
  );
  const pollContextValue = React.useMemo(
    () => ({
      target: pollTarget,
      voterId,
      persistVote: pollTarget ? persistVote : undefined,
    }),
    [persistVote, pollTarget, voterId],
  );
  const initialConfig = React.useRef({
    namespace: "RainbowLexicalViewer",
    theme: PlaygroundEditorTheme,
    nodes: PlaygroundNodes,
    onError: (error: Error) => {
      console.error(error);
    },
    editable: false,
    editorState: safeParseLexicalJson(value) || undefined,
  }).current;

    return (
      <SettingsContext>
        <FlashMessageContext>
          <PollProvider value={pollContextValue}>
            <LexicalComposer initialConfig={initialConfig}>
              <SharedHistoryContext>
                <TableContext>
                  <ToolbarContext>
                    <div className={`lexical-playground ${className || ""}`}>
                      <div className="editor-shell editor-shell--read-only">
                        <Editor hideToolbar placeholder="" />
                      </div>
                    </div>
                    <ValuePlugin value={value} />
                    <EditablePlugin />
                  </ToolbarContext>
                </TableContext>
              </SharedHistoryContext>
            </LexicalComposer>
          </PollProvider>
        </FlashMessageContext>
      </SettingsContext>
    );
};

export default LexicalViewer;
