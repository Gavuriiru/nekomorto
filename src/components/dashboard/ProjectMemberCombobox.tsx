import { useMemo } from "react";

import { Combobox } from "@/components/dashboard/dashboard-form-controls";

type ProjectMemberComboboxProps = {
  value: string;
  options: string[];
  excludedValues?: string[];
  placeholder?: string;
  onValueChange: (value: string) => void;
  onCommit: (value: string) => void;
  disabled?: boolean;
};

const normalizeSearchValue = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const ProjectMemberCombobox = ({
  value,
  options,
  excludedValues = [],
  placeholder = "Adicionar membro",
  onValueChange,
  onCommit,
  disabled = false,
}: ProjectMemberComboboxProps) => {
  const excludedOptions = useMemo(
    () => new Set(excludedValues.map((option) => normalizeSearchValue(option))),
    [excludedValues],
  );

  const normalizedOptions = useMemo(() => {
    const seen = new Set<string>();
    const next: Array<{
      value: string;
      label: string;
      keywords: string[];
      searchText: string;
    }> = [];

    options.forEach((option) => {
      const trimmedOption = String(option || "").trim();
      const normalizedOption = normalizeSearchValue(trimmedOption);
      if (!trimmedOption || seen.has(normalizedOption) || excludedOptions.has(normalizedOption)) {
        return;
      }

      seen.add(normalizedOption);
      next.push({
        value: trimmedOption,
        label: trimmedOption,
        keywords: [normalizedOption],
        searchText: normalizedOption,
      });
    });

    return next;
  }, [excludedOptions, options]);

  const normalizedInput = normalizeSearchValue(value);
  const canCreateValue = !normalizedInput || !excludedOptions.has(normalizedInput);

  return (
    <Combobox
      ariaLabel={placeholder}
      listAriaLabel="Sugestões de membros"
      searchInputAriaLabel="Buscar membro"
      value={value}
      inputValue={value}
      onInputValueChange={onValueChange}
      onValueChange={onCommit}
      options={normalizedOptions}
      placeholder={placeholder}
      disabled={disabled}
      searchable
      allowCreate={canCreateValue}
      emptyMessage="Nenhum membro encontrado."
      createLabel={(nextValue) => `Adicionar "${nextValue}"`}
    />
  );
};

export default ProjectMemberCombobox;
