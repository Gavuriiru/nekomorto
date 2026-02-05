import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListItemNode, ListNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { CodeNode, CodeHighlightNode } from "@lexical/code";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
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
  ImageNode,
  VideoNode,
];
