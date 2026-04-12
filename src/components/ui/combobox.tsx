import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";
import { Check, ChevronDown, Plus } from "lucide-react";

import {
  dropdownChevronClassName,
  dropdownItemClassName,
  dropdownItemIndicatorClassName,
  dropdownListClassName,
  dropdownPopoverClassName,
  dropdownRichContentClassName,
  dropdownRichIconClassName,
  dropdownRichLabelClassName,
  dropdownTriggerClassName,
} from "@/components/ui/dropdown-contract";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { normalizeSearchText } from "@/lib/search-ranking";
import { cn } from "@/lib/utils";

type ComboboxIconComponent = React.ComponentType<{
  className?: string;
}>;

export type ComboboxOption = {
  value: string;
  label: string;
  keywords?: string[];
  searchText?: string;
  icon?: React.ReactNode | ComboboxIconComponent;
  disabled?: boolean;
};

type CreateLabelResolver = string | ((value: string) => string);

type ComboboxItem =
  | {
      kind: "option";
      id: string;
      option: ComboboxOption;
      disabled: boolean;
      searchText: string;
    }
  | {
      kind: "create";
      id: string;
      value: string;
      label: string;
    };

type ComboboxOptionItem = Extract<ComboboxItem, { kind: "option" }>;

const SEARCH_FIELD_MIN_OPTION_COUNT = 16;
const INFINITE_SCROLL_LOAD_OFFSET = 56;

export type ComboboxVariant = "default" | "compact";

export type ComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  listAriaLabel?: string;
  searchInputAriaLabel?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
  allowCreate?: boolean;
  createLabel?: CreateLabelResolver;
  variant?: ComboboxVariant;
  className?: string;
  popoverClassName?: string;
  listClassName?: string;
  searchInputClassName?: string;
  open?: boolean;
  onOpenChange?: (nextOpen: boolean) => void;
  initialVisibleCount?: number;
  visibleCountStep?: number;
  id?: string;
  dataTestId?: string;
};

let activeComboboxId: string | null = null;
const registeredComboboxClosers = new Map<string, () => void>();

const activateComboboxInstance = (id: string) => {
  if (activeComboboxId === id) {
    return;
  }

  const previousId = activeComboboxId;
  activeComboboxId = id;
  if (previousId) {
    registeredComboboxClosers.get(previousId)?.();
  }
};

const clearActiveComboboxInstance = (id: string) => {
  if (activeComboboxId === id) {
    activeComboboxId = null;
  }
};

const registerComboboxInstance = (id: string, requestClose: () => void) => {
  registeredComboboxClosers.set(id, requestClose);
  return () => {
    registeredComboboxClosers.delete(id);
    clearActiveComboboxInstance(id);
  };
};

const normalizeOptionSearchText = (option: ComboboxOption) =>
  option.searchText ||
  normalizeSearchText(
    [option.label, option.value, ...(Array.isArray(option.keywords) ? option.keywords : [])]
      .filter(Boolean)
      .join(" "),
  );

const resolveCreateLabel = (createLabel: CreateLabelResolver | undefined, value: string) => {
  if (typeof createLabel === "function") {
    return createLabel(value);
  }
  if (typeof createLabel === "string" && createLabel.trim()) {
    return createLabel.replace("{value}", value);
  }
  return `Criar "${value}"`;
};

const renderComboboxIcon = (
  icon: ComboboxOption["icon"],
  fallbackClassName = dropdownRichIconClassName,
) => {
  if (!icon) {
    return null;
  }

  if (React.isValidElement(icon)) {
    return icon;
  }

  if (
    typeof icon === "function" ||
    (typeof icon === "object" && icon !== null && "$$typeof" in icon)
  ) {
    const Icon = icon as React.ElementType<{ className?: string }>;
    return <Icon className={fallbackClassName} />;
  }

  return icon;
};

const isItemDisabled = (item: ComboboxItem) => item.kind === "option" && item.disabled;

const findNavigableIndex = (items: ComboboxItem[], startIndex: number, direction: 1 | -1) => {
  if (!items.length) {
    return -1;
  }

  for (let step = 0; step < items.length; step += 1) {
    const candidateIndex = (startIndex + direction * step + items.length) % items.length;
    const candidate = items[candidateIndex];
    if (candidate && !isItemDisabled(candidate)) {
      return candidateIndex;
    }
  }

  return -1;
};

