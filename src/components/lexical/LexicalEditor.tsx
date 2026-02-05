import * as React from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { AutoLinkPlugin, createLinkMatcherWithRegExp } from "@lexical/react/LexicalAutoLinkPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createParagraphNode, $createTextNode, $getRoot, $getSelection, $insertNodes, $isRangeSelection, COMMAND_PRIORITY_EDITOR } from "lexical";
import { TRANSFORMERS } from "@lexical/markdown";
import LexicalToolbar from "@/components/lexical/LexicalToolbar";
import { lexicalTheme } from "@/lib/lexical/theme";
import { lexicalNodes } from "@/lib/lexical/nodes";
import { INSERT_IMAGE_COMMAND, type ImagePayload, $createImageNode } from "@/components/lexical/nodes/ImageNode";
import { INSERT_VIDEO_COMMAND, type VideoPayload, $createVideoNode } from "@/components/lexical/nodes/VideoNode";
import { $createLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";

const URL_MATCHER = createLinkMatcherWithRegExp(/https?:\/\/[^\s]+/g, (text) => text);

export type LexicalEditorHandle = {
  insertImage: (payload: ImagePayload) => void;
  insertVideo: (payload: VideoPayload) => void;
  insertLink: (url: string, text?: string) => void;
  focus: () => void;
};

type LexicalEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onRequestImage?: () => void;
  onRequestLink?: () => void;
  onRequestVideo?: () => void;
  readOnly?: boolean;
};

const EditorBridge = React.forwardRef<LexicalEditorHandle, { onRequestLink?: () => void }>(
  ({ onRequestLink }, ref) => {
    const [editor] = useLexicalComposerContext();

    React.useImperativeHandle(ref, () => ({
      insertImage: (payload) => {
        editor.update(() => {
          const imageNode = $createImageNode(payload);
          $insertNodes([imageNode]);
        });
      },
      insertVideo: (payload) => {
        editor.update(() => {
          const videoNode = $createVideoNode(payload);
          $insertNodes([videoNode]);
        });
      },
      insertLink: (url, text) => {
        let didInsert = false;
        editor.update(
          () => {
            const selection = $getSelection();
            if ($isRangeSelection(selection) && selection.isCollapsed()) {
              if (text) {
                const linkNode = $createLinkNode(url);
                linkNode.append($createTextNode(text));
                $insertNodes([linkNode]);
                didInsert = true;
              }
            }
          },
          { discrete: true },
        );
        if (!didInsert) {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
        }
      },
      focus: () => editor.focus(),
    }));

    React.useEffect(() => {
      return editor.registerCommand(
        INSERT_IMAGE_COMMAND,
        (payload) => {
          const imageNode = $createImageNode(payload);
          $insertNodes([imageNode]);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      );
    }, [editor]);

    React.useEffect(() => {
      return editor.registerCommand(
        INSERT_VIDEO_COMMAND,
        (payload) => {
          const videoNode = $createVideoNode(payload);
          $insertNodes([videoNode]);
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      );
    }, [editor]);

    return null;
  },
);

EditorBridge.displayName = "EditorBridge";

const ValuePlugin = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const [editor] = useLexicalComposerContext();
  const isSettingRef = React.useRef(false);
  const lastValueRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!value || value === lastValueRef.current) {
      return;
    }
    try {
      isSettingRef.current = true;
      const state = editor.parseEditorState(value);
      editor.setEditorState(state);
      lastValueRef.current = value;
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
  }, [editor, value]);

  return (
    <OnChangePlugin
      onChange={(editorState) => {
        if (isSettingRef.current) {
          return;
        }
        const next = JSON.stringify(editorState.toJSON());
        lastValueRef.current = next;
        onChange(next);
      }}
    />
  );
};

const LexicalEditor = React.forwardRef<LexicalEditorHandle, LexicalEditorProps>(
  ({ value, onChange, placeholder, className, onRequestImage, onRequestLink, onRequestVideo, readOnly }, ref) => {
    const initialConfig = React.useMemo(
      () => ({
        namespace: "RainbowLexicalEditor",
        theme: lexicalTheme,
        onError: (error: Error) => {
          console.error(error);
        },
        nodes: lexicalNodes,
        editable: !readOnly,
      }),
      [readOnly],
    );

    return (
      <LexicalComposer initialConfig={initialConfig}>
        <div
          className={`lexical-editor ${className || ""}`}
          onDragStartCapture={(event) => {
            event.stopPropagation();
          }}
        >
          {!readOnly ? (
            <LexicalToolbar onRequestImage={onRequestImage} onRequestLink={onRequestLink} onRequestVideo={onRequestVideo} />
          ) : null}
          <div className="lexical-content-wrapper">
            <RichTextPlugin
              contentEditable={<ContentEditable className="lexical-content" draggable={false} />}
              placeholder={<div className="lexical-placeholder">{placeholder || "Digite o conteúdo..."}</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <LinkPlugin />
          <AutoLinkPlugin matchers={[URL_MATCHER]} />
          <TablePlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <ValuePlugin value={value} onChange={onChange} />
          <EditorBridge ref={ref} onRequestLink={onRequestLink} />
        </div>
      </LexicalComposer>
    );
  },
);

LexicalEditor.displayName = "LexicalEditor";

export default LexicalEditor;
