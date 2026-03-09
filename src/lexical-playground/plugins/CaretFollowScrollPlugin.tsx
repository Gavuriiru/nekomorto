import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$getSelection, $isRangeSelection} from 'lexical';
import {useEffect, useRef} from 'react';

type ScrollRoot = HTMLElement | Window;

const CARET_VISIBILITY_PADDING_PX = 12;

const hasMeasuredRect = (rect: DOMRect | null): rect is DOMRect =>
  Boolean(
    rect &&
      (rect.width !== 0 ||
        rect.height !== 0 ||
        rect.top !== 0 ||
        rect.bottom !== 0 ||
        rect.left !== 0 ||
        rect.right !== 0),
  );

const isElementScrollRoot = (value: ScrollRoot): value is HTMLElement =>
  typeof window !== 'undefined' && value instanceof window.HTMLElement;

export const findCaretScrollRoot = (rootElement: HTMLElement): ScrollRoot =>
  rootElement.closest('.project-editor-scroll-shell') ??
  rootElement.ownerDocument.defaultView ??
  window;

export const getCaretClientRect = (rootElement: HTMLElement): DOMRect | null => {
  const selection = rootElement.ownerDocument.defaultView?.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!rootElement.contains(range.startContainer)) {
    return null;
  }

  const rangeRect = range.getBoundingClientRect();
  if (hasMeasuredRect(rangeRect)) {
    return rangeRect;
  }

  const clientRect = range.getClientRects().item(0);
  if (clientRect) {
    return clientRect;
  }

  const parentElement =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;

  return parentElement?.getBoundingClientRect() ?? null;
};

const getScrollViewportRect = (scrollRoot: ScrollRoot) =>
  isElementScrollRoot(scrollRoot)
    ? scrollRoot.getBoundingClientRect()
    : ({
        top: 0,
        bottom: scrollRoot.innerHeight,
      } as Pick<DOMRect, 'top' | 'bottom'>);

export const getCaretTopOffset = (
  rootElement: HTMLElement,
  scrollRoot: ScrollRoot,
  paddingPx = CARET_VISIBILITY_PADDING_PX,
): number => {
  const toolbar = rootElement
    .closest('.lexical-playground')
    ?.querySelector('.toolbar') as HTMLElement | null;
  if (!toolbar) {
    return paddingPx;
  }

  const viewportRect = getScrollViewportRect(scrollRoot);
  const toolbarRect = toolbar.getBoundingClientRect();
  if (
    toolbarRect.bottom <= viewportRect.top ||
    toolbarRect.top >= viewportRect.bottom
  ) {
    return paddingPx;
  }

  return Math.max(
    paddingPx,
    toolbarRect.bottom - viewportRect.top + paddingPx,
  );
};

export const scrollCaretRectIntoView = ({
  caretRect,
  rootElement,
  scrollRoot,
  paddingPx = CARET_VISIBILITY_PADDING_PX,
}: {
  caretRect: DOMRect;
  rootElement: HTMLElement;
  scrollRoot: ScrollRoot;
  paddingPx?: number;
}): boolean => {
  const viewportRect = getScrollViewportRect(scrollRoot);
  const visibleTop =
    viewportRect.top + getCaretTopOffset(rootElement, scrollRoot, paddingPx);
  const visibleBottom = viewportRect.bottom - paddingPx;

  let delta = 0;
  if (caretRect.top < visibleTop) {
    delta = caretRect.top - visibleTop;
  } else if (caretRect.bottom > visibleBottom) {
    delta = caretRect.bottom - visibleBottom;
  }

  if (delta === 0) {
    return false;
  }

  if (isElementScrollRoot(scrollRoot)) {
    scrollRoot.scrollTop += delta;
  } else {
    scrollRoot.scrollBy({top: delta, behavior: 'auto'});
  }

  return true;
};

export default function CaretFollowScrollPlugin() {
  const [editor] = useLexicalComposerContext();
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const cancelFrame = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };

    const scheduleCaretSync = () => {
      cancelFrame();
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const rootElement = editor.getRootElement();
        if (!rootElement) {
          return;
        }
        const caretRect = getCaretClientRect(rootElement);
        if (!caretRect) {
          return;
        }
        scrollCaretRectIntoView({
          caretRect,
          rootElement,
          scrollRoot: findCaretScrollRoot(rootElement),
        });
      });
    };

    const unregister = editor.registerUpdateListener(({editorState}) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          cancelFrame();
          return;
        }
        scheduleCaretSync();
      });
    });

    return () => {
      cancelFrame();
      unregister();
    };
  }, [editor]);

  return null;
}