const Combobox = ({
  value,
  onValueChange,
  options,
  label,
  placeholder = "Selecione",
  ariaLabel,
  listAriaLabel,
  searchInputAriaLabel,
  disabled = false,
  searchable = false,
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhuma opção encontrada.",
  inputValue,
  onInputValueChange,
  allowCreate = false,
  createLabel,
  variant = "default",
  className,
  popoverClassName,
  listClassName,
  searchInputClassName,
  open: openProp,
  onOpenChange,
  initialVisibleCount = Number.POSITIVE_INFINITY,
  visibleCountStep = Number.POSITIVE_INFINITY,
  id,
  dataTestId,
}: ComboboxProps) => {
  const instanceId = React.useId();
  const triggerId = id;
  const listboxId = id ? `${id}-listbox` : `${instanceId}-listbox`;
  const isEditable = inputValue !== undefined || onInputValueChange !== undefined;
  const resolvedOpenProp = openProp;
  const isControlled = resolvedOpenProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [visibleCount, setVisibleCount] = React.useState(initialVisibleCount);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const resolvedSearchable = searchable;
  const open = isControlled ? resolvedOpenProp : uncontrolledOpen;
  const buttonTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const inputTriggerRef = React.useRef<HTMLInputElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const anchorRef = React.useRef<HTMLDivElement | null>(null);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const highlightedByPointerRef = React.useRef(false);
  const openRef = React.useRef(open);
  const triggerRef = isEditable ? inputTriggerRef : buttonTriggerRef;

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value],
  );
  const isCompactVariant = variant === "compact" && !isEditable;

  const shouldRenderSearchInput =
    resolvedSearchable && !isEditable && options.length >= SEARCH_FIELD_MIN_OPTION_COUNT;
  const shouldFilterOptions = isEditable || shouldRenderSearchInput;
  const activeQuery = isEditable
    ? String(inputValue || "")
    : shouldRenderSearchInput
      ? searchQuery
      : "";
  const normalizedQuery = normalizeSearchText(activeQuery);

  const baseItems = React.useMemo<ComboboxOptionItem[]>(
    () =>
      options.map((option, index) => ({
        kind: "option",
        id: `${instanceId}-option-${index}`,
        option,
        disabled: Boolean(option.disabled),
        searchText: normalizeOptionSearchText(option),
      })),
    [instanceId, options],
  );

  const filteredState = React.useMemo(() => {
    const matches = shouldFilterOptions
      ? baseItems.filter((item) =>
          normalizedQuery ? item.searchText.includes(normalizedQuery) : true,
        )
      : baseItems;

    const visibleMatches = Number.isFinite(initialVisibleCount)
      ? matches.slice(0, visibleCount)
      : matches;

    const items: ComboboxItem[] = [...visibleMatches];
    const trimmedInputValue = String(inputValue || value || "").trim();
    const hasExactMatch = baseItems.some(
      (item) =>
        normalizeSearchText(item.option.label) === normalizedQuery ||
        normalizeSearchText(item.option.value) === normalizedQuery,
    );

    if (allowCreate && trimmedInputValue && normalizedQuery && !hasExactMatch) {
      items.push({
        kind: "create",
        id: `${instanceId}-create`,
        value: trimmedInputValue,
        label: resolveCreateLabel(createLabel, trimmedInputValue),
      });
    }

    return {
      items,
      hasHiddenItems:
        Number.isFinite(initialVisibleCount) && visibleMatches.length < matches.length,
    };
  }, [
    allowCreate,
    baseItems,
    createLabel,
    initialVisibleCount,
    inputValue,
    isEditable,
    normalizedQuery,
    shouldFilterOptions,
    value,
    visibleCount,
  ]);

  const items = filteredState.items;
  optionRefs.current.length = items.length;

  const emitOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (openRef.current === nextOpen) {
        return;
      }

      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const restoreFocusToTrigger = React.useCallback(() => {
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [triggerRef]);

  const closeMenu = React.useCallback(
    (restoreFocus = false) => {
      emitOpenChange(false);
      clearActiveComboboxInstance(instanceId);
      if (!isEditable) {
        setSearchQuery("");
      }
      setVisibleCount(initialVisibleCount);
      if (restoreFocus) {
        restoreFocusToTrigger();
      }
    },
    [emitOpenChange, initialVisibleCount, instanceId, isEditable, restoreFocusToTrigger],
  );

  React.useEffect(
    () => registerComboboxInstance(instanceId, () => closeMenu(false)),
    [closeMenu, instanceId],
  );

  React.useEffect(() => {
    openRef.current = open;
    if (open) {
      activateComboboxInstance(instanceId);
      return;
    }

    clearActiveComboboxInstance(instanceId);
  }, [instanceId, open]);

  React.useEffect(() => {
    if (open) {
      return;
    }

    if (!isEditable) {
      setSearchQuery("");
    }
    setVisibleCount(initialVisibleCount);
    setHighlightedIndex(-1);
  }, [initialVisibleCount, isEditable, open]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const selectedIndex = items.findIndex(
      (item) => item.kind === "option" && item.option.value === value && !item.disabled,
    );
    const fallbackIndex = findNavigableIndex(items, 0, 1);

    setHighlightedIndex((current) => {
      if (current >= 0 && current < items.length && !isItemDisabled(items[current])) {
        return current;
      }
      return selectedIndex >= 0 ? selectedIndex : fallbackIndex;
    });
  }, [items, open, value]);

  React.useLayoutEffect(() => {
    if (!open) {
      return;
    }

    if (isEditable) {
      return;
    }

    if (highlightedByPointerRef.current) {
      return;
    }

    if (shouldRenderSearchInput) {
      window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return;
    }

    const focusHighlightedOption = () => {
      const nextOption = optionRefs.current[highlightedIndex];
      if (!nextOption) {
        return;
      }

      if (nextOption !== document.activeElement) {
        nextOption.focus();
      }
      nextOption.scrollIntoView?.({ block: "nearest" });
    };

    focusHighlightedOption();
    const animationFrame = window.requestAnimationFrame(focusHighlightedOption);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [highlightedIndex, isEditable, open, shouldRenderSearchInput]);

  const openMenu = React.useCallback(
    (targetIndex?: number) => {
      if (disabled) {
        return;
      }

      const selectedIndex = items.findIndex(
        (item) => item.kind === "option" && item.option.value === value,
      );
      const preferredIndex =
        targetIndex !== undefined
          ? findNavigableIndex(items, targetIndex, 1)
          : selectedIndex >= 0
            ? selectedIndex
            : findNavigableIndex(items, 0, 1);

      highlightedByPointerRef.current = false;
      setHighlightedIndex(preferredIndex);
      activateComboboxInstance(instanceId);
      emitOpenChange(true);
    },
    [disabled, emitOpenChange, instanceId, items, value],
  );

  const commitSelection = React.useCallback(
    (nextValue: string, restoreFocus = !isEditable) => {
      if (!String(nextValue || "").trim()) {
        return;
      }

      onValueChange(nextValue);
      closeMenu(restoreFocus);
    },
    [closeMenu, isEditable, onValueChange],
  );

  const commitItem = React.useCallback(
    (item: ComboboxItem | null | undefined, restoreFocus = !isEditable) => {
      if (!item) {
        return false;
      }

      if (item.kind === "option") {
        if (item.disabled) {
          return false;
        }
        commitSelection(item.option.value, restoreFocus);
        return true;
      }

      commitSelection(item.value, false);
      return true;
    },
    [commitSelection, isEditable],
  );

  const moveHighlight = React.useCallback(
    (direction: 1 | -1) => {
      highlightedByPointerRef.current = false;
      setHighlightedIndex((current) => {
        if (!items.length) {
          return -1;
        }

        const startIndex =
          current >= 0 ? current + direction : direction > 0 ? 0 : items.length - 1;
        return findNavigableIndex(items, startIndex, direction);
      });
    },
    [items],
  );

  const handleSearchQueryChange = (nextValue: string) => {
    setSearchQuery(nextValue);
    setVisibleCount(initialVisibleCount);
  };

  const revealMoreItems = React.useCallback(() => {
    if (!filteredState.hasHiddenItems) {
      return;
    }

    setVisibleCount((current) => {
      if (!Number.isFinite(current)) {
        return current;
      }

      if (!Number.isFinite(visibleCountStep) || visibleCountStep <= 0) {
        return Number.POSITIVE_INFINITY;
      }

      return current + visibleCountStep;
    });
  }, [filteredState.hasHiddenItems, visibleCountStep]);

  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!filteredState.hasHiddenItems) {
      return;
    }

    const listElement = event.currentTarget;
    const remainingScroll =
      listElement.scrollHeight - listElement.scrollTop - listElement.clientHeight;

    if (remainingScroll <= INFINITE_SCROLL_LOAD_OFFSET) {
      revealMoreItems();
    }
  };

  React.useEffect(() => {
    if (!open || !filteredState.hasHiddenItems || highlightedIndex < items.length - 3) {
      return;
    }

    revealMoreItems();
  }, [filteredState.hasHiddenItems, highlightedIndex, items.length, open, revealMoreItems]);

  const selectedDescendantId =
    highlightedIndex >= 0 && highlightedIndex < items.length
      ? items[highlightedIndex]?.id
      : undefined;
  const compactTriggerClassName = isCompactVariant ? "min-h-8 gap-2 px-2.5 py-1.5" : "";
  const compactPopoverClassName = isCompactVariant
    ? "w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-2"
    : "w-[var(--radix-popover-trigger-width)] min-w-[min(16rem,calc(100vw-2rem))] p-3";
  const compactItemClassName = isCompactVariant ? "py-1.5 pl-8 pr-2 text-xs" : "";
  const compactIndicatorClassName = isCompactVariant ? "left-2.5" : "";
  const compactRichContentClassName = isCompactVariant ? "gap-1.5" : "";
  const compactTriggerLabelClassName = isCompactVariant ? "text-[11px]" : "text-sm";
  const compactOptionLabelClassName = isCompactVariant ? "text-xs" : "";
  const compactChevronClassName = isCompactVariant ? "h-3.5 w-3.5" : "";

  return (
    <Popover open={open} onOpenChange={(nextOpen) => (nextOpen ? openMenu() : closeMenu(false))}>
      <PopoverPrimitive.Anchor asChild>
        <div ref={anchorRef} className="relative min-w-0">
          {isEditable ? (
            <div className="group relative" data-state={open ? "open" : "closed"}>
              <Input
                id={triggerId}
                ref={inputTriggerRef}
                role="combobox"
                aria-label={ariaLabel}
                aria-autocomplete="list"
                aria-controls={open ? listboxId : undefined}
                aria-expanded={open}
                aria-activedescendant={open ? selectedDescendantId : undefined}
                aria-haspopup="listbox"
                data-testid={dataTestId}
                value={inputValue}
                disabled={disabled}
                placeholder={placeholder}
                onChange={(event) => {
                  onInputValueChange?.(event.target.value);
                  if (!disabled) {
                    openMenu();
                  }
                }}
                onFocus={() => {
                  if (!disabled) {
                    openMenu();
                  }
                }}
                onClick={() => {
                  if (!disabled) {
                    openMenu();
                  }
                }}
                onKeyDown={(event) => {
                  switch (event.key) {
                    case "ArrowDown":
                      event.preventDefault();
                      if (!open) {
                        openMenu(0);
                        break;
                      }
                      moveHighlight(1);
                      break;
                    case "ArrowUp":
                      event.preventDefault();
                      if (!open) {
                        openMenu(Math.max(items.length - 1, 0));
                        break;
                      }
                      moveHighlight(-1);
                      break;
                    case "Home":
                      if (open) {
                        event.preventDefault();
                        setHighlightedIndex(findNavigableIndex(items, 0, 1));
                      }
                      break;
                    case "End":
                      if (open) {
                        event.preventDefault();
                        setHighlightedIndex(findNavigableIndex(items, items.length - 1, -1));
                      }
                      break;
                    case "Enter": {
                      const highlightedItem =
                        highlightedIndex >= 0 && highlightedIndex < items.length
                          ? items[highlightedIndex]
                          : null;
                      const exactMatch = items.find(
                        (item) =>
                          item.kind === "option" &&
                          item.searchText === normalizedQuery &&
                          !item.disabled,
                      );
                      if (commitItem(highlightedItem, false)) {
                        event.preventDefault();
                        break;
                      }
                      if (exactMatch?.kind === "option") {
                        event.preventDefault();
                        commitSelection(exactMatch.option.value, false);
                        break;
                      }
                      if (allowCreate) {
                        const trimmedValue = String(inputValue || value || "").trim();
                        if (trimmedValue) {
                          event.preventDefault();
                          commitSelection(trimmedValue, false);
                        }
                      }
                      break;
                    }
                    case "Escape":
                      if (open) {
                        event.preventDefault();
                        closeMenu(false);
                      }
                      break;
                    default:
                      break;
                  }
                }}
                className={cn("pr-10", className)}
              />
              <ChevronDown
                className={cn(
                  dropdownChevronClassName,
                  compactChevronClassName,
                  "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2",
                )}
                aria-hidden="true"
              />
            </div>
          ) : (
            <button
              id={triggerId}
              ref={buttonTriggerRef}
              type="button"
              role="combobox"
              aria-label={ariaLabel}
              aria-controls={open ? listboxId : undefined}
              aria-expanded={open}
              aria-activedescendant={open ? selectedDescendantId : undefined}
              aria-haspopup="listbox"
              aria-disabled={disabled}
              disabled={disabled}
              data-testid={dataTestId}
              data-placeholder={selectedOption ? undefined : ""}
              data-state={open ? "open" : "closed"}
              className={cn(dropdownTriggerClassName, compactTriggerClassName, className)}
              onClick={() => {
                if (disabled) {
                  return;
                }
                if (open) {
                  closeMenu(false);
                } else {
                  openMenu();
                }
              }}
              onKeyDown={(event) => {
                switch (event.key) {
                  case "ArrowDown":
                    event.preventDefault();
                    if (open) {
                      moveHighlight(1);
                    } else {
                      openMenu(0);
                    }
                    break;
                  case "ArrowUp":
                    event.preventDefault();
                    if (open) {
                      moveHighlight(-1);
                    } else {
                      openMenu(Math.max(items.length - 1, 0));
                    }
                    break;
                  case "Home":
                    event.preventDefault();
                    if (open) {
                      setHighlightedIndex(findNavigableIndex(items, 0, 1));
                    } else {
                      openMenu(0);
                    }
                    break;
                  case "End":
                    event.preventDefault();
                    if (open) {
                      setHighlightedIndex(findNavigableIndex(items, items.length - 1, -1));
                    } else {
                      openMenu(Math.max(items.length - 1, 0));
                    }
                    break;
                  case "Enter":
                  case " ":
                  case "Spacebar":
                    event.preventDefault();
                    if (open) {
                      const highlightedItem =
                        highlightedIndex >= 0 && highlightedIndex < items.length
                          ? items[highlightedIndex]
                          : null;
                      commitItem(highlightedItem, true);
                    } else {
                      openMenu();
                    }
                    break;
                  case "Escape":
                    if (open) {
                      event.preventDefault();
                      closeMenu(true);
                    }
                    break;
                  default:
                    break;
                }
              }}
            >
              <span className={cn(dropdownRichContentClassName, compactRichContentClassName)}>
                {selectedOption ? renderComboboxIcon(selectedOption.icon) : null}
                <span
                  className={cn(
                    dropdownRichLabelClassName,
                    compactTriggerLabelClassName,
                    "text-foreground",
                  )}
                >
                  {selectedOption?.label || placeholder}
                </span>
              </span>
              <ChevronDown
                className={cn(dropdownChevronClassName, compactChevronClassName)}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </PopoverPrimitive.Anchor>

      <PopoverContent
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          const target = event.target;
          if (target instanceof Node && anchorRef.current?.contains(target)) {
            event.preventDefault();
          }
        }}
        className={cn(dropdownPopoverClassName, compactPopoverClassName, popoverClassName)}
      >
        {shouldRenderSearchInput ? (
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => handleSearchQueryChange(event.target.value)}
            onKeyDown={(event) => {
              switch (event.key) {
                case "ArrowDown":
                  event.preventDefault();
                  if (items.length) {
                    const nextIndex =
                      highlightedIndex >= 0
                        ? findNavigableIndex(items, highlightedIndex + 1, 1)
                        : 0;
                    setHighlightedIndex(nextIndex);
                    window.requestAnimationFrame(() => {
                      optionRefs.current[nextIndex]?.focus();
                    });
                  }
                  break;
                case "ArrowUp":
                  event.preventDefault();
                  if (items.length) {
                    const nextIndex =
                      highlightedIndex >= 0
                        ? findNavigableIndex(items, highlightedIndex - 1, -1)
                        : Math.max(items.length - 1, 0);
                    setHighlightedIndex(nextIndex);
                    window.requestAnimationFrame(() => {
                      optionRefs.current[nextIndex]?.focus();
                    });
                  }
                  break;
                case "Home": {
                  event.preventDefault();
                  const nextIndex = findNavigableIndex(items, 0, 1);
                  setHighlightedIndex(nextIndex);
                  window.requestAnimationFrame(() => {
                    optionRefs.current[nextIndex]?.focus();
                  });
                  break;
                }
                case "End": {
                  event.preventDefault();
                  const nextIndex = findNavigableIndex(items, items.length - 1, -1);
                  setHighlightedIndex(nextIndex);
                  window.requestAnimationFrame(() => {
                    optionRefs.current[nextIndex]?.focus();
                  });
                  break;
                }
                case "Enter": {
                  const highlightedItem =
                    highlightedIndex >= 0 && highlightedIndex < items.length
                      ? items[highlightedIndex]
                      : null;
                  if (commitItem(highlightedItem, true)) {
                    event.preventDefault();
                  }
                  break;
                }
                case "Escape":
                  event.preventDefault();
                  closeMenu(true);
                  break;
                default:
                  break;
              }
            }}
            placeholder={searchPlaceholder}
            aria-label={
              searchInputAriaLabel ||
              `Buscar em ${String(label || listAriaLabel || ariaLabel || placeholder).toLowerCase()}`
            }
            className={cn("bg-background/80", searchInputClassName)}
          />
        ) : null}

        <div
          id={listboxId}
          role="listbox"
          aria-label={listAriaLabel || label || ariaLabel || placeholder}
          onScroll={handleListScroll}
          className={cn(
            dropdownListClassName,
            shouldRenderSearchInput ? "mt-3" : "mt-0",
            listClassName,
          )}
        >
          {items.length > 0 ? (
            items.map((item, index) => {
              const isSelected = item.kind === "option" && item.option.value === value;
              const itemIcon =
                item.kind === "option" ? (
                  item.option.icon
                ) : (
                  <Plus className={dropdownRichIconClassName} />
                );

              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  id={item.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={highlightedIndex === index ? 0 : -1}
                  data-highlighted={highlightedIndex === index ? "" : undefined}
                  data-state={isSelected ? "checked" : "unchecked"}
                  disabled={isItemDisabled(item)}
                  className={cn(
                    dropdownItemClassName,
                    compactItemClassName,
                    item.kind === "option" && !isSelected ? "text-foreground/80" : "",
                  )}
                  onClick={() => {
                    if (item.kind === "option") {
                      if (item.disabled) {
                        return;
                      }
                      commitSelection(item.option.value, !isEditable);
                      return;
                    }
                    commitSelection(item.value, false);
                  }}
                  onFocus={() => setHighlightedIndex(index)}
                  onMouseEnter={() => {
                    highlightedByPointerRef.current = true;
                    setHighlightedIndex(index);
                  }}
                  onMouseLeave={() => {
                    highlightedByPointerRef.current = false;
                    setHighlightedIndex((current) => (current === index ? -1 : current));
                  }}
                  onKeyDown={(event) => {
                    switch (event.key) {
                      case "ArrowDown":
                        event.preventDefault();
                        moveHighlight(1);
                        break;
                      case "ArrowUp":
                        event.preventDefault();
                        moveHighlight(-1);
                        break;
                      case "Home":
                        event.preventDefault();
                        setHighlightedIndex(findNavigableIndex(items, 0, 1));
                        break;
                      case "End":
                        event.preventDefault();
                        setHighlightedIndex(findNavigableIndex(items, items.length - 1, -1));
                        break;
                      case "Enter":
                      case " ":
                      case "Spacebar":
                        event.preventDefault();
                        if (item.kind === "option") {
                          if (!item.disabled) {
                            commitSelection(item.option.value, !isEditable);
                          }
                          return;
                        }
                        commitSelection(item.value, false);
                        break;
                      case "Escape":
                        event.preventDefault();
                        closeMenu(true);
                        break;
                      case "Tab":
                        closeMenu(false);
                        break;
                      default:
                        break;
                    }
                  }}
                >
                  <span className={cn(dropdownItemIndicatorClassName, compactIndicatorClassName)}>
                    {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                  </span>
                  <span className={cn(dropdownRichContentClassName, compactRichContentClassName)}>
                    {renderComboboxIcon(itemIcon)}
                    <span className={cn(dropdownRichLabelClassName, compactOptionLabelClassName)}>
                      {item.kind === "option" ? item.option.label : item.label}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="rounded-xl bg-background/50 px-3 py-4 text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export { Combobox };
