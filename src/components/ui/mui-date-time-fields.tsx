import { DateField, LocalizationProvider, TimeField } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { ptBR } from "date-fns/locale";
import type { ReactNode } from "react";

type MuiFieldBaseProps = {
  id?: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  disabled?: boolean;
  className?: string;
};

const normalizeDate = (value: Date | null): Date | null => {
  if (!value) {
    return null;
  }
  return Number.isNaN(value.getTime()) ? null : value;
};

const muiDateTimeFieldEditorClassName = "mui-date-time-field--editor";
const muiDateTimeFieldDashboardFilterClassName = "mui-date-time-field--dashboard-filter";
const muiFieldRootSelector =
  "& .MuiPickersInputBase-root, & .MuiPickersOutlinedInput-root, & .MuiOutlinedInput-root";
const muiFieldOutlineSelector =
  "& .MuiPickersOutlinedInput-notchedOutline, & .MuiOutlinedInput-notchedOutline";

const muiTextFieldSx = {
  minWidth: 0,
  [muiFieldRootSelector]: {
    minWidth: 0,
    minHeight: "2.5rem",
    borderRadius: "calc(var(--radius) - 2px)",
    overflow: "hidden",
    backgroundColor: "hsl(var(--background))",
    color: "hsl(var(--foreground))",
    fontFamily: "inherit",
    fontSize: "1rem",
    lineHeight: "1.5rem",
    transition: "border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease",
    "@media (min-width:768px)": {
      fontSize: "0.875rem",
    },
    [muiFieldOutlineSelector]: {
      borderColor: "hsl(var(--input))",
      borderRadius: "calc(var(--radius) - 2px)",
    },
    "& fieldset, & legend": {
      borderRadius: "calc(var(--radius) - 2px)",
    },
    "&:hover .MuiPickersOutlinedInput-notchedOutline, &:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "hsl(var(--input))",
    },
    "&.Mui-focused .MuiPickersOutlinedInput-notchedOutline, &.Mui-focused .MuiOutlinedInput-notchedOutline":
      {
        borderColor: "hsl(var(--primary))",
        borderWidth: "1px",
      },
    "&.Mui-disabled": {
      backgroundColor: "hsl(var(--background))",
      color: "hsl(var(--muted-foreground) / 0.72)",
      cursor: "not-allowed",
    },
    "&.Mui-disabled .MuiPickersOutlinedInput-notchedOutline, &.Mui-disabled .MuiOutlinedInput-notchedOutline":
      {
        borderColor: "hsl(var(--input))",
      },
  },
  "& .MuiPickersSectionList-root": {
    minWidth: 0,
    width: "100%",
    minHeight: "calc(2.5rem - 2px)",
    alignItems: "center",
    color: "inherit",
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit",
    padding: 0,
  },
  [`&.${muiDateTimeFieldDashboardFilterClassName} ${muiFieldRootSelector.replaceAll("& ", "")}`]: {
    minHeight: "2.75rem",
    borderRadius: "0.75rem",
    backgroundColor: "hsl(var(--background) / 0.6)",
    [muiFieldOutlineSelector]: {
      borderColor: "hsl(var(--border) / 0.6)",
      borderRadius: "0.75rem",
    },
    "& fieldset, & legend": {
      borderRadius: "0.75rem",
    },
  },
  [`&.${muiDateTimeFieldDashboardFilterClassName} .MuiPickersSectionList-root`]: {
    minHeight: "calc(2.75rem - 2px)",
  },
  [`&.${muiDateTimeFieldEditorClassName} ${muiFieldRootSelector.replaceAll("& ", "")}`]: {
    minHeight: "2.5rem",
  },
  [`&.${muiDateTimeFieldEditorClassName} .MuiPickersSectionList-root`]: {
    minHeight: "calc(2.5rem - 2px)",
  },
  "& .MuiPickersSectionList-section, & .MuiPickersSectionList-sectionContent, & .MuiPickersInputBase-sectionContent":
    {
      color: "hsl(var(--foreground))",
      fontFamily: "inherit",
      fontSize: "inherit",
      lineHeight: "inherit",
      letterSpacing: "inherit",
      outline: "none",
      WebkitTextFillColor: "hsl(var(--foreground))",
    },
  "& .MuiPickersSectionList-root::selection, & .MuiPickersSectionList-sectionContent::selection, & .MuiPickersInputBase-sectionContent::selection":
    {
      backgroundColor: "hsl(var(--primary) / 0.22)",
      color: "hsl(var(--foreground))",
      WebkitTextFillColor: "hsl(var(--foreground))",
    },
  "& .MuiPickersSectionList-root::-moz-selection, & .MuiPickersSectionList-sectionContent::-moz-selection, & .MuiPickersInputBase-sectionContent::-moz-selection":
    {
      backgroundColor: "hsl(var(--primary) / 0.22)",
      color: "hsl(var(--foreground))",
    },
  "& .MuiPickersInputBase-root.Mui-disabled .MuiPickersSectionList-section, & .MuiPickersInputBase-root.Mui-disabled .MuiPickersSectionList-sectionContent, & .MuiPickersInputBase-root.Mui-disabled .MuiPickersInputBase-sectionContent":
    {
      color: "hsl(var(--muted-foreground) / 0.72)",
      WebkitTextFillColor: "hsl(var(--muted-foreground) / 0.72)",
    },
  "& .MuiInputBase-input, & .MuiPickersInputBase-input": {
    color: "hsl(var(--foreground))",
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit",
    "&::placeholder": {
      color: "hsl(var(--muted-foreground))",
      opacity: 1,
    },
    "&.Mui-disabled": {
      color: "hsl(var(--muted-foreground) / 0.72)",
      opacity: 1,
      WebkitTextFillColor: "hsl(var(--muted-foreground) / 0.72)",
    },
  },
  "& .MuiSvgIcon-root": {
    color: "hsl(var(--muted-foreground))",
  },
  "& .MuiInputAdornment-root .MuiIconButton-root, & .MuiPickersInputAdornment-root .MuiIconButton-root":
    {
      color: "hsl(var(--muted-foreground))",
    },
  "& .MuiPickersInputBase-root.Mui-disabled .MuiSvgIcon-root, & .MuiOutlinedInput-root.Mui-disabled .MuiSvgIcon-root":
    {
      color: "hsl(var(--muted-foreground))",
    },
  "& .MuiPickersInputBase-root.Mui-disabled .MuiInputAdornment-root .MuiIconButton-root, & .MuiOutlinedInput-root.Mui-disabled .MuiInputAdornment-root .MuiIconButton-root, & .MuiPickersInputBase-root.Mui-disabled .MuiPickersInputAdornment-root .MuiIconButton-root":
    {
      color: "hsl(var(--muted-foreground))",
    },
} as const;

export const MuiDateTimeFieldsProvider = ({ children }: { children: ReactNode }) => (
  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
    {children}
  </LocalizationProvider>
);

export const MuiBrazilDateField = ({
  id,
  value,
  onChange,
  disabled,
  className,
}: MuiFieldBaseProps) => (
  <DateField
    id={id}
    value={value}
    onChange={(nextValue) => onChange(normalizeDate(nextValue))}
    format="dd/MM/yyyy"
    disabled={disabled}
    slotProps={{
      textField: {
        fullWidth: true,
        size: "small",
        variant: "outlined",
        className,
        sx: muiTextFieldSx,
      },
    }}
  />
);

export const MuiBrazilTimeField = ({
  id,
  value,
  onChange,
  disabled,
  className,
}: MuiFieldBaseProps) => (
  <TimeField
    id={id}
    value={value}
    onChange={(nextValue) => onChange(normalizeDate(nextValue))}
    format="HH:mm"
    ampm={false}
    disabled={disabled}
    slotProps={{
      textField: {
        fullWidth: true,
        size: "small",
        variant: "outlined",
        className,
        sx: muiTextFieldSx,
      },
    }}
  />
);
