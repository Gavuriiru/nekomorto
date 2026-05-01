import type { ImageLibraryOptions } from "@/components/ImageLibraryDialog";
import editorNodes from "@/components/lexical/editor-nodes";
import LexicalEditorShell from "@/components/lexical/LexicalEditorShell";
import { FlashMessageContext } from "@/components/lexical/editor/context/FlashMessageContext";
import { PollProvider } from "@/components/lexical/editor/context/PollContext";
import { SettingsContext } from "@/components/lexical/editor/context/SettingsContext";
import { SharedHistoryContext } from "@/components/lexical/editor/context/SharedHistoryContext";
import { ToolbarContext } from "@/components/lexical/editor/context/ToolbarContext";
import { TableContext } from "@/components/lexical/editor/plugins/TablePlugin";
import PlaygroundEditorTheme from "@/components/lexical/editor/themes/PlaygroundEditorTheme";
import { EMPTY_LEXICAL_JSON, normalizeLexicalJson } from "@/lib/lexical/serialize";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { $setSelection } from "lexical";
import * as React from "react";

import "@/components/lexical/editor/playground.css";
import "@/components/lexical/editor/playground-overrides.css";
import "@/components/lexical/editor/lexical-editor.css";

export type LexicalEditorHandle = {
  focus: () => void;
  blur: () => void;
};

export type LexicalEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  imageLibraryOptions?: ImageLibraryOptions;
  autoFocus?: boolean;
  followCaretScroll?: boolean;
};

const blurEditorRoot = (editor: ReturnType<typeof useLexicalComposerContext>[0]) => {
  editor.blur();
  editor.update(
    () => {
      $setSelection(null);
    },
    { discrete: true },
  );
  const root = editor.getRootElement();
  if (root && document.activeElement === root) {
    root.blur();
  }
};

const EditorBridge = React.forwardRef<LexicalEditorHandle>((_props, ref) => {
  const [editor] = useLexicalComposerContext();

  React.useImperativeHandle(ref, () => ({
    focus: () => editor.focus(),
    blur: () => blurEditorRoot(editor),
  }));

  return null;
});

EditorBridge.displayName = "EditorBridge";

const getNormalizedEditorState = (value: string) =>
  normalizeLexicalJson(value) ?? EMPTY_LEXICAL_JSON;

const ValuePlugin = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const [editor] = useLexicalComposerContext();
  const isSettingRef = React.useRef(false);
  const lastValueRef = React.useRef<string | null>(null);
  const onChangeRef = React.useRef(onChange);
  const pendingValueRef = React.useRef<string | null>(null);
  const scheduledRef = React.useRef(false);
  const pendingSetValueRef = React.useRef<string | null>(null);
  const scheduledSetRef = React.useRef(false);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    if (value === lastValueRef.current) {
      return;
    }
    pendingSetValueRef.current = value;
    if (scheduledSetRef.current) {
      return;
    }
    scheduledSetRef.current = true;
    const schedule =
      typeof queueMicrotask === "function"
        ? queueMicrotask
        : (cb: () => void) => Promise.resolve().then(cb);
    schedule(() => {
      scheduledSetRef.current = false;
      const nextValue = pendingSetValueRef.current;
      pendingSetValueRef.current = null;
      if (nextValue == null || nextValue === lastValueRef.current) {
        return;
      }
      if (!nextValue) {
        try {
          isSettingRef.current = true;
          const state = editor.parseEditorState(EMPTY_LEXICAL_JSON);
          editor.setEditorState(state);
        } finally {
          lastValueRef.current = nextValue;
          isSettingRef.current = false;
        }
        return;
      }
      try {
        isSettingRef.current = true;
        const state = editor.parseEditorState(getNormalizedEditorState(nextValue));
        editor.setEditorState(state);
        lastValueRef.current = nextValue;
      } catch {
        const state = editor.parseEditorState(EMPTY_LEXICAL_JSON);
        editor.setEditorState(state);
        lastValueRef.current = nextValue;
      } finally {
        isSettingRef.current = false;
      }
    });
  }, [editor, value]);

  return (
    <OnChangePlugin
      onChange={(editorState) => {
        if (isSettingRef.current) {
          return;
        }
        const next = JSON.stringify(editorState.toJSON());
        if (next === lastValueRef.current) {
          return;
        }
        lastValueRef.current = next;
        pendingValueRef.current = next;
        if (!scheduledRef.current) {
          scheduledRef.current = true;
          const flush = () => {
            scheduledRef.current = false;
            const valueToSend = pendingValueRef.current;
            pendingValueRef.current = null;
            if (valueToSend != null) {
              onChangeRef.current(valueToSend);
            }
          };
          if (typeof queueMicrotask === "function") {
            queueMicrotask(flush);
          } else {
            Promise.resolve().then(flush);
          }
        }
      }}
    />
  );
};

const EditablePlugin = ({ readOnly }: { readOnly?: boolean }) => {
  const [editor] = useLexicalComposerContext();
  React.useEffect(() => {
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);
  return null;
};

const LexicalEditor = React.forwardRef<LexicalEditorHandle, LexicalEditorProps>(
  (
    {
      value,
      onChange,
      placeholder,
      className,
      readOnly,
      imageLibraryOptions,
      autoFocus,
      followCaretScroll = false,
    },
    ref,
  ) => {
    const initialConfig = React.useRef({
      namespace: "RainbowLexicalPlayground",
      theme: PlaygroundEditorTheme,
      nodes: editorNodes,
      onError: (error: Error) => {
        console.error(error);
      },
      editable: !readOnly,
      editorState: getNormalizedEditorState(value),
    }).current;

    return (
      <SettingsContext>
        <FlashMessageContext>
          <PollProvider value={{}}>
            <LexicalComposer initialConfig={initialConfig}>
              <SharedHistoryContext>
                <TableContext>
                  <ToolbarContext>
                    <div className={`lexical-playground ${className || ""}`}>
                      <div className="editor-shell">
                        <LexicalEditorShell
                          hideToolbar={Boolean(readOnly)}
                          placeholder={placeholder}
                          imageLibraryOptions={imageLibraryOptions}
                          autoFocus={autoFocus}
                          followCaretScroll={followCaretScroll}
                        />
                      </div>
                    </div>
                    <ValuePlugin value={value} onChange={onChange} />
                    <EditablePlugin readOnly={readOnly} />
                    <EditorBridge ref={ref} />
                  </ToolbarContext>
                </TableContext>
              </SharedHistoryContext>
            </LexicalComposer>
          </PollProvider>
        </FlashMessageContext>
      </SettingsContext>
    );
  },
);

LexicalEditor.displayName = "LexicalEditor";

export default LexicalEditor;
