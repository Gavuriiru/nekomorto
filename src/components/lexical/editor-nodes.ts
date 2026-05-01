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
import { AutocompleteNode } from "@/components/lexical/editor/nodes/AutocompleteNode";
import { DateTimeNode } from "@/components/lexical/editor/nodes/DateTimeNode/DateTimeNode";
import { EmojiNode } from "@/components/lexical/editor/nodes/EmojiNode";
import { EquationNode } from "@/components/lexical/editor/nodes/EquationNode";
import { ImageNode } from "@/components/lexical/editor/nodes/ImageNode";
import { KeywordNode } from "@/components/lexical/editor/nodes/KeywordNode";
import { LayoutContainerNode } from "@/components/lexical/editor/nodes/LayoutContainerNode";
import { LayoutItemNode } from "@/components/lexical/editor/nodes/LayoutItemNode";
import { MentionNode } from "@/components/lexical/editor/nodes/MentionNode";
import { PageBreakNode } from "@/components/lexical/editor/nodes/PageBreakNode";
import { PollNode } from "@/components/lexical/editor/nodes/PollNode";
import { SpecialTextNode } from "@/components/lexical/editor/nodes/SpecialTextNode";
import { StickyNode } from "@/components/lexical/editor/nodes/StickyNode";
import { TweetNode } from "@/components/lexical/editor/nodes/TweetNode";
import { YouTubeNode } from "@/components/lexical/editor/nodes/YouTubeNode";
import { CollapsibleContainerNode } from "@/components/lexical/editor/plugins/CollapsiblePlugin/CollapsibleContainerNode";
import { CollapsibleContentNode } from "@/components/lexical/editor/plugins/CollapsiblePlugin/CollapsibleContentNode";
import { CollapsibleTitleNode } from "@/components/lexical/editor/plugins/CollapsiblePlugin/CollapsibleTitleNode";

export const editorNodes: Array<Klass<LexicalNode>> = [
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
  PollNode,
  StickyNode,
  ImageNode,
  MentionNode,
  EmojiNode,
  EquationNode,
  AutocompleteNode,
  KeywordNode,
  HorizontalRuleNode,
  TweetNode,
  YouTubeNode,
  MarkNode,
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
  PageBreakNode,
  LayoutContainerNode,
  LayoutItemNode,
  SpecialTextNode,
  DateTimeNode,
];

export default editorNodes;
