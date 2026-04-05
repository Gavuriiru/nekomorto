import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import {
  dropdownChevronClassName,
  dropdownItemClassName,
  dropdownItemIndicatorClassName,
  dropdownPopoverClassName,
  dropdownRichContentClassName,
  dropdownRichIconClassName,
  dropdownRichLabelClassName,
  dropdownTriggerClassName,
} from "@/components/ui/dropdown-contract";
import { cn } from "@/lib/utils";

export type DashboardLightSelectIcon = React.ComponentType<{
  className?: string;
}>;

export type DashboardLightSelectOption = {
  value: string;
  label: string;
  icon?: DashboardLightSelectIcon | null;
};

type DashboardLightSelectProps = {
  value: string;
  options: DashboardLightSelectOption[];
  onValueChange: (next: string) => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
};

let activeDashboardLightSelectId: string | null = null;
const registeredDashboardLightSelectClosers = new Map<string, () => void>();

const activateDashboardLightSelect = (id: string) => {
  if (activeDashboardLightSelectId === id) {
    return;
  }

  const previousActiveId = activeDashboardLightSelectId;
  activeDashboardLightSelectId = id;
  if (previousActiveId) {
    registeredDashboardLightSelectClosers.get(previousActiveId)?.();
  }
};

const clearActiveDashboardLightSelect = (id: string) => {
  if (activeDashboardLightSelectId === id) {
    activeDashboardLightSelectId = null;
  }
};

const registerDashboardLightSelect = (id: string, requestClose: () => void) => {
  registeredDashboardLightSelectClosers.set(id, requestClose);
  return () => {
    registeredDashboardLightSelectClosers.delete(id);
    clearActiveDashboardLightSelect(id);
  };
};

const clampIndex = (value: number, length: number) => {
  if (length <= 0) {
    return -1;
  }
  if (value < 0) {
    return 0;
  }
  if (value >= length) {
    return length - 1;
  }
  return value;
};

