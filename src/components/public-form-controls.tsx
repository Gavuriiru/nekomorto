import * as React from "react";

import { publicStrongFocusFieldClassName } from "@/components/public-page-tokens";
import { Combobox as BaseCombobox, type ComboboxProps } from "@/components/ui/combobox";
import { Input as BaseInput } from "@/components/ui/input";
import { Textarea as BaseTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PublicInputProps = React.ComponentPropsWithoutRef<typeof BaseInput>;
type PublicTextareaProps = React.ComponentPropsWithoutRef<typeof BaseTextarea>;
type PublicComboboxProps = ComboboxProps;

const Input = React.forwardRef<HTMLInputElement, PublicInputProps>(
  ({ className, ...props }, ref) => (
    <BaseInput ref={ref} className={cn(publicStrongFocusFieldClassName, className)} {...props} />
  ),
);
Input.displayName = "PublicInput";

const Textarea = React.forwardRef<HTMLTextAreaElement, PublicTextareaProps>(
  ({ className, ...props }, ref) => (
    <BaseTextarea ref={ref} className={cn(publicStrongFocusFieldClassName, className)} {...props} />
  ),
);
Textarea.displayName = "PublicTextarea";

const Combobox = ({ className, searchInputClassName, ...props }: PublicComboboxProps) => (
  <BaseCombobox
    className={cn(publicStrongFocusFieldClassName, className)}
    searchInputClassName={cn(publicStrongFocusFieldClassName, searchInputClassName)}
    {...props}
  />
);

export {
  Combobox,
  Input,
  Textarea,
};
