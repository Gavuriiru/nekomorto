import * as React from "react";

import { dashboardStrongFocusFieldClassName } from "@/components/dashboard/dashboard-page-tokens";
import { Combobox as BaseCombobox, type ComboboxProps } from "@/components/ui/combobox";
import { Input as BaseInput } from "@/components/ui/input";
import { Textarea as BaseTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type DashboardInputProps = React.ComponentPropsWithoutRef<typeof BaseInput>;
type DashboardTextareaProps = React.ComponentPropsWithoutRef<typeof BaseTextarea>;
type DashboardComboboxProps = ComboboxProps;

const Input = React.forwardRef<HTMLInputElement, DashboardInputProps>(
  ({ className, ...props }, ref) => (
    <BaseInput ref={ref} className={cn(dashboardStrongFocusFieldClassName, className)} {...props} />
  ),
);
Input.displayName = "DashboardInput";

const Textarea = React.forwardRef<HTMLTextAreaElement, DashboardTextareaProps>(
  ({ className, ...props }, ref) => (
    <BaseTextarea
      ref={ref}
      className={cn(dashboardStrongFocusFieldClassName, className)}
      {...props}
    />
  ),
);
Textarea.displayName = "DashboardTextarea";

const Combobox = ({ className, searchInputClassName, ...props }: DashboardComboboxProps) => (
  <BaseCombobox
    className={cn(dashboardStrongFocusFieldClassName, className)}
    searchInputClassName={cn(dashboardStrongFocusFieldClassName, searchInputClassName)}
    {...props}
  />
);

export { Combobox, Input, Textarea };
