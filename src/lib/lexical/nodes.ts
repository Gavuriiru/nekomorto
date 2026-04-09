import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { EpubAnchorNode } from "@/components/lexical/nodes/EpubAnchorNode";
import { EpubHeadingNode } from "@/components/lexical/nodes/EpubHeadingNode";
import { EpubImageNode } from "@/components/lexical/nodes/EpubImageNode";
import { EpubParagraphNode } from "@/components/lexical/nodes/EpubParagraphNode";
import { ImageNode } from "@/components/lexical/nodes/ImageNode";
import { VideoNode } from "@/components/lexical/nodes/VideoNode";

export const lexicalNodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  CodeHighlightNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  EpubAnchorNode,
  EpubParagraphNode,
  EpubHeadingNode,
  EpubImageNode,
  ImageNode,
  VideoNode,
];