const DashboardLightSelect = ({
  value,
  options,
  onValueChange,
  ariaLabel,
  className,
  disabled = false,
  placeholder,
}: DashboardLightSelectProps) => {
  const instanceId = React.useId();
  const listboxId = `${instanceId}-listbox`;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedIndex = React.useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
  const [highlightedIndex, setHighlightedIndex] = React.useState(() =>
    clampIndex(selectedIndex >= 0 ? selectedIndex : 0, options.length),
  );

  optionRefs.current.length = options.length;

  const closeMenu = React.useCallback(
    (restoreFocus = false) => {
      setIsOpen(false);
      clearActiveDashboardLightSelect(instanceId);
      if (restoreFocus) {
        window.requestAnimationFrame(() => {
          triggerRef.current?.focus();
        });
      }
    },
    [instanceId],
  );

  const openMenu = React.useCallback(
    (targetIndex?: number) => {
      if (disabled || options.length === 0) {
        return;
      }
      const nextIndex = clampIndex(
        targetIndex ?? (selectedIndex >= 0 ? selectedIndex : 0),
        options.length,
      );
      setHighlightedIndex(nextIndex);
      setIsOpen(true);
      activateDashboardLightSelect(instanceId);
    },
    [disabled, instanceId, options.length, selectedIndex],
  );

  React.useEffect(
    () => registerDashboardLightSelect(instanceId, () => setIsOpen(false)),
    [instanceId],
  );

  React.useEffect(() => {
    if (!isOpen) {
      clearActiveDashboardLightSelect(instanceId);
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [closeMenu, instanceId, isOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    setHighlightedIndex((previous) => {
      if (previous >= 0 && previous < options.length) {
        return previous;
      }
      return clampIndex(selectedIndex >= 0 ? selectedIndex : 0, options.length);
    });
  }, [isOpen, options.length, selectedIndex]);

  React.useEffect(() => {
    if (!isOpen || highlightedIndex < 0) {
      return;
    }

    const nextOption = optionRefs.current[highlightedIndex];
    if (!nextOption) {
      return;
    }
    if (nextOption !== document.activeElement) {
      nextOption.focus();
    }
    nextOption.scrollIntoView?.({ block: "nearest" });
  }, [highlightedIndex, isOpen]);

  const selectValue = React.useCallback(
    (nextValue: string, restoreFocus = true) => {
      onValueChange(nextValue);
      closeMenu(restoreFocus);
    },
    [closeMenu, onValueChange],
  );

  const handleTriggerKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          openMenu(selectedIndex >= 0 ? selectedIndex : 0);
          break;
        case "ArrowUp":
          event.preventDefault();
          openMenu(selectedIndex >= 0 ? selectedIndex : options.length - 1);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (isOpen) {
            closeMenu(true);
          } else {
            openMenu();
          }
          break;
        case "Escape":
          if (isOpen) {
            event.preventDefault();
            closeMenu(true);
          }
          break;
        default:
          break;
      }
    },
    [closeMenu, isOpen, openMenu, options.length, selectedIndex],
  );

  const triggerLabel =
    selectedOption?.label || (options.length === 0 ? placeholder : value) || placeholder;
  const TriggerIcon = selectedOption?.icon || null;

  return (
    <div ref={rootRef} className={cn("relative min-w-0", isOpen ? "z-[70]" : "")}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        disabled={disabled}
        data-placeholder={selectedOption ? undefined : ""}
        data-state={isOpen ? "open" : "closed"}
        className={cn(dropdownTriggerClassName, className)}
        onClick={() => {
          if (disabled) {
            return;
          }
          if (isOpen) {
            closeMenu();
          } else {
            openMenu();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={dropdownRichContentClassName}>
          {TriggerIcon ? (
            <TriggerIcon className={cn(dropdownRichIconClassName, "text-primary")} />
          ) : null}
          <span className={cn(dropdownRichLabelClassName, "text-sm text-foreground")}>
            {triggerLabel || placeholder}
          </span>
        </span>
        <ChevronDown className={dropdownChevronClassName} />
      </button>

      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          data-state="open"
          className={cn(
            dropdownPopoverClassName,
            "absolute left-0 top-full z-[80] mt-2 w-full overflow-auto p-1",
          )}
        >
          {options.map((option, index) => {
            const OptionIcon = option.icon || null;
            const isSelected = option.value === value;
            const isHighlighted = index === highlightedIndex;

            return (
              <button
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                id={`${instanceId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={isHighlighted ? 0 : -1}
                data-highlighted={isHighlighted ? "" : undefined}
                data-state={isSelected ? "checked" : "unchecked"}
                className={cn(dropdownItemClassName, !isSelected ? "text-foreground/80" : "")}
                onClick={() => selectValue(option.value)}
                onFocus={() => setHighlightedIndex(index)}
                onMouseEnter={() => setHighlightedIndex(index)}
                onKeyDown={(event) => {
                  switch (event.key) {
                    case "ArrowDown":
                      event.preventDefault();
                      setHighlightedIndex((previous) => clampIndex(previous + 1, options.length));
                      break;
                    case "ArrowUp":
                      event.preventDefault();
                      setHighlightedIndex((previous) => clampIndex(previous - 1, options.length));
                      break;
                    case "Home":
                      event.preventDefault();
                      setHighlightedIndex(0);
                      break;
                    case "End":
                      event.preventDefault();
                      setHighlightedIndex(options.length - 1);
                      break;
                    case "Enter":
                    case " ":
                      event.preventDefault();
                      selectValue(option.value);
                      break;
                    case "Escape":
                      event.preventDefault();
                      closeMenu(true);
                      break;
                    case "Tab":
                      closeMenu();
                      break;
                    default:
                      break;
                  }
                }}
              >
                <span className={dropdownItemIndicatorClassName}>
                  {isSelected ? <Check className="h-4 w-4" /> : null}
                </span>
                <span className={dropdownRichContentClassName}>
                  {OptionIcon ? (
                    <OptionIcon className={cn(dropdownRichIconClassName, "text-primary")} />
                  ) : null}
                  <span className={dropdownRichLabelClassName}>{option.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default DashboardLightSelect;
