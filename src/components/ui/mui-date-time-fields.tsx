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

const muiTextFieldSx = {
  "& .MuiOutlinedInput-root": {
    height: "2.5rem",
    borderRadius: "var(--radius)",
    overflow: "hidden",
    backgroundColor: "hsl(var(--background))",
    color: "hsl(var(--foreground))",
    fontSize: "0.875rem",
    transition: "box-shadow 0.2s ease",
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "hsl(var(--input))",
      borderRadius: "var(--radius)",
    },
    "& fieldset": {
      borderRadius: "var(--radius)",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "hsl(var(--input))",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "hsl(var(--primary))",
      borderWidth: "1px",
    },
    "&.Mui-disabled": {
      backgroundColor: "hsl(var(--background))",
      color: "hsl(var(--muted-foreground))",
      cursor: "not-allowed",
    },
    "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
      borderColor: "hsl(var(--input))",
    },
  },
  "& .MuiInputBase-input": {
    color: "hsl(var(--foreground))",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
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
  "& .MuiInputAdornment-root .MuiIconButton-root": {
    color: "hsl(var(--muted-foreground))",
  },
  "& .MuiOutlinedInput-root.Mui-disabled .MuiSvgIcon-root": {
    color: "hsl(var(--muted-foreground))",
  },
  "& .MuiOutlinedInput-root.Mui-disabled .MuiInputAdornment-root .MuiIconButton-root": {
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
        variant: "outlined",
        className,
        sx: muiTextFieldSx,
      },
    }}
  />
);
