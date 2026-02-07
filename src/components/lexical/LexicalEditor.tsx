import * as React from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createParagraphNode, $getRoot, $setSelection } from "lexical";

import Editor from "@/lexical-playground/Editor";
import PlaygroundNodes from "@/lexical-playground/nodes/PlaygroundNodes";
import PlaygroundEditorTheme from "@/lexical-playground/themes/PlaygroundEditorTheme";
import { SettingsContext } from "@/lexical-playground/context/SettingsContext";
import { SharedHistoryContext } from "@/lexical-playground/context/SharedHistoryContext";
import { ToolbarContext } from "@/lexical-playground/context/ToolbarContext";
import { TableContext } from "@/lexical-playground/plugins/TablePlugin";
import { FlashMessageContext } from "@/lexical-playground/context/FlashMessageContext";
import { PollProvider } from "@/lexical-playground/context/PollContext";

import "@/lexical-playground/playground.css";
import "@/lexical-playground/playground-overrides.css";

export type LexicalEditorHandle = {
  focus: () => void;
  blur: () => void;
};

type LexicalEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
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

const ValuePlugin = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
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
          editor.update(
            () => {
              const root = $getRoot();
              root.clear();
              root.append($createParagraphNode());
            },
            { discrete: true },
          );
        } finally {
          lastValueRef.current = nextValue;
          isSettingRef.current = false;
        }
        return;
      }
      const safe = safeParseLexicalJson(nextValue);
      if (!safe) {
        try {
          isSettingRef.current = true;
          editor.update(
            () => {
              const root = $getRoot();
              root.clear();
              root.append($createParagraphNode());
            },
            { discrete: true },
          );
          lastValueRef.current = nextValue;
        } finally {
          isSettingRef.current = false;
        }
        return;
      }
      try {
        isSettingRef.current = true;
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
  ({ value, onChange, placeholder, className, readOnly }, ref) => {
    const initialConfig = React.useRef({
      namespace: "RainbowLexicalPlayground",
      theme: PlaygroundEditorTheme,
      nodes: PlaygroundNodes,
      onError: (error: Error) => {
        console.error(error);
      },
      editable: !readOnly,
      editorState: safeParseLexicalJson(value) || undefined,
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
                        <Editor
                          hideToolbar={Boolean(readOnly)}
                          placeholder={placeholder}
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
