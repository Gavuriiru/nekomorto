const EDITABLE_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [role="textbox"], [data-lexical-editor="true"]';
const SEARCH_BLOCKED_SELECTOR = `${EDITABLE_SELECTOR}, button`;

const toElement = (target: EventTarget | null): Element | null => {
  if (target instanceof Element) {
    return target;
  }
  if (target instanceof Node) {
    return target.parentElement;
  }
  return null;
};

export const isEditableShortcutTarget = (target: EventTarget | null) => {
  const element = toElement(target);
  if (!element) {
    return false;
  }
  return Boolean(element.closest(EDITABLE_SELECTOR));
};

export const isSearchShortcutBlockedTarget = (target: EventTarget | null) => {
  const element = toElement(target);
  if (!element) {
    return false;
  }
  if (element.closest('[role="dialog"]')) {
    return true;
  }
  return Boolean(element.closest(SEARCH_BLOCKED_SELECTOR));
};
