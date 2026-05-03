const SCROLLABLE_OVERFLOW_VALUES = new Set(["auto", "scroll", "overlay"]);

const hasScrollableOverflow = (value: string) =>
  SCROLLABLE_OVERFLOW_VALUES.has(value.trim().toLowerCase());

export const findToolbarScrollRoot = (toolbar: HTMLElement): HTMLElement | Window => {
  let parent = toolbar.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    if (hasScrollableOverflow(style.overflowY) || hasScrollableOverflow(style.overflow)) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
};

export const getStickyTopPx = (toolbar: HTMLElement): number => {
  const topValue = window.getComputedStyle(toolbar).top;
  const parsed = Number.parseFloat(topValue);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getScrollRootTop = (scrollRoot: HTMLElement | Window): number =>
  scrollRoot instanceof HTMLElement ? scrollRoot.getBoundingClientRect().top : 0;

export const isToolbarStickyStuck = ({
  toolbarTop,
  scrollRootTop,
  stickyTop,
  tolerancePx = 1,
}: {
  toolbarTop: number;
  scrollRootTop: number;
  stickyTop: number;
  tolerancePx?: number;
}): boolean => toolbarTop <= scrollRootTop + stickyTop + tolerancePx;

const parsePx = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const measureToolbarRequiredWidth = (toolbar: HTMLElement): number => {
  const toolbarStyle = window.getComputedStyle(toolbar);
  const columnGap = parsePx(toolbarStyle.columnGap || toolbarStyle.gap);
  const children = Array.from(toolbar.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );

  if (children.length === 0) {
    return 0;
  }

  const childrenWidth = children.reduce((total, child) => {
    const childStyle = window.getComputedStyle(child);
    const marginLeft = child.classList.contains("toolbar-group-right")
      ? 0
      : parsePx(childStyle.marginLeft);
    const marginRight = parsePx(childStyle.marginRight);
    return total + child.getBoundingClientRect().width + marginLeft + marginRight;
  }, 0);

  return childrenWidth + columnGap * Math.max(0, children.length - 1);
};

export const getToolbarAvailableContentWidth = (toolbar: HTMLElement): number => {
  const toolbarStyle = window.getComputedStyle(toolbar);
  return Math.max(
    0,
    toolbar.clientWidth - parsePx(toolbarStyle.paddingLeft) - parsePx(toolbarStyle.paddingRight),
  );
};
