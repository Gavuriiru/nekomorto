const SCROLLABLE_OVERFLOW_VALUES = new Set(['auto', 'scroll', 'overlay']);

const hasScrollableOverflow = (value: string) =>
  SCROLLABLE_OVERFLOW_VALUES.has(value.trim().toLowerCase());

export const findToolbarScrollRoot = (
  toolbar: HTMLElement,
): HTMLElement | Window => {
  let parent = toolbar.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    if (
      hasScrollableOverflow(style.overflowY) ||
      hasScrollableOverflow(style.overflow)
    ) {
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
  scrollRoot === window ? 0 : scrollRoot.getBoundingClientRect().top;

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
