import type { ImageLibraryOptions } from "@/components/ImageLibraryDialog";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { ClearEditorPlugin } from "@lexical/react/LexicalClearEditorPlugin";
import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HashtagPlugin } from "@lexical/react/LexicalHashtagPlugin";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { SelectionAlwaysOnDisplay } from "@lexical/react/LexicalSelectionAlwaysOnDisplay";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { CAN_USE_DOM } from "@lexical/utils";
import { $createParagraphNode, $getRoot } from "lexical";
import { useEffect, useState } from "react";
import type { JSX, MouseEvent } from "react";

import { useSettings } from "@/components/lexical/editor/context/SettingsContext";
import { useSharedHistoryContext } from "@/components/lexical/editor/context/SharedHistoryContext";
import AutocompletePlugin from "@/components/lexical/editor/plugins/AutocompletePlugin";
import AutoEmbedPlugin from "@/components/lexical/editor/plugins/AutoEmbedPlugin";
import AutoLinkPlugin from "@/components/lexical/editor/plugins/AutoLinkPlugin";
import CaretFollowScrollPlugin from "@/components/lexical/editor/plugins/CaretFollowScrollPlugin";
import CodeActionMenuPlugin from "@/components/lexical/editor/plugins/CodeActionMenuPlugin";
import CodeHighlightPrismPlugin from "@/components/lexical/editor/plugins/CodeHighlightPrismPlugin";
import CollapsiblePlugin from "@/components/lexical/editor/plugins/CollapsiblePlugin";
import ComponentPickerPlugin from "@/components/lexical/editor/plugins/ComponentPickerPlugin";
import DragDropPaste from "@/components/lexical/editor/plugins/DragDropPastePlugin";
import DraggableBlockPlugin from "@/components/lexical/editor/plugins/DraggableBlockPlugin";
import EmojiPickerPlugin from "@/components/lexical/editor/plugins/EmojiPickerPlugin";
import FloatingLinkEditorPlugin from "@/components/lexical/editor/plugins/FloatingLinkEditorPlugin";
import FloatingTextFormatToolbarPlugin from "@/components/lexical/editor/plugins/FloatingTextFormatToolbarPlugin";
import ImagesPlugin from "@/components/lexical/editor/plugins/ImagesPlugin";
import KeywordsPlugin from "@/components/lexical/editor/plugins/KeywordsPlugin";
import { LayoutPlugin } from "@/components/lexical/editor/plugins/LayoutPlugin/LayoutPlugin";
import LinkPlugin from "@/components/lexical/editor/plugins/LinkPlugin";
import MarkdownShortcutPlugin from "@/components/lexical/editor/plugins/MarkdownShortcutPlugin";
import MentionsPlugin from "@/components/lexical/editor/plugins/MentionsPlugin";
import PollPlugin from "@/components/lexical/editor/plugins/PollPlugin";
import SpecialTextPlugin from "@/components/lexical/editor/plugins/SpecialTextPlugin";
import TabFocusPlugin from "@/components/lexical/editor/plugins/TabFocusPlugin";
import TableCellActionMenuPlugin from "@/components/lexical/editor/plugins/TableActionMenuPlugin";
import TableCellResizer from "@/components/lexical/editor/plugins/TableCellResizer";
import TableHoverActionsV2Plugin from "@/components/lexical/editor/plugins/TableHoverActionsV2Plugin";
import TableScrollShadowPlugin from "@/components/lexical/editor/plugins/TableScrollShadowPlugin";
import TableThemeSyncPlugin from "@/components/lexical/editor/plugins/TableThemeSyncPlugin";
import ToolbarPlugin from "@/components/lexical/editor/plugins/ToolbarPlugin";
import TwitterPlugin from "@/components/lexical/editor/plugins/TwitterPlugin";
import YouTubePlugin from "@/components/lexical/editor/plugins/YouTubePlugin";
import ContentEditable from "@/components/lexical/editor/ui/ContentEditable";

export interface LexicalEditorShellProps {
  hideToolbar?: boolean;
  placeholder?: string;
  imageLibraryOptions?: ImageLibraryOptions;
  autoFocus?: boolean;
  followCaretScroll?: boolean;
}

