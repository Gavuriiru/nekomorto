import * as React from "react";

import { dashboardStrongFocusFieldClassName } from "@/components/dashboard/dashboard-page-tokens";
import { Input as BaseInput } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger as BaseSelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea as BaseTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type DashboardInputProps = React.ComponentPropsWithoutRef<typeof BaseInput>;
type DashboardTextareaProps = React.ComponentPropsWithoutRef<typeof BaseTextarea>;
type DashboardSelectTriggerProps = React.ComponentPropsWithoutRef<typeof BaseSelectTrigger>;

const Input = React.forwardRef<HTMLInputElement, DashboardInputProps>(({ className, ...props }, ref) => (
  <BaseInput
    ref={ref}
    className={cn(dashboardStrongFocusFieldClassName, className)}
    {...props}
  />
));
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

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof BaseSelectTrigger>,
  DashboardSelectTriggerProps
>(({ className, ...props }, ref) => (
  <BaseSelectTrigger
    ref={ref}
    className={cn(dashboardStrongFocusFieldClassName, className)}
    {...props}
  />
));
SelectTrigger.displayName = "DashboardSelectTrigger";

export { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea };
