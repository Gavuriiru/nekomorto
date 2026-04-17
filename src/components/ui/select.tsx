import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";

import {
  dropdownChevronClassName,
  dropdownItemClassName,
  dropdownItemIndicatorClassName,
  dropdownItemTextClassName,
  dropdownPopoverClassName,
  dropdownTriggerClassName,
  dropdownTriggerValueClassName,
  dropdownViewportClassName,
} from "@/components/ui/dropdown-contract";
import { cn } from "@/lib/utils";

type SelectProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>;

let activeSelectId: string | null = null;
const registeredSelectClosers = new Map<string, () => void>();

const activateSelectInstance = (id: string) => {
  if (activeSelectId === id) {
    return;
  }

  const previousActiveId = activeSelectId;
  activeSelectId = id;
  if (previousActiveId) {
    registeredSelectClosers.get(previousActiveId)?.();
  }
};

const clearActiveSelectInstance = (id: string) => {
  if (activeSelectId === id) {
    activeSelectId = null;
  }
};

const registerSelectInstance = (id: string, requestClose: () => void) => {
  registeredSelectClosers.set(id, requestClose);
  return () => {
    registeredSelectClosers.delete(id);
    clearActiveSelectInstance(id);
  };
};

const Select = ({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: SelectProps) => {
  const instanceId = React.useId();
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = isControlled ? openProp : uncontrolledOpen;
  const openRef = React.useRef(open);

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

  const requestClose = React.useCallback(() => {
    if (!openRef.current) {
      return;
    }

    emitOpenChange(false);
    clearActiveSelectInstance(instanceId);
  }, [emitOpenChange, instanceId]);

  React.useEffect(
    () => registerSelectInstance(instanceId, requestClose),
    [instanceId, requestClose],
  );

  React.useEffect(() => {
    openRef.current = open;
    if (open) {
      activateSelectInstance(instanceId);
      return;
    }

    clearActiveSelectInstance(instanceId);
  }, [instanceId, open]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        activateSelectInstance(instanceId);
      } else {
        clearActiveSelectInstance(instanceId);
      }

      emitOpenChange(nextOpen);
    },
    [emitOpenChange, instanceId],
  );

  return (
    <SelectPrimitive.Root {...props} open={open} onOpenChange={handleOpenChange}>
      {children}
    </SelectPrimitive.Root>
  );
};

const SelectGroup = SelectPrimitive.Group;

const SelectValue = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Value>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Value
    ref={ref}
    className={cn(dropdownTriggerValueClassName, className)}
    {...props}
  />
));
SelectValue.displayName = SelectPrimitive.Value.displayName;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger ref={ref} className={cn(dropdownTriggerClassName, className)} {...props}>
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className={dropdownChevronClassName} />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        dropdownPopoverClassName,
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className,
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          dropdownViewportClassName,
          position === "popper" &&
            "h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item ref={ref} className={cn(dropdownItemClassName, className)} {...props}>
    <span className={dropdownItemIndicatorClassName}>
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText className={dropdownItemTextClassName}>
      {children}
    </SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
