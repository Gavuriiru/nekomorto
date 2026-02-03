import { useEffect, useRef, useState } from "react";

type PostFormState = {
  contentMarkdown: string;
  contentHtml: string;
  contentFormat: "markdown" | "html";
};

type UsePostEditorStateArgs<T extends PostFormState> = {
  formState: T;
  setFormState: React.Dispatch<React.SetStateAction<T>>;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  isEditorOpen: boolean;
};

export const usePostEditorState = <T extends PostFormState>({
  formState,
  setFormState,
  editorRef,
  isEditorOpen,
}: UsePostEditorStateArgs<T>) => {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyGuard = useRef(false);

  const currentContent =
    formState.contentFormat === "markdown" ? formState.contentMarkdown : formState.contentHtml;

  const updateContent = (value: string) => {
    if (formState.contentFormat === "markdown") {
      setFormState((prev) => ({ ...prev, contentMarkdown: value }));
    } else {
      setFormState((prev) => ({ ...prev, contentHtml: value }));
    }
  };

  const applyTextEdit = (
    next: string,
    cursorStart: number,
    cursorEnd: number,
    scrollTop: number,
  ) => {
    updateContent(next);
    requestAnimationFrame(() => {
      const textarea = editorRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(cursorStart, cursorEnd);
      textarea.scrollTop = scrollTop;
    });
  };

  const insertAtCursor = (text: string) => {
    const textarea = editorRef.current;
    if (!textarea) {
      updateContent(`${currentContent}${text}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    const next = `${currentContent.slice(0, start)}${text}${currentContent.slice(end)}`;
    applyTextEdit(next, start + text.length, start + text.length, scrollTop);
  };

  const applyWrap = (before: string, after = before) => {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    const selected = currentContent.slice(start, end);
    const next = `${currentContent.slice(0, start)}${before}${selected}${after}${currentContent.slice(end)}`;
    applyTextEdit(next, start + before.length, end + before.length, scrollTop);
  };

  const applyLinePrefix = (prefix: string) => {
    const textarea = editorRef.current;
    if (!textarea) {
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    const selected = currentContent.slice(start, end) || "";
    const lines = selected.split(/\r?\n/).map((line) => `${prefix}${line}`);
    const inserted = lines.join("\n");
    const next = `${currentContent.slice(0, start)}${inserted}${currentContent.slice(end)}`;
    applyTextEdit(next, start, start + inserted.length, scrollTop);
  };

  const applyListHtml = (type: "ul" | "ol") => {
    const textarea = editorRef.current;
    const start = textarea?.selectionStart ?? 0;
    const end = textarea?.selectionEnd ?? 0;
    const scrollTop = textarea?.scrollTop ?? 0;
    const selected = currentContent.slice(start, end).trim();
    const lines = selected ? selected.split(/\r?\n/).filter(Boolean) : [""];
    const items = lines.map((line) => `  <li>${line.trim()}</li>`).join("\n");
    const block = `<${type}>\n${items}\n</${type}>`;
    const next = `${currentContent.slice(0, start)}${block}${currentContent.slice(end)}`;
    applyTextEdit(next, start, start + block.length, scrollTop);
  };

  const handleUnorderedList = () => {
    if (formState.contentFormat === "html") {
      applyListHtml("ul");
      return;
    }
    applyLinePrefix("- ");
  };

  const handleOrderedList = () => {
    if (formState.contentFormat === "html") {
      applyListHtml("ol");
      return;
    }
    applyLinePrefix("1. ");
  };

  const handleUndo = () => {
    if (historyIndex <= 0) {
      return;
    }
    historyGuard.current = true;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    updateContent(history[nextIndex]);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) {
      return;
    }
    historyGuard.current = true;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    updateContent(history[nextIndex]);
  };

  useEffect(() => {
    if (!isEditorOpen) {
      return;
    }
    setHistory([currentContent]);
    setHistoryIndex(0);
  }, [currentContent, isEditorOpen, formState.contentFormat]);

  useEffect(() => {
    if (!isEditorOpen || historyGuard.current) {
      historyGuard.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        if (next[next.length - 1] !== currentContent) {
          next.push(currentContent);
          setHistoryIndex(next.length - 1);
        }
        return next;
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [currentContent, historyIndex, isEditorOpen]);

  return {
    currentContent,
    updateContent,
    applyTextEdit,
    insertAtCursor,
    applyWrap,
    applyLinePrefix,
    applyListHtml,
    handleUnorderedList,
    handleOrderedList,
    handleUndo,
    handleRedo,
  };
};
