import * as React from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";

import { getApiBase } from "@/lib/api-base";
import { apiFetch } from "@/lib/api-client";
import { resolveEpubViewerLinkAction } from "@/lib/epub-internal-links";
import { EMPTY_LEXICAL_JSON } from "@/lib/lexical/empty-state";
import { prepareLexicalViewerState, readPreparedLexicalViewerState } from "@/lib/lexical/viewer";
import LexicalViewerNodes from "./LexicalViewerNodes";
import LexicalViewerTheme from "./LexicalViewerTheme";
import { ViewerPollProvider, type PollTarget } from "./viewer-nodes/ViewerPollContext";

import "./lexical-viewer.css";
import "@/styles/rich-content.css";

type LexicalViewerProps = {
  value: string;
  editorStateJson?: string;
  className?: string;
  pollTarget?: PollTarget;
  ariaLabel?: string;
  onInternalLinkNavigate?: (href: string) => void;
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

const resolveViewerEditorState = (value: string, editorStateJson?: string) => {
  const preparedState = readPreparedLexicalViewerState(editorStateJson);
  if (preparedState !== EMPTY_LEXICAL_JSON || String(editorStateJson || "").trim()) {
    return preparedState;
  }
  return prepareLexicalViewerState(value);
};

const ValuePlugin = ({ editorStateJson }: { editorStateJson: string }) => {
  const [editor] = useLexicalComposerContext();
  const lastValueRef = React.useRef<string | null>(null);
  const pendingValueRef = React.useRef<string | null>(null);
  const scheduledRef = React.useRef(false);

  React.useEffect(() => {
    if (editorStateJson === lastValueRef.current) {
      return;
    }
    pendingValueRef.current = editorStateJson;
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
        const state = editor.parseEditorState(nextValue);
        editor.setEditorState(state);
      } catch {
        const state = editor.parseEditorState(EMPTY_LEXICAL_JSON);
        editor.setEditorState(state);
      } finally {
        lastValueRef.current = nextValue;
      }
    });
  }, [editor, editorStateJson]);

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
  const checklistItems = rootElement.querySelectorAll<HTMLElement>(
    "li[role='checkbox'], li[aria-checked]",
  );
  checklistItems.forEach((item) => {
    const checkedValue =
      item.getAttribute("aria-checked") === "true" || item.dataset.lexicalChecked === "true";
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

const isModifiedNavigationEvent = (
  event: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
) => event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;

const LexicalViewer = ({
  value,
  editorStateJson,
  className,
  pollTarget,
  ariaLabel,
  onInternalLinkNavigate,
}: LexicalViewerProps) => {
  const apiBase = getApiBase();
  const viewerRootRef = React.useRef<HTMLDivElement | null>(null);
  const voterId = React.useMemo(() => getOrCreatePollVoterId(), []);
  const preparedEditorState = React.useMemo(
    () => resolveViewerEditorState(value, editorStateJson),
    [editorStateJson, value],
  );
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
    editorState: preparedEditorState,
  }).current;
  const handleInternalLinkClick = React.useCallback(
    (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedNavigationEvent(event)) {
        return;
      }
      const targetElement =
        event.target instanceof Element
          ? event.target
          : event.target instanceof Node
            ? event.target.parentElement
            : null;
      const target = targetElement?.closest<HTMLAnchorElement>("a[href]") || null;
      if (!target) {
        return;
      }
      const rawHref = String(target.getAttribute("href") || "").trim();
      const linkAction = resolveEpubViewerLinkAction(rawHref, {
        allowInternalChapterNavigation: Boolean(onInternalLinkNavigate),
      });
      if (!linkAction) {
        return;
      }
      if (linkAction.kind === "internal-chapter") {
        event.preventDefault();
        onInternalLinkNavigate?.(linkAction.href);
        return;
      }
      if (linkAction.kind === "block-raw-epub") {
        event.preventDefault();
      }
    },
    [onInternalLinkNavigate],
  );
  const viewerLabel = String(ariaLabel || "Conteúdo").trim() || "Conteúdo";

  React.useLayoutEffect(() => {
    const rootElement = viewerRootRef.current;
    if (!rootElement) {
      return;
    }
    rootElement.addEventListener("click", handleInternalLinkClick, true);
    return () => {
      rootElement.removeEventListener("click", handleInternalLinkClick, true);
    };
  }, [handleInternalLinkClick]);

  return (
    <ViewerPollProvider value={pollContextValue}>
      <LexicalComposer initialConfig={initialConfig}>
        <div
          ref={viewerRootRef}
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
          <ValuePlugin editorStateJson={preparedEditorState} />
          <EditablePlugin />
          <ChecklistA11yPlugin />
        </div>
      </LexicalComposer>
    </ViewerPollProvider>
  );
};

export default LexicalViewer;
