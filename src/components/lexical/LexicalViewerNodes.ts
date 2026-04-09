import type { Klass, LexicalNode } from "lexical";

import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { HashtagNode } from "@lexical/hashtag";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { MarkNode } from "@lexical/mark";
import { OverflowNode } from "@lexical/overflow";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";

import { EpubAnchorNode } from "@/components/lexical/nodes/EpubAnchorNode";
import { EpubHeadingNode } from "@/components/lexical/nodes/EpubHeadingNode";
import { EpubImageNode } from "@/components/lexical/nodes/EpubImageNode";
import { EpubParagraphNode } from "@/components/lexical/nodes/EpubParagraphNode";
import { ViewerAutocompleteNode } from "@/components/lexical/viewer-nodes/ViewerAutocompleteNode";
import { ViewerDateTimeNode } from "@/components/lexical/viewer-nodes/ViewerDateTimeNode";
import { ViewerEquationNode } from "@/components/lexical/viewer-nodes/ViewerEquationNode";
import { ViewerImageNode } from "@/components/lexical/viewer-nodes/ViewerImageNode";
import { ViewerPageBreakNode } from "@/components/lexical/viewer-nodes/ViewerPageBreakNode";
import { ViewerPollNode } from "@/components/lexical/viewer-nodes/ViewerPollNode";
import { ViewerStickyNode } from "@/components/lexical/viewer-nodes/ViewerStickyNode";
import { TweetNode } from "@/lexical-playground/nodes/TweetNode";
import { YouTubeNode } from "@/lexical-playground/nodes/YouTubeNode";
import { CollapsibleContainerNode } from "@/lexical-playground/plugins/CollapsiblePlugin/CollapsibleContainerNode";
import { CollapsibleContentNode } from "@/lexical-playground/plugins/CollapsiblePlugin/CollapsibleContentNode";
import { CollapsibleTitleNode } from "@/lexical-playground/plugins/CollapsiblePlugin/CollapsibleTitleNode";
import { EmojiNode } from "@/lexical-playground/nodes/EmojiNode";
import { KeywordNode } from "@/lexical-playground/nodes/KeywordNode";
import { LayoutContainerNode } from "@/lexical-playground/nodes/LayoutContainerNode";
import { LayoutItemNode } from "@/lexical-playground/nodes/LayoutItemNode";
import { MentionNode } from "@/lexical-playground/nodes/MentionNode";
import { SpecialTextNode } from "@/lexical-playground/nodes/SpecialTextNode";

const LexicalViewerNodes: Array<Klass<LexicalNode>> = [
  HeadingNode,
  ListNode,
  ListItemNode,
  QuoteNode,
  CodeNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  HashtagNode,
  CodeHighlightNode,
  AutoLinkNode,
  LinkNode,
  OverflowNode,
  EpubAnchorNode,
  EpubParagraphNode,
  EpubHeadingNode,
  EpubImageNode,
  ViewerPollNode,
  ViewerImageNode,
  MentionNode,
  EmojiNode,
  ViewerEquationNode,
  ViewerAutocompleteNode,
  KeywordNode,
  HorizontalRuleNode,
  TweetNode,
  YouTubeNode,
  MarkNode,
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
  ViewerPageBreakNode,
  LayoutContainerNode,
  LayoutItemNode,
  SpecialTextNode,
  ViewerDateTimeNode,
  ViewerStickyNode,
];

export default LexicalViewerNodes;
