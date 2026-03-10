import * as React from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";

import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { EMPTY_LEXICAL_JSON } from "@/lib/lexical/empty-state";
import { normalizeLexicalViewerJson } from "@/lib/lexical/viewer";
import LexicalViewerNodes from "./LexicalViewerNodes";
import LexicalViewerTheme from "./LexicalViewerTheme";
import { ViewerPollProvider, type PollTarget } from "./viewer-nodes/ViewerPollContext";

import "./lexical-viewer.css";

type LexicalViewerProps = {
  value: string;
  className?: string;
  pollTarget?: PollTarget;
  ariaLabel?: string;
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

const getNormalizedEditorState = (value: string) =>
  normalizeLexicalViewerJson(value) ?? EMPTY_LEXICAL_JSON;

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
        : (callback: () => void) => Promise.resolve().then(callback);
    schedule(() => {
      scheduledRef.current = false;
      const nextValue = pendingValueRef.current;
      pendingValueRef.current = null;
      if (nextValue == null || nextValue === lastValueRef.current) {
        return;
      }
      try {
        const state = editor.parseEditorState(getNormalizedEditorState(nextValue));
        editor.setEditorState(state);
      } catch {
        const state = editor.parseEditorState(EMPTY_LEXICAL_JSON);
        editor.setEditorState(state);
      } finally {
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

const normalizeChecklistDom = (rootElement: HTMLElement | null) => {
  if (!rootElement) {
    return;
  }
  const checklistItems = rootElement.querySelectorAll<HTMLElement>("li[role='checkbox'], li[aria-checked]");
  checklistItems.forEach((item) => {
    const checkedValue =
      item.getAttribute("aria-checked") === "true" ||
      item.dataset.lexicalChecked === "true";
    item.dataset.lexicalChecklistItem = "true";
    item.dataset.lexicalChecked = checkedValue ? "true" : "false";
    item.removeAttribute("role");
    item.removeAttribute("tabindex");
    item.removeAttribute("aria-checked");
  });
};

const ChecklistA11yPlugin = () => {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    const scheduleNormalize = () => {
      const rootElement = editor.getRootElement();
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => {
          normalizeChecklistDom(rootElement);
        });
        return;
      }
      normalizeChecklistDom(rootElement);
    };

    scheduleNormalize();
    return editor.registerUpdateListener(() => {
      scheduleNormalize();
    });
  }, [editor]);

  return null;
};

const LexicalViewer = ({ value, className, pollTarget, ariaLabel }: LexicalViewerProps) => {
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
        // Ignore vote persistence errors on public view.
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
    theme: LexicalViewerTheme,
    nodes: LexicalViewerNodes,
    onError: (error: Error) => {
      console.error(error);
    },
    editable: false,
    editorState: getNormalizedEditorState(value),
  }).current;
  const viewerLabel = String(ariaLabel || "Conteúdo").trim() || "Conteúdo";

  return (
    <ViewerPollProvider value={pollContextValue}>
      <LexicalComposer initialConfig={initialConfig}>
        <div
          className={`lexical-playground lexical-playground--viewer ${className || ""}`}
          data-lexical-viewer="true"
        >
          <div className="LexicalViewer__editor" data-lexical-viewer-editor="true">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  aria-label={viewerLabel}
                  className="LexicalViewer__content"
                  data-lexical-viewer-content="true"
                />
              }
              placeholder={null}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <ValuePlugin value={value} />
          <EditablePlugin />
          <ChecklistA11yPlugin />
        </div>
      </LexicalComposer>
    </ViewerPollProvider>
  );
};

export default LexicalViewer;
