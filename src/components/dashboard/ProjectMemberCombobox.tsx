import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { Command, CommandEmpty, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ProjectMemberComboboxProps = {
  value: string;
  options: string[];
  placeholder?: string;
  onValueChange: (value: string) => void;
  onCommit: (value: string) => void;
  disabled?: boolean;
};

type ComboboxItem = {
  id: string;
  label: string;
  commitValue: string;
  keywords: string[];
  icon: "option" | "create";
};

const normalizeSearchValue = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getCreateItemId = (value: string) => `create:${normalizeSearchValue(value)}`;
const getOptionItemId = (value: string) => `option:${normalizeSearchValue(value)}`;

const ProjectMemberCombobox = ({
  value,
  options,
  placeholder = "Adicionar membro",
  onValueChange,
  onCommit,
  disabled = false,
}: ProjectMemberComboboxProps) => {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");

  const trimmedValue = String(value || "").trim();
  const normalizedValue = normalizeSearchValue(trimmedValue);

  const normalizedOptions = useMemo(() => {
    const seen = new Set<string>();
    const next: string[] = [];
    options.forEach((option) => {
      const trimmedOption = String(option || "").trim();
      const normalizedOption = normalizeSearchValue(trimmedOption);
      if (!trimmedOption || seen.has(normalizedOption)) {
        return;
      }
      seen.add(normalizedOption);
      next.push(trimmedOption);
    });
    return next;
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!normalizedValue) {
      return normalizedOptions;
    }
    return normalizedOptions.filter((option) => normalizeSearchValue(option).includes(normalizedValue));
  }, [normalizedOptions, normalizedValue]);

  const hasExactMatch = useMemo(
    () => normalizedOptions.some((option) => normalizeSearchValue(option) === normalizedValue),
    [normalizedOptions, normalizedValue],
  );

  const items = useMemo<ComboboxItem[]>(() => {
    const next: ComboboxItem[] = filteredOptions.map((option) => ({
      id: getOptionItemId(option),
      label: option,
      commitValue: option,
      keywords: [normalizeSearchValue(option)],
      icon: "option",
    }));

    if (trimmedValue && !hasExactMatch) {
      next.push({
        id: getCreateItemId(trimmedValue),
        label: `Adicionar "${trimmedValue}"`,
        commitValue: trimmedValue,
        keywords: [normalizedValue],
        icon: "create",
      });
    }

    return next;
  }, [filteredOptions, hasExactMatch, normalizedValue, trimmedValue]);

  useEffect(() => {
    if (!open) {
      setSelectedItemId("");
      return;
    }
    if (!items.length) {
      setSelectedItemId("");
      return;
    }

    const exactOption = items.find(
      (item) => item.icon === "option" && normalizeSearchValue(item.commitValue) === normalizedValue,
    );
    const preferredItemId = exactOption?.id || items[0]?.id || "";
    setSelectedItemId((current) =>
      current && items.some((item) => item.id === current) ? current : preferredItemId,
    );
  }, [items, normalizedValue, open]);

  useEffect(() => {
    if (!disabled) {
      return;
    }
    setOpen(false);
  }, [disabled]);

  const commitValue = useCallback(
    (nextValue?: string) => {
      const resolvedValue = String(nextValue ?? value).trim();
      if (!resolvedValue) {
        return;
      }
      onCommit(resolvedValue);
      setOpen(false);
    },
    [onCommit, value],
  );

  const moveSelection = useCallback(
    (direction: -1 | 1) => {
      if (!items.length) {
        return;
      }
      setOpen(true);
      setSelectedItemId((current) => {
        const currentIndex = items.findIndex((item) => item.id === current);
        const fallbackIndex = direction > 0 ? -1 : 0;
        const startIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
        const nextIndex = (startIndex + direction + items.length) % items.length;
        return items[nextIndex]?.id || items[0]?.id || "";
      });
    },
    [items],
  );

  const handleSelect = useCallback(
    (itemId: string) => {
      const selectedItem = items.find((item) => item.id === itemId);
      if (!selectedItem) {
        return;
      }
      commitValue(selectedItem.commitValue);
    },
    [commitValue, items],
  );

  const selectedDescendantId = selectedItemId ? `${listId}-${selectedItemId}` : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className="w-full">
          <div className="relative">
            <Input
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={open}
              aria-activedescendant={selectedDescendantId}
              value={value}
              onChange={(event) => {
                onValueChange(event.target.value);
                if (!disabled) {
                  setOpen(true);
                }
              }}
              onFocus={() => {
                if (!disabled) {
                  setOpen(true);
                }
              }}
              onClick={() => {
                if (!disabled) {
                  setOpen(true);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveSelection(1);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveSelection(-1);
                  return;
                }
                if (event.key === "Enter") {
                  const selectedItem = items.find((item) => item.id === selectedItemId);
                  if (!selectedItem && !trimmedValue) {
                    return;
                  }
                  event.preventDefault();
                  commitValue(selectedItem?.commitValue ?? trimmedValue);
                  return;
                }
                if (event.key === "Escape" && open) {
                  event.preventDefault();
                  setOpen(false);
                }
              }}
              placeholder={placeholder}
              disabled={disabled}
              className="pr-10"
            />
            <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
          </div>
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command
          shouldFilter={false}
          value={selectedItemId}
          onValueChange={setSelectedItemId}
          label="Sugestoes de membros"
        >
          <CommandList id={listId} role="listbox">
            {items.length ? null : <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>}
            {items.map((item) => (
              <CommandItem
                key={item.id}
                id={`${listId}-${item.id}`}
                value={item.id}
                keywords={item.keywords}
                role="option"
                aria-selected={selectedItemId === item.id}
                onSelect={handleSelect}
                className={cn(
                  "gap-2",
                  selectedItemId === item.id && "bg-accent text-accent-foreground",
                )}
              >
                {item.icon === "create" ? (
                  <Plus className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Check
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-opacity",
                      selectedItemId === item.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                )}
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ProjectMemberCombobox;