export default function LexicalEditorShell({
  hideToolbar = false,
  placeholder: placeholderOverride,
  imageLibraryOptions,
  autoFocus = true,
  followCaretScroll = false,
}: LexicalEditorShellProps): JSX.Element {
  const { historyState } = useSharedHistoryContext();
  const {
    settings: {
      isCodeHighlighted,
      isAutocomplete,
      hasLinkAttributes,
      hasNestedTables,
      isRichText,
      tableCellMerge,
      tableCellBackgroundColor,
      tableHorizontalScroll,
      shouldAllowHighlightingWithBrackets,
      selectionAlwaysOnDisplay,
      listStrictIndent,
    },
  } = useSettings();
  const isEditable = useLexicalEditable();
  const placeholder =
    placeholderOverride ?? (isRichText ? "Enter some rich text..." : "Enter some plain text...");
  const [floatingAnchorElem, setFloatingAnchorElem] = useState<HTMLDivElement | null>(null);
  const [isSmallWidthViewport, setIsSmallWidthViewport] = useState<boolean>(false);
  const [editor] = useLexicalComposerContext();
  const [activeEditor, setActiveEditor] = useState(editor);
  const [isLinkEditMode, setIsLinkEditMode] = useState<boolean>(false);

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  useEffect(() => {
    const updateViewPortWidth = () => {
      const isNextSmallWidthViewport =
        CAN_USE_DOM && window.matchMedia("(max-width: 1025px)").matches;

      if (isNextSmallWidthViewport !== isSmallWidthViewport) {
        setIsSmallWidthViewport(isNextSmallWidthViewport);
      }
    };
    updateViewPortWidth();
    window.addEventListener("resize", updateViewPortWidth);

    return () => {
      window.removeEventListener("resize", updateViewPortWidth);
    };
  }, [isSmallWidthViewport]);

  const showToolbar = isRichText && !hideToolbar;
  const showEditingPlugins = isRichText && isEditable;
  const handleEditorScrollerMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }
    if (
      target.closest(".ContentEditable__root") ||
      target.closest(".link-editor") ||
      target.closest(".floating-text-format-popup") ||
      target.closest(".dropdown") ||
      target.closest("button, a, input, textarea, select")
    ) {
      return;
    }
    editor.focus();
    editor.update(() => {
      const root = $getRoot();
      if (root.getChildrenSize() === 0) {
        root.append($createParagraphNode());
      }
      root.selectEnd();
    });
  };

  return (
    <>
      {showToolbar && (
        <ToolbarPlugin
          editor={editor}
          activeEditor={activeEditor}
          setActiveEditor={setActiveEditor}
          setIsLinkEditMode={setIsLinkEditMode}
          imageLibraryOptions={imageLibraryOptions}
        />
      )}
      <div className={`editor-container ${!isRichText ? "plain-text" : ""}`}>
        {showEditingPlugins && <DragDropPaste />}
        {showEditingPlugins && autoFocus && <AutoFocusPlugin />}
        {showEditingPlugins && followCaretScroll && <CaretFollowScrollPlugin />}
        {selectionAlwaysOnDisplay && <SelectionAlwaysOnDisplay />}
        {showEditingPlugins && <ClearEditorPlugin />}
        {showEditingPlugins && <ComponentPickerPlugin imageLibraryOptions={imageLibraryOptions} />}
        {showEditingPlugins && <EmojiPickerPlugin />}
        {showEditingPlugins && <AutoEmbedPlugin />}
        {showEditingPlugins && <MentionsPlugin />}
        {showEditingPlugins && <HashtagPlugin />}
        {showEditingPlugins && <KeywordsPlugin />}
        {showEditingPlugins && <AutoLinkPlugin />}
        {isRichText ? (
          <>
            <HistoryPlugin externalHistoryState={historyState} />
            <RichTextPlugin
              contentEditable={
                <div className="editor-scroller" onMouseDown={handleEditorScrollerMouseDown}>
                  <div className="editor" ref={onRef} onMouseDown={handleEditorScrollerMouseDown}>
                    <ContentEditable placeholder={placeholder} />
                  </div>
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            {showEditingPlugins && <MarkdownShortcutPlugin />}
            {isCodeHighlighted && <CodeHighlightPrismPlugin />}
            <ListPlugin hasStrictIndent={listStrictIndent} />
            <CheckListPlugin />
            <TablePlugin
              hasCellMerge={tableCellMerge}
              hasCellBackgroundColor={tableCellBackgroundColor}
              hasHorizontalScroll={tableHorizontalScroll}
              hasNestedTables={hasNestedTables}
            />
            <TableThemeSyncPlugin />
            {showEditingPlugins && <TableCellResizer />}
            <TableScrollShadowPlugin />
            {showEditingPlugins && <ImagesPlugin imageLibraryOptions={imageLibraryOptions} />}
            <LinkPlugin hasLinkAttributes={hasLinkAttributes} />
            {showEditingPlugins && <PollPlugin />}
            <TwitterPlugin />
            <YouTubePlugin />
            <ClickableLinkPlugin disabled={isEditable} />
            {showEditingPlugins && <HorizontalRulePlugin />}
            {showEditingPlugins && <TabFocusPlugin />}
            {showEditingPlugins && <TabIndentationPlugin maxIndent={7} />}
            {showEditingPlugins && <CollapsiblePlugin />}
            {showEditingPlugins && <LayoutPlugin />}
            {showEditingPlugins && floatingAnchorElem && (
              <>
                <FloatingLinkEditorPlugin
                  anchorElem={floatingAnchorElem}
                  isLinkEditMode={isLinkEditMode}
                  setIsLinkEditMode={setIsLinkEditMode}
                />
                <TableCellActionMenuPlugin anchorElem={floatingAnchorElem} cellMerge={true} />
              </>
            )}
            {showEditingPlugins && floatingAnchorElem && !isSmallWidthViewport && (
              <>
                <DraggableBlockPlugin anchorElem={floatingAnchorElem} />
                <CodeActionMenuPlugin anchorElem={floatingAnchorElem} />
                <TableHoverActionsV2Plugin anchorElem={floatingAnchorElem} />
                <FloatingTextFormatToolbarPlugin
                  anchorElem={floatingAnchorElem}
                  setIsLinkEditMode={setIsLinkEditMode}
                />
              </>
            )}
          </>
        ) : (
          <>
            <PlainTextPlugin
              contentEditable={<ContentEditable placeholder={placeholder} />}
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin externalHistoryState={historyState} />
          </>
        )}
        {isAutocomplete && <AutocompletePlugin />}
        {shouldAllowHighlightingWithBrackets && <SpecialTextPlugin />}
      </div>
    </>
  );
}
